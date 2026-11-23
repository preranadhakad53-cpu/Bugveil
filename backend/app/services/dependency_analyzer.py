import os
import re
from typing import Dict, List, Set, Any, Optional
from app.services.language_detector import is_binary_or_ignored_file


# Regex patterns for imports
PY_IMPORT_RE = re.compile(r"^(?:from\s+([a-zA-Z0-9_\.]+)\s+import|import\s+([a-zA-Z0-9_\.,\s]+))", re.MULTILINE)
JS_IMPORT_RE = re.compile(r"""(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))""", re.MULTILINE)

# Regex patterns for function/class definitions
PY_FUNC_RE = re.compile(r"^\s*def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", re.MULTILINE)
PY_CLASS_RE = re.compile(r"^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*[:\(]", re.MULTILINE)
JS_FUNC_RE = re.compile(r"(?:function\s+([a-zA-Z_][a-zA-Z0-9_]*)|(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)", re.MULTILINE)
JS_CLASS_RE = re.compile(r"^\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE)


class DependencyGraph:
    """
    Analyzes static imports, symbol definitions, and caller relationships
    across multi-language codebases without external dependencies.
    """

    def __init__(self, repo_dir: str):
        self.repo_dir = os.path.abspath(repo_dir)
        # file_path -> list of relative files or modules it imports
        self.imports: Dict[str, List[str]] = {}
        # file_path -> list of files that import this file
        self.dependents: Dict[str, List[str]] = {}
        # symbol_name -> list of {"file": path, "line": int, "type": "func"|"class"}
        self.definitions: Dict[str, List[Dict[str, Any]]] = {}
        # file_path -> list of symbols defined in it
        self.file_symbols: Dict[str, List[str]] = {}
        # All known source files relative to repo_dir
        self.all_files: List[str] = []

        self._build_graph()

    def _build_graph(self):
        if not os.path.exists(self.repo_dir):
            return

        file_contents: Dict[str, str] = {}

        for root, dirs, files in os.walk(self.repo_dir):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in (
                "node_modules", "dist", "build", "venv", ".venv", "__pycache__"
            )]

            for f in files:
                abs_path = os.path.join(root, f)
                rel_path = os.path.relpath(abs_path, self.repo_dir).replace("\\", "/")

                if is_binary_or_ignored_file(abs_path, f):
                    continue

                self.all_files.append(rel_path)
                try:
                    with open(abs_path, "r", encoding="utf-8", errors="ignore") as fp:
                        content = fp.read()
                        file_contents[rel_path] = content
                except Exception:
                    continue

        # Parse definitions and imports
        for rel_path, content in file_contents.items():
            self.imports[rel_path] = []
            self.file_symbols[rel_path] = []

            # 1. Parse Python symbols & imports
            if rel_path.endswith((".py", ".pyi")):
                for m in PY_FUNC_RE.finditer(content):
                    sym = m.group(1)
                    line = content[:m.start()].count("\n") + 1
                    self._add_def(sym, rel_path, line, "function")
                for m in PY_CLASS_RE.finditer(content):
                    sym = m.group(1)
                    line = content[:m.start()].count("\n") + 1
                    self._add_def(sym, rel_path, line, "class")

                for m in PY_IMPORT_RE.finditer(content):
                    mod1, mod2 = m.group(1), m.group(2)
                    raw_mod = (mod1 or mod2 or "").strip()
                    target_file = self._resolve_py_module(raw_mod, rel_path)
                    if target_file and target_file != rel_path:
                        self.imports[rel_path].append(target_file)

            # 2. Parse JS / TS symbols & imports
            elif rel_path.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs")):
                for m in JS_FUNC_RE.finditer(content):
                    sym = m.group(1) or m.group(2)
                    if sym:
                        line = content[:m.start()].count("\n") + 1
                        self._add_def(sym, rel_path, line, "function")
                for m in JS_CLASS_RE.finditer(content):
                    sym = m.group(1)
                    line = content[:m.start()].count("\n") + 1
                    self._add_def(sym, rel_path, line, "class")

                for m in JS_IMPORT_RE.finditer(content):
                    target_spec = m.group(1) or m.group(2)
                    target_file = self._resolve_js_module(target_spec, rel_path)
                    if target_file and target_file != rel_path:
                        self.imports[rel_path].append(target_file)

        # De-duplicate imports
        for f in self.imports:
            self.imports[f] = sorted(list(set(self.imports[f])))

        # Compute reverse dependents mapping
        for f in self.all_files:
            self.dependents[f] = []

        for source_file, imported_list in self.imports.items():
            for imp in imported_list:
                if imp in self.dependents:
                    self.dependents[imp].append(source_file)

        for f in self.dependents:
            self.dependents[f] = sorted(list(set(self.dependents[f])))

    def _add_def(self, symbol: str, file_path: str, line: int, kind: str):
        if symbol not in self.definitions:
            self.definitions[symbol] = []
        self.definitions[symbol].append({"file": file_path, "line": line, "type": kind})
        self.file_symbols[file_path].append(symbol)

    def _resolve_py_module(self, mod_name: str, current_file: str) -> Optional[str]:
        # Handle relative imports e.g. .auth or app.models
        clean = mod_name.split(",")[0].strip()
        parts = clean.replace(".", "/").split("/")
        
        # Check direct candidate
        candidate = f"{'/'.join(parts)}.py"
        for f in self.all_files:
            if f.endswith(candidate) or f == candidate:
                return f

        # Try package __init__.py
        init_cand = f"{'/'.join(parts)}/__init__.py"
        for f in self.all_files:
            if f.endswith(init_cand):
                return f
        return None

    def _resolve_js_module(self, spec: str, current_file: str) -> Optional[str]:
        if not spec.startswith("."):
            return None  # External npm package
        
        current_dir = os.path.dirname(current_file)
        target_norm = os.path.normpath(os.path.join(current_dir, spec)).replace("\\", "/")

        # Try extensions
        for ext in ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"]:
            candidate = f"{target_norm}{ext}"
            if candidate in self.all_files:
                return candidate
        return None

    def compute_impact(self, modified_files: List[str], modified_symbols: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Calculates direct dependents, transitive blast radius, and callers
        for the given modified files and symbols.
        """
        direct_dependents: Set[str] = set()
        for mf in modified_files:
            mf_clean = mf.replace("\\", "/").lstrip("/")
            # Match exact or suffix
            for k, deps in self.dependents.items():
                if k == mf_clean or k.endswith(mf_clean):
                    direct_dependents.update(deps)

        # Transitive blast radius (2 levels deep)
        transitive_dependents: Set[str] = set(direct_dependents)
        for dep in list(direct_dependents):
            if dep in self.dependents:
                transitive_dependents.update(self.dependents[dep])

        # Symbol callers
        affected_callers: List[Dict[str, Any]] = []
        target_syms = set(modified_symbols or [])
        
        if not target_syms:
            # If no symbols given, extract all symbols in modified files
            for mf in modified_files:
                for k, syms in self.file_symbols.items():
                    if k == mf or k.endswith(mf):
                        target_syms.update(syms[:10])

        for sym in list(target_syms)[:15]:
            if sym in self.definitions:
                for d in self.definitions[sym]:
                    affected_callers.append({
                        "symbol": sym,
                        "defined_in": d["file"],
                        "line": d["line"],
                        "type": d["type"]
                    })

        total_affected = len(transitive_dependents)
        if total_affected == 0:
            impact_level = "ISOLATED"
            summary = "Changes are isolated to the modified files with no internal dependents detected."
        elif total_affected <= 3:
            impact_level = "MODERATE"
            summary = f"Affects {total_affected} dependent module(s): {', '.join(sorted(list(transitive_dependents))[:3])}."
        else:
            impact_level = "HIGH"
            summary = f"Broad blast radius affecting {total_affected} modules across the codebase. Downstream verification required."

        return {
            "impact_level": impact_level,
            "summary": summary,
            "modified_files": modified_files,
            "direct_dependents": sorted(list(direct_dependents)),
            "transitive_dependents": sorted(list(transitive_dependents)),
            "affected_callers": affected_callers,
            "total_impacted_modules": total_affected,
        }

    def get_graph_data(self) -> Dict[str, Any]:
        """Returns nodes and edges formatted for visual graph rendering."""
        nodes = []
        edges = []

        for f in self.all_files[:100]:  # Cap at 100 files for graph performance
            nodes.append({
                "id": f,
                "label": os.path.basename(f),
                "path": f,
                "symbols_count": len(self.file_symbols.get(f, [])),
                "in_degree": len(self.dependents.get(f, [])),
                "out_degree": len(self.imports.get(f, [])),
            })

        for src, targets in self.imports.items():
            if src in self.all_files[:100]:
                for tgt in targets:
                    if tgt in self.all_files[:100]:
                        edges.append({
                            "source": src,
                            "target": tgt,
                            "id": f"{src}->{tgt}",
                        })

        return {"nodes": nodes, "edges": edges, "total_files": len(self.all_files)}
