import os
import re
from pathlib import Path
from fastapi import HTTPException, status

# Permitted public git repository URL regex
GITHUB_URL_REGEX = re.compile(
    r"^https://github\.com/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\.git)?/?$"
)

# Forbidden directory and file patterns that must never be traversed or served
FORBIDDEN_DIR_NAMES = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "__pycache__",
    ".venv",
    "venv",
    "vendor",
    ".env",
}


def validate_github_url(url: str) -> bool:
    """
    Validate that the repository URL is a legitimate public GitHub repository URL.
    Blocks SSRF, internal IP addresses, local files, and unsupported protocols.
    """
    if not url:
        return False
    return bool(GITHUB_URL_REGEX.match(url.strip()))


def is_safe_relative_path(base_dir: str, target_path: str) -> bool:
    """
    Ensure the resolved target_path is strictly within base_dir (prevent Zip Slip / Path Traversal).
    """
    base = Path(base_dir).resolve()
    target = (base / target_path).resolve()
    try:
        target.relative_to(base)
        return True
    except ValueError:
        return False


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing path separators and suspicious characters.
    """
    clean_name = os.path.basename(filename)
    clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", clean_name)
    return clean_name


def sanitize_api_secrets(text: str, configured_key: str = "") -> str:
    """
    Ensure API keys, bearer tokens, and credentials NEVER leak into logs, errors, or responses.
    """
    if not text:
        return ""
    
    # Redact configured key if present and not default placeholder
    if configured_key and configured_key != "your_groq_api_key_here" and len(configured_key) > 5:
        text = text.replace(configured_key, "[REDACTED_API_KEY]")
    
    # Redact standard Groq API key patterns (gsk_...)
    text = re.sub(r"gsk_[a-zA-Z0-9]{20,}", "[REDACTED_GROQ_KEY]", text)
    
    # Redact Authorization: Bearer tokens
    text = re.sub(r"(Bearer\s+)[a-zA-Z0-9_\-\.]{15,}", r"\1[REDACTED_TOKEN]", text, flags=re.IGNORECASE)
    
    return text
