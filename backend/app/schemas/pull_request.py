from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class AuditFinding(BaseModel):
    id: str
    title: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO
    category: str  # SECURITY, BUG, PERFORMANCE, BREAKING_CHANGE, CODE_QUALITY, VALIDATION
    file: str
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    explanation: str
    why_it_matters: str
    suggested_fix: str
    source: str = "GROQ_AI"  # "STATIC_ANALYSIS" or "GROQ_AI"


class ImpactAnalysisResult(BaseModel):
    impact_level: str  # ISOLATED, MODERATE, HIGH
    summary: str
    modified_files: List[str] = []
    direct_dependents: List[str] = []
    transitive_dependents: List[str] = []
    affected_callers: List[Dict[str, Any]] = []
    total_impacted_modules: int = 0


class PRAuditRequest(BaseModel):
    repo_id: Optional[str] = None
    diff_text: str
    base_ref: Optional[str] = "main"
    target_ref: Optional[str] = "feature"
    title: Optional[str] = "Pull Request"


class PRAuditResponse(BaseModel):
    summary: str
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    approval_status: str  # APPROVED, REQUEST_CHANGES, COMMENT
    total_findings: int
    static_findings_count: int
    ai_findings_count: int
    findings: List[AuditFinding] = []
    impact: Optional[ImpactAnalysisResult] = None
    breaking_changes: List[str] = []
    testing_recommendations: List[str] = []
    is_mock: bool = False
    model_used: str
