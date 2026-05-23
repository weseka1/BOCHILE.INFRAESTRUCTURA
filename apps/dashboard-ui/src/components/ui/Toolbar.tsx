import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  right?: ReactNode;
}

export function Toolbar({ search, onSearch, searchPlaceholder = 'Buscar...', children, right }: ToolbarProps) {
  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      {onSearch && (
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted pointer-events-none" />
          <input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-surface-1 border border-border text-sm placeholder:text-text-subtle focus:outline-none focus:border-accent transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearch('')}
              className="absolute right-2 top-2 text-text-muted hover:text-text"
              aria-label="Limpiar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {children}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

interface ChipFilterProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

export function ChipFilter({ label, active, onClick, count }: ChipFilterProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
        active
          ? 'bg-accent text-accent-fg border-accent shadow-gold'
          : 'bg-surface-1 border-border text-text-muted hover:text-text hover:border-accent/40',
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={cn(
          'text-[10px] font-mono rounded-full px-1.5 py-0.5',
          active ? 'bg-accent-fg/20' : 'bg-surface-2',
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
