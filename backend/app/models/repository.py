import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    url = Column(String(512), nullable=True)
    source_type = Column(String(50), nullable=False, default="GITHUB")  # GITHUB or ZIP_UPLOAD
    default_branch = Column(String(100), default="main")
    storage_path = Column(String(512), nullable=False)
    size_bytes = Column(Integer, default=0)
    file_count = Column(Integer, default=0)
    primary_language = Column(String(100), nullable=True)
    language_distribution = Column(JSON, default=dict)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    analyses = relationship("AnalysisJob", back_populates="repository", cascade="all, delete-orphan")
    findings = relationship("Finding", back_populates="repository", cascade="all, delete-orphan")
