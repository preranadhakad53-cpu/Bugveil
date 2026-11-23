from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.repository import Repository
from app.models.analysis import AnalysisJob
from app.models.finding import Finding
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    SeverityCount,
    RecentActivityItem
)

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    """
    Fetch live aggregated dashboard metrics calculated from the database.
    Never returns fake metrics.
    """
    # Count repositories
    repo_count_result = await db.execute(select(func.count(Repository.id)))
    repos_count = repo_count_result.scalar() or 0

    # Count analyzed repositories (at least one completed analysis)
    analyzed_count_result = await db.execute(
        select(func.count(func.distinct(AnalysisJob.repo_id))).where(AnalysisJob.status == "COMPLETED")
    )
    analyzed_repos_count = analyzed_count_result.scalar() or 0

    # Count total findings
    total_findings_result = await db.execute(select(func.count(Finding.id)))
    total_findings = total_findings_result.scalar() or 0

    # Critical findings count
    critical_result = await db.execute(
        select(func.count(Finding.id)).where(Finding.severity == "CRITICAL")
    )
    critical_findings = critical_result.scalar() or 0

    # Security findings count
    security_result = await db.execute(
        select(func.count(Finding.id)).where(Finding.category == "SECURITY")
    )
    security_findings = security_result.scalar() or 0

    # Average quality score across completed analyses
    avg_score_result = await db.execute(
        select(func.avg(AnalysisJob.quality_score)).where(AnalysisJob.status == "COMPLETED")
    )
    raw_avg = avg_score_result.scalar()
    average_quality_score = round(float(raw_avg), 1) if raw_avg is not None else None

    # Severity breakdown
    high_result = await db.execute(select(func.count(Finding.id)).where(Finding.severity == "HIGH"))
    med_result = await db.execute(select(func.count(Finding.id)).where(Finding.severity == "MEDIUM"))
    low_result = await db.execute(select(func.count(Finding.id)).where(Finding.severity == "LOW"))
    info_result = await db.execute(select(func.count(Finding.id)).where(Finding.severity == "INFORMATIONAL"))

    severity_counts = SeverityCount(
        critical=critical_findings,
        high=high_result.scalar() or 0,
        medium=med_result.scalar() or 0,
        low=low_result.scalar() or 0,
        informational=info_result.scalar() or 0
    )

    # Recent activities (Latest 5 analysis jobs or imported repositories)
    recent_analyses = await db.execute(
        select(AnalysisJob, Repository.name.label("repo_name"))
        .join(Repository, AnalysisJob.repo_id == Repository.id)
        .order_by(AnalysisJob.started_at.desc())
        .limit(5)
    )
    
    recent_items = []
    for job, repo_name in recent_analyses:
        recent_items.append(
            RecentActivityItem(
                id=job.id,
                repo_name=repo_name,
                event_type="ANALYSIS",
                status=job.status,
                quality_score=job.quality_score,
                created_at=job.started_at
            )
        )

    return DashboardSummaryResponse(
        repositories_count=repos_count,
        analyzed_repositories_count=analyzed_repos_count,
        total_findings_count=total_findings,
        critical_findings_count=critical_findings,
        security_findings_count=security_findings,
        average_quality_score=average_quality_score,
        severity_breakdown=severity_counts,
        recent_activities=recent_items
    )
