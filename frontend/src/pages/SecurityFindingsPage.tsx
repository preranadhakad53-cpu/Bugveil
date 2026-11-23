import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Play,
  Loader2,
  FileCode,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wrench,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { api } from '../services/api';
import { Repository, AnalysisJob, Finding } from '../types';

export const SecurityFindingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const repoIdParam = searchParams.get('repoId');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisJob | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  
  // Filter States
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');

  // UI States
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // 1. Fetch repositories
  useEffect(() => {
    const loadRepos = async () => {
      try {
        setIsLoadingRepos(true);
        const repos = await api.getRepositories();
        setRepositories(repos);

        if (repos.length > 0) {
          const target = repoIdParam && repos.some((r) => r.id === repoIdParam)
            ? repoIdParam
            : repos[0].id;
          setSelectedRepoId(target);
        }
      } catch (err) {
        console.error('Failed to load repositories', err);
      } finally {
        setIsLoadingRepos(false);
      }
    };
    loadRepos();
  }, [repoIdParam]);

  // 2. Fetch latest analysis for selected repository
  useEffect(() => {
    if (!selectedRepoId) return;

    const loadLatestAnalysis = async () => {
      try {
        const analyses = await api.getRepositoryAnalyses(selectedRepoId);
        if (analyses.length > 0) {
          const latest = analyses[0];
          setActiveAnalysis(latest);
          const findingsData = await api.getAnalysisFindings(latest.id);
          setFindings(findingsData);
        } else {
          setActiveAnalysis(null);
          setFindings([]);
        }
      } catch (err) {
        console.error('Failed to load analysis', err);
      }
    };

    loadLatestAnalysis();
    setSearchParams({ repoId: selectedRepoId });
  }, [selectedRepoId]);

  // 3. Trigger new static scan
  const handleRunScan = async () => {
    if (!selectedRepoId) return;

    try {
      setIsScanning(true);
      const newJob = await api.triggerAnalysis(selectedRepoId);
      setActiveAnalysis(newJob);
      const findingsData = await api.getAnalysisFindings(newJob.id);
      setFindings(findingsData);
    } catch (err: any) {
      alert(`Scan failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // 4. Client-side filtering
  const filteredFindings = findings.filter((f) => {
    if (selectedSeverity !== 'ALL' && f.severity !== selectedSeverity) return false;
    if (selectedCategory !== 'ALL' && f.category !== selectedCategory) return false;
    if (selectedSource !== 'ALL' && f.source !== selectedSource) return false;
    return true;
  });

  const getSeverityBadgeVariant = (severity: string): 'danger' | 'warning' | 'info' | 'default' => {
    switch (severity) {
      case 'CRITICAL':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'default';
    }
  };

  if (isLoadingRepos) {
    return (
      <div className="panel-card p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span>Loading static analysis workspace...</span>
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No Repositories Available"
        description="Import a repository to execute deterministic static analysis with Ruff, Bandit, and Semgrep."
        actionText="Import Repository"
        actionHref="/import"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="panel-card p-5 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Deterministic Static Security Engine
              </h3>
              <Badge variant="success">Milestone 3 Active</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero-hallucination code auditor powered by Bandit, Ruff, and polyglot security rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedRepoId}
            onChange={(e) => setSelectedRepoId(e.target.value)}
            disabled={isScanning}
            className="bg-[#090d16] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
          >
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name} ({repo.file_count} files)
              </option>
            ))}
          </select>

          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium transition-colors shadow-sm shrink-0"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Scan...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Static Audit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Metrics Banner (if scan exists) */}
      {activeAnalysis && (
        <div className="panel-card p-5 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Quality Score
            </span>
            <div className="text-2xl font-bold font-mono text-slate-100 flex items-center gap-2">
              <span>{activeAnalysis.quality_score}/100</span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono ${
                  activeAnalysis.quality_score >= 80
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                    : activeAnalysis.quality_score >= 50
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                }`}
              >
                {activeAnalysis.quality_score >= 80 ? 'Good' : activeAnalysis.quality_score >= 50 ? 'Needs Work' : 'Critical'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Total Findings
            </span>
            <div className="text-2xl font-bold font-mono text-slate-200">
              {activeAnalysis.total_findings}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-rose-400 tracking-wider">
              Critical
            </span>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {activeAnalysis.critical_count}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider">
              High
            </span>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {activeAnalysis.high_count}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Analyzers Active
            </span>
            <div className="text-xs font-mono text-slate-300 pt-1">
              Ruff, Bandit, Security Scan
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs Bar */}
      {findings.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 mr-1">Severity:</span>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
              const count = sev === 'ALL'
                ? findings.length
                : findings.filter((f) => f.severity === sev).length;
              return (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(sev)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    selectedSeverity === sev
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {sev} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-slate-500">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[#090d16] border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="SECURITY">Security</option>
              <option value="BUG">Bug</option>
              <option value="QUALITY">Quality</option>
              <option value="PERFORMANCE">Performance</option>
              <option value="TECH_DEBT">Tech Debt</option>
            </select>

            <span className="text-[11px] text-slate-500 ml-2">Source:</span>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-[#090d16] border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Tools</option>
              <option value="BANDIT">Bandit (Security AST)</option>
              <option value="RUFF">Ruff (Lint & Quality)</option>
              <option value="SECURITY_SCAN">Polyglot Rules</option>
            </select>
          </div>
        </div>
      )}

      {/* Findings List or Empty State */}
      {isScanning ? (
        <div className="panel-card p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          <span>Executing Ruff, Bandit, and Polyglot Security rules...</span>
          <span className="text-[11px] text-slate-500">Checking for hardcoded secrets, dangerous evals, insecure deserialization, and syntax bugs.</span>
        </div>
      ) : !activeAnalysis ? (
        <EmptyState
          icon={AlertTriangle}
          title="No Static Analysis Performed Yet"
          description="Click 'Run Static Audit' above to scan this repository for deterministic security flaws, code smells, and syntax bugs."
          actionText="Run Static Audit Now"
          onAction={handleRunScan}
        />
      ) : filteredFindings.length === 0 ? (
        <div className="panel-card p-8 text-center text-xs text-slate-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-200">No Findings Matching Filter</h4>
          <p className="text-xs text-slate-500 mt-1">Try switching severity or tool filter to view other issues.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedFindingId === finding.id;

            return (
              <div
                key={finding.id}
                className="panel-card p-4 space-y-3 border-slate-800/90 hover:border-slate-700 transition-all"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getSeverityBadgeVariant(finding.severity)} dot={finding.severity === 'CRITICAL'}>
                        {finding.severity}
                      </Badge>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                        {finding.source}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                        {finding.category}
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-semibold text-slate-200 pt-1">
                      {finding.title}
                    </h4>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                      <FileCode className="w-3.5 h-3.5 text-blue-400" />
                      <span>{finding.file_path}:{finding.line_start}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Code Snippet */}
                {finding.code_snippet && (
                  <div className="rounded bg-[#090d16] border border-slate-800/80 p-3 overflow-x-auto font-mono text-[11px] text-slate-300">
                    <pre><code>{finding.code_snippet}</code></pre>
                  </div>
                )}

                {/* Expandable Details: Why It Matters & Suggested Fix */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-3 text-xs">
                    {finding.why_it_matters && (
                      <div className="p-3 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300">
                        <strong className="block text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5 text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Why It Matters
                        </strong>
                        <p className="text-amber-200/90 leading-relaxed text-xs">{finding.why_it_matters}</p>
                      </div>
                    )}

                    {finding.suggested_fix && (
                      <div className="p-3 rounded bg-emerald-950/20 border border-emerald-900/40 text-emerald-300">
                        <strong className="block text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5 text-emerald-400">
                          <Wrench className="w-3.5 h-3.5" />
                          Suggested Fix & Remediation
                        </strong>
                        <p className="text-emerald-200/90 leading-relaxed text-xs">{finding.suggested_fix}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
