import os
from typing import Dict, List, Any, Tuple, Optional
from app.services.language_detector import (
    is_ignored_directory,
    is_binary_or_ignored_file,
    detect_file_language,
)


class FileTreeNode:
    def __init__(self, name: str, path: str, node_type: str, size: int = 0, language: Optional[str] = None, line_count: int = 0):
        self.name = name
        self.path = path.replace("\\", "/")
        self.type = node_type  # "directory" or "file"
        self.size = size
        self.language = language
        self.line_count = line_count
        self.children: List[FileTreeNode] = []

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "name": self.name,
            "path": self.path,
            "type": self.type,
            "size": self.size,
        }
        if self.type == "file":
            result["language"] = self.language
            result["line_count"] = self.line_count
        else:
            result["children"] = [child.to_dict() for child in self.children]
        return result


def count_file_lines(file_path: str) -> int:
    """Safely count lines in a text file."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return sum(1 for _ in f)
    except Exception:
        return 0


def build_repository_file_tree(root_dir: str) -> Tuple[Dict[str, Any], int, int, Optional[str], Dict[str, float]]:
    """
    Recursively scans the root directory, ignores binary & vendor files,
    constructs a hierarchical file tree, and computes language statistics.

    Returns:
        (tree_dict, total_files, total_bytes, primary_language, language_distribution)
    """
    total_files = 0
    total_bytes = 0
    language_bytes: Dict[str, int] = {}

    def scan_dir(current_dir: str, rel_path: str) -> Optional[FileTreeNode]:
        nonlocal total_files, total_bytes
        dir_name = os.path.basename(current_dir) if rel_path else "root"
        node = FileTreeNode(name=dir_name, path=rel_path, node_type="directory")

        try:
            entries = sorted(os.scandir(current_dir), key=lambda e: (not e.is_dir(), e.name.lower()))
        except Exception:
            return None

        for entry in entries:
            child_rel_path = os.path.join(rel_path, entry.name).replace("\\", "/") if rel_path else entry.name

            if entry.is_dir(follow_symlinks=False):
                if is_ignored_directory(entry.name):
                    continue
                child_node = scan_dir(entry.path, child_rel_path)
                if child_node and (child_node.children or child_node.type == "file"):
                    node.children.append(child_node)
            elif entry.is_file(follow_symlinks=False):
                if is_binary_or_ignored_file(entry.path, entry.name):
                    continue

                try:
                    stat = entry.stat()
                    file_size = stat.st_size
                except Exception:
                    continue

                lang = detect_file_language(entry.name)
                lines = count_file_lines(entry.path)

                total_files += 1
                total_bytes += file_size
                if lang:
                    language_bytes[lang] = language_bytes.get(lang, 0) + file_size

                file_node = FileTreeNode(
                    name=entry.name,
                    path=child_rel_path,
                    node_type="file",
                    size=file_size,
                    language=lang,
                    line_count=lines
                )
                node.children.append(file_node)

        return node

    root_node = scan_dir(root_dir, "")
    tree_dict = root_node.to_dict() if root_node else {"name": "root", "path": "", "type": "directory", "children": []}

    # Compute language distribution
    distribution: Dict[str, float] = {}
    total_lang_bytes = sum(language_bytes.values())
    primary_language = None

    if total_lang_bytes > 0:
        sorted_langs = sorted(language_bytes.items(), key=lambda item: item[1], reverse=True)
        primary_language = sorted_langs[0][0]
        for lang, byte_count in sorted_langs:
            percentage = round((byte_count / total_lang_bytes) * 100.0, 1)
            distribution[lang] = percentage

    return tree_dict, total_files, total_bytes, primary_language, distribution
