import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  PlusCircle,
  GitPullRequest,
  FileCode2,
  ShieldAlert,
  BookOpen,
  BotMessageSquare,
  Network,
  FileSpreadsheet,
  Settings,
  Activity,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { api } from '../../services/api';
import { HealthResponse } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Repositories', path: '/repositories', icon: FolderGit2 },
  { label: 'New Analysis', path: '/import', icon: PlusCircle },
  { label: 'Pull Request Review', path: '/pull-requests', icon: GitPullRequest },
  { label: 'Legacy Code Explorer', path: '/explorer', icon: FileCode2 },
  { label: 'Security & Static Analysis', path: '/security', icon: ShieldAlert },
  { label: 'Dependency Graph', path: '/dependencies', icon: Network },
  { label: 'Documentation', path: '/documentation', icon: BookOpen },
  { label: 'Bugveil Assistant', path: '/chat', icon: BotMessageSquare },
  { label: 'Audit Reports', path: '/reports', icon: FileSpreadsheet },
  { label: 'Settings & Status', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const checkConnectivity = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const data = await api.getHealth();
      setLatency(Math.round(performance.now() - start));
      setHealth(data);
    } catch {
      setHealth({
        status: 'offline',
        version: '0.1.0',
        project_name: 'Bugveil',
        environment: 'development',
        database_connected: false,
        groq_configured: false,
        groq_model: 'llama-3.3-70b-versatile',
        timestamp: new Date().toISOString(),
      });
      setLatency(null);
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    checkConnectivity();
    const interval = setInterval(checkConnectivity, 30000); // 30s heartbeat
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#090d16] border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-600/20 transition-colors">
              <Terminal className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-slate-100">
                  Bugveil
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight">
                Review smarter. Debug deeper.
              </p>
            </div>
          </NavLink>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Live Backend Connection Indicator (Requirement: Frontend/Backend Connectivity) */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="p-2.5 rounded-lg border border-slate-800/90 bg-[#0c1220]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health?.status === 'healthy'
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : health?.status === 'degraded'
                      ? 'bg-amber-400'
                      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  }`}
                />
                <span className="font-medium text-slate-300">
                  {health?.status === 'healthy'
                    ? 'Backend Online'
                    : health?.status === 'degraded'
                    ? 'DB Degraded'
                    : 'Backend Offline'}
                </span>
              </div>
              <button
                onClick={checkConnectivity}
                disabled={isPinging}
                title="Ping Backend API"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isPinging ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-slate-400" />
                {latency !== null ? `${latency}ms` : '---'}
              </span>
              <span>FastAPI v{health?.version || '0.1.0'}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
