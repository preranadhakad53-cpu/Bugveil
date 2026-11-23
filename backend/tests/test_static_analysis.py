import os
import io
import zipfile
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.static_analyzer.pipeline import static_pipeline
from app.services.static_analyzer.polyglot_scanner import PolyglotSecurityScanner
from app.services.static_analyzer.ruff_runner import RuffRunner
from app.services.static_analyzer.bandit_runner import BanditRunner


def create_vulnerable_project_zip() -> bytes:
    """
    Creates an in-memory zip archive with real source files containing known vulnerabilities:
    - Bandit: Pickle deserialization (B301/B403), weak MD5 hash (B303)
    - Ruff: Undefined variable name (F821), unused import (F401)
    - Polyglot: Hardcoded AWS key, eval(), dangerouslySetInnerHTML, hardcoded DB URI
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        # Python with Bandit & Ruff issues
        zf.writestr(
            "src/vulnerable_service.py",
            "import os\n"
            "import math\n"  # Unused import (Ruff F401)
            "import pickle\n"  # Insecure deserialization (Bandit B403)
            "import hashlib\n"
            "\n"
            "def unsafe_deserialize(payload):\n"
            "    return pickle.loads(payload)\n"
            "\n"
            "def hash_password(password):\n"
            "    return hashlib.md5(password.encode()).hexdigest()\n"  # Weak hash (Bandit B303 / Polyglot SEC-007)
            "\n"
            "def call_undefined():\n"
            "    return non_existent_variable + 10\n"  # Undefined name (Ruff F821)
        )

        # JavaScript/React with XSS & Eval flaws
        zf.writestr(
            "frontend/component.tsx",
            "import React from 'react';\n"
            "\n"
            "export const UserView = ({ userInput, rawHtml }) => {\n"
            "    const parsed = eval(userInput);\n"  # Dangerous eval (Polyglot SEC-004)
            "    return <div dangerouslySetInnerHTML={{ __html: rawHtml }} />;\n"  # Dangerous HTML (Polyglot SEC-005)
            "};\n"
        )

        # Config with hardcoded credentials
        zf.writestr(
            "config/settings.py",
            "# Production Configuration\n"
            "AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'\n"  # AWS Access Key (Polyglot SEC-001)
            "DATABASE_URL = 'postgresql://admin:super_secret_password99@10.0.0.5:5432/prod_db'\n"  # DB credentials (Polyglot SEC-003)
        )

    buf.seek(0)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_static_analysis_direct_pipeline(tmp_path):
    # Unpack vulnerable project directly into tmp_path
    zip_bytes = create_vulnerable_project_zip()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(tmp_path)

    findings, score, counts = await static_pipeline.execute_analysis(str(tmp_path))

    # Assertions
    assert len(findings) > 0, "Pipeline should detect issues in the vulnerable project"
    assert counts["critical"] >= 2, "Should identify critical AWS key and DB credentials"
    assert counts["high"] >= 1, "Should identify high severity eval/pickle issues"
    assert score < 70.0, f"Quality score ({score}) should be penalized for critical/high findings"

    # Verify normalization format of all findings
    for f in findings:
        assert f.title, "Finding must have title"
        assert f.severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"]
        assert f.category in ["SECURITY", "BUG", "QUALITY", "PERFORMANCE", "TECH_DEBT"]
        assert f.source in ["RUFF", "BANDIT", "SEMGREP", "SECURITY_SCAN"]
        assert f.file_path, "Finding must specify file path"
        assert f.line_start >= 1, "Finding must specify start line"
        assert f.why_it_matters, "Finding must explain why it matters"
        assert f.suggested_fix, "Finding must provide suggested fix"

    titles = [f.title for f in findings]
    # Check specific detections
    assert any("AWS" in t for t in titles)
    assert any("Database Connection" in t or "postgresql" in t.lower() for t in titles)
    assert any("eval" in t.lower() for t in titles)
    assert any("dangerouslySetInnerHTML" in t or "html" in t.lower() for t in titles)


@pytest.mark.asyncio
async def test_end_to_end_static_analysis_api():
    zip_bytes = create_vulnerable_project_zip()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Upload repository
        upload_resp = await client.post(
            "/api/v1/repositories/upload-zip",
            files={"file": ("vulnerable_app.zip", zip_bytes, "application/zip")},
            data={"name": "Vulnerable Demo App"}
        )
        assert upload_resp.status_code == 201
        repo = upload_resp.json()
        repo_id = repo["id"]

        # 2. Trigger static analysis
        run_resp = await client.post(
            "/api/v1/analysis/run",
            json={"repo_id": repo_id}
        )
        assert run_resp.status_code == 201
        job = run_resp.json()
        assert job["status"] == "COMPLETED"
        assert job["total_findings"] > 0
        assert job["critical_count"] > 0
        assert job["quality_score"] < 100.0
        analysis_id = job["id"]

        # 3. Retrieve normalized findings via API
        findings_resp = await client.get(f"/api/v1/analysis/{analysis_id}/findings")
        assert findings_resp.status_code == 200
        findings = findings_resp.json()
        assert len(findings) == job["total_findings"]

        first_finding = findings[0]
        assert "title" in first_finding
        assert "severity" in first_finding
        assert "code_snippet" in first_finding
        assert "suggested_fix" in first_finding

        # 4. Filter findings by category=SECURITY
        sec_resp = await client.get(
            f"/api/v1/analysis/{analysis_id}/findings",
            params={"category": "SECURITY"}
        )
        assert sec_resp.status_code == 200
        sec_findings = sec_resp.json()
        assert len(sec_findings) > 0
        for f in sec_findings:
            assert f["category"] == "SECURITY"

        # 5. Verify Dashboard summary metrics updated in real-time
        dash_resp = await client.get("/api/v1/dashboard/summary")
        assert dash_resp.status_code == 200
        dash = dash_resp.json()
        assert dash["repositories_count"] >= 1
        assert dash["analyzed_repositories_count"] >= 1
        assert dash["total_findings_count"] > 0
        assert dash["critical_findings_count"] > 0
        assert dash["security_findings_count"] > 0
        assert dash["average_quality_score"] is not None

        # Clean up
        await client.delete(f"/api/v1/repositories/{repo_id}")
