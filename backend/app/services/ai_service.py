import json
import logging
import asyncio
from typing import Dict, Any, Optional, Type, TypeVar
import httpx
from fastapi import HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import sanitize_api_secrets
from app.schemas.ai import (
    RepoSummaryResponse,
    CodeExplanationResponse,
    BugAnalysisResponse,
    SecurityAnalysisResponse,
    PullRequestReviewResponse,
    DocGenerationResponse,
    TestGenerationResponse,
    CoreComponent,
    ParameterInfo,
    OutputInfo,
    BugItem,
    SecurityVulnerability,
    PRReviewFinding,
    TestCaseItem,
)

logger = logging.getLogger("bugveil.ai")
T = TypeVar("T", bound=BaseModel)


class GroqAIService:
    """
    Centralized Single AI Service using Groq API.
    Handles repository summarization, code explanations, bug analyses,
    security contextualization, PR reviews, doc generation, and test generation.
    Strictly backend-only; ensures secrets are never exposed to clients or logs.
    """

    def __init__(self):
        self.api_url = f"{settings.GROQ_API_BASE_URL.rstrip('/')}/chat/completions"
        self.model = settings.GROQ_MODEL
        self.timeout = settings.GROQ_TIMEOUT_SECONDS
        self.max_retries = settings.GROQ_MAX_RETRIES

    def _sanitize(self, text: str) -> str:
        return sanitize_api_secrets(str(text), configured_key=settings.GROQ_API_KEY)

    async def _call_groq_api(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: Optional[Type[T]] = None,
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        """
        Executes a direct async HTTPS call to Groq API.
        Handles missing keys, rate limits (HTTP 429) with exponential backoff, and timeouts.
        """
        # If API key is not configured (or is placeholder)
        if not settings.is_groq_configured:
            if settings.ALLOW_MOCK_FALLBACK:
                logger.info("Groq API key not configured. Using schema-validated mock fallback response.")
                return {"_is_mock": True}
            else:
                raise HTTPException(
                    status_code=status.HTTP_424_FAILED_DEPENDENCY,
                    detail=(
                        "Groq API key is not configured or using placeholder. "
                        "Please set GROQ_API_KEY in backend/.env to enable live AI features."
                    )
                )

        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY.strip()}",
            "Content-Type": "application/json",
        }

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }

        # Request JSON mode if a structured response model is expected
        if response_model is not None:
            payload["response_format"] = {"type": "json_object"}

        last_error: Optional[Exception] = None

        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(self.api_url, headers=headers, json=payload)

                # Check for rate limiting
                if response.status_code == 429:
                    wait_time = (2 ** attempt) * 1.5
                    logger.warning(
                        "Groq API rate limit (429) hit. Retrying in %ss (attempt %s/%s)...",
                        wait_time, attempt + 1, self.max_retries
                    )
                    await asyncio.sleep(wait_time)
                    continue

                # Authentication error
                if response.status_code in (401, 403):
                    logger.error("Groq API authentication failed. Check GROQ_API_KEY.")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid Groq API Key. Please verify GROQ_API_KEY in backend/.env."
                    )

                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {}).get("total_tokens")

                if response_model is not None:
                    parsed_json = json.loads(content)
                    return {"data": parsed_json, "tokens": usage, "_is_mock": False}

                return {"content": content, "tokens": usage, "_is_mock": False}

            except httpx.TimeoutException as exc:
                last_error = exc
                logger.warning("Groq API request timed out (attempt %s/%s).", attempt + 1, self.max_retries)
                await asyncio.sleep(1.0)
            except HTTPException:
                raise
            except Exception as exc:
                last_error = exc
                sanitized_msg = self._sanitize(str(exc))
                logger.error("Groq API error on attempt %s: %s", attempt + 1, sanitized_msg)
                await asyncio.sleep(1.0)

        # If retries exhausted
        if settings.ALLOW_MOCK_FALLBACK:
            logger.warning("Groq API call failed after retries. Falling back to mock generator: %s", self._sanitize(str(last_error)))
            return {"_is_mock": True}

        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Groq API service unavailable or timed out: {self._sanitize(str(last_error))}"
        )

    # =========================================================================
    # 1. Repository Summarization
    # =========================================================================
    async def summarize_repository(
        self,
        repo_name: str,
        primary_language: str = "Polyglot",
        file_tree_summary: Optional[str] = None,
        context_notes: Optional[str] = None,
    ) -> RepoSummaryResponse:
        system_prompt = (
            "You are a principal software architect at Bugveil. Analyze the repository structure and "
            "provide an executive architecture summary, technical debt assessment, and component breakdown. "
            "Return valid JSON matching this schema: {"
            "'overview': str, 'architecture_style': str, 'primary_languages': [str], "
            "'core_components': [{'name': str, 'purpose': str, 'key_files': [str]}], "
            "'entry_points': [str], 'dependencies_summary': str, "
            "'technical_debt_assessment': str, 'recommended_next_steps': [str]}"
        )
        user_prompt = (
            f"Repository Name: {repo_name}\nPrimary Language: {primary_language}\n"
            f"File Tree Structure:\n{file_tree_summary or 'Standard project files'}\n"
            f"Context Notes:\n{context_notes or 'None'}"
        )

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=RepoSummaryResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return RepoSummaryResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                **data
            )

        # Mock / Fallback Response
        return RepoSummaryResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            overview=(
                f"{repo_name} is a structured {primary_language} application featuring modular separation of "
                f"concerns, client-server decoupling, and typed interface contracts."
            ),
            architecture_style="Modular Monolith with Service-Oriented Domain Layer",
            primary_languages=[primary_language, "JSON", "Markdown"],
            core_components=[
                CoreComponent(name="Core Services", purpose="Encapsulates business workflows and domain rules.", key_files=["src/services/"]),
                CoreComponent(name="Data Access Layer", purpose="Handles persistence models and query execution.", key_files=["src/models/", "src/database/"]),
                CoreComponent(name="API Boundary", purpose="Exposes REST endpoints with input validation schemas.", key_files=["src/api/"]),
            ],
            entry_points=["main.py", "index.ts", "app.py"],
            dependencies_summary="Uses modern standard libraries with minimal external runtime overhead.",
            technical_debt_assessment="Low to moderate. Opportunities exist for expanding automated test suites and adding comprehensive API docstrings.",
            recommended_next_steps=[
                "Run static security scans across dependencies.",
                "Generate architecture documentation for onboarding.",
                "Review uncovered edge cases in core modules.",
            ]
        )

    # =========================================================================
    # 2. Code Explanation
    # =========================================================================
    async def explain_code(
        self,
        code: str,
        language: str = "python",
        file_path: Optional[str] = None,
        symbol_name: Optional[str] = None,
        explanation_level: str = "technical",
    ) -> CodeExplanationResponse:
        system_prompt = (
            f"You are a senior engineer explaining {language} code at a {explanation_level} level. "
            "Explain inputs, outputs, logic steps, dependencies, potential edge cases, and blast radius. "
            "Return valid JSON matching: {"
            "'what_it_does': str, 'how_it_works': str, "
            "'inputs': [{'name': str, 'type': str, 'description': str}], "
            "'outputs': [{'type': str, 'description': str}], "
            "'dependencies': [str], 'important_logic_steps': [str], "
            "'potential_problems': [str], 'blast_radius_and_impact': str}"
        )
        user_prompt = f"File: {file_path or 'unknown'}\nSymbol: {symbol_name or 'block'}\nCode:\n```{language}\n{code}\n```"

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=CodeExplanationResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return CodeExplanationResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                file_path=file_path,
                symbol_name=symbol_name,
                explanation_level=explanation_level,
                **data
            )

        # Mock / Fallback Response
        if explanation_level == "beginner":
            what = "This code takes input data, performs calculations or transformations, and returns the result safely."
            how = "It works step-by-step like a recipe: reading inputs, checking if they are valid, and producing output."
        else:
            what = f"Implements deterministic logic for {symbol_name or 'the routine'}, ensuring typed inputs and predictable state transitions."
            how = "Executes sequential transformation pipeline, validates parameter preconditions, and handles exceptional branches."

        return CodeExplanationResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            file_path=file_path,
            symbol_name=symbol_name,
            explanation_level=explanation_level,
            what_it_does=what,
            how_it_works=how,
            inputs=[
                ParameterInfo(name="params", type="Record / Arguments", description="Primary data payload processed by the function.")
            ],
            outputs=[
                OutputInfo(type="Result Object", description="Transformed result or status confirmation.")
            ],
            dependencies=["standard library", "runtime runtime helpers"],
            important_logic_steps=[
                "1. Receives input arguments and validates boundary constraints.",
                "2. Performs core domain transformation or computational step.",
                "3. Catches anomalies and returns normalized response.",
            ],
            potential_problems=[
                "Unhandled null or unexpected input shapes could trigger exceptions.",
                "Ensure asynchronous calls include proper timeout boundaries.",
            ],
            blast_radius_and_impact=(
                f"Modifying this symbol directly impacts downstream callers in {file_path or 'the module'}. "
                "Ensure corresponding unit tests are executed before applying modifications."
            )
        )

    # =========================================================================
    # 3. Bug Analysis
    # =========================================================================
    async def analyze_bugs(
        self,
        code: str,
        language: str = "python",
        file_path: Optional[str] = None,
        context: Optional[str] = None,
        static_findings: Optional[list] = None,
    ) -> BugAnalysisResponse:
        system_prompt = (
            "You are a static analysis and debugging specialist at Bugveil. Identify logical flaws, "
            "off-by-one errors, unhandled null values, race conditions, and edge cases. "
            "Return valid JSON matching: {"
            "'overall_bug_risk': 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', "
            "'bugs_found': [{'title': str, 'severity': str, 'line_number': int, 'code_snippet': str, 'root_cause': str, 'reproduction_scenario': str, 'suggested_fix': str}], "
            "'recommendations': [str]}"
        )
        user_prompt = (
            f"Language: {language}\nFile: {file_path or 'Snippet'}\nContext: {context or 'None'}\n"
            f"Known Static Findings: {json.dumps(static_findings or [])}\n"
            f"Code:\n```{language}\n{code}\n```"
        )

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=BugAnalysisResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return BugAnalysisResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                file_path=file_path,
                **data
            )

        # Mock / Fallback Response
        return BugAnalysisResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            file_path=file_path,
            overall_bug_risk="MEDIUM",
            bugs_found=[
                BugItem(
                    title="Potential Null Dereference or Missing Validation",
                    severity="MEDIUM",
                    line_number=2,
                    code_snippet="data = process_payload(input_param)",
                    root_cause="Input arguments are processed without explicit null/empty checks.",
                    reproduction_scenario="Passing `None` or an empty dictionary triggers an AttributeError.",
                    suggested_fix="Add defensive validation: `if not input_param: raise ValueError('Payload required')`",
                )
            ],
            recommendations=[
                "Add defensive parameter assertions at function boundaries.",
                "Implement boundary test cases for empty, null, and overflow values.",
            ]
        )

    # =========================================================================
    # 4. Security Analysis
    # =========================================================================
    async def analyze_security(
        self,
        code: str,
        language: str = "python",
        file_path: Optional[str] = None,
        context: Optional[str] = None,
        static_findings: Optional[list] = None,
    ) -> SecurityAnalysisResponse:
        system_prompt = (
            "You are a cybersecurity auditor at Bugveil. Inspect code for security vulnerabilities "
            "(OWASP Top 10, injection, insecure deserialization, secret leakage, broken auth). "
            "Return valid JSON matching: {"
            "'security_score': float, "
            "'vulnerabilities': [{'title': str, 'cwe_id': str, 'severity': str, 'affected_file': str, 'line_number': int, 'attack_vector': str, 'impact': str, 'remediation_code': str}], "
            "'compliance_notes': str, 'hardened_code_recommendations': [str]}"
        )
        user_prompt = (
            f"Language: {language}\nFile: {file_path or 'Snippet'}\n"
            f"Context: {context or 'None'}\nStatic Scan Clues: {json.dumps(static_findings or [])}\n"
            f"Code:\n```{language}\n{code}\n```"
        )

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=SecurityAnalysisResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return SecurityAnalysisResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                **data
            )

        # Mock / Fallback Response
        return SecurityAnalysisResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            security_score=85.0,
            vulnerabilities=[
                SecurityVulnerability(
                    title="Defensive Boundary Sanitization Warning",
                    cwe_id="CWE-20",
                    severity="LOW",
                    affected_file=file_path or "service.py",
                    line_number=1,
                    attack_vector="Malformed input injection",
                    impact="Potential denial of service or unhandled error trace exposure.",
                    remediation_code="Use Pydantic or schema validator to reject untyped parameters.",
                )
            ],
            compliance_notes="Follows general OWASP guidelines with minor defensive enhancements recommended.",
            hardened_code_recommendations=[
                "Ensure all external inputs pass through centralized validation schemas.",
                "Never pass dynamic strings to system shells or unparameterized queries.",
            ]
        )

    # =========================================================================
    # 5. Pull Request Review
    # =========================================================================
    async def review_pull_request(
        self,
        diff_text: str,
        base_ref: str = "main",
        target_ref: str = "feature",
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> PullRequestReviewResponse:
        system_prompt = (
            "You are a staff engineer auditing a pull request diff. Inspect changed hunks for bugs, "
            "security flaws, breaking changes, and missing tests. Return valid JSON matching: {"
            "'summary': str, 'risk_level': 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', "
            "'changed_files_analyzed': int, 'key_changes': [str], "
            "'review_findings': [{'file': str, 'line': int, 'severity': str, 'category': str, 'comment': str, 'suggested_diff': str}], "
            "'breaking_changes': [str], 'testing_recommendations': [str], "
            "'approval_status': 'APPROVED'|'REQUEST_CHANGES'|'COMMENT'}"
        )
        user_prompt = (
            f"PR Title: {title or 'Code Change'}\nPR Description: {description or 'None'}\n"
            f"Base: {base_ref} -> Target: {target_ref}\n"
            f"Git Diff:\n```diff\n{diff_text[:12000]}\n```"
        )

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=PullRequestReviewResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return PullRequestReviewResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                **data
            )

        # Mock / Fallback Response
        return PullRequestReviewResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            summary=f"Audit of pull request from {target_ref} into {base_ref}. Identified clean refactoring with standard verification needed.",
            risk_level="LOW",
            changed_files_analyzed=1,
            key_changes=[
                "Refactored internal logic routines.",
                "Updated input validation checks.",
            ],
            review_findings=[
                PRReviewFinding(
                    file="modified_file.py",
                    line=10,
                    severity="LOW",
                    category="CODE_QUALITY",
                    comment="Consider adding a descriptive docstring explaining this modified branch.",
                    suggested_diff=None,
                )
            ],
            breaking_changes=[],
            testing_recommendations=[
                "Verify automated regression tests pass.",
                "Confirm backwards compatibility with external consumers.",
            ],
            approval_status="APPROVED",
        )

    # =========================================================================
    # 6. Documentation Generation
    # =========================================================================
    async def generate_documentation(
        self,
        repo_name: str,
        doc_type: str = "README",
        context_summary: Optional[str] = None,
        file_manifest: Optional[list] = None,
    ) -> DocGenerationResponse:
        system_prompt = (
            "You are a technical documentation specialist. Generate thorough, accurate markdown documentation "
            f"of type '{doc_type}' for the repository. Return valid JSON matching: {{"
            "'doc_type': str, 'title': str, 'content_markdown': str, "
            "'table_of_contents': [str], 'suggested_filename': str}}"
        )
        user_prompt = (
            f"Repository: {repo_name}\nDocument Type: {doc_type}\n"
            f"Context Summary: {context_summary or 'General codebase overview'}\n"
            f"File Manifest: {json.dumps(file_manifest or [])[:2000]}"
        )

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=DocGenerationResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return DocGenerationResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                **data
            )

        # Mock / Fallback Response
        doc_filename_map = {
            "README": "README.md",
            "ARCHITECTURE": "ARCHITECTURE.md",
            "API": "API_REFERENCE.md",
            "ONBOARDING": "ONBOARDING.md",
        }
        filename = doc_filename_map.get(doc_type.upper(), "DOCUMENTATION.md")

        markdown_body = f"""# {repo_name} — {doc_type.title()} Documentation

> Automated architectural documentation generated by Bugveil.

## 1. System Overview
{repo_name} is designed with modularity, reliability, and security in mind. It provides clear interface boundaries and predictable execution flows.

## 2. Core Architecture
- **API Layer**: Handles incoming requests, verifies authentication, and performs payload validation.
- **Service Layer**: Coordinates business workflows, external integrations, and deterministic calculations.
- **Persistence Layer**: Enforces relational data models and transaction integrity.

## 3. Developer Guidelines
1. Ensure virtual environments or container runtimes are initialized before building.
2. Run automated static checks (`ruff`, `bandit`, `semgrep`) prior to submitting pull requests.
3. Review audit logs for detected code smells or technical debt.
"""

        return DocGenerationResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            doc_type=doc_type,
            title=f"{repo_name} {doc_type.title()} Documentation",
            content_markdown=markdown_body,
            table_of_contents=["1. System Overview", "2. Core Architecture", "3. Developer Guidelines"],
            suggested_filename=filename,
        )

    # =========================================================================
    # 7. Test Generation
    # =========================================================================
    async def generate_tests(
        self,
        code: str,
        language: str = "python",
        framework: str = "pytest",
        context: Optional[str] = None,
    ) -> TestGenerationResponse:
        system_prompt = (
            f"You are a quality assurance automation engineer. Generate a comprehensive unit test suite in {language} "
            f"using {framework}. Cover happy paths, boundary edge cases, and exception handling. "
            "Return valid JSON matching: {"
            "'framework': str, 'test_code': str, "
            "'test_cases': [{'name': str, 'type': 'happy_path'|'edge_case'|'error_handling', 'description': str}], "
            "'coverage_notes': str}"
        )
        user_prompt = f"Target Code ({language}):\n```{language}\n{code}\n```\nContext: {context or 'Unit test suite'}"

        res = await self._call_groq_api(system_prompt, user_prompt, response_model=TestGenerationResponse)

        if not res.get("_is_mock"):
            data = res["data"]
            return TestGenerationResponse(
                model_used=self.model,
                is_mock=False,
                tokens_used=res.get("tokens"),
                **data
            )

        # Mock / Fallback Response
        sample_test = f"""import pytest

def test_happy_path_execution():
    \"\"\"Verify expected output under nominal input conditions.\"\"\"
    # Arrange
    test_input = "sample_data"
    
    # Act & Assert
    assert test_input is not None

def test_edge_case_empty_payload():
    \"\"\"Verify resilient handling of empty or boundary inputs.\"\"\"
    with pytest.raises((ValueError, TypeError)):
        pass  # Ensure boundary checks trigger predictably
"""
        return TestGenerationResponse(
            model_used=f"{self.model} (Simulated)",
            is_mock=True,
            framework=framework,
            test_code=sample_test,
            test_cases=[
                TestCaseItem(name="test_happy_path_execution", type="happy_path", description="Validates nominal execution flow."),
                TestCaseItem(name="test_edge_case_empty_payload", type="edge_case", description="Checks boundary handling for empty inputs."),
            ],
            coverage_notes="Tests cover nominal paths and empty payload boundary conditions.",
        )


ai_service = GroqAIService()
