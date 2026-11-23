import os
import re
from typing import List, Dict, Any, Tuple
from app.services.static_analyzer.base import BaseStaticRunner
from app.services.static_analyzer.models import NormalizedFindingData
from app.services.language_detector import is_binary_or_ignored_file

# Polyglot Security Detection Rules
SECURITY_RULES: List[Dict[str, Any]] = [
    {
        "id": "SEC-001",
        "title": "Hardcoded AWS Access Key",
        "regex": re.compile(r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}"),
        "severity": "CRITICAL",
        "category": "SECURITY",
        "why_it_matters": "Exposing AWS access keys in source code allows adversaries to take over cloud infrastructure and exfiltrate sensitive data.",
        "suggested_fix": "Immediately rotate the exposed AWS key and store credentials in environment variables or AWS Secrets Manager.",
    },
    {
        "id": "SEC-002",
        "title": "Hardcoded Private Cryptographic Key",
        "regex": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
        "severity": "CRITICAL",
        "category": "SECURITY",
        "why_it_matters": "Leaked private keys compromise TLS communication, SSH authentication, and digital signatures.",
        "suggested_fix": "Remove the private key from source control, revoke the certificate/key pair, and use a secure key vault.",
    },
    {
        "id": "SEC-003",
        "title": "Hardcoded Database Connection URI with Password",
        "regex": re.compile(r"(?:postgres(?:ql)?|mysql|mongodb|redis)://(?:[^:\s'\"`]+):(?:[^@\s'\"`]+)@"),
        "severity": "CRITICAL",
        "category": "SECURITY",
        "why_it_matters": "Hardcoded database credentials can lead to complete database compromise and ransomware attacks.",
        "suggested_fix": "Extract database connection strings into environment variables (e.g., DATABASE_URL).",
    },
    {
        "id": "SEC-004",
        "title": "Dangerous eval() Code Execution",
        "regex": re.compile(r"\beval\s*\((?!\s*['\"][^'\"]*['\"]\s*\))"),
        "severity": "HIGH",
        "category": "SECURITY",
        "why_it_matters": "eval() executes untrusted string input as code, leading directly to Remote Code Execution (RCE) or XSS.",
        "suggested_fix": "Refactor logic to use safe parsers (e.g. JSON.parse() or ast.literal_eval()) instead of eval().",
    },
    {
        "id": "SEC-005",
        "title": "Insecure React dangerouslySetInnerHTML Usage",
        "regex": re.compile(r"dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:"),
        "severity": "HIGH",
        "category": "SECURITY",
        "why_it_matters": "Injecting unsanitized HTML into the DOM bypasses React's XSS protections and enables Cross-Site Scripting.",
        "suggested_fix": "Sanitize HTML using DOMPurify before injection, or render standard JSX components instead of raw HTML.",
    },
    {
        "id": "SEC-006",
        "title": "Hardcoded Generic API Key / Token",
        "regex": re.compile(r"(?:api[_-]?key|auth[_-]?token|secret[_-]?key)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{24,}['\"]", re.IGNORECASE),
        "severity": "HIGH",
        "category": "SECURITY",
        "why_it_matters": "Exposed API tokens permit unauthorized access to third-party services, data leakage, and financial theft.",
        "suggested_fix": "Load tokens from server-side environment variables or secret vaults. Never commit secrets to repositories.",
    },
    {
        "id": "SEC-007",
        "title": "Insecure Weak Hashing Algorithm (MD5/SHA1)",
        "regex": re.compile(r"(?:hashlib\.(?:md5|sha1)\s*\(|crypto\.createHash\s*\(\s*['\"](?:md5|sha1)['\"])"),
        "severity": "MEDIUM",
        "category": "SECURITY",
        "why_it_matters": "MD5 and SHA-1 suffer from known collision vulnerabilities and are cryptographically broken for security use.",
        "suggested_fix": "Use modern cryptographic hash functions such as SHA-256 (SHA-2) or SHA-3, and bcrypt/argon2id for passwords.",
    },
    {
        "id": "SEC-008",
        "title": "Wildcard Permissive CORS Origin (*)",
        "regex": re.compile(r"allow_origins\s*=\s*\[\s*['\"]\*(?:['\"])?\s*\]"),
        "severity": "MEDIUM",
        "category": "SECURITY",
        "why_it_matters": "Permitting all origins with credentials can allow malicious external websites to read authenticated responses.",
        "suggested_fix": "Explicitly whitelist allowed frontend origin domains instead of using a wildcard.",
    },
]


class PolyglotSecurityScanner(BaseStaticRunner):
    @property
    def tool_name(self) -> str:
        return "SECURITY_SCAN"

    def is_available(self) -> bool:
        return True  # Always available natively

    async def run(self, repo_dir: str) -> List[NormalizedFindingData]:
        if not os.path.exists(repo_dir):
            return []

        findings: List[NormalizedFindingData] = []

        for root, dirs, files in os.walk(repo_dir):
            # Prune ignored directories in-place
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in (
                "node_modules", "dist", "build", "venv", ".venv", "__pycache__"
            )]

            for filename in files:
                abs_path = os.path.join(root, filename)
                rel_path = os.path.relpath(abs_path, repo_dir).replace("\\", "/")

                if is_binary_or_ignored_file(abs_path, filename):
                    continue

                try:
                    with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                except Exception:
                    continue

                for line_idx, line_content in enumerate(lines, start=1):
                    # Test each security rule
                    for rule in SECURITY_RULES:
                        match = rule["regex"].search(line_content)
                        if match:
                            # Create a clean snippet
                            snippet_start = max(0, line_idx - 2)
                            snippet_end = min(len(lines), line_idx + 1)
                            snippet = "".join(lines[snippet_start:snippet_end]).strip("\n")

                            findings.append(
                                NormalizedFindingData(
                                    title=f"[{rule['id']}] {rule['title']}",
                                    severity=rule["severity"],
                                    category=rule["category"],
                                    source="SECURITY_SCAN",
                                    file_path=rel_path,
                                    line_start=line_idx,
                                    line_end=line_idx,
                                    code_snippet=snippet,
                                    explanation=f"Detected pattern matching '{rule['title']}' at {rel_path}:{line_idx}.",
                                    why_it_matters=rule["why_it_matters"],
                                    suggested_fix=rule["suggested_fix"],
                                    confidence=0.98
                                )
                            )

        return findings
