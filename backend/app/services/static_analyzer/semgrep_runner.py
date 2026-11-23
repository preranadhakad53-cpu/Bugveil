import os
import json
import shutil
import asyncio
from typing import List, Optional
from app.services.static_analyzer.base import BaseStaticRunner
from app.services.static_analyzer.models import NormalizedFindingData


class SemgrepRunner(BaseStaticRunner):
    @property
    def tool_name(self) -> str:
        return "SEMGREP"

    def is_available(self) -> bool:
        return shutil.which("semgrep") is not None

    async def run(self, repo_dir: str) -> List[NormalizedFindingData]:
        if not self.is_available() or not os.path.exists(repo_dir):
            return []

        cmd = [
            "semgrep",
            "scan",
            "--json",
            "--quiet",
            "--config=auto",
            repo_dir,
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            output_str = stdout.decode("utf-8", errors="replace")

            if not output_str.strip():
                return []

            raw_data = json.loads(output_str)
            raw_results = raw_data.get("results", [])
        except Exception:
            return []

        findings: List[NormalizedFindingData] = []
        for item in raw_results:
            check_id = item.get("check_id", "semgrep-rule")
            extra = item.get("extra", {})
            message = extra.get("message", "Semgrep security finding")
            raw_sev = extra.get("severity", "WARNING").upper()

            # Severity mapping
            if raw_sev == "ERROR":
                severity = "HIGH"
            elif raw_sev == "WARNING":
                severity = "MEDIUM"
            else:
                severity = "LOW"

            abs_path = item.get("path", "")
            rel_file = os.path.relpath(abs_path, repo_dir).replace("\\", "/") if os.path.isabs(abs_path) else abs_path

            start = item.get("start", {})
            end = item.get("end", {})
            line_start = start.get("line", 1)
            line_end = end.get("line", line_start)

            code_snippet = extra.get("lines", "").strip("\n")
            fix_rec = extra.get("fix", "Review Semgrep rule documentation and refactor code to avoid known vulnerability.")

            findings.append(
                NormalizedFindingData(
                    title=f"[{check_id.split('.')[-1]}] {message[:120]}",
                    severity=severity,
                    category="SECURITY",
                    source="SEMGREP",
                    file_path=rel_file,
                    line_start=line_start,
                    line_end=line_end,
                    code_snippet=code_snippet,
                    explanation=f"Semgrep rule '{check_id}' triggered: {message}",
                    why_it_matters="Semgrep semantic pattern matched a known vulnerability pattern or insecure library usage.",
                    suggested_fix=fix_rec,
                    confidence=0.9
                )
            )

        return findings
