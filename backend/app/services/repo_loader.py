import os
import shutil
import zipfile
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException, status
import git

from app.core.config import settings
from app.core.security import validate_github_url, is_safe_relative_path
from app.services.file_tree import build_repository_file_tree


def extract_repo_name_from_url(url: str) -> str:
    """Extracts a clean repository name from a GitHub URL."""
    clean_url = url.strip().rstrip("/")
    if clean_url.endswith(".git"):
        clean_url = clean_url[:-4]
    parts = clean_url.split("/")
    return parts[-1] if parts else "imported-repo"


async def clone_github_repo(url: str, branch: Optional[str], dest_dir: str) -> str:
    """
    Clones a public GitHub repository safely into dest_dir with shallow depth.
    Removes .git directory after cloning to prevent execution of untrusted git hooks.
    """
    if not validate_github_url(url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid repository URL. Only public GitHub URLs (https://github.com/owner/repo) are allowed."
        )

    os.makedirs(dest_dir, exist_ok=True)

    clone_kwargs: Dict[str, Any] = {
        "depth": 1,
        "single_branch": True,
    }
    if branch and branch.strip():
        clone_kwargs["branch"] = branch.strip()

    try:
        git.Repo.clone_from(url.strip(), dest_dir, **clone_kwargs)
    except git.GitCommandError as e:
        # Clean up partial directory if clone failed
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir, ignore_errors=True)
        error_msg = str(e)
        if "Remote branch" in error_msg or "not found in upstream" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Branch '{branch}' was not found in the remote repository."
            )
        elif "Repository not found" in error_msg or "Authentication failed" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found or is private. Only public repositories can be cloned."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Git clone failed: {error_msg.splitlines()[-1] if error_msg else 'Unknown error'}"
            )
    except Exception as e:
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during cloning: {str(e)}"
        )

    # Security measure: Remove .git directory so untrusted hooks cannot be triggered
    git_dir = os.path.join(dest_dir, ".git")
    if os.path.exists(git_dir):
        try:
            # On Windows, files in .git may be read-only, handle gracefully
            def remove_readonly(func, path, excinfo):
                import stat
                os.chmod(path, stat.S_IWRITE)
                func(path)
            shutil.rmtree(git_dir, onerror=remove_readonly)
        except Exception:
            pass

    return branch or "main"


def extract_safe_zip(zip_bytes: bytes, dest_dir: str) -> None:
    """
    Safely extract a ZIP archive with comprehensive defenses:
    - Max compressed archive size check
    - Zip bomb detection (uncompressed ratio > 100)
    - Max uncompressed size limit
    - Max file count limit
    - Path traversal / Zip-Slip prevention
    """
    max_zip_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(zip_bytes) > max_zip_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"ZIP file size ({round(len(zip_bytes)/(1024*1024), 1)} MB) exceeds limit of {settings.MAX_UPLOAD_SIZE_MB} MB."
        )

    os.makedirs(dest_dir, exist_ok=True)

    import io
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            infolist = zf.infolist()
            
            # File count check
            if len(infolist) > settings.MAX_FILE_COUNT:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Archive contains {len(infolist)} files, exceeding the limit of {settings.MAX_FILE_COUNT}."
                )

            total_uncompressed = 0
            max_uncompressed_bytes = settings.MAX_UNCOMPRESSED_SIZE_MB * 1024 * 1024
            dest_dir_abs = os.path.abspath(dest_dir)

            # Pre-validation pass: verify all targets are safe before writing anything
            for member in infolist:
                total_uncompressed += member.file_size
                if total_uncompressed > max_uncompressed_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Archive exceeds uncompressed size safety threshold (Zip bomb protection)."
                    )

                # Compression ratio check
                if member.compress_size > 0:
                    ratio = member.file_size / member.compress_size
                    if ratio > 100:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Abnormally high compression ratio detected (Zip bomb protection)."
                        )

                # Zip-Slip / Path Traversal Defense
                target_path = os.path.abspath(os.path.join(dest_dir, member.filename))
                if not target_path.startswith(dest_dir_abs + os.sep) and target_path != dest_dir_abs:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Path traversal attempt detected in ZIP member: {member.filename}"
                    )

            # Extraction pass
            for member in infolist:
                # Skip symlinks and special files
                if member.is_dir():
                    continue

                target_path = os.path.abspath(os.path.join(dest_dir, member.filename))
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                
                with zf.open(member) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)

    except zipfile.BadZipFile:
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid or readable ZIP archive."
        )
    except HTTPException:
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir, ignore_errors=True)
        raise
    except Exception as e:
        if os.path.exists(dest_dir):
            shutil.rmtree(dest_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to safely extract ZIP archive: {str(e)}"
        )


def read_file_safely(base_dir: str, rel_path: str) -> Dict[str, Any]:
    """
    Safely read file contents, verifying path boundaries and text encoding.
    """
    if not is_safe_relative_path(base_dir, rel_path):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Path traversal detected."
        )

    full_path = os.path.abspath(os.path.join(base_dir, rel_path))
    if not os.path.isfile(full_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {rel_path}"
        )

    file_size = os.path.getsize(full_path)
    # 2MB limit for previewing text in Monaco
    if file_size > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({round(file_size/(1024*1024), 1)} MB) exceeds 2 MB preview limit."
        )

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to read file: {str(e)}"
        )

    lines = content.count("\n") + 1
    return {
        "path": rel_path.replace("\\", "/"),
        "content": content,
        "size": file_size,
        "line_count": lines,
    }
