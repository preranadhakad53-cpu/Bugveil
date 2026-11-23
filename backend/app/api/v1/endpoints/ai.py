from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.repository import Repository
from app.schemas.ai import (
    RepoSummaryRequest,
    RepoSummaryResponse,
    CodeExplanationRequest,
    CodeExplanationResponse,
    BugAnalysisRequest,
    BugAnalysisResponse,
    SecurityAnalysisRequest,
    SecurityAnalysisResponse,
    PullRequestReviewRequest,
    PullRequestReviewResponse,
    DocGenerationRequest,
    DocGenerationResponse,
    TestGenerationRequest,
    TestGenerationResponse,
)
from app.services.ai_service import ai_service
from app.services.file_tree import build_repository_file_tree

router = APIRouter()


@router.post("/summarize-repo", response_model=RepoSummaryResponse)
async def summarize_repository(
    payload: RepoSummaryRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate an architectural overview, tech debt assessment, and component summary for a repository.
    """
    file_tree_str = payload.file_tree_summary
    primary_lang = payload.primary_language

    # If repo_id is provided, optionally fetch richer context from database
    if payload.repo_id:
        result = await db.execute(select(Repository).where(Repository.id == payload.repo_id))
        repo = result.scalar_one_or_none()
        if repo:
            primary_lang = repo.primary_language or primary_lang
            if not file_tree_str and repo.storage_path:
                try:
                    tree, total_files, _, _, _ = build_repository_file_tree(repo.storage_path)
                    file_tree_str = f"Total Files: {total_files}, Structure: {str(tree)[:1500]}"
                except Exception:
                    pass

    return await ai_service.summarize_repository(
        repo_name=payload.repo_name,
        primary_language=primary_lang or "Polyglot",
        file_tree_summary=file_tree_str,
        context_notes=payload.context_notes,
    )


@router.post("/explain-code", response_model=CodeExplanationResponse)
async def explain_code(payload: CodeExplanationRequest):
    """
    Explain legacy or unfamiliar code with input/output contracts, dependencies, and blast radius.
    Supports both 'technical' and 'beginner' explanation levels.
    """
    if not payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source code cannot be empty."
        )

    return await ai_service.explain_code(
        code=payload.code,
        language=payload.language,
        file_path=payload.file_path,
        symbol_name=payload.symbol_name,
        explanation_level=payload.explanation_level,
    )


@router.post("/analyze-bugs", response_model=BugAnalysisResponse)
async def analyze_bugs(payload: BugAnalysisRequest):
    """
    Analyze code for subtle logic bugs, race conditions, edge cases, and unhandled null values.
    """
    if not payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source code cannot be empty."
        )

    return await ai_service.analyze_bugs(
        code=payload.code,
        language=payload.language,
        file_path=payload.file_path,
        context=payload.context,
        static_findings=payload.static_findings,
    )


@router.post("/analyze-security", response_model=SecurityAnalysisResponse)
async def analyze_security(payload: SecurityAnalysisRequest):
    """
    Contextualize security issues, attack vectors, and hardened remediation code.
    """
    if not payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source code cannot be empty."
        )

    return await ai_service.analyze_security(
        code=payload.code,
        language=payload.language,
        file_path=payload.file_path,
        context=payload.context,
        static_findings=payload.static_findings,
    )


@router.post("/review-pr", response_model=PullRequestReviewResponse)
async def review_pull_request(payload: PullRequestReviewRequest):
    """
    Audit git diffs for bugs, breaking changes, missing tests, and risk level.
    """
    if not payload.diff_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Git diff cannot be empty."
        )

    return await ai_service.review_pull_request(
        diff_text=payload.diff_text,
        base_ref=payload.base_ref or "main",
        target_ref=payload.target_ref or "feature",
        title=payload.title,
        description=payload.description,
    )


@router.post("/generate-docs", response_model=DocGenerationResponse)
async def generate_docs(payload: DocGenerationRequest):
    """
    Generate README, Architecture, API reference, or Developer Onboarding guides in Markdown.
    Never automatically overwrites repository files.
    """
    return await ai_service.generate_documentation(
        repo_name=payload.repo_name,
        doc_type=payload.doc_type,
        context_summary=payload.context_summary,
        file_manifest=payload.file_manifest,
    )


@router.post("/generate-tests", response_model=TestGenerationResponse)
async def generate_tests(payload: TestGenerationRequest):
    """
    Synthesize comprehensive unit test suites covering nominal paths, edge cases, and error handling.
    """
    if not payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source code cannot be empty."
        )

    return await ai_service.generate_tests(
        code=payload.code,
        language=payload.language,
        framework=payload.framework,
        context=payload.context,
    )
