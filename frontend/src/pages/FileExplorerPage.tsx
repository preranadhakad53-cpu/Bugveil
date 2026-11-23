import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCode2,
  FolderTree,
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Compass,
  Loader2,
  Code2,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { api } from '../services/api';
import { Repository, TreeNode, RepositoryFileContentResponse } from '../types';

interface FileTreeItemProps {
  node: TreeNode;
  level: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, level, selectedPath, onSelectFile }) => {
  const [isOpen, setIsOpen] = useState(level < 2); // Auto-expand first 2 levels

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-slate-300 hover:bg-slate-900/80 rounded transition-colors text-left"
          style={{ paddingLeft: `${level * 14 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          )}
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </button>

        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`w-full flex items-center justify-between py-1 px-2 text-xs rounded transition-colors text-left ${
        isSelected
          ? 'bg-blue-600/20 text-blue-300 font-medium border border-blue-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
      }`}
      style={{ paddingLeft: `${level * 14 + 18}px` }}
    >
      <div className="flex items-center gap-2 truncate">
        <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
        <span className="truncate">{node.name}</span>
      </div>
      {node.line_count !== undefined && (
        <span className="text-[10px] font-mono text-slate-600 shrink-0 ml-1">
          {node.line_count}L
        </span>
      )}
    </button>
  );
};

export const FileExplorerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const repoIdParam = searchParams.get('repoId');

  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [fileTree, setFileTree] = useState<TreeNode | null>(null);
  const [primaryLang, setPrimaryLang] = useState<string | null>(null);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<RepositoryFileContentResponse | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);

  // 1. Fetch repositories list
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

  // 2. Fetch file tree when selected repository changes
  useEffect(() => {
    if (!selectedRepoId) return;

    const loadTree = async () => {
      try {
        setIsLoadingTree(true);
        setSelectedFilePath(null);
        setFileContent(null);

        const data = await api.getRepositoryFiles(selectedRepoId);
        setFileTree(data.tree);
        setPrimaryLang(data.primary_language || null);
        setTotalFiles(data.total_files);

        // Auto-select first source file if available
        const findFirstFile = (node: TreeNode): string | null => {
          if (node.type === 'file') return node.path;
          if (node.children) {
            for (const child of node.children) {
              const res = findFirstFile(child);
              if (res) return res;
            }
          }
          return null;
        };

        const firstFile = findFirstFile(data.tree);
        if (firstFile) {
          handleFileSelect(firstFile, selectedRepoId);
        }
      } catch (err) {
        console.error('Failed to load file tree', err);
      } finally {
        setIsLoadingTree(false);
      }
    };

    loadTree();
    setSearchParams({ repoId: selectedRepoId });
  }, [selectedRepoId]);

  const handleFileSelect = async (path: string, repoIdToUse = selectedRepoId) => {
    setSelectedFilePath(path);
    try {
      setIsLoadingContent(true);
      const contentData = await api.getRepositoryFileContent(repoIdToUse, path);
      setFileContent(contentData);
    } catch (err) {
      console.error('Failed to load file content', err);
      setFileContent(null);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleCopy = () => {
    if (fileContent?.content) {
      navigator.clipboard.writeText(fileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoadingRepos) {
    return (
      <div className="panel-card p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span>Loading workspace...</span>
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <EmptyState
        icon={FolderTree}
        title="No Repositories Available"
        description="Import a repository to explore its file tree, inspect source code, and run audits."
        actionText="Import Repository"
        actionHref="/import"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="panel-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Active Repository
            </label>
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="bg-[#090d16] border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
            >
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name} ({repo.file_count} files, {repo.primary_language || 'Polyglot'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {primaryLang && (
            <Badge variant="purple">
              Primary: {primaryLang}
            </Badge>
          )}
          <Badge variant="default">
            {totalFiles} source files
          </Badge>
        </div>
      </div>

      {/* Two-Pane Explorer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Pane: Hierarchical File Tree */}
        <div className="lg:col-span-4 panel-card p-4 flex flex-col h-[620px]">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FolderTree className="w-4 h-4 text-blue-400" />
              Directory Structure
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {totalFiles} files
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
            {isLoadingTree ? (
              <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Scanning directory...</span>
              </div>
            ) : fileTree && fileTree.children && fileTree.children.length > 0 ? (
              fileTree.children.map((child) => (
                <FileTreeItem
                  key={child.path}
                  node={child}
                  level={0}
                  selectedPath={selectedFilePath}
                  onSelectFile={(path) => handleFileSelect(path)}
                />
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                No code files found in this repository.
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Code Inspection Viewer */}
        <div className="lg:col-span-8 panel-card flex flex-col h-[620px] overflow-hidden">
          {/* File Header */}
          <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between bg-[#0a0f1d]">
            <div className="flex items-center gap-2 truncate">
              <File className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs font-mono text-slate-200 truncate font-medium">
                {selectedFilePath || 'Select a file to inspect'}
              </span>
            </div>

            {fileContent && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">
                  {fileContent.line_count} lines • {Math.round(fileContent.size / 1024 * 10) / 10} KB
                </span>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy File Content"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* File Content Display */}
          <div className="flex-1 overflow-auto bg-[#090d16] font-mono text-xs">
            {isLoadingContent ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Loading source code...</span>
              </div>
            ) : fileContent ? (
              <div className="flex">
                {/* Line Numbers */}
                <div className="py-4 px-3 select-none text-right text-slate-600 bg-slate-950/60 border-r border-slate-800/80 min-w-[48px]">
                  {Array.from({ length: fileContent.line_count }).map((_, i) => (
                    <div key={i + 1} className="leading-5">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Code Body */}
                <pre className="py-4 px-4 flex-1 text-slate-200 overflow-x-auto leading-5">
                  <code>{fileContent.content}</code>
                </pre>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Code2 className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-xs text-slate-400">Select a file from the tree to inspect code</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
