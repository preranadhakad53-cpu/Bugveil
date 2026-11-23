import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router
from app import __version__

# Configure structured logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("bugveil")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown events.
    """
    logger.info("Initializing Bugveil Backend v%s...", __version__)
    logger.info("Database backend: %s", settings.DATABASE_URL.split("///")[0])
    
    # Initialize database tables
    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error("Failed to initialize database: %s", str(e))
        raise e

    if settings.is_groq_configured:
        logger.info("Groq AI configured with model: %s", settings.GROQ_MODEL)
    else:
        logger.warning(
            "Groq AI API key is not configured or using placeholder. "
            "AI features will prompt for configuration when invoked."
        )

    yield

    logger.info("Shutting down Bugveil Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Bugveil — Legacy Code & Pull Request Auditor",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration for Frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled server exception: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred."
        }
    )

# Include API v1 router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": __version__,
        "status": "online",
        "docs_url": "/docs",
        "api_v1": "/api/v1"
    }
