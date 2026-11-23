import React from 'react';
import { Menu, Plus, Sparkles, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  onToggleSidebar: () => void;
}

const routeTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Dashboard', subtitle: 'Repository metrics and audit overview' },
  '/repositories': { title: 'Repositories', subtitle: 'Tracked codebases and analysis status' },
  '/import': { title: 'New Analysis', subtitle: 'Import a GitHub repository or upload a source ZIP' },
  '/pull-requests': { title: 'Pull Request Review', subtitle: 'Automated diff analysis and regression detection' },
  '/explorer': { title: 'Legacy Code Explorer', subtitle: 'AST symbol tree and deep code explanations' },
  '/security': { title: 'Security & Static Analysis', subtitle: 'Deterministic findings from Ruff, Bandit, and Semgrep' },
  '/dependencies': { title: 'Dependency Graph', subtitle: 'Module relationships and blast radius analysis' },
  '/documentation': { title: 'Documentation Generator', subtitle: 'Architecture specs, READMEs, and onboarding guides' },
  '/chat': { title: 'Bugveil Assistant', subtitle: 'Contextual RAG chatbot grounded in repository AST' },
  '/reports': { title: 'Audit Reports', subtitle: 'Comprehensive downloadable technical debt summaries' },
  '/settings': { title: 'Settings & Status', subtitle: 'Runtime diagnostics, Groq configuration, and tool availability' },
};

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const currentRoute = routeTitles[location.pathname] || {
    title: 'Bugveil',
    subtitle: 'Review smarter. Debug deeper.',
  };

  return (
    <header className="h-16 sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
            {currentRoute.title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            {currentRoute.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Milestone Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Milestone 1 Active</span>
        </div>

        {/* Documentation Link */}
        <Link
          to="/settings"
          className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="System Diagnostics & Settings"
        >
          <BookOpen className="w-4 h-4" />
        </Link>

        {/* Quick Action Button */}
        <Link
          to="/import"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Import Repository</span>
        </Link>
      </div>
    </header>
  );
};
