import os
import asyncio
from typing import List, Dict, Any, Tuple
from app.services.static_analyzer.base import BaseStaticRunner
from app.services.static_analyzer.models import NormalizedFindingData
from app.services.static_analyzer.ruff_runner import RuffRunner
from app.services.static_analyzer.bandit_runner import BanditRunner
from app.services.static_analyzer.semgrep_runner import SemgrepRunner
from app.services.static_analyzer.polyglot_scanner import PolyglotSecurityScanner


class StaticAnalysisPipeline:
    def __init__(self):
        self.runners: List[BaseStaticRunner] = [
            RuffRunner(),
            BanditRunner(),
            SemgrepRunner(),
            PolyglotSecurityScanner(),
        ]

    def get_available_tools(self) -> List[str]:
        return [runner.tool_name for runner in self.runners if runner.is_available()]

    async def execute_analysis(self, repo_dir: str) -> Tuple[List[NormalizedFindingData], float, Dict[str, int]]:
        """
        Runs all available static analyzers against repo_dir concurrently.
        Computes the normalized findings, quality score, and severity distribution.

        Returns:
            (findings, quality_score, severity_counts)
        """
        if not os.path.exists(repo_dir):
            return [], 100.0, {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}

        active_runners = [r for r in self.runners if r.is_available()]
        
        # Execute runners concurrently
        results = await asyncio.gather(*(runner.run(repo_dir) for runner in active_runners), return_exceptions=True)

        all_findings: List[NormalizedFindingData] = []
        seen_keys = set()

        for res in results:
            if isinstance(res, list):
                for finding in res:
                    # De-duplicate across tools if same file, line, and category
                    dedup_key = (finding.file_path, finding.line_start, finding.title[:40])
                    if dedup_key not in seen_keys:
                        seen_keys.add(dedup_key)
                        all_findings.append(finding)

        # Calculate severity metrics
        counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "informational": 0,
        }

        for f in all_findings:
            sev = f.severity.lower()
            if sev in counts:
                counts[sev] += 1
            else:
                counts["low"] += 1

        # Calculate Quality Score (starts at 100, drops per severity)
        penalty = (
            counts["critical"] * 25.0 +
            counts["high"] * 15.0 +
            counts["medium"] * 8.0 +
            counts["low"] * 3.0 +
            counts["informational"] * 1.0
        )
        quality_score = max(0.0, round(100.0 - penalty, 1))

        # Sort findings by severity priority: CRITICAL -> HIGH -> MEDIUM -> LOW -> INFORMATIONAL
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFORMATIONAL": 4}
        all_findings.sort(key=lambda x: severity_order.get(x.severity, 5))

        return all_findings, quality_score, counts


static_pipeline = StaticAnalysisPipeline()
