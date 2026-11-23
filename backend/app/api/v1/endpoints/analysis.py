import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.repository import Repository
from app.models.analysis import AnalysisJob
from app.models.finding import Finding
from app.schemas.analysis import AnalysisJobResponse, AnalysisDetailResponse, AnalysisRunRequest
from app.schemas.finding import FindingResponse
from app.services.static_analyzer.pipeline import static_pipeline

router = APIRouter()


@router.post("/run", response_model=AnalysisJobResponse, status_code=status.HTTP_201_CREATED)
async def trigger_static_analysis(
    payload: AnalysisRunRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger deterministic static analysis (Ruff, Bandit, Semgrep, Security Scan) on a repository.
    Runs 100% offline without requiring an AI API key.
    """
    # 1. Verify repository
    result = await db.execute(select(Repository).where(Repository.id == payload.repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{payload.repo_id}' not found."
        )

    if not os.path.exists(repo.storage_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Repository storage files no longer exist on disk."
        )

    # 2. Create pending job
    job_id = str(uuid.uuid4())
    job = AnalysisJob(
        id=job_id,
        repo_id=repo.id,
        status="RUNNING",
        started_at=datetime.now(timezone.utc)
    )
    db.add(job)
    await db.commit()

    try:
        # 3. Execute static pipeline
        findings_data, quality_score, counts = await static_pipeline.execute_analysis(repo.storage_path)

        # 4. Save normalized findings
        for f in findings_data:
            db_finding = Finding(
                id=str(uuid.uuid4()),
                analysis_id=job_id,
                repo_id=repo.id,
                title=f.title,
                severity=f.severity,
                category=f.category,
                source=f.source,
                file_path=f.file_path,
                line_start=f.line_start,
                line_end=f.line_end,
                code_snippet=f.code_snippet,
                explanation=f.explanation,
                why_it_matters=f.why_it_matters,
                suggested_fix=f.suggested_fix,
                confidence=f.confidence,
                created_at=datetime.now(timezone.utc)
            )
            db.add(db_finding)

        # 5. Complete job
        job.status = "COMPLETED"
        job.quality_score = quality_score
        job.total_findings = len(findings_data)
        job.critical_count = counts["critical"]
        job.high_count = counts["high"]
        job.medium_count = counts["medium"]
        job.low_count = counts["low"]
        job.completed_at = datetime.now(timezone.utc)
        job.metrics = {
            "severity_breakdown": counts,
            "analyzers_used": static_pipeline.get_available_tools(),
        }
        job.summary = f"Completed static scan with {len(findings_data)} findings. Quality Score: {quality_score}/100."

        await db.commit()
        await db.refresh(job)
        return job

    except Exception as e:
        job.status = "FAILED"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(job)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Static analysis failed: {str(e)}"
        )


@router.get("/{analysis_id}", response_model=AnalysisJobResponse)
async def get_analysis_job(analysis_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve metadata and score for a specific analysis job."""
    result = await db.execute(select(AnalysisJob).where(AnalysisJob.id == analysis_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis job '{analysis_id}' not found."
        )
    return job


@router.get("/{analysis_id}/findings", response_model=List[FindingResponse])
async def get_analysis_findings(
    analysis_id: str,
    severity: Optional[str] = Query(None, description="Filter by severity: CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL"),
    category: Optional[str] = Query(None, description="Filter by category: SECURITY, BUG, QUALITY, PERFORMANCE, TECH_DEBT"),
    source: Optional[str] = Query(None, description="Filter by source: RUFF, BANDIT, SEMGREP, SECURITY_SCAN"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve normalized findings for an analysis run with optional filtering."""
    query = select(Finding).where(Finding.analysis_id == analysis_id)

    if severity and severity.upper() != "ALL":
        query = query.where(Finding.severity == severity.upper())
    if category and category.upper() != "ALL":
        query = query.where(Finding.category == category.upper())
    if source and source.upper() != "ALL":
        query = query.where(Finding.source == source.upper())

    query = query.order_by(Finding.severity, Finding.file_path, Finding.line_start)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/repository/{repo_id}", response_model=List[AnalysisJobResponse])
async def list_repository_analyses(repo_id: str, db: AsyncSession = Depends(get_db)):
    """List historical analysis runs for a given repository."""
    result = await db.execute(
        select(AnalysisJob).where(AnalysisJob.repo_id == repo_id).order_by(desc(AnalysisJob.started_at))
    )
    return result.scalars().all()
