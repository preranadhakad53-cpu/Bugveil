import sys
import os
import shutil
from fastapi import APIRouter
from app.core.config import settings
from app.schemas.settings import SystemSettingsResponse, ToolStatus

router = APIRouter()


def check_tool_available(tool_name: str) -> bool:
    """
    Check if a tool executable exists either in system PATH or in the active Python venv.
    """
    # 1. System PATH
    if shutil.which(tool_name):
        return True
    
    # 2. Virtual environment Scripts / bin directory
    venv_dir = sys.prefix
    for sub in ["Scripts", "bin"]:
        candidate = os.path.join(venv_dir, sub, f"{tool_name}.exe")
        if os.path.isfile(candidate):
            return True
        candidate_nix = os.path.join(venv_dir, sub, tool_name)
        if os.path.isfile(candidate_nix):
            return True
    return False


@router.get("/config", response_model=SystemSettingsResponse)
async def get_system_config():
    """
    Returns public system status and configuration diagnostics.
    Never exposes raw secrets or sensitive credentials.
    """
    tools = [
        ToolStatus(
            name="Ruff",
            installed=check_tool_available("ruff"),
            description="Ultra-fast Python linter and code quality scanner"
        ),
        ToolStatus(
            name="Bandit",
            installed=check_tool_available("bandit"),
            description="Python AST-based security vulnerability scanner"
        ),
        ToolStatus(
            name="Git",
            installed=check_tool_available("git"),
            description="Version control system for diffs and repo cloning"
        ),
        ToolStatus(
            name="Semgrep",
            installed=check_tool_available("semgrep"),
            description="Lightweight polyglot static analysis engine"
        ),
    ]

    key_status = (
        "Configured (Ready)" if settings.is_groq_configured 
        else "Pending (Placeholder value in .env - will be required for Milestone 5 AI features)"
    )

    return SystemSettingsResponse(
        project_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        debug=settings.DEBUG,
        database_backend="SQLite (Local Async)" if "sqlite" in settings.DATABASE_URL else "PostgreSQL",
        groq_model=settings.GROQ_MODEL,
        groq_configured=settings.is_groq_configured,
        groq_api_key_status=key_status,
        storage_dir=settings.STORAGE_DIR,
        max_upload_size_mb=settings.MAX_UPLOAD_SIZE_MB,
        tools=tools
    )
