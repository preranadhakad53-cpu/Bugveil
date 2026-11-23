import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.ai_service import ai_service
from app.core.security import sanitize_api_secrets
from app.core.config import settings


@pytest.mark.asyncio
async def test_ai_summarize_repository():
    res = await ai_service.summarize_repository(
        repo_name="demo-legacy-app",
        primary_language="Python",
        file_tree_summary="src/main.py, src/auth.py, src/db.py"
    )
    assert res.overview
    assert res.architecture_style
    assert len(res.core_components) > 0
    assert len(res.recommended_next_steps) > 0
    assert res.model_used


@pytest.mark.asyncio
async def test_ai_explain_code_technical():
    code = (
        "def compute_interest(principal: float, rate: float, time: int) -> float:\n"
        "    if principal <= 0 or rate < 0 or time < 0:\n"
        "        raise ValueError('Invalid financial terms')\n"
        "    return principal * (1 + rate * time)\n"
    )
    res = await ai_service.explain_code(
        code=code,
        language="python",
        file_path="src/finance.py",
        symbol_name="compute_interest",
        explanation_level="technical"
    )
    assert res.what_it_does
    assert res.how_it_works
    assert len(res.inputs) > 0
    assert len(res.outputs) > 0
    assert res.blast_radius_and_impact


@pytest.mark.asyncio
async def test_ai_explain_code_beginner():
    code = "def greet(name): return f'Hello, {name}!'"
    res = await ai_service.explain_code(
        code=code,
        language="python",
        symbol_name="greet",
        explanation_level="beginner"
    )
    assert res.explanation_level == "beginner"
    assert "step-by-step" in res.how_it_works.lower() or "recipe" in res.how_it_works.lower() or len(res.how_it_works) > 10


@pytest.mark.asyncio
async def test_ai_analyze_bugs():
    buggy_code = (
        "def divide_items(items, divisor):\n"
        "    # Potential ZeroDivisionError and TypeError\n"
        "    return [item / divisor for item in items]\n"
    )
    res = await ai_service.analyze_bugs(
        code=buggy_code,
        language="python",
        file_path="src/calc.py"
    )
    assert res.overall_bug_risk in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(res.bugs_found) > 0
    first_bug = res.bugs_found[0]
    assert first_bug.title
    assert first_bug.root_cause
    assert first_bug.suggested_fix


@pytest.mark.asyncio
async def test_ai_analyze_security():
    vulnerable_code = (
        "import pickle\n"
        "def load_untrusted_data(raw_bytes):\n"
        "    return pickle.loads(raw_bytes)\n"
    )
    res = await ai_service.analyze_security(
        code=vulnerable_code,
        language="python",
        file_path="src/loader.py"
    )
    assert res.security_score >= 0.0
    assert len(res.vulnerabilities) > 0
    assert res.vulnerabilities[0].attack_vector
    assert res.vulnerabilities[0].remediation_code


@pytest.mark.asyncio
async def test_ai_review_pull_request():
    diff = (
        "--- a/src/auth.py\n"
        "+++ b/src/auth.py\n"
        "@@ -10,3 +10,4 @@\n"
        "- def verify(password):\n"
        "+ def verify(password, salt=None):\n"
        "+     return bcrypt.checkpw(password, hash)\n"
    )
    res = await ai_service.review_pull_request(
        diff_text=diff,
        base_ref="main",
        target_ref="feature/auth-update",
        title="Update password hashing"
    )
    assert res.summary
    assert res.risk_level in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert res.approval_status in ["APPROVED", "REQUEST_CHANGES", "COMMENT"]
    assert len(res.key_changes) > 0


@pytest.mark.asyncio
async def test_ai_generate_docs():
    res = await ai_service.generate_documentation(
        repo_name="InventoryAPI",
        doc_type="README"
    )
    assert res.doc_type == "README"
    assert "InventoryAPI" in res.title
    assert "# InventoryAPI" in res.content_markdown
    assert "README.md" in res.suggested_filename


@pytest.mark.asyncio
async def test_ai_generate_tests():
    code = "def is_even(n: int) -> bool:\n    return n % 2 == 0\n"
    res = await ai_service.generate_tests(
        code=code,
        language="python",
        framework="pytest"
    )
    assert res.framework == "pytest"
    assert "def test_" in res.test_code
    assert len(res.test_cases) > 0


def test_secret_sanitization():
    fake_key = "gsk_1234567890abcdefghijklmnopqrstuvwxyz"
    log_sample = f"Failed to connect to Groq using key {fake_key} with header Bearer {fake_key}"
    sanitized = sanitize_api_secrets(log_sample, configured_key=fake_key)
    assert fake_key not in sanitized
    assert "[REDACTED" in sanitized


@pytest.mark.asyncio
async def test_ai_http_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test explain-code
        resp = await client.post(
            "/api/v1/ai/explain-code",
            json={
                "code": "def ping(): return 'pong'",
                "language": "python",
                "explanation_level": "technical"
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "what_it_does" in data

        # Test empty code error
        empty_resp = await client.post(
            "/api/v1/ai/explain-code",
            json={"code": "   ", "language": "python"}
        )
        assert empty_resp.status_code == 400
