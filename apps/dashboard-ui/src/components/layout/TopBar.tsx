import { useEffect, useState } from 'react';
import { RefreshCw, Activity, Menu } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface TopBarProps {
  onMenu?: () => void;
}

export function TopBar({ onMenu }: TopBarProps) {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  const fechaCorta = now.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const fechaLarga = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="sticky top-0 z-20 bg-surface-0/95 backdrop-blur border-b border-border px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Hamburger (solo mobile) */}
        <button
          onClick={onMenu}
          className="md:hidden p-2 -ml-1 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="hidden sm:flex items-center gap-1.5 text-xs text-accent shrink-0">
          <Activity className="w-3 h-3 animate-pulse" />
          <span className="font-medium">Sistema activo</span>
        </span>
        <span className="hidden sm:inline text-text-subtle">·</span>
        <span className="text-xs text-text-muted capitalize truncate hidden sm:inline">
          {fechaLarga}
        </span>
        {/* mobile: solo fecha corta */}
        <span className="text-xs text-text-muted capitalize sm:hidden">
          {fechaCorta}
        </span>
        <span className="text-text-subtle">·</span>
        <span className="text-xs text-text-muted font-mono">{hora}</span>
      </div>
      <button
        onClick={() => qc.invalidateQueries()}
        className="btn-ghost text-xs px-2.5 sm:px-3 py-1.5 shrink-0"
        title="Refrescar datos del Sheet"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Refrescar</span>
      </button>
    </div>
  );
}
