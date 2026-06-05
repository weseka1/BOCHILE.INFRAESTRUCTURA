import { useNavigate } from 'react-router-dom';
import { Building2, Megaphone } from 'lucide-react';
import { usePanel, type PanelKey } from '@/panel/PanelContext';
import { cn } from '@/lib/utils';

export function PanelSwitcher({ className }: { className?: string }) {
  const { panel, setPanel } = usePanel();
  const navigate = useNavigate();

  function go(target: PanelKey) {
    setPanel(target);
    navigate(target === 'marketing' ? '/marketing' : '/');
  }

  return (
    <div className={cn('grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2 border border-border', className)}>
      <button
        type="button"
        onClick={() => go('bochile')}
        className={cn(
          'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
          panel === 'bochile'
            ? 'bg-accent text-accent-fg shadow-gold'
            : 'text-text-muted hover:text-text hover:bg-surface-1',
        )}
        aria-pressed={panel === 'bochile'}
      >
        <Building2 className="w-3.5 h-3.5" />
        <span>Bochile</span>
      </button>
      <button
        type="button"
        onClick={() => go('marketing')}
        className={cn(
          'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
          panel === 'marketing'
            ? 'bg-fuchsia-500 text-white shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)]'
            : 'text-text-muted hover:text-text hover:bg-surface-1',
        )}
        aria-pressed={panel === 'marketing'}
      >
        <Megaphone className="w-3.5 h-3.5" />
        <span>Marketing</span>
      </button>
    </div>
  );
}
