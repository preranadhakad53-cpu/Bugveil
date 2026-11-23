from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    dashboard,
    repositories,
    settings,
    analysis,
    ai,
    chat,
    pull_requests,
    dependencies,
)

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(repositories.router, prefix="/repositories", tags=["Repositories"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Engine (Groq)"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chatbot"])
api_router.include_router(pull_requests.router, prefix="/pull-requests", tags=["Pull Requests"])
api_router.include_router(dependencies.router, prefix="/dependencies", tags=["Dependencies"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
