import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700',
  success: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60',
  warning: 'bg-amber-950/70 text-amber-400 border-amber-800/60',
  danger: 'bg-rose-950/70 text-rose-400 border-rose-800/60',
  info: 'bg-blue-950/70 text-blue-400 border-blue-800/60',
  purple: 'bg-purple-950/70 text-purple-400 border-purple-800/60',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  success: 'bg-emerald-400 animate-pulse',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400 animate-pulse',
  info: 'bg-blue-400',
  purple: 'bg-purple-400',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
  dot = false,
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  );
};
