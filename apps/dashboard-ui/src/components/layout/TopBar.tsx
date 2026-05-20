import { useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function TopBar() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  const fechaLarga = now.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="sticky top-0 z-10 bg-surface-0/90 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-accent">
          <Activity className="w-3 h-3 animate-pulse" />
          <span className="font-medium">Sistema activo</span>
        </span>
        <span className="text-text-subtle">·</span>
        <span className="text-xs text-text-muted capitalize">{fechaLarga}</span>
        <span className="text-text-subtle">·</span>
        <span className="text-xs text-text-muted font-mono">{hora}</span>
      </div>
      <button
        onClick={() => qc.invalidateQueries()}
        className="btn-ghost text-xs px-3 py-1.5"
        title="Refrescar datos del Sheet"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Refrescar
      </button>
    </div>
  );
}
