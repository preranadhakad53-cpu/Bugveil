import os
import sys
import json
import shutil
import asyncio
from typing import List, Optional
from app.services.static_analyzer.base import BaseStaticRunner
from app.services.static_analyzer.models import NormalizedFindingData


class BanditRunner(BaseStaticRunner):
    @property
    def tool_name(self) -> str:
        return "BANDIT"

    def _get_executable(self) -> Optional[str]:
        venv_bin = os.path.join(sys.prefix, "Scripts" if os.name == "nt" else "bin", "bandit.exe" if os.name == "nt" else "bandit")
        if os.path.isfile(venv_bin):
            return venv_bin
        return shutil.which("bandit")

    def is_available(self) -> bool:
        return self._get_executable() is not None

    async def run(self, repo_dir: str) -> List[NormalizedFindingData]:
        exe = self._get_executable()
        if not exe or not os.path.exists(repo_dir):
            return []

        # Run bandit recursively with JSON output
        cmd = [
            exe,
            "-r",
            repo_dir,
            "-f",
            "json",
            "-q",
        ]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            output_str = stdout.decode("utf-8", errors="replace")

            if not output_str.strip():
                return []

            raw_data = json.loads(output_str)
            raw_results = raw_data.get("results", [])
        except Exception:
            return []

        findings: List[NormalizedFindingData] = []
        for issue in raw_results:
            test_id = issue.get("test_id", "SEC")
            test_name = issue.get("test_name", "security_issue")
            issue_text = issue.get("issue_text", "Security flaw identified by Bandit")
            abs_filename = issue.get("filename", "")
            rel_file = os.path.relpath(abs_filename, repo_dir).replace("\\", "/")

            line_number = issue.get("line_number", 1)
            line_range = issue.get("line_range", [line_number])
            line_start = line_range[0] if line_range else line_number
            line_end = line_range[-1] if line_range else line_number

            raw_sev = issue.get("issue_severity", "MEDIUM").upper()
            raw_conf = issue.get("issue_confidence", "MEDIUM").upper()

            # Map to standard severities
            if raw_sev == "HIGH":
                severity = "CRITICAL" if raw_conf == "HIGH" else "HIGH"
            elif raw_sev == "MEDIUM":
                severity = "HIGH" if raw_conf == "HIGH" else "MEDIUM"
            else:
                severity = "LOW"

            conf_map = {"HIGH": 1.0, "MEDIUM": 0.8, "LOW": 0.5}
            confidence = conf_map.get(raw_conf, 0.8)

            code_snippet = issue.get("code", "").strip("\n")
            more_info = issue.get("more_info", "")

            why_it_matters = (
                f"AST security scanner detected an unsafe pattern ({test_name}). "
                "This could allow unauthorized code execution, credential theft, or resource hijacking if exploited."
            )

            suggested_fix = (
                f"Replace insecure construct identified by {test_id}. "
                f"Consult reference documentation: {more_info}" if more_info else "Review and remediate according to OWASP secure coding guidelines."
            )

            findings.append(
                NormalizedFindingData(
                    title=f"[{test_id}] {issue_text}",
                    severity=severity,
                    category="SECURITY",
                    source="BANDIT",
                    file_path=rel_file,
                    line_start=line_start,
                    line_end=line_end,
                    code_snippet=code_snippet,
                    explanation=f"Bandit security check {test_id} ({test_name}) failed: {issue_text}",
                    why_it_matters=why_it_matters,
                    suggested_fix=suggested_fix,
                    confidence=confidence
                )
            )

        return findings
