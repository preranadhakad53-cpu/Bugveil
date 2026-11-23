import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Upload, ShieldCheck, Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export const RepositoryImportPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'github' | 'zip'>('github');
  
  // GitHub URL Form State
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [repoName, setRepoName] = useState('');
  
  // ZIP Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zipRepoName, setZipRepoName] = useState('');

  // Status & Error States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const createdRepo = await api.importRepositoryUrl(repoUrl.trim(), branch.trim(), repoName.trim() || undefined);
      setSuccessMessage(`Successfully imported ${createdRepo.name}! Redirecting to File Explorer...`);
      setTimeout(() => {
        navigate(`/explorer?repoId=${createdRepo.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to import repository from GitHub.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const createdRepo = await api.uploadRepositoryZip(selectedFile, zipRepoName.trim() || undefined);
      setSuccessMessage(`Successfully extracted and analyzed ${createdRepo.name}! Redirecting to File Explorer...`);
      setTimeout(() => {
        navigate(`/explorer?repoId=${createdRepo.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to safely extract ZIP archive.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title & Description */}
      <div>
        <h2 className="text-base font-semibold text-slate-100">Import Repository for Audit</h2>
        <p className="text-xs text-slate-400 mt-1">
          Select an ingestion method to clone a public repository or safely extract a source code archive.
        </p>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/80 flex items-center gap-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-center gap-3 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setActiveTab('github');
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'github'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>Public GitHub Repository</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('zip');
            setError(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'zip'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload Source Code ZIP</span>
        </button>
      </div>

      {/* Form Content */}
      <div className="panel-card p-6">
        {activeTab === 'github' ? (
          <form onSubmit={handleGitHubSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                GitHub Repository URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://github.com/psf/requests"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#0d1424] border border-slate-800 rounded-md px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono transition-colors disabled:opacity-50"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must be a public repository. Shallow clone (depth=1) is used for speed and efficiency.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Default Branch
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-[#0d1424] border border-slate-800 rounded-md px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono transition-colors disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Custom Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Requests Core"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-[#0d1424] border border-slate-800 rounded-md px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !repoUrl.trim()}
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium transition-colors shadow-sm mt-4 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Cloning and Analyzing Repository...</span>
                </>
              ) : (
                <span>Clone & Analyze Repository</span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleZipSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Custom Project Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. My Legacy App"
                value={zipRepoName}
                onChange={(e) => setZipRepoName(e.target.value)}
                disabled={isLoading}
                className="w-full bg-[#0d1424] border border-slate-800 rounded-md px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer bg-slate-900/30 ${
                selectedFile ? 'border-blue-500/60 bg-blue-950/10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-200 font-medium">
                {selectedFile ? (
                  <span className="text-blue-400 font-mono">{selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</span>
                ) : (
                  'Click to select or drag and drop a ZIP archive'
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Maximum file size: 50 MB. Uncompressed limit: 150 MB.
              </p>
              <input
                type="file"
                accept=".zip"
                disabled={isLoading}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block mt-4 px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors"
              >
                {selectedFile ? 'Choose Different Archive' : 'Browse ZIP File'}
              </label>
            </div>

            <button
              type="submit"
              disabled={!selectedFile || isLoading}
              className="w-full py-2.5 px-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Safely Extracting & Profiling Archive...</span>
                </>
              ) : (
                <span>Upload & Extract Archive</span>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Safety & Sandboxing Guarantees */}
      <div className="panel-card p-5 border-blue-900/40 bg-blue-950/10">
        <h3 className="text-xs font-semibold text-blue-300 flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          Bugveil Sandboxing & Security Safeguards
        </h3>
        <ul className="space-y-2 text-xs text-slate-400">
          <li className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Dynamic Execution:</strong> Code is strictly analyzed via AST parsers, tokenizers, and static rules. Source code is never executed, compiled, or evaluated on the server.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Anti-Traversal & Zip-Slip Defense:</strong> All extraction targets are strictly validated against directory traversal using canonical path resolution.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Automatic Ignore Rules:</strong> Binary files, executables, minified bundles, and directories like <code className="font-mono text-slate-300">node_modules</code>, <code className="font-mono text-slate-300">.git</code>, <code className="font-mono text-slate-300">dist</code>, and <code className="font-mono text-slate-300">venv</code> are automatically filtered.
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};
