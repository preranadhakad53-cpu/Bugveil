import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database_connected"] is True
        assert "version" in data
        assert "groq_configured" in data


@pytest.mark.asyncio
async def test_dashboard_summary_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/dashboard/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["repositories_count"] == 0
        assert data["analyzed_repositories_count"] == 0
        assert data["total_findings_count"] == 0
        assert data["critical_findings_count"] == 0
        assert data["security_findings_count"] == 0
        assert data["recent_activities"] == []


@pytest.mark.asyncio
async def test_settings_config():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/settings/config")
        assert response.status_code == 200
        data = response.json()
        assert data["project_name"] == "Bugveil"
        assert len(data["tools"]) > 0
        tool_map = {t["name"]: t["installed"] for t in data["tools"]}
        assert tool_map["Ruff"] is True
        assert tool_map["Bandit"] is True
        assert tool_map["Git"] is True
