import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'green' | 'blue' | 'amber' | 'pink' | 'default' | 'gold';
  to?: string;
  onClick?: () => void;
}

const accentMap = {
  green: 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20',
  blue: 'text-blue-400 bg-blue-500/10 ring-1 ring-blue-500/20',
  amber: 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20',
  pink: 'text-pink-400 bg-pink-500/10 ring-1 ring-pink-500/20',
  gold: 'text-accent bg-accent/10 ring-1 ring-accent/20',
  default: 'text-text-muted bg-surface-2 ring-1 ring-border',
};

export function StatCard({ label, value, hint, icon: Icon, accent = 'default', to, onClick }: Props) {
  const interactive = Boolean(to || onClick);
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.15em] text-text-muted font-medium leading-tight">
            {label}
          </p>
          <p className="font-display text-xl sm:text-3xl font-semibold mt-1.5 sm:mt-2 text-text truncate">
            {value}
          </p>
          {hint && (
            <p className="text-[10px] sm:text-xs text-text-subtle mt-1 sm:mt-1.5 italic truncate">{hint}</p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition-transform group-hover:scale-110 shrink-0', accentMap[accent])}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        )}
      </div>
      {interactive && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-text-subtle group-hover:text-accent transition-colors">
          <span>Abrir</span>
          <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      )}
    </>
  );

  const baseClasses = cn(
    'card p-3 sm:p-5 transition-all group block text-left w-full',
    interactive
      ? 'cursor-pointer hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-15px_rgba(255,200,80,0.35)] active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60'
      : 'hover:border-accent/30',
  );

  if (to) {
    return (
      <Link to={to} className={baseClasses}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {inner}
      </button>
    );
  }
  return <div className={baseClasses}>{inner}</div>;
}
