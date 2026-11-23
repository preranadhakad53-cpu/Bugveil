import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.repository import Repository
from app.schemas.dependency import (
    DependencyGraphResponse,
    ImpactAnalysisRequest,
)
from app.schemas.pull_request import ImpactAnalysisResult
from app.services.dependency_analyzer import DependencyGraph

router = APIRouter()


@router.get("/{repo_id}", response_model=DependencyGraphResponse)
async def get_repository_dependencies(
    repo_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns visual dependency graph data (nodes and edges) for the repository.
    Traces imports, module relationships, and internal symbols.
    """
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found."
        )

    if not os.path.exists(repo.storage_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Repository storage files no longer exist on disk."
        )

    dep_graph = DependencyGraph(repo.storage_path)
    graph_data = dep_graph.get_graph_data()

    return DependencyGraphResponse(
        repo_id=repo.id,
        repo_name=repo.name,
        total_files=graph_data["total_files"],
        nodes=graph_data["nodes"],
        edges=graph_data["edges"],
    )


@router.post("/{repo_id}/impact", response_model=ImpactAnalysisResult)
async def analyze_code_impact(
    repo_id: str,
    payload: ImpactAnalysisRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Computes code change blast radius:
    - Identifies functions calling modified functions
    - Identifies files importing modified modules
    - Calculates direct & transitive downstream affected components
    """
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repo_id}' not found."
        )

    if not os.path.exists(repo.storage_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Repository storage files no longer exist on disk."
        )

    dep_graph = DependencyGraph(repo.storage_path)
    res = dep_graph.compute_impact(payload.modified_files, payload.modified_symbols)

    return ImpactAnalysisResult(
        impact_level=res["impact_level"],
        summary=res["summary"],
        modified_files=res["modified_files"],
        direct_dependents=res["direct_dependents"],
        transitive_dependents=res["transitive_dependents"],
        affected_callers=res["affected_callers"],
        total_impacted_modules=res["total_impacted_modules"],
    )
