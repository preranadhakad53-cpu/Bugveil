from typing import List, Dict
from pydantic import BaseModel


class ToolStatus(BaseModel):
    name: str
    installed: bool
    description: str


class SystemSettingsResponse(BaseModel):
    project_name: str
    environment: str
    debug: bool
    database_backend: str
    groq_model: str
    groq_configured: bool
    groq_api_key_status: str  # "Configured" or "Missing / Using Placeholder"
    storage_dir: str
    max_upload_size_mb: int
    tools: List[ToolStatus]
