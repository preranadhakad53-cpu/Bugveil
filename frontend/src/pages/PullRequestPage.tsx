import React, { useState } from 'react';
import {
  GitPullRequest,
  GitCompare,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Bug,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { PRAuditResponse, AuditFinding } from '../types';

const severityVariant = (s: string): 'danger' | 'warning' | 'info' | 'success' | 'purple' => {
  if (s === 'CRITICAL' || s === 'HIGH') return 'danger';
  if (s === 'MEDIUM') return 'warning';
  if (s === 'LOW') return 'info';
  return 'success';
};

const approvalIcon = (status: string) => {
  if (status === 'APPROVED') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === 'REQUEST_CHANGES') return <XCircle className="w-4 h-4 text-rose-400" />;
  return <Info className="w-4 h-4 text-amber-400" />;
};

export const PullRequestPage: React.FC = () => {
  const [baseBranch, setBaseBranch] = useState('main');
  const [targetBranch, setTargetBranch] = useState('feature/auth-hardening');
  const [prTitle, setPrTitle] = useState('Enhance password hashing and rate limiting');
  const [diffText, setDiffText] = useState(
    'diff --git a/app/auth.py b/app/auth.py\n' +
    'index 83a1b02..f93e210 100644\n' +
    '--- a/app/auth.py\n' +
    '+++ b/app/auth.py\n' +
    '@@ -12,4 +12,12 @@\n' +
    '-def verify_password(stored, provided):\n' +
    '-    return hashlib.md5(provided.encode()).hexdigest() == stored\n' +
    '+def verify_password(stored_hash: str, provided_password: str) -> bool:\n' +
    '+    # Migrated from MD5 to bcrypt with constant-time comparison\n' +
    '+    if not provided_password or len(provided_password) < 8:\n' +
    '+        raise ValueError("Password must be at least 8 characters")\n' +
    '+    return bcrypt.checkpw(provided_password.encode("utf-8"), stored_hash.encode("utf-8"))\n'
  );

  const [auditResult, setAuditResult] = useState<PRAuditResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRunAudit = async () => {
    if (!diffText.trim()) return;
    setIsLoading(true);

    try {
      const res = await api.auditPullRequest({
        diff_text: diffText,
        base_ref: baseBranch,
        target_ref: targetBranch,
        title: prTitle,
      });
      setAuditResult(res);
    } catch (err: any) {
      alert(`PR Audit failed: ${err?.response?.data?.detail || err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleDiff = (type: 'security' | 'regression') => {
    if (type === 'security') {
      setPrTitle('Add user deserialization routine');
      setTargetBranch('feature/import-user-data');
      setDiffText(
        'diff --git a/app/importer.py b/app/importer.py\n' +
        '@@ -1,3 +1,6 @@\n' +
        '+import pickle\n' +
        '+def import_user_object(raw_data):\n' +
        '+    return pickle.loads(raw_data)\n'
      );
    } else {
      setPrTitle('Refactor order calculation discount');
      setTargetBranch('feature/discount-calc');
      setDiffText(
        'diff --git a/app/billing.py b/app/billing.py\n' +
        '@@ -20,3 +20,4 @@\n' +
        '-    return total - discount\n' +
        '+    # Potential division by zero if items is 0\n' +
        '+    return (total - discount) / len(order_items)\n'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="panel-card p-5 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <GitPullRequest className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Pull Request Auditor
              </h3>
              <Badge variant="purple">AI + Static Analysis</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyze changed hunks, blast radius, regressions, breaking changes, and risk level.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSampleDiff('security')}
            className="text-xs px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            Sample Security Diff
          </button>
          <button
            onClick={() => loadSampleDiff('regression')}
            className="text-xs px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
          >
            Sample Bug Diff
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: PR Diff Input */}
        <div className="lg:col-span-5 space-y-4">
          <div className="panel-card p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">PR Title</label>
              <input
                type="text"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="e.g. Refactor user session handling"
                className="w-full bg-[#090d16] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Base Branch</label>
                <input
                  type="text"
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Branch</label>
                <input
                  type="text"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  className="w-full bg-[#090d16] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Git Diff / Patch</label>
              <textarea
                rows={12}
                value={diffText}
                onChange={(e) => setDiffText(e.target.value)}
                placeholder="Paste git diff here..."
                className="w-full bg-[#090d16] border border-slate-800 rounded-md p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500 leading-5"
              />
            </div>

            <button
              onClick={handleRunAudit}
              disabled={isLoading || !diffText.trim()}
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Auditing Pull Request Diff...</span>
                </>
              ) : (
                <>
                  <GitCompare className="w-4 h-4" />
                  <span>Audit Pull Request</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Audit Report */}
        <div className="lg:col-span-7">
          <div className="panel-card p-6 min-h-[500px]">
            {isLoading ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                <p className="text-xs font-medium text-slate-200">
                  Running static analysis + Groq AI audit…
                </p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Checking for security vulnerabilities, breaking contract changes, and missing tests.
                </p>
              </div>
            ) : auditResult ? (
              <div className="space-y-5">
                {/* Status Bar */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded font-semibold font-mono border ${
                      auditResult.approval_status === 'APPROVED'
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                        : auditResult.approval_status === 'REQUEST_CHANGES'
                        ? 'bg-rose-950/80 text-rose-400 border-rose-800'
                        : 'bg-amber-950/80 text-amber-400 border-amber-800'
                    }`}>
                      {approvalIcon(auditResult.approval_status)}
                      {auditResult.approval_status}
                    </span>

                    <Badge variant={
                      auditResult.risk_level === 'LOW' ? 'success'
                        : auditResult.risk_level === 'MEDIUM' ? 'warning'
                        : 'danger'
                    }>
                      Risk: {auditResult.risk_level}
                    </Badge>

                    {auditResult.is_mock && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertCircle className="w-3 h-3" /> Mock
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                    <span className="text-blue-400">{auditResult.static_findings_count} static</span>
                    <span className="text-purple-400">{auditResult.ai_findings_count} AI</span>
                    <span>Model: {auditResult.model_used}</span>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-300">Executive Summary</h4>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded border border-slate-800">
                    {auditResult.summary}
                  </p>
                </div>

                {/* Findings */}
                {auditResult.findings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-300">
                      Findings ({auditResult.findings.length})
                    </h4>
                    <div className="space-y-2 max-h-[320px] overflow-y-auto">
                      {auditResult.findings.map((f: AuditFinding, idx: number) => (
                        <div key={idx} className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              {f.source === 'GROQ_AI'
                                ? <Bug className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                                : <ShieldAlert className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-200 leading-tight">{f.title}</p>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {f.file}{f.line_number ? `:${f.line_number}` : ''}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
                              <span className="text-[10px] text-slate-600 font-mono">{f.source === 'GROQ_AI' ? 'AI' : 'Static'}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400">{f.explanation}</p>
                          {f.code_snippet && (
                            <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                              {f.code_snippet}
                            </pre>
                          )}
                          <div className="text-xs text-blue-300 bg-blue-950/20 border border-blue-900/40 rounded p-2">
                            <strong className="block text-[10px] uppercase tracking-wider text-blue-400 mb-0.5">Suggested Fix</strong>
                            {f.suggested_fix}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Breaking Changes */}
                {auditResult.breaking_changes.length > 0 && (
                  <div className="p-3 rounded bg-rose-950/20 border border-rose-900/40 text-xs space-y-1">
                    <strong className="block text-[11px] uppercase tracking-wider text-rose-400">Breaking Changes</strong>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {auditResult.breaking_changes.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Testing Recommendations */}
                {auditResult.testing_recommendations.length > 0 && (
                  <div className="p-3 rounded bg-blue-950/20 border border-blue-900/40 text-xs space-y-1">
                    <strong className="block text-[11px] uppercase tracking-wider text-blue-400">Testing & Verification</strong>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {auditResult.testing_recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <GitCompare className="w-10 h-10 text-slate-700 mb-3" />
                <h4 className="text-xs font-medium text-slate-300">No Pull Request Audited Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Paste a git diff or select a sample diff, then click 'Audit Pull Request' to run the AI auditor.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
