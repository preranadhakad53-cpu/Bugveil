import React, { useEffect, useState } from 'react';
import {
  Settings,
  Database,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';
import { SystemSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSettings = async () => {
    try {
      setIsRefreshing(true);
      const data = await api.getSettings();
      setSettingsData(data);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            System Configuration & Diagnostics
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time inspection of backend environment variables, static analyzer status, and database connectivity.
          </p>
        </div>
        <button
          onClick={loadSettings}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading system diagnostics...</div>
      ) : settingsData ? (
        <div className="space-y-6">
          {/* AI Provider Configuration Section */}
          <div className="panel-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  AI Service Configuration (Groq API)
                </h3>
              </div>
              <Badge variant={settingsData.groq_configured ? 'success' : 'warning'} dot>
                {settingsData.groq_configured ? 'Configured & Active' : 'Placeholder Value'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block mb-1">Provider & Model</span>
                <span className="font-mono text-slate-200 font-medium">
                  Groq / {settingsData.groq_model}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block mb-1">API Key Status</span>
                <span className="text-slate-300">{settingsData.groq_api_key_status}</span>
              </div>
            </div>

            {/* Clear setup instructions for student developer */}
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/90 space-y-2 text-xs">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                How to configure your Groq API key:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed pl-1">
                <li>
                  Generate an API key from{' '}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    console.groq.com
                  </a>
                  .
                </li>
                <li>
                  Open <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-[11px] text-slate-300">backend/.env</code> in your local editor.
                </li>
                <li>
                  Replace <code className="font-mono bg-slate-900 px-1 py-0.5 rounded text-[11px] text-slate-300">GROQ_API_KEY=your_groq_api_key_here</code> with your real key.
                </li>
                <li>
                  Save the file and click <strong>Refresh Status</strong> above. Bugveil will detect your key automatically without restarting.
                </li>
              </ol>
            </div>
          </div>

          {/* Static Analysis Engine Availability */}
          <div className="panel-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Deterministic Static Analysis Tools
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {settingsData.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">{tool.name}</span>
                      {tool.installed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{tool.description}</p>
                  </div>
                  <Badge variant={tool.installed ? 'success' : 'default'}>
                    {tool.installed ? 'Ready' : 'Not Detected'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Database & Runtime Details */}
          <div className="panel-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Database className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Database & Sandboxed Storage
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block mb-1">Database Engine</span>
                <span className="font-mono text-slate-200 font-medium">
                  {settingsData.database_backend}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block mb-1">Sandboxed Storage Dir</span>
                <span className="font-mono text-slate-200 font-medium">
                  {settingsData.storage_dir}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block mb-1">Max Archive Size</span>
                <span className="font-mono text-slate-200 font-medium">
                  {settingsData.max_upload_size_mb} MB
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
