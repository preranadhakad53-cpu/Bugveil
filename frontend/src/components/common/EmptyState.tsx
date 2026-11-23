import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  secondaryActionHref?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  actionHref,
  onAction,
  secondaryActionText,
  secondaryActionHref,
}) => {
  return (
    <div className="panel-card p-10 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-6 border-dashed border-slate-800">
      <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-md">{description}</p>
      
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionText && actionHref && (
          <Link
            to={actionHref}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm"
          >
            {actionText}
          </Link>
        )}
        {actionText && onAction && !actionHref && (
          <button
            onClick={onAction}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors shadow-sm"
          >
            {actionText}
          </button>
        )}
        {secondaryActionText && secondaryActionHref && (
          <Link
            to={secondaryActionHref}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-md transition-colors"
          >
            {secondaryActionText}
          </Link>
        )}
      </div>
    </div>
  );
};
