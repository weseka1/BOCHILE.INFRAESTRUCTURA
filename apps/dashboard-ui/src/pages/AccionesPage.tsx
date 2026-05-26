import { useAcciones } from '@/hooks/useAcciones';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Toolbar, ChipFilter } from '@/components/ui/Toolbar';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { relativeTime, formatDateTime } from '@/lib/utils';
import type { AccionIA } from '@/types/domain';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ArrowUpRight } from 'lucide-react';

export function AccionesPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAcciones();
  const [filtroRes, setFiltroRes] = useState<'todos' | 'ok' | 'error'>('todos');
  const [filtroAgente, setFiltroAgente] = useState<string>('todos');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<AccionIA | null>(null);

  const all = data ?? [];

  const agentes = useMemo(() => {
    const s = new Set<string>();
    all.forEach(a => { if (a.agente) s.add(a.agente); });
    return Array.from(s).sort();
  }, [all]);

  const counts = useMemo(() => ({
    todos: all.length,
    ok: all.filter(a => a.resultado === 'ok').length,
    error: all.filter(a => a.resultado !== 'ok').length,
  }), [all]);

  const filtered = useMemo(() => {
    let arr = all;
    if (filtroRes === 'ok') arr = arr.filter(a => a.resultado === 'ok');
    if (filtroRes === 'error') arr = arr.filter(a => a.resultado !== 'ok');
    if (filtroAgente !== 'todos') arr = arr.filter(a => a.agente === filtroAgente);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(a =>
        String(a.resumen || '').toLowerCase().includes(ql) ||
        String(a.tipo || '').toLowerCase().includes(ql) ||
        String(a.lead_id || '').toLowerCase().includes(ql) ||
        String(a.detalle || '').toLowerCase().includes(ql),
      );
    }
    return arr.slice(0, 500);
  }, [all, filtroRes, filtroAgente, q]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Acciones IA" subtitle="Auditoría de todas las acciones del sistema" count={filtered.length} />

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="Buscar por resumen, tipo, lead...">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todas" active={filtroRes === 'todos'} onClick={() => setFiltroRes('todos')} count={counts.todos} />
          <ChipFilter label="OK" active={filtroRes === 'ok'} onClick={() => setFiltroRes('ok')} count={counts.ok} />
          <ChipFilter label="Errores" active={filtroRes === 'error'} onClick={() => setFiltroRes('error')} count={counts.error} />
        </div>
        {agentes.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <ChipFilter label="Todos agentes" active={filtroAgente === 'todos'} onClick={() => setFiltroAgente('todos')} />
            {agentes.map(a => (
              <ChipFilter key={a} label={a} active={filtroAgente === a} onClick={() => setFiltroAgente(a)} />
            ))}
          </div>
        )}
      </Toolbar>

      <Card>
        <Table<AccionIA>
          rowKey={(r) => r.accion_id}
          rows={filtered}
          empty="No hay acciones con esos filtros"
          rowOnClick={(r) => setSelected(r)}
          columns={[
            { key: 'when', header: 'Cuándo', cell: (r) => <span className="text-text-muted text-xs">{relativeTime(r.timestamp)}</span> },
            { key: 'tipo', header: 'Tipo', cell: (r) => <Badge className="bg-purple-500/10 text-purple-300">{r.tipo}</Badge> },
            { key: 'agente', header: 'Agente', cell: (r) => r.agente },
            { key: 'lead', header: 'Lead', cell: (r) => <span className="font-mono text-xs">{r.lead_id || '-'}</span> },
            { key: 'resumen', header: 'Resumen', cell: (r) => <span className="text-text">{r.resumen}</span> },
            {
              key: 'res',
              header: 'Resultado',
              cell: (r) => (
                <Badge className={r.resultado === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}>
                  {r.resultado}
                </Badge>
              ),
            },
            { key: 'ahorro', header: 'Ahorro', cell: (r) => <span className="text-text-muted text-xs">{r.tiempo_ahorrado_min}min</span> },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.resumen || 'Acción IA'}
        subtitle={selected ? `${selected.accion_id} · ${selected.tipo}` : ''}
        footer={selected?.lead_id && (
          <button type="button"
            onClick={() => { navigate(`/conversaciones?lead=${selected.lead_id}`); setSelected(null); }}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent text-accent-fg hover:brightness-110 font-semibold">
            <MessageSquare className="w-4 h-4" /> Ver chat del lead <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      >
        {selected && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className="bg-purple-500/10 text-purple-300">{selected.tipo}</Badge>
              <Badge className={selected.resultado === 'ok' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}>
                {selected.resultado}
              </Badge>
            </div>
            <DrawerField label="Agente" value={selected.agente} />
            <DrawerField label="Lead ID" value={selected.lead_id && <span className="font-mono text-xs">{selected.lead_id}</span>} />
            <DrawerField label="Resumen" value={selected.resumen} />
            <DrawerField label="Detalle" value={selected.detalle && <pre className="text-xs whitespace-pre-wrap bg-surface-2 p-2 rounded">{selected.detalle}</pre>} />
            <DrawerField label="Tiempo ahorrado" value={`${selected.tiempo_ahorrado_min} min`} />
            <DrawerField label="Timestamp" value={formatDateTime(selected.timestamp)} />
          </div>
        )}
      </Drawer>
    </>
  );
}
