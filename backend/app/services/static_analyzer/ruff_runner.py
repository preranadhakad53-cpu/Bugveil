import os
import sys
import json
import shutil
import asyncio
from typing import List, Optional
from app.services.static_analyzer.base import BaseStaticRunner
from app.services.static_analyzer.models import NormalizedFindingData


def get_snippet(file_path: str, line_start: int, line_end: int, context_lines: int = 2) -> Optional[str]:
    """Safely extracts line range with context from file."""
    if not os.path.isfile(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        
        start_idx = max(0, line_start - 1 - context_lines)
        end_idx = min(len(all_lines), line_end + context_lines)
        return "".join(all_lines[start_idx:end_idx]).strip("\n")
    except Exception:
        return None


class RuffRunner(BaseStaticRunner):
    @property
    def tool_name(self) -> str:
        return "RUFF"

    def _get_executable(self) -> Optional[str]:
        # Check venv first
        venv_bin = os.path.join(sys.prefix, "Scripts" if os.name == "nt" else "bin", "ruff.exe" if os.name == "nt" else "ruff")
        if os.path.isfile(venv_bin):
            return venv_bin
        return shutil.which("ruff")

    def is_available(self) -> bool:
        return self._get_executable() is not None

    async def run(self, repo_dir: str) -> List[NormalizedFindingData]:
        exe = self._get_executable()
        if not exe or not os.path.exists(repo_dir):
            return []

        # Run ruff check with JSON output
        cmd = [
            exe,
            "check",
            "--output-format=json",
            "--select=E,F,B,S,A,W",
            "--isolated",
            repo_dir,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            output_str = stdout.decode("utf-8", errors="replace")
            
            if not output_str.strip():
                return []

            raw_issues = json.loads(output_str)
        except Exception:
            return []

        findings: List[NormalizedFindingData] = []
        for issue in raw_issues:
            code = issue.get("code", "RUFF")
            message = issue.get("message", "Lint issue detected")
            abs_filename = issue.get("filename", "")
            rel_file = os.path.relpath(abs_filename, repo_dir).replace("\\", "/")

            loc = issue.get("location", {})
            end_loc = issue.get("end_location", {})
            line_start = loc.get("row", 1)
            line_end = end_loc.get("row", line_start)

            # Categorize severity & category
            if code.startswith("S"):
                category = "SECURITY"
                severity = "HIGH"
                why_it_matters = "Security risk flagged by static rule check. May introduce vulnerabilities into runtime."
            elif code.startswith("E9") or code in ("F821", "F822", "F823"):
                category = "BUG"
                severity = "HIGH"
                why_it_matters = "Probable runtime exception or syntax error that will cause unexpected crashes."
            elif code.startswith("B"):
                category = "BUG"
                severity = "MEDIUM"
                why_it_matters = "Known anti-pattern likely to cause subtle bugs or logic regressions."
            elif code in ("F401", "F841"):
                category = "QUALITY"
                severity = "LOW"
                why_it_matters = "Unused symbols clutter the codebase and increase cognitive overhead."
            else:
                category = "QUALITY"
                severity = "LOW"
                why_it_matters = "Violation of code quality and maintainability best practices."

            # Fix recommendation
            fix_obj = issue.get("fix")
            suggested_fix = fix_obj.get("message") if fix_obj else f"Review rule {code} and adjust logic according to PEP-8 standards."

            snippet = get_snippet(abs_filename, line_start, line_end)

            findings.append(
                NormalizedFindingData(
                    title=f"[{code}] {message}",
                    severity=severity,
                    category=category,
                    source="RUFF",
                    file_path=rel_file,
                    line_start=line_start,
                    line_end=line_end,
                    code_snippet=snippet,
                    explanation=f"Ruff detected rule {code}: {message}. File: {rel_file}:{line_start}",
                    why_it_matters=why_it_matters,
                    suggested_fix=suggested_fix,
                    confidence=0.95
                )
            )

        return findings
