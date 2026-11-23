import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.repository import Repository
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag_engine import chat_with_repository

router = APIRouter()


@router.post("/message", response_model=ChatResponse)
async def send_chat_message(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Repository-aware AI Chatbot.
    Grounds answers in the analyzed repository code, provides exact file paths
    and line citations (`file:start-end`), and supports multi-turn follow-ups.
    """
    if not payload.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat query cannot be empty."
        )

    # 1. Fetch repository
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
            detail="Repository files no longer exist on disk. Please re-import repository."
        )

    # 2. Convert history to dict list
    history_dicts = [{"role": h.role, "content": h.content} for h in (payload.history or [])]

    # 3. Grounded RAG query
    rag_result = await chat_with_repository(
        repo_id=repo.id,
        repo_dir=repo.storage_path,
        query=payload.query,
        repo_name=repo.name,
        history=history_dicts,
    )

    return ChatResponse(
        answer=rag_result["answer"],
        referenced_files=rag_result["referenced_files"],
        is_mock=rag_result["is_mock"],
        model_used=rag_result["model_used"],
        repo_id=repo.id,
        repo_name=repo.name,
    )
