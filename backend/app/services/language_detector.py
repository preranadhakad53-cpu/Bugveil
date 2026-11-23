import os
from typing import Dict, Optional, Tuple

EXTENSION_TO_LANGUAGE: Dict[str, str] = {
    ".py": "Python",
    ".pyi": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".c": "C",
    ".h": "C/C++ Header",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".hpp": "C++ Header",
    ".cs": "C#",
    ".rb": "Ruby",
    ".php": "PHP",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".ps1": "PowerShell",
    ".sql": "SQL",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".xml": "XML",
    ".md": "Markdown",
    ".markdown": "Markdown",
    ".rst": "reStructuredText",
    ".dockerfile": "Dockerfile",
}

SPECIAL_FILENAMES: Dict[str, str] = {
    "dockerfile": "Dockerfile",
    "makefile": "Makefile",
    "cmakelists.txt": "CMake",
    "gemfile": "Ruby",
    "rakefile": "Ruby",
    "vagrantfile": "Ruby",
}

BINARY_EXTENSIONS = {
    ".exe", ".dll", ".so", ".dylib", ".bin", ".iso", ".img", ".dmg", ".msi",
    ".pyc", ".pyo", ".pyd", ".class", ".jar", ".war", ".ear", ".o", ".obj",
    ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar",
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".mp4", ".mp3", ".wav",
    ".pdf", ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".sqlite", ".sqlite3", ".db",
    ".map",
}

IGNORE_DIRECTORIES = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "vendor",
    ".idea",
    ".vscode",
    "coverage",
    ".next",
    ".nuxt",
    ".cache",
    ".pytest_cache",
    ".ruff_cache",
}

IGNORE_FILES = {
    ".ds_store",
    "thumbs.db",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "gemfile.lock",
}


def is_ignored_directory(dir_name: str) -> bool:
    """Check if a directory should be skipped during repository scanning."""
    return dir_name.lower() in IGNORE_DIRECTORIES or dir_name.startswith(".")


def is_binary_or_ignored_file(file_path: str, filename: str) -> bool:
    """
    Check if a file is binary, minified, or in the ignore list.
    """
    lower_name = filename.lower()
    if lower_name in IGNORE_FILES:
        return True
    
    # Sensitive or dot files (except special allowed ones like Dockerfile)
    if lower_name.startswith(".env") or lower_name.endswith(".key") or lower_name.endswith(".pem"):
        return True

    # Check extension
    _, ext = os.path.splitext(lower_name)
    if ext in BINARY_EXTENSIONS:
        return True

    # Check minified files
    if lower_name.endswith(".min.js") or lower_name.endswith(".min.css"):
        return True

    # Inspect first 1024 bytes for null character
    if os.path.exists(file_path):
        try:
            with open(file_path, "rb") as f:
                chunk = f.read(1024)
                if b"\x00" in chunk:
                    return True
        except Exception:
            return True

    return False


def detect_file_language(filename: str) -> Optional[str]:
    """Detect language based on filename or extension."""
    lower_name = filename.lower()
    if lower_name in SPECIAL_FILENAMES:
        return SPECIAL_FILENAMES[lower_name]

    _, ext = os.path.splitext(lower_name)
    return EXTENSION_TO_LANGUAGE.get(ext)
