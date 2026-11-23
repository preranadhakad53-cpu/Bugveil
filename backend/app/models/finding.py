import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Finding(Base):
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id = Column(String(36), ForeignKey("analysis_jobs.id"), nullable=False)
    repo_id = Column(String(36), ForeignKey("repositories.id"), nullable=False)
    title = Column(String(255), nullable=False)
    severity = Column(String(20), nullable=False)  # CRITICAL, HIGH, MEDIUM, LOW, INFORMATIONAL
    category = Column(String(50), nullable=False)  # SECURITY, BUG, QUALITY, PERFORMANCE, TECH_DEBT
    source = Column(String(50), nullable=False)    # RUFF, BANDIT, SEMGREP, GROQ_AI
    file_path = Column(String(512), nullable=False)
    line_start = Column(Integer, nullable=False, default=1)
    line_end = Column(Integer, nullable=False, default=1)
    code_snippet = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    why_it_matters = Column(Text, nullable=True)
    suggested_fix = Column(Text, nullable=True)
    confidence = Column(Float, default=1.0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    repository = relationship("Repository", back_populates="findings")
    analysis = relationship("AnalysisJob", back_populates="findings")
