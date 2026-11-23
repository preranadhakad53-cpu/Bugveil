import os
import re
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.repository import Repository
from app.schemas.pull_request import (
    PRAuditRequest,
    PRAuditResponse,
    AuditFinding,
    ImpactAnalysisResult,
)
from app.services.ai_service import ai_service
from app.services.dependency_analyzer import DependencyGraph
from app.services.static_analyzer.polyglot_scanner import SECURITY_RULES

router = APIRouter()


def _parse_diff(diff_text: str):
    """
    Parses a unified git diff into changed files, added lines with line numbers,
    and detected modified symbols (functions, classes).
    """
    modified_files: List[str] = []
    file_added_lines: Dict[str, List[Dict[str, Any]]] = {}
    detected_symbols: List[str] = []

    current_file = None
    new_line_idx = 0

    for line in diff_text.splitlines():
        # Check diff headers for file names
        if line.startswith("+++ b/"):
            current_file = line[6:].strip()
            if current_file not in modified_files and current_file != "/dev/null":
                modified_files.append(current_file)
                file_added_lines[current_file] = []
            continue
        elif line.startswith("diff --git"):
            parts = line.split(" ")
            if len(parts) >= 4:
                cand = parts[3].lstrip("b/").strip()
                if cand and cand not in modified_files:
                    modified_files.append(cand)
                    if cand not in file_added_lines:
                        file_added_lines[cand] = []
                    current_file = cand
            continue

        # Check hunk header @@ -start,count +start,count @@
        hunk_match = re.match(r"^@@\s+-[0-9]+(?:,[0-9]+)?\s+\+([0-9]+)(?:,[0-9]+)?\s+@@", line)
        if hunk_match:
            new_line_idx = int(hunk_match.group(1))
            continue

        if current_file:
            if line.startswith("+") and not line.startswith("+++"):
                added_code = line[1:]
                file_added_lines[current_file].append({
                    "line_no": new_line_idx,
                    "code": added_code,
                })
                # Check for symbol definitions
                sym_match = re.search(r"(?:def|class|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)", added_code)
                if sym_match:
                    detected_symbols.append(sym_match.group(1))
                new_line_idx += 1
            elif line.startswith("-") and not line.startswith("---"):
                pass
            else:
                new_line_idx += 1

    return modified_files, file_added_lines, detected_symbols


@router.post("/audit", response_model=PRAuditResponse)
async def audit_pull_request(
    payload: PRAuditRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Pull Request / Code Change Auditor.
    Combines:
    1. Deterministic Static Security & Syntax Checks (Polyglot scan with 0 hallucinations)
    2. Dependency Blast Radius & Caller Impact Analysis
    3. Groq AI Pull Request Review (Logical bugs, edge cases, breaking changes, missing tests)
    """
    diff_text = payload.diff_text.strip()
    if not diff_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diff text cannot be empty."
        )

    # 1. Parse diff
    modified_files, file_added_lines, detected_symbols = _parse_diff(diff_text)
    if not modified_files:
        # Fallback if raw patch without git headers
        modified_files = ["modified_code_patch.py"]
        file_added_lines["modified_code_patch.py"] = [
            {"line_no": idx + 1, "code": line.lstrip("+")}
            for idx, line in enumerate(diff_text.splitlines())
            if not line.startswith("-")
        ]

    # 2. Deterministic Static Analysis on Diff
    static_findings: List[AuditFinding] = []
    for file_path, entries in file_added_lines.items():
        for item in entries:
            code_line = item["code"]
            line_no = item["line_no"]
            for rule in SECURITY_RULES:
                if rule["regex"].search(code_line):
                    static_findings.append(
                        AuditFinding(
                            id=f"STATIC-{uuid.uuid4().hex[:8]}",
                            title=rule["title"],
                            severity=rule["severity"],
                            category=rule["category"],
                            file=file_path,
                            line_number=line_no,
                            code_snippet=code_line.strip(),
                            explanation=f"Deterministic rule match: {rule['title']} detected in added code.",
                            why_it_matters=rule["why_it_matters"],
                            suggested_fix=rule["suggested_fix"],
                            source="STATIC_ANALYSIS",
                        )
                    )

    # 3. Code Impact Analysis via Dependency Graph (if repo_id provided)
    impact_data = None
    if payload.repo_id:
        result = await db.execute(select(Repository).where(Repository.id == payload.repo_id))
        repo = result.scalar_one_or_none()
        if repo and os.path.exists(repo.storage_path):
            dep_graph = DependencyGraph(repo.storage_path)
            impact_result = dep_graph.compute_impact(modified_files, detected_symbols)
            impact_data = ImpactAnalysisResult(
                impact_level=impact_result["impact_level"],
                summary=impact_result["summary"],
                modified_files=impact_result["modified_files"],
                direct_dependents=impact_result["direct_dependents"],
                transitive_dependents=impact_result["transitive_dependents"],
                affected_callers=impact_result["affected_callers"],
                total_impacted_modules=impact_result["total_impacted_modules"],
            )

    # 4. Groq AI Pull Request Review
    ai_review = await ai_service.review_pull_request(
        diff_text=diff_text,
        base_ref=payload.base_ref or "main",
        target_ref=payload.target_ref or "feature",
        title=payload.title,
    )

    ai_findings: List[AuditFinding] = []
    for f in ai_review.review_findings:
        ai_findings.append(
            AuditFinding(
                id=f"AI-{uuid.uuid4().hex[:8]}",
                title=f"{f.category.replace('_', ' ').title()}: {f.comment[:50]}...",
                severity=f.severity.upper(),
                category=f.category.upper(),
                file=f.file,
                line_number=f.line,
                code_snippet=f.suggested_diff or "",
                explanation=f.comment,
                why_it_matters="Identified by Groq AI review as a potential regression, missing validation, or code quality risk.",
                suggested_fix=f.suggested_diff or "Implement suggested refactoring and add corresponding unit test coverage.",
                source="GROQ_AI",
            )
        )

    all_findings = static_findings + ai_findings

    # Compute risk and approval status
    severities = [f.severity.upper() for f in all_findings]
    if "CRITICAL" in severities:
        computed_risk = "CRITICAL"
        computed_status = "REQUEST_CHANGES"
    elif severities.count("HIGH") >= 2:
        computed_risk = "HIGH"
        computed_status = "REQUEST_CHANGES"
    elif "HIGH" in severities or "MEDIUM" in severities:
        computed_risk = "MEDIUM"
        computed_status = "COMMENT"
    else:
        computed_risk = "LOW"
        computed_status = "APPROVED" if not all_findings else "COMMENT"

    return PRAuditResponse(
        summary=ai_review.summary,
        risk_level=computed_risk,
        approval_status=computed_status,
        total_findings=len(all_findings),
        static_findings_count=len(static_findings),
        ai_findings_count=len(ai_findings),
        findings=all_findings,
        impact=impact_data,
        breaking_changes=ai_review.breaking_changes,
        testing_recommendations=ai_review.testing_recommendations,
        is_mock=ai_review.is_mock,
        model_used=ai_review.model_used,
    )
