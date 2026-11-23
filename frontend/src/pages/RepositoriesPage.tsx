import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  Search,
  Plus,
  ExternalLink,
  Calendar,
  HardDrive,
  FileCode,
  Trash2,
  Loader2,
  Code2,
  ShieldAlert,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Repository } from '../types';

export const RepositoriesPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRepos = async () => {
    try {
      setIsLoading(true);
      const data = await api.getRepositories();
      setRepositories(data);
    } catch (err) {
      console.error('Failed to load repositories', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleDelete = async (repo: Repository) => {
    const confirmed = window.confirm(`Are you sure you want to delete '${repo.name}' and its storage files?`);
    if (!confirmed) return;

    try {
      setDeletingId(repo.id);
      await api.deleteRepository(repo.id);
      setRepositories((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err) {
      alert('Failed to delete repository');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredRepos = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1424] border border-slate-800 rounded-md pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <Link
          to="/import"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Analysis</span>
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="panel-card p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Loading tracked repositories...</span>
        </div>
      ) : repositories.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No Repositories Tracked"
          description="You haven't imported any codebases yet. Connect a public GitHub repository or upload a source code ZIP to begin static analysis and auditing."
          actionText="Import Repository"
          actionHref="/import"
        />
      ) : filteredRepos.length === 0 ? (
        <div className="panel-card p-8 text-center text-xs text-slate-400">
          No repositories matching "{searchQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRepos.map((repo) => (
            <div key={repo.id} className="panel-card p-5 space-y-4 hover:border-slate-700/80 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-blue-400" />
                    {repo.name}
                  </h3>
                  {repo.url ? (
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-400 hover:text-blue-400 inline-flex items-center gap-1 mt-1 transition-colors"
                    >
                      <span className="truncate max-w-[240px]">{repo.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 mt-1 block">Local Source Archive</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={repo.source_type === 'GITHUB' ? 'info' : 'purple'}>
                    {repo.source_type}
                  </Badge>
                  <button
                    onClick={() => handleDelete(repo)}
                    disabled={deletingId === repo.id}
                    title="Delete Repository"
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  >
                    {deletingId === repo.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Language Breakdown */}
              {repo.primary_language && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Code2 className="w-3 h-3 text-purple-400" />
                      Primary: <strong className="text-slate-200">{repo.primary_language}</strong>
                    </span>
                    <span className="text-slate-500">
                      {Object.keys(repo.language_distribution || {}).length} languages
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(repo.language_distribution || {}).slice(0, 4).map(([lang, pct]) => (
                      <span
                        key={lang}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                      >
                        {lang}: {pct}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800 text-xs">
                <div className="text-slate-400 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-slate-500" />
                  <span>{repo.file_count} files</span>
                </div>
                <div className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>{Math.round(repo.size_bytes / 1024)} KB</span>
                </div>
                <div className="text-slate-400 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(repo.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-1">
                <Link
                  to={`/security?repoId=${repo.id}`}
                  className="text-xs px-2.5 py-1 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 font-medium inline-flex items-center gap-1.5 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Run Static Audit</span>
                </Link>
                <Link
                  to={`/explorer?repoId=${repo.id}`}
                  className="text-xs text-slate-400 hover:text-slate-200 font-medium inline-flex items-center gap-1"
                >
                  <span>Explore Files</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
