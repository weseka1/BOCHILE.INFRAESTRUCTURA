import { useConversaciones } from '@/hooks/useConversaciones';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { relativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export function ConversacionesPage() {
  const { data, isLoading, error } = useConversaciones();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const all = data ?? [];
    if (!q) return all.slice(0, 200);
    const ql = q.toLowerCase();
    return all
      .filter(
        (m) =>
          m.mensaje?.toLowerCase().includes(ql) ||
          m.telefono?.includes(q) ||
          m.lead_id?.toLowerCase().includes(ql),
      )
      .slice(0, 200);
  }, [data, q]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader
        title="Conversaciones"
        subtitle="Mensajes entrantes y salientes del bot Camila"
        count={data?.length}
      />
      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar mensaje, teléfono, lead_id..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-1 border border-border text-sm placeholder:text-text-subtle focus:outline-none focus:border-accent"
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <p className="text-text-muted text-sm py-8 text-center">Sin resultados</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => (
              <div
                key={m.msg_id}
                className={cn(
                  'rounded-lg p-3 border',
                  m.direccion === 'in'
                    ? 'bg-surface-2 border-border'
                    : 'bg-accent/5 border-emerald-500/20',
                )}
              >
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <div className="flex items-center gap-2">
                    <span className={m.direccion === 'in' ? 'text-blue-300' : 'text-emerald-300'}>
                      {m.direccion === 'in' ? '↘ entrada' : '↗ salida'}
                    </span>
                    <span className="font-mono">{m.telefono}</span>
                    <span>·</span>
                    <span className="font-mono">{m.lead_id}</span>
                  </div>
                  <span>{relativeTime(m.timestamp)}</span>
                </div>
                <p className="text-sm text-text whitespace-pre-wrap">{m.mensaje || <em className="text-text-subtle">(vacío)</em>}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
