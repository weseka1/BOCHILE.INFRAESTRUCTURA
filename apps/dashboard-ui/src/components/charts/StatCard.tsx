import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'green' | 'blue' | 'amber' | 'pink' | 'default' | 'gold';
}

const accentMap = {
  green: 'text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20',
  blue: 'text-blue-400 bg-blue-500/10 ring-1 ring-blue-500/20',
  amber: 'text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20',
  pink: 'text-pink-400 bg-pink-500/10 ring-1 ring-pink-500/20',
  gold: 'text-accent bg-accent/10 ring-1 ring-accent/20',
  default: 'text-text-muted bg-surface-2 ring-1 ring-border',
};

export function StatCard({ label, value, hint, icon: Icon, accent = 'default' }: Props) {
  return (
    <div className="card p-3 sm:p-5 hover:border-accent/30 transition-colors group">
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
    </div>
  );
}
