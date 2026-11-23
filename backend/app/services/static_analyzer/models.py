from dataclasses import dataclass
from typing import Optional


@dataclass
class NormalizedFindingData:
    title: str
    severity: str        # CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
    category: str        # SECURITY, BUG, QUALITY, PERFORMANCE, TECH_DEBT
    source: str          # RUFF, BANDIT, SEMGREP, ESLINT, SECURITY_SCAN
    file_path: str       # Relative path within repository
    line_start: int
    line_end: int
    code_snippet: Optional[str] = None
    explanation: Optional[str] = None
    why_it_matters: Optional[str] = None
    suggested_fix: Optional[str] = None
    confidence: float = 1.0
