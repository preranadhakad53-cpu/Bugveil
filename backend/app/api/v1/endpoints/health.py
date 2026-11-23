from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.config import settings
from app.core.database import get_db
from app.schemas.health import HealthResponse
from app import __version__

router = APIRouter()


@router.get("", response_model=HealthResponse)
async def check_health(db: AsyncSession = Depends(get_db)):
    """
    Check backend health, database connectivity, and configuration state.
    """
    database_connected = False
    try:
        result = await db.execute(text("SELECT 1"))
        database_connected = bool(result.scalar() == 1)
    except Exception:
        database_connected = False

    return HealthResponse(
        status="healthy" if database_connected else "degraded",
        version=__version__,
        project_name=settings.PROJECT_NAME,
        environment=settings.ENVIRONMENT,
        database_connected=database_connected,
        groq_configured=settings.is_groq_configured,
        groq_model=settings.GROQ_MODEL,
        timestamp=datetime.now(timezone.utc)
    )
