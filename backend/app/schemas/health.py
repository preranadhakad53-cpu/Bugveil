from datetime import datetime
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str
    project_name: str
    environment: str
    database_connected: bool
    groq_configured: bool
    groq_model: str
    timestamp: datetime
