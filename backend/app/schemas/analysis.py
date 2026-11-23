from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.finding import FindingResponse


class AnalysisRunRequest(BaseModel):
    repo_id: str


class AnalysisJobResponse(BaseModel):
    id: str
    repo_id: str
    status: str
    quality_score: float
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    commit_hash: Optional[str] = None
    summary: Optional[str] = None
    metrics: Dict[str, Any] = {}
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AnalysisDetailResponse(AnalysisJobResponse):
    findings: List[FindingResponse] = []
