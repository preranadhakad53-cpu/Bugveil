import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  Info,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { Repository, AnalysisJob, Finding } from '../types';

function severityColor(sev: string): string {
  switch (sev?.toUpperCase()) {
    case 'CRITICAL': return 'text-rose-400 bg-rose-950/40 border-rose-800/50';
    case 'HIGH': return 'text-orange-400 bg-orange-950/40 border-orange-800/50';
    case 'MEDIUM': return 'text-amber-400 bg-amber-950/40 border-amber-800/50';
    case 'LOW': return 'text-blue-400 bg-blue-950/40 border-blue-800/50';
    default: return 'text-slate-400 bg-slate-800/40 border-slate-700/50';
  }
}

export const ReportsPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [analyses, setAnalyses] = useState<AnalysisJob[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisJob | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingsLoading, setIsFindingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    api.getRepositories().then(setRepositories).catch(() => {});
  }, []);

  const handleRepoSelect = async (repoId: string) => {
    setSelectedRepoId(repoId);
    setSelectedAnalysis(null);
    setFindings([]);
    setError(null);
    if (!repoId) return;
    setIsLoading(true);
    try {
      const jobs = await api.getRepositoryAnalyses(repoId);
      setAnalyses(jobs);
      if (jobs.length > 0) {
        const latest = jobs.find((j) => j.status === 'COMPLETED') || jobs[0];
        setSelectedAnalysis(latest);
        await loadFindings(latest.id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load analyses.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFindings = async (analysisId: string) => {
    setIsFindingsLoading(true);
    try {
      const f = await api.getAnalysisFindings(analysisId);
      setFindings(f);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load findings.');
    } finally {
      setIsFindingsLoading(false);
    }
  };

  const selectedRepo = repositories.find((r) => r.id === selectedRepoId);

  // Filtered findings
  const filteredFindings = findings.filter((f) => {
    const sevMatch = severityFilter === 'ALL' || f.severity === severityFilter;
    const catMatch = categoryFilter === 'ALL' || f.category === categoryFilter;
    return sevMatch && catMatch;
  });

  // Group by severity for summary
  const counts = {
    CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
    HIGH: findings.filter((f) => f.severity === 'HIGH').length,
    MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
    LOW: findings.filter((f) => f.severity === 'LOW').length,
    INFORMATIONAL: findings.filter((f) => f.severity === 'INFORMATIONAL').length,
  };

  const securityFindings = findings.filter((f) => f.category === 'SECURITY');
  const affectedFiles = [...new Set(findings.map((f) => f.file_path))];

  // Generate and download Markdown report
  const downloadMarkdown = () => {
    if (!selectedAnalysis || !selectedRepo) return;

    const lines: string[] = [
      `# Bugveil Audit Report`,
      ``,
      `**Repository:** ${selectedRepo.name}`,
      `**Analysis Date:** ${new Date(selectedAnalysis.started_at).toLocaleString()}`,
      `**Quality Score:** ${selectedAnalysis.quality_score?.toFixed(1) ?? 'N/A'}/100`,
      `**Total Findings:** ${selectedAnalysis.total_findings}`,
      ``,
      `---`,
      ``,
      `## Summary`,
      ``,
      `| Severity | Count |`,
      `|----------|-------|`,
      `| 🔴 Critical | ${counts.CRITICAL} |`,
      `| 🟠 High | ${counts.HIGH} |`,
      `| 🟡 Medium | ${counts.MEDIUM} |`,
      `| 🔵 Low | ${counts.LOW} |`,
      `| ⚪ Informational | ${counts.INFORMATIONAL} |`,
      ``,
      `**Affected Files:** ${affectedFiles.length}`,
      ``,
      `---`,
      ``,
      `## Security Findings (${securityFindings.length})`,
      ``,
      ...securityFindings.map((f, i) => [
        `### ${i + 1}. [${f.severity}] ${f.title}`,
        `- **File:** \`${f.file_path}\` (line ${f.line_start})`,
        `- **Source:** ${f.source}`,
        `- **Why it matters:** ${f.why_it_matters || 'N/A'}`,
        `- **Suggested fix:** ${f.suggested_fix || 'N/A'}`,
        f.code_snippet ? `\`\`\`\n${f.code_snippet}\n\`\`\`` : '',
        ``,
      ].join('\n')),
      `---`,
      ``,
      `## All Findings (${findings.length})`,
      ``,
      ...findings.map((f, i) => [
        `### ${i + 1}. [${f.severity}] [${f.category}] ${f.title}`,
        `- **File:** \`${f.file_path}\` (lines ${f.line_start}-${f.line_end})`,
        `- **Source:** ${f.source}`,
        `- **Explanation:** ${f.explanation || 'N/A'}`,
        `- **Why it matters:** ${f.why_it_matters || 'N/A'}`,
        `- **Fix:** ${f.suggested_fix || 'N/A'}`,
        ``,
      ].join('\n')),
      `---`,
      ``,
      `## Affected Files (${affectedFiles.length})`,
      ``,
      ...affectedFiles.map((fp) => `- \`${fp}\``),
      ``,
      `---`,
      `*Generated by Bugveil — Review smarter. Debug deeper.*`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bugveil-audit-${selectedRepo.name}-${Date.now()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download JSON report
  const downloadJSON = () => {
    if (!selectedAnalysis || !selectedRepo) return;
    const report = {
      repository: selectedRepo.name,
      analysis_id: selectedAnalysis.id,
      date: selectedAnalysis.started_at,
      quality_score: selectedAnalysis.quality_score,
      total_findings: selectedAnalysis.total_findings,
      severity_counts: counts,
      affected_files: affectedFiles,
      findings: findings,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bugveil-audit-${selectedRepo.name}-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="panel-card p-4 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Comprehensive Audit Report</h3>
            <p className="text-xs text-slate-400">
              Real findings from static analysis. Download as Markdown or JSON.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedRepoId}
            onChange={(e) => handleRepoSelect(e.target.value)}
            className="bg-[#090d16] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 min-w-[180px]"
          >
            <option value="">Select repository…</option>
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {selectedAnalysis && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={downloadMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> .md
              </button>
              <button
                onClick={downloadJSON}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> .json
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="panel-card flex items-center justify-center py-12 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-xs text-slate-400">Loading analyses…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="panel-card p-4 border-rose-900/40 bg-rose-950/10 flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Empty */}
      {!selectedRepoId && !isLoading && (
        <div className="panel-card flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-10 h-10 text-slate-700 mb-3" />
          <h4 className="text-sm font-medium text-slate-300">No Repository Selected</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Select an analyzed repository to view and export the full audit report.
          </p>
        </div>
      )}

      {/* No analyses */}
      {selectedRepoId && !isLoading && analyses.length === 0 && (
        <div className="panel-card p-6 text-center space-y-2">
          <Info className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">No analysis runs found for this repository.</p>
          <a href="/import" className="text-xs text-blue-400 hover:underline">Run analysis →</a>
        </div>
      )}

      {/* Report content */}
      {selectedAnalysis && (
        <div className="space-y-5">
          {/* Analysis selector */}
          {analyses.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Analysis run:</span>
              <select
                value={selectedAnalysis.id}
                onChange={async (e) => {
                  const job = analyses.find((a) => a.id === e.target.value);
                  if (job) { setSelectedAnalysis(job); await loadFindings(job.id); }
                }}
                className="bg-[#090d16] border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
              >
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.started_at).toLocaleString()} — {a.status} ({a.total_findings} findings)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="panel-card p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{selectedAnalysis.quality_score?.toFixed(0) ?? '—'}</div>
              <div className="text-xs text-slate-400 mt-1">Quality Score</div>
              <div className="text-[10px] text-slate-500">/100</div>
            </div>
            <div className="panel-card p-4 text-center">
              <div className="text-2xl font-bold text-rose-400">{counts.CRITICAL + counts.HIGH}</div>
              <div className="text-xs text-slate-400 mt-1">Critical + High</div>
              <div className="text-[10px] text-slate-500">priority issues</div>
            </div>
            <div className="panel-card p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{findings.length}</div>
              <div className="text-xs text-slate-400 mt-1">Total Findings</div>
              <div className="text-[10px] text-slate-500">all severities</div>
            </div>
            <div className="panel-card p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{affectedFiles.length}</div>
              <div className="text-xs text-slate-400 mt-1">Affected Files</div>
              <div className="text-[10px] text-slate-500">unique paths</div>
            </div>
          </div>

          {/* Severity breakdown */}
          <div className="panel-card p-4">
            <h4 className="text-xs font-semibold text-slate-200 mb-3">Severity Breakdown</h4>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(severityFilter === sev ? 'ALL' : sev)}
                  className={`p-2.5 rounded border transition-colors ${
                    severityFilter === sev
                      ? severityColor(sev) + ' ring-1 ring-inset ring-current'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-base">{counts[sev]}</div>
                  <div className="text-[10px] mt-0.5">{sev}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Category filters + findings */}
          <div className="panel-card p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-semibold text-slate-200">
                Findings ({filteredFindings.length})
              </h4>
              <div className="flex items-center gap-1.5">
                {(['ALL', 'SECURITY', 'BUG', 'QUALITY', 'PERFORMANCE', 'TECH_DEBT'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-colors ${
                      categoryFilter === cat
                        ? 'bg-blue-600/20 text-blue-400 border-blue-600/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {cat === 'ALL' ? 'All' : cat}
                  </button>
                ))}
                {isFindingsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
              </div>
            </div>

            {filteredFindings.length === 0 && !isFindingsLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No findings match the current filter.
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filteredFindings.map((f) => (
                  <div
                    key={f.id}
                    className={`p-3.5 rounded-lg border ${severityColor(f.severity)} space-y-1.5`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold uppercase">{f.severity}</span>
                        <span className="text-[10px] text-slate-500">·</span>
                        <span className="text-[10px] text-slate-400">{f.category}</span>
                        <span className="text-[10px] text-slate-500">·</span>
                        <span className="text-[10px] font-mono text-slate-400">{f.source}</span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-slate-200">{f.title}</p>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                      <FileText className="w-3 h-3" />
                      {f.file_path}:{f.line_start}
                    </div>
                    {f.explanation && (
                      <p className="text-xs text-slate-400 leading-relaxed">{f.explanation}</p>
                    )}
                    {f.why_it_matters && (
                      <p className="text-[11px] text-slate-500">⚠ {f.why_it_matters}</p>
                    )}
                    {f.suggested_fix && (
                      <p className="text-[11px] text-emerald-400">✓ {f.suggested_fix}</p>
                    )}
                    {f.code_snippet && (
                      <pre className="text-[10px] font-mono bg-slate-950/60 p-2 rounded overflow-x-auto text-slate-300 mt-1 whitespace-pre-wrap">
                        {f.code_snippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
