import io
import os
import zipfile
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import validate_github_url, is_safe_relative_path
from app.services.language_detector import detect_file_language, is_binary_or_ignored_file


def test_url_validation():
    # Valid URLs
    assert validate_github_url("https://github.com/psf/requests") is True
    assert validate_github_url("https://github.com/pallets/flask.git") is True
    assert validate_github_url("https://github.com/torvalds/linux/") is True

    # Invalid / Malicious / SSRF URLs
    assert validate_github_url("http://github.com/psf/requests") is False  # Must be HTTPS
    assert validate_github_url("https://gitlab.com/psf/requests") is False  # Only GitHub
    assert validate_github_url("https://github.com/../../etc/passwd") is False
    assert validate_github_url("http://169.254.169.254/latest/meta-data") is False
    assert validate_github_url("http://localhost:8000") is False
    assert validate_github_url("file:///etc/passwd") is False


def test_path_traversal_detection(tmp_path):
    base_dir = str(tmp_path)
    assert is_safe_relative_path(base_dir, "src/main.py") is True
    assert is_safe_relative_path(base_dir, "nested/deep/file.ts") is True
    assert is_safe_relative_path(base_dir, "../../../etc/passwd") is False
    assert is_safe_relative_path(base_dir, "..\\..\\windows\\system32") is False


def test_language_detection():
    assert detect_file_language("main.py") == "Python"
    assert detect_file_language("App.tsx") == "TypeScript"
    assert detect_file_language("server.js") == "JavaScript"
    assert detect_file_language("main.go") == "Go"
    assert detect_file_language("lib.rs") == "Rust"
    assert detect_file_language("Dockerfile") == "Dockerfile"


def create_sample_zip() -> bytes:
    """Create an in-memory sample zip with python, typescript, and ignored files."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("src/main.py", "def add(a, b):\n    return a + b\n\nprint(add(2, 3))\n")
        zf.writestr("src/utils.py", "import os\n\ndef get_greeting():\n    return 'Hello World'\n")
        zf.writestr("frontend/index.ts", "console.log('TypeScript frontend');\n")
        zf.writestr("node_modules/bad_package/index.js", "console.log('should be ignored');\n")
        zf.writestr(".env", "SECRET=should_be_ignored\n")
        zf.writestr("README.md", "# Sample Repository\nThis is a test repo.\n")
    buffer.seek(0)
    return buffer.getvalue()


def create_malicious_zip_slip() -> bytes:
    """Create a zip with a path traversal filename."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("../../etc/passwd", "root:x:0:0:root:/root:/bin/bash\n")
    buffer.seek(0)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_zip_upload_and_file_inspection():
    zip_bytes = create_sample_zip()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Upload ZIP
        response = await client.post(
            "/api/v1/repositories/upload-zip",
            files={"file": ("sample_repo.zip", zip_bytes, "application/zip")},
            data={"name": "Sample Test Project"}
        )
        assert response.status_code == 201
        data = response.json()
        repo_id = data["id"]
        assert data["name"] == "Sample Test Project"
        assert data["source_type"] == "ZIP_UPLOAD"
        assert data["file_count"] >= 3  # node_modules and .env ignored!
        assert data["primary_language"] in ["Python", "TypeScript"]
        assert "Python" in data["language_distribution"]

        # 2. Get File Tree
        tree_resp = await client.get(f"/api/v1/repositories/{repo_id}/files")
        assert tree_resp.status_code == 200
        tree_data = tree_resp.json()
        assert tree_data["total_files"] >= 3
        assert "tree" in tree_data

        # 3. Read specific file content
        content_resp = await client.get(
            f"/api/v1/repositories/{repo_id}/file-content",
            params={"path": "src/main.py"}
        )
        assert content_resp.status_code == 200
        content_data = content_resp.json()
        assert "def add(a, b):" in content_data["content"]
        assert content_data["line_count"] == 5

        # 4. Verify Path Traversal prevention on file reading
        traversal_resp = await client.get(
            f"/api/v1/repositories/{repo_id}/file-content",
            params={"path": "../../../etc/passwd"}
        )
        assert traversal_resp.status_code == 403

        # 5. Delete repository
        del_resp = await client.delete(f"/api/v1/repositories/{repo_id}")
        assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_zip_slip_rejection():
    malicious_bytes = create_malicious_zip_slip()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/repositories/upload-zip",
            files={"file": ("malicious.zip", malicious_bytes, "application/zip")},
            data={"name": "Malicious Test"}
        )
        # Should be rejected with 400 Bad Request
        assert response.status_code == 400
        assert "Path traversal attempt detected" in response.json()["detail"]
