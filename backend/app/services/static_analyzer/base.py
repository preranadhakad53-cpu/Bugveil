from abc import ABC, abstractmethod
from typing import List
from app.services.static_analyzer.models import NormalizedFindingData


class BaseStaticRunner(ABC):
    """
    Abstract contract for static analysis runners.
    Ensures deterministic, normalized findings.
    """
    @property
    @abstractmethod
    def tool_name(self) -> str:
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the tool executable or library is installed and runnable."""
        pass

    @abstractmethod
    async def run(self, repo_dir: str) -> List[NormalizedFindingData]:
        """Execute the static analyzer against the target repo and normalize findings."""
        pass
