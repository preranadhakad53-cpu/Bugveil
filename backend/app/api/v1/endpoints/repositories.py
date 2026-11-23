import os
import shutil
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.database import get_db
from app.models.repository import Repository
from app.schemas.repository import (
    RepositoryResponse,
    RepositoryImportUrlRequest,
    RepositoryFileTreeResponse,
    RepositoryFileContentResponse,
)
from app.services.repo_loader import (
    clone_github_repo,
    extract_safe_zip,
    extract_repo_name_from_url,
    read_file_safely,
)
from app.services.file_tree import build_repository_file_tree

router = APIRouter()


@router.post("/import-url", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def import_repository_from_url(
    payload: RepositoryImportUrlRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Import a public GitHub repository by URL.
    Safely clones into sandboxed storage, detects languages, and generates file statistics.
    """
    repo_id = str(uuid.uuid4())
    dest_dir = os.path.join(settings.absolute_storage_dir, repo_id)
    
    repo_name = payload.name.strip() if payload.name and payload.name.strip() else extract_repo_name_from_url(payload.url)
    target_branch = payload.branch.strip() if payload.branch and payload.branch.strip() else "main"

    # Clone repository
    cloned_branch = await clone_github_repo(payload.url, target_branch, dest_dir)

    # Analyze file tree and languages
    tree, total_files, total_bytes, primary_lang, lang_dist = build_repository_file_tree(dest_dir)

    # Persist in DB
    new_repo = Repository(
        id=repo_id,
        name=repo_name,
        url=payload.url.strip(),
        source_type="GITHUB",
        default_branch=cloned_branch,
        storage_path=dest_dir,
        size_bytes=total_bytes,
        file_count=total_files,
        primary_language=primary_lang,
        language_distribution=lang_dist,
        description=f"Imported from {payload.url}",
    )
    db.add(new_repo)
    await db.commit()
    await db.refresh(new_repo)

    return new_repo


@router.post("/upload-zip", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def upload_repository_zip(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload and safely extract a source code ZIP archive.
    Defends against Zip-Slip, Zip bombs, ignores binaries, and computes language profiles.
    """
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only valid ZIP archive files (.zip) are supported."
        )

    repo_id = str(uuid.uuid4())
    dest_dir = os.path.join(settings.absolute_storage_dir, repo_id)

    # Clean display name
    clean_name = name.strip() if name and name.strip() else os.path.splitext(file.filename)[0]

    # Read uploaded bytes
    zip_bytes = await file.read()

    # Safely extract
    extract_safe_zip(zip_bytes, dest_dir)

    # Build file tree & language profiling
    tree, total_files, total_bytes, primary_lang, lang_dist = build_repository_file_tree(dest_dir)

    # Persist in DB
    new_repo = Repository(
        id=repo_id,
        name=clean_name,
        url=None,
        source_type="ZIP_UPLOAD",
        default_branch="main",
        storage_path=dest_dir,
        size_bytes=total_bytes,
        file_count=total_files,
        primary_language=primary_lang,
        language_distribution=lang_dist,
        description=f"Uploaded archive {file.filename}",
    )
    db.add(new_repo)
    await db.commit()
    await db.refresh(new_repo)

    return new_repo


@router.get("", response_model=List[RepositoryResponse])
async def list_repositories(db: AsyncSession = Depends(get_db)):
    """
    List all tracked repositories.
    """
    result = await db.execute(select(Repository).order_by(Repository.created_at.desc()))
    return result.scalars().all()


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(repo_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get detailed repository metadata by ID.
    """
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found."
        )
    return repo


@router.get("/{repo_id}/files", response_model=RepositoryFileTreeResponse)
async def get_repository_files(repo_id: str, db: AsyncSession = Depends(get_db)):
    """
    Generate and return the hierarchical file tree and language profile.
    """
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found."
        )

    if not os.path.exists(repo.storage_path):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Repository storage directory no longer exists on disk."
        )

    tree, total_files, total_bytes, primary_lang, lang_dist = build_repository_file_tree(repo.storage_path)

    return RepositoryFileTreeResponse(
        repo_id=repo.id,
        name=repo.name,
        total_files=total_files,
        total_bytes=total_bytes,
        primary_language=primary_lang,
        language_distribution=lang_dist,
        tree=tree
    )


@router.get("/{repo_id}/file-content", response_model=RepositoryFileContentResponse)
async def get_repository_file_content(
    repo_id: str,
    path: str = Query(..., description="Relative file path within repository"),
    db: AsyncSession = Depends(get_db)
):
    """
    Safely retrieve content of a specific source code file.
    Guarded against directory traversal and oversized files.
    """
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found."
        )

    file_data = read_file_safely(repo.storage_path, path)
    return RepositoryFileContentResponse(**file_data)


@router.delete("/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(repo_id: str, db: AsyncSession = Depends(get_db)):
    """
    Delete repository record from DB and purge files from disk.
    """
    result = await db.execute(select(Repository).where(Repository.id == repo_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository with ID '{repo_id}' not found."
        )

    # Clean disk files
    if os.path.exists(repo.storage_path):
        shutil.rmtree(repo.storage_path, ignore_errors=True)

    await db.delete(repo)
    await db.commit()
    return None
