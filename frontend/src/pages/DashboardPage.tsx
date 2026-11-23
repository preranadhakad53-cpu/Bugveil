import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  GitBranch,
  Upload,
  Cpu,
  Layers,
  Database,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { DashboardSummary, HealthResponse } from '../types';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [summaryData, healthData] = await Promise.all([
          api.getDashboardSummary(),
          api.getHealth(),
        ]);
        setSummary(summaryData);
        setHealth(healthData);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to Bugveil backend service.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Configuration Advisory Banner (Safe handling of missing Groq API Key) */}
      {health && !health.groq_configured && (
        <div className="panel-card p-4 bg-amber-950/20 border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-amber-900/40 text-amber-400 mt-0.5">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-amber-300">
                AI Service Configuration Notice (Milestone 5)
              </h4>
              <p className="text-xs text-amber-400/80 mt-0.5">
                Groq API key is currently using placeholder values in <code className="font-mono bg-amber-950/80 px-1 py-0.5 rounded text-[11px]">backend/.env</code>. Repository browsing and deterministic static analysis run locally without requiring an API key.
              </p>
            </div>
          </div>
          <Link
            to="/settings"
            className="text-xs font-medium text-amber-300 hover:text-amber-200 underline whitespace-nowrap self-start sm:self-auto"
          >
            Review Setup Guide &rarr;
          </Link>
        </div>
      )}

      {/* Backend Disconnected Warning */}
      {error && (
        <div className="panel-card p-4 bg-rose-950/30 border-rose-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-rose-300">Backend Connection Error</h4>
              <p className="text-xs text-rose-400/80">{error}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-2.5 py-1 rounded bg-rose-900/40 text-rose-300 hover:bg-rose-900/60 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Key Metric Overview Cards (Always honest, never fake) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Repositories"
          value={isLoading ? '...' : summary?.repositories_count ?? 0}
          subtitle={
            summary?.analyzed_repositories_count
              ? `${summary.analyzed_repositories_count} fully analyzed`
              : '0 analyzed'
          }
          icon={FolderGit2}
          color="text-blue-400"
        />
        <MetricCard
          title="Total Findings"
          value={isLoading ? '...' : summary?.total_findings_count ?? 0}
          subtitle="Static analysis + AI audits"
          icon={AlertTriangle}
          color="text-amber-400"
        />
        <MetricCard
          title="Critical Security Flaws"
          value={isLoading ? '...' : summary?.critical_findings_count ?? 0}
          subtitle="Immediate remediation needed"
          icon={ShieldAlert}
          color="text-rose-400"
          badge={summary?.critical_findings_count ? 'Critical' : undefined}
          badgeVariant="danger"
        />
        <MetricCard
          title="Quality Score"
          value={
            isLoading
              ? '...'
              : summary?.average_quality_score !== null && summary?.average_quality_score !== undefined
              ? `${summary.average_quality_score}/100`
              : 'N/A'
          }
          subtitle="Computed across audits"
          icon={Sparkles}
          color="text-purple-400"
        />
      </div>

      {/* Main Section: Empty State or Active Repositories */}
      {!isLoading && summary?.repositories_count === 0 ? (
        <div className="space-y-6">
          {/* Realistic Empty State */}
          <EmptyState
            icon={FolderGit2}
            title="No Repositories Imported Yet"
            description="Bugveil analyzes legacy codebases, runs deterministic static security scanning, and powers intelligent pull request audits. Get started by connecting a public repository or uploading source code."
            actionText="Import Repository"
            actionHref="/import"
            secondaryActionText="View System Settings"
            secondaryActionHref="/settings"
          />

          {/* Onboarding Pipeline Steps */}
          <div className="panel-card p-6">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              How Bugveil Audits Your Codebase
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-mono text-xs font-semibold mb-3">
                  01
                </div>
                <h4 className="text-xs font-semibold text-slate-200 mb-1">
                  Safe Ingestion & Sandboxing
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Code is sandboxed in an isolated storage directory. Path traversal protection, zip-slip defense, and file size limits protect your environment. Code is never dynamically executed.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-xs font-semibold mb-3">
                  02
                </div>
                <h4 className="text-xs font-semibold text-slate-200 mb-1">
                  Deterministic Static Analysis
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ruff, Bandit, and Semgrep scan the source code for deterministic vulnerabilities, syntax violations, and insecure patterns without AI hallucinations.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-xs font-semibold mb-3">
                  03
                </div>
                <h4 className="text-xs font-semibold text-slate-200 mb-1">
                  Contextual AI & Pull Request Audit
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Groq LLM agent interprets static findings, explains legacy logic, assesses blast radiuses, reviews pull request diffs, and responds to queries via Bugveil Assistant.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Import Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/import"
              className="panel-card p-5 hover:border-blue-500/40 transition-all group flex items-start gap-4"
            >
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <GitBranch className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                    Clone Public GitHub Repository
                  </h4>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 group-hover:text-blue-400 transition-all" />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Provide a public repository URL to clone and analyze branches, commit histories, and pull requests.
                </p>
              </div>
            </Link>

            <Link
              to="/import"
              className="panel-card p-5 hover:border-blue-500/40 transition-all group flex items-start gap-4"
            >
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                    Upload Source Code ZIP
                  </h4>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 group-hover:text-blue-400 transition-all" />
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Safely inspect a local codebase archive with automatic ignore patterns for <code className="font-mono text-[11px]">node_modules</code> and <code className="font-mono text-[11px]">.git</code>.
                </p>
              </div>
            </Link>
          </div>
        </div>
      ) : (
        /* Populated Repositories View */
        <div className="space-y-6">
          <div className="panel-card p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">Recent Analysis Activity</h3>
            <div className="divide-y divide-slate-800">
              {summary?.recent_activities.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <FolderGit2 className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="font-medium text-slate-200">{item.repo_name}</span>
                      <span className="text-slate-400 ml-2 font-mono">{item.event_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={item.status === 'COMPLETED' ? 'success' : 'warning'}>
                      {item.status}
                    </Badge>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* System Diagnostics & Technology Stack Summary */}
      <div className="panel-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-400" />
            System Architecture Status
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Environment: {health?.environment || 'development'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">Database Layer</span>
            </div>
            <Badge variant={health?.database_connected ? 'success' : 'danger'} dot>
              {health?.database_connected ? 'SQLite Async' : 'Disconnected'}
            </Badge>
          </div>

          <div className="p-3 rounded bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-slate-300">Groq AI Agent</span>
            </div>
            <Badge variant={health?.groq_configured ? 'success' : 'warning'}>
              {health?.groq_configured ? 'Configured' : 'Needs Key'}
            </Badge>
          </div>

          <div className="p-3 rounded bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">FastAPI Backend</span>
            </div>
            <Badge variant={health?.status === 'healthy' ? 'success' : 'warning'} dot>
              v{health?.version || '0.1.0'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};
