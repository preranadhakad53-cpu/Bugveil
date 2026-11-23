from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FindingResponse(BaseModel):
    id: str
    analysis_id: str
    repo_id: str
    title: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
    category: str  # SECURITY, BUG, QUALITY, PERFORMANCE, TECH_DEBT
    source: str    # RUFF, BANDIT, SEMGREP, ESLINT, SECURITY_SCAN
    file_path: str
    line_start: int
    line_end: int
    code_snippet: Optional[str] = None
    explanation: Optional[str] = None
    why_it_matters: Optional[str] = None
    suggested_fix: Optional[str] = None
    confidence: float = 1.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
