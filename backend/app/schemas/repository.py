from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class RepositoryCreate(BaseModel):
    name: str
    url: Optional[str] = None
    default_branch: Optional[str] = "main"


class RepositoryImportUrlRequest(BaseModel):
    url: str = Field(..., description="Public GitHub repository URL (https://github.com/owner/repo)")
    branch: Optional[str] = Field(default="main", description="Target branch to clone")
    name: Optional[str] = Field(default=None, description="Optional custom label for repository")


class RepositoryResponse(BaseModel):
    id: str
    name: str
    url: Optional[str] = None
    source_type: str
    default_branch: str
    size_bytes: int
    file_count: int
    primary_language: Optional[str] = None
    language_distribution: Dict[str, float] = {}
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RepositoryFileTreeResponse(BaseModel):
    repo_id: str
    name: str
    total_files: int
    total_bytes: int
    primary_language: Optional[str] = None
    language_distribution: Dict[str, float] = {}
    tree: Dict[str, Any]


class RepositoryFileContentResponse(BaseModel):
    path: str
    content: str
    size: int
    line_count: int
