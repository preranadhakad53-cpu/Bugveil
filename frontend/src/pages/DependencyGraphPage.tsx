import React, { useState, useEffect } from 'react';
import { Network, Share2, Loader2, AlertCircle, FileCode, ArrowRight } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { Repository, DependencyGraphResponse, DependencyNode } from '../types';

export const DependencyGraphPage: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [graphData, setGraphData] = useState<DependencyGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<DependencyNode | null>(null);
  const [impactFiles, setImpactFiles] = useState<string>('');
  const [impactResult, setImpactResult] = useState<any>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  useEffect(() => {
    api.getRepositories().then(setRepositories).catch(() => {});
  }, []);

  const loadGraph = async (repoId: string) => {
    setIsLoading(true);
    setError(null);
    setGraphData(null);
    setSelectedNode(null);
    setImpactResult(null);
    try {
      const data = await api.getDependencyGraph(repoId);
      setGraphData(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load dependency graph.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepoChange = (id: string) => {
    setSelectedRepoId(id);
    if (id) loadGraph(id);
  };

  const runImpact = async () => {
    if (!selectedRepoId || !impactFiles.trim()) return;
    setImpactLoading(true);
    try {
      const files = impactFiles.split('\n').map((f) => f.trim()).filter(Boolean);
      const res = await api.getImpactAnalysis(selectedRepoId, { modified_files: files });
      setImpactResult(res);
    } catch (err: any) {
      setImpactResult({ error: err?.response?.data?.detail || err.message });
    } finally {
      setImpactLoading(false);
    }
  };

  const getNodeDeps = (node: DependencyNode) => {
    if (!graphData) return { imports: [], importedBy: [] };
    const imports = graphData.edges.filter((e) => e.source === node.id).map((e) => e.target);
    const importedBy = graphData.edges.filter((e) => e.target === node.id).map((e) => e.source);
    return { imports, importedBy };
  };

  const impactColor = (level: string) => {
    if (level === 'CRITICAL' || level === 'HIGH') return 'text-rose-400';
    if (level === 'MODERATE') return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-6">
      <div className="panel-card p-4 border-blue-900/40 bg-blue-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Dependency Graph & Blast Radius</h3>
            <p className="text-xs text-slate-400">Import hierarchy, module relationships, and change impact analysis.</p>
          </div>
        </div>
        <select
          value={selectedRepoId}
          onChange={(e) => handleRepoChange(e.target.value)}
          className="bg-[#090d16] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 min-w-[180px]"
        >
          <option value="">Select repository…</option>
          {repositories.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {!selectedRepoId && (
        <div className="panel-card flex flex-col items-center justify-center py-16 text-center">
          <Share2 className="w-10 h-10 text-slate-700 mb-3" />
          <h4 className="text-sm font-medium text-slate-300">No Repository Selected</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1">Select a repository to map its dependency graph and analyze blast radius.</p>
        </div>
      )}

      {isLoading && (
        <div className="panel-card flex items-center justify-center py-16 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-xs text-slate-400">Building dependency graph…</span>
        </div>
      )}

      {error && (
        <div className="panel-card p-4 border-rose-900/40 bg-rose-950/10 flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {graphData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Node List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="panel-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-200">Module Files ({graphData.nodes.length})</h4>
                <Badge variant="info">{graphData.total_files} total</Badge>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {graphData.nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                    className={`w-full text-left p-2.5 rounded border text-xs transition-colors ${
                      selectedNode?.id === node.id
                        ? 'bg-blue-950/40 border-blue-700/50 text-blue-300'
                        : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileCode className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="font-mono truncate">{node.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-500">
                        {node.in_degree > 0 && <span className="text-emerald-500">{node.in_degree}↓</span>}
                        {node.out_degree > 0 && <span className="text-blue-500">{node.out_degree}→</span>}
                        {node.symbols_count > 0 && <span>{node.symbols_count}σ</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Impact Calculator */}
            <div className="panel-card p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-200">Blast Radius Calculator</h4>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Modified files (one per line)</label>
                <textarea
                  value={impactFiles}
                  onChange={(e) => setImpactFiles(e.target.value)}
                  placeholder="utils.py&#10;auth/models.py"
                  className="w-full h-20 bg-[#090d16] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <button
                onClick={runImpact}
                disabled={impactLoading || !impactFiles.trim()}
                className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium transition-colors disabled:opacity-40"
              >
                {impactLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Calculate Impact'}
              </button>
              {impactResult && !impactResult.error && (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Impact Level</span>
                    <span className={`font-bold ${impactColor(impactResult.impact_level)}`}>{impactResult.impact_level}</span>
                  </div>
                  <p className="text-slate-300 bg-slate-900/60 p-2.5 rounded border border-slate-800">{impactResult.summary}</p>
                  {impactResult.direct_dependents.length > 0 && (
                    <div>
                      <p className="text-slate-500 mb-1">Direct dependents ({impactResult.direct_dependents.length}):</p>
                      {impactResult.direct_dependents.map((f: string, i: number) => (
                        <div key={i} className="font-mono text-blue-400 text-[11px]">{f}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {impactResult?.error && (
                <p className="text-xs text-rose-400">{impactResult.error}</p>
              )}
            </div>
          </div>

          {/* Node Detail */}
          <div className="lg:col-span-7">
            {selectedNode ? (
              <div className="panel-card p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-sm text-slate-200 font-semibold">{selectedNode.path}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs text-center">
                  <div className="bg-slate-900 rounded p-2.5 border border-slate-800">
                    <div className="text-slate-400">Symbols</div>
                    <div className="text-slate-100 font-bold text-base mt-0.5">{selectedNode.symbols_count}</div>
                  </div>
                  <div className="bg-slate-900 rounded p-2.5 border border-slate-800">
                    <div className="text-emerald-500">Imported by</div>
                    <div className="text-slate-100 font-bold text-base mt-0.5">{selectedNode.in_degree}</div>
                  </div>
                  <div className="bg-slate-900 rounded p-2.5 border border-slate-800">
                    <div className="text-blue-400">Imports</div>
                    <div className="text-slate-100 font-bold text-base mt-0.5">{selectedNode.out_degree}</div>
                  </div>
                </div>
                {(() => {
                  const { imports, importedBy } = getNodeDeps(selectedNode);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 mb-2 font-medium">Imports ({imports.length}):</p>
                        <div className="space-y-1">
                          {imports.length === 0 ? (
                            <p className="text-slate-600">No internal imports detected.</p>
                          ) : imports.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-blue-300">
                              <ArrowRight className="w-3 h-3 text-blue-500" />
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-2 font-medium">Imported by ({importedBy.length}):</p>
                        <div className="space-y-1">
                          {importedBy.length === 0 ? (
                            <p className="text-slate-600">No internal dependents detected.</p>
                          ) : importedBy.map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
                              <ArrowRight className="w-3 h-3 text-emerald-500 rotate-180" />
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="panel-card flex flex-col items-center justify-center h-full py-20 text-center">
                <Network className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-xs text-slate-400">Click a module to see its imports, dependents, and symbols.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
