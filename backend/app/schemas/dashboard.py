from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class SeverityCount(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    informational: int = 0


class RecentActivityItem(BaseModel):
    id: str
    repo_name: str
    event_type: str  # IMPORT, ANALYSIS, PR_AUDIT
    status: str
    quality_score: Optional[float] = None
    created_at: datetime


class DashboardSummaryResponse(BaseModel):
    repositories_count: int
    analyzed_repositories_count: int
    total_findings_count: int
    critical_findings_count: int
    security_findings_count: int
    average_quality_score: Optional[float]
    severity_breakdown: SeverityCount
    recent_activities: List[RecentActivityItem] = []
