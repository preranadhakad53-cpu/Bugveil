from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ChatMessageItem(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str


class ChatRequest(BaseModel):
    repo_id: str
    query: str
    history: Optional[List[ChatMessageItem]] = []


class ReferencedFile(BaseModel):
    file_path: str
    line_start: int
    line_end: int
    snippet: str = ""


class ChatResponse(BaseModel):
    answer: str
    referenced_files: List[ReferencedFile] = []
    is_mock: bool = False
    model_used: str
    repo_id: str
    repo_name: str
