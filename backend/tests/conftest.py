import pytest
import pytest_asyncio
from app.core.database import engine, Base


@pytest_asyncio.fixture(autouse=True)
async def reset_database():
    """Ensure every test has a clean database state."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(lambda c: Base.metadata.create_all(c, checkfirst=True))
    yield
