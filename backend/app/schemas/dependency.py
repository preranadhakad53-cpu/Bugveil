from typing import List, Dict, Optional, Any
from pydantic import BaseModel


class DependencyNode(BaseModel):
    id: str
    label: str
    path: str
    symbols_count: int = 0
    in_degree: int = 0
    out_degree: int = 0


class DependencyEdge(BaseModel):
    id: str
    source: str
    target: str


class DependencyGraphResponse(BaseModel):
    repo_id: str
    repo_name: str
    total_files: int
    nodes: List[DependencyNode] = []
    edges: List[DependencyEdge] = []


class ImpactAnalysisRequest(BaseModel):
    modified_files: List[str]
    modified_symbols: Optional[List[str]] = []
