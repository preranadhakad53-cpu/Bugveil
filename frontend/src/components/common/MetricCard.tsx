import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  color?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeVariant = 'default',
  color = 'text-blue-400',
}) => {
  return (
    <div className="panel-card p-5 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`p-2 rounded-md bg-slate-900/80 border border-slate-800 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold font-mono text-slate-100">{value}</div>
        {badge && (
          <span
            className={`text-xs px-2 py-0.5 rounded font-mono ${
              badgeVariant === 'danger'
                ? 'bg-rose-950/80 text-rose-400 border border-rose-900/60'
                : badgeVariant === 'warning'
                ? 'bg-amber-950/80 text-amber-400 border border-amber-900/60'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mt-2">{subtitle}</p>}
    </div>
  );
};
