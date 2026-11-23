from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# -------------------------------------------------------------
# Base AI Metadata
# -------------------------------------------------------------
class AIMetadata(BaseModel):
    model_used: str
    is_mock: bool = False
    tokens_used: Optional[int] = None


# -------------------------------------------------------------
# 1. Repository Summarization
# -------------------------------------------------------------
class RepoSummaryRequest(BaseModel):
    repo_id: Optional[str] = None
    repo_name: str
    primary_language: Optional[str] = "Polyglot"
    file_tree_summary: Optional[str] = None
    context_notes: Optional[str] = None


class CoreComponent(BaseModel):
    name: str
    purpose: str
    key_files: List[str] = []


class RepoSummaryResponse(AIMetadata):
    overview: str
    architecture_style: str
    primary_languages: List[str] = []
    core_components: List[CoreComponent] = []
    entry_points: List[str] = []
    dependencies_summary: str
    technical_debt_assessment: str
    recommended_next_steps: List[str] = []


# -------------------------------------------------------------
# 2. Code Explanation
# -------------------------------------------------------------
class CodeExplanationRequest(BaseModel):
    code: str
    language: str = "python"
    file_path: Optional[str] = None
    symbol_name: Optional[str] = None
    explanation_level: str = Field(default="technical", description="'technical' or 'beginner'")


class ParameterInfo(BaseModel):
    name: str
    type: str = "any"
    description: str


class OutputInfo(BaseModel):
    type: str = "any"
    description: str


class CodeExplanationResponse(AIMetadata):
    file_path: Optional[str] = None
    symbol_name: Optional[str] = None
    explanation_level: str
    what_it_does: str
    how_it_works: str
    inputs: List[ParameterInfo] = []
    outputs: List[OutputInfo] = []
    dependencies: List[str] = []
    important_logic_steps: List[str] = []
    potential_problems: List[str] = []
    blast_radius_and_impact: str


# -------------------------------------------------------------
# 3. Bug Analysis
# -------------------------------------------------------------
class BugAnalysisRequest(BaseModel):
    code: str
    language: str = "python"
    file_path: Optional[str] = None
    context: Optional[str] = None
    static_findings: Optional[List[Dict[str, Any]]] = None


class BugItem(BaseModel):
    title: str
    severity: str = "MEDIUM"  # CRITICAL, HIGH, MEDIUM, LOW
    line_number: Optional[int] = None
    code_snippet: Optional[str] = None
    root_cause: str
    reproduction_scenario: str
    suggested_fix: str


class BugAnalysisResponse(AIMetadata):
    file_path: Optional[str] = None
    overall_bug_risk: str  # LOW, MEDIUM, HIGH, CRITICAL
    bugs_found: List[BugItem] = []
    recommendations: List[str] = []


# -------------------------------------------------------------
# 4. Security Analysis
# -------------------------------------------------------------
class SecurityAnalysisRequest(BaseModel):
    code: str
    language: str = "python"
    file_path: Optional[str] = None
    context: Optional[str] = None
    static_findings: Optional[List[Dict[str, Any]]] = None


class SecurityVulnerability(BaseModel):
    title: str
    cwe_id: Optional[str] = None
    severity: str = "HIGH"  # CRITICAL, HIGH, MEDIUM, LOW
    affected_file: Optional[str] = None
    line_number: Optional[int] = None
    attack_vector: str
    impact: str
    remediation_code: str


class SecurityAnalysisResponse(AIMetadata):
    security_score: float  # 0.0 - 100.0
    vulnerabilities: List[SecurityVulnerability] = []
    compliance_notes: Optional[str] = None
    hardened_code_recommendations: List[str] = []


# -------------------------------------------------------------
# 5. Pull Request Review
# -------------------------------------------------------------
class PullRequestReviewRequest(BaseModel):
    diff_text: str
    base_ref: Optional[str] = "main"
    target_ref: Optional[str] = "feature"
    title: Optional[str] = None
    description: Optional[str] = None


class PRReviewFinding(BaseModel):
    file: str
    line: Optional[int] = None
    severity: str = "MEDIUM"  # CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
    category: str = "BUG"     # BUG, SECURITY, PERFORMANCE, BREAKING_CHANGE, CODE_QUALITY
    comment: str
    suggested_diff: Optional[str] = None


class PullRequestReviewResponse(AIMetadata):
    summary: str
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    changed_files_analyzed: int
    key_changes: List[str] = []
    review_findings: List[PRReviewFinding] = []
    breaking_changes: List[str] = []
    testing_recommendations: List[str] = []
    approval_status: str  # APPROVED, REQUEST_CHANGES, COMMENT


# -------------------------------------------------------------
# 6. Documentation Generation
# -------------------------------------------------------------
class DocGenerationRequest(BaseModel):
    repo_name: str
    doc_type: str = Field(default="README", description="'README', 'ARCHITECTURE', 'API', or 'ONBOARDING'")
    context_summary: Optional[str] = None
    file_manifest: Optional[List[str]] = None


class DocGenerationResponse(AIMetadata):
    doc_type: str
    title: str
    content_markdown: str
    table_of_contents: List[str] = []
    suggested_filename: str


# -------------------------------------------------------------
# 7. Test Generation
# -------------------------------------------------------------
class TestGenerationRequest(BaseModel):
    code: str
    language: str = "python"
    framework: str = "pytest"  # pytest, jest, unittest, go_test
    context: Optional[str] = None


class TestCaseItem(BaseModel):
    name: str
    type: str  # happy_path, edge_case, error_handling
    description: str


class TestGenerationResponse(AIMetadata):
    framework: str
    test_code: str
    test_cases: List[TestCaseItem] = []
    coverage_notes: str
