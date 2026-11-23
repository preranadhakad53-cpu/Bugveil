import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Download,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Eye,
  Edit3,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Repository, DocGenerationResponse } from '../types';

export const DocumentationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const repoIdParam = searchParams.get('repoId');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [docType, setDocType] = useState<string>('README');
  const [contextSummary, setContextSummary] = useState<string>('');
  
  const [docResult, setDocResult] = useState<DocGenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [editedMarkdown, setEditedMarkdown] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
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
      }
    };
    fetchRepos();
  }, [repoIdParam]);

  const handleGenerate = async () => {
    const selectedRepo = repositories.find((r) => r.id === selectedRepoId);
    const repoName = selectedRepo ? selectedRepo.name : 'Target Repository';

    setIsLoading(true);
    try {
      const res = await api.aiGenerateDocs({
        repo_name: repoName,
        doc_type: docType,
        context_summary: contextSummary || `Primary language: ${selectedRepo?.primary_language || 'Polyglot'}`,
      });
      setDocResult(res);
      setEditedMarkdown(res.content_markdown);
    } catch (err: any) {
      alert(`Documentation generation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!editedMarkdown) return;
    const blob = new Blob([editedMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', docResult?.suggested_filename || `${docType.toLowerCase()}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    if (!editedMarkdown) return;
    navigator.clipboard.writeText(editedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="panel-card p-5 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Automated Documentation Generator
              </h3>
              <Badge variant="purple">Groq AI Agent</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate READMEs, architecture blueprints, API specifications, and onboarding guides.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Safe Mode: Never overwrites source files
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Generator Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="panel-card p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Repository</label>
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="w-full bg-[#090d16] border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {repositories.length > 0 ? (
                  repositories.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.name} ({repo.primary_language || 'Polyglot'})
                    </option>
                  ))
                ) : (
                  <option value="">No repository imported</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Document Type</label>
              <div className="grid grid-cols-2 gap-2">
                {['README', 'ARCHITECTURE', 'API', 'ONBOARDING'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setDocType(type)}
                    className={`py-2 px-2.5 rounded text-xs font-medium border transition-colors ${
                      docType === type
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 font-semibold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Context & Special Instructions (Optional)</label>
              <textarea
                rows={4}
                value={contextSummary}
                onChange={(e) => setContextSummary(e.target.value)}
                placeholder="e.g. Focus on microservice boundary communication and database migration guides..."
                className="w-full bg-[#090d16] border border-slate-800 rounded-md p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing Documentation...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate {docType} Documentation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Markdown Preview & Download */}
        <div className="lg:col-span-8">
          <div className="panel-card flex flex-col h-[600px] overflow-hidden">
            {/* Action Bar */}
            <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-[#0a0f1d]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeTab === 'preview' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab('edit')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    activeTab === 'edit' ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Raw Markdown</span>
                </button>
              </div>

              {docResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .md</span>
                  </button>
                </div>
              )}
            </div>

            {/* Document Body */}
            <div className="flex-1 overflow-auto p-6 bg-[#090d16]">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                  <p className="text-xs font-medium text-slate-200">
                    Groq AI agent is writing {docType} documentation...
                  </p>
                </div>
              ) : editedMarkdown ? (
                activeTab === 'preview' ? (
                  <div className="prose prose-invert max-w-none text-xs text-slate-200 leading-relaxed font-sans space-y-3 whitespace-pre-wrap">
                    {editedMarkdown}
                  </div>
                ) : (
                  <textarea
                    value={editedMarkdown}
                    onChange={(e) => setEditedMarkdown(e.target.value)}
                    className="w-full h-full bg-transparent border-0 font-mono text-xs text-slate-200 focus:outline-none resize-none leading-5"
                  />
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <FileText className="w-10 h-10 text-slate-700 mb-3" />
                  <h4 className="text-xs font-medium text-slate-300">No Documentation Generated Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Select a document type and click 'Generate Documentation' to preview, edit, and export markdown documentation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
