import { useLeads } from '@/hooks/useLeads';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Toolbar, ChipFilter } from '@/components/ui/Toolbar';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { etapaColor, scoreColor, formatMoney, formatDate, cn } from '@/lib/utils';
import type { Lead } from '@/types/domain';
import { useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, MapPin, ExternalLink } from 'lucide-react';

const isVenta = (op?: string) => /vent|sale|compra/i.test(String(op || ''));
const isAlquiler = (op?: string) => /alquil|rent/i.test(String(op || ''));

type OpFilter = 'todos' | 'venta' | 'alquiler';
type ScoreFilter = 'todos' | 'cali' | 'medio' | 'bajo';

export function LeadsPage() {
  const { data, isLoading, error } = useLeads();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const opFromUrl = (searchParams.get('op') as OpFilter) || 'todos';
  const scoreFromUrl = searchParams.get('score');
  const [op, setOp] = useState<OpFilter>(['venta', 'alquiler'].includes(opFromUrl) ? opFromUrl : 'todos');
  const [score, setScore] = useState<ScoreFilter>(scoreFromUrl === '70' ? 'cali' : 'todos');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Lead | null>(null);

  const leads = data ?? [];

  const counts = useMemo(() => ({
    todos: leads.length,
    venta: leads.filter(l => isVenta(l.operacion)).length,
    alquiler: leads.filter(l => isAlquiler(l.operacion)).length,
    cali: leads.filter(l => Number(l.score || 0) >= 70).length,
  }), [leads]);

  const filtered = useMemo(() => {
    let arr = leads;
    if (op === 'venta') arr = arr.filter(l => isVenta(l.operacion));
    if (op === 'alquiler') arr = arr.filter(l => isAlquiler(l.operacion));
    if (score === 'cali') arr = arr.filter(l => Number(l.score || 0) >= 70);
    if (score === 'medio') arr = arr.filter(l => { const s = Number(l.score || 0); return s >= 40 && s < 70; });
    if (score === 'bajo') arr = arr.filter(l => Number(l.score || 0) < 40);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(l =>
        (l.nombre || '').toLowerCase().includes(ql) ||
        (l.telefono || '').includes(q) ||
        (l.email || '').toLowerCase().includes(ql) ||
        (l.zona_pref || '').toLowerCase().includes(ql) ||
        (l.lead_id || '').toLowerCase().includes(ql),
      );
    }
    return arr;
  }, [leads, op, score, q]);

  function syncOp(next: OpFilter) {
    setOp(next);
    const p = new URLSearchParams(searchParams);
    if (next === 'todos') p.delete('op'); else p.set('op', next);
    setSearchParams(p, { replace: true });
  }
  function syncScore(next: ScoreFilter) {
    setScore(next);
    const p = new URLSearchParams(searchParams);
    if (next === 'cali') p.set('score', '70'); else p.delete('score');
    setSearchParams(p, { replace: true });
  }

  if (isLoading) return <div className="text-text-muted">Cargando leads...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Leads" subtitle="Clientes captados por Camila" count={filtered.length} />

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="Buscar por nombre, teléfono, zona...">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todos" active={op === 'todos'} onClick={() => syncOp('todos')} count={counts.todos} />
          <ChipFilter label="Venta" active={op === 'venta'} onClick={() => syncOp('venta')} count={counts.venta} />
          <ChipFilter label="Alquiler" active={op === 'alquiler'} onClick={() => syncOp('alquiler')} count={counts.alquiler} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todos scores" active={score === 'todos'} onClick={() => syncScore('todos')} />
          <ChipFilter label="Calif ≥70" active={score === 'cali'} onClick={() => syncScore('cali')} count={counts.cali} />
          <ChipFilter label="Medio 40-70" active={score === 'medio'} onClick={() => syncScore('medio')} />
          <ChipFilter label="Bajo <40" active={score === 'bajo'} onClick={() => syncScore('bajo')} />
        </div>
      </Toolbar>

      <Card>
        <Table<Lead>
          rowKey={(r) => r.lead_id}
          rows={filtered}
          empty="No hay leads que coincidan con los filtros"
          rowOnClick={(r) => setSelected(r)}
          columns={[
            { key: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium text-text">{r.nombre || r.lead_id}</span> },
            { key: 'tel', header: 'Teléfono', cell: (r) => <span className="font-mono text-xs">{r.telefono}</span> },
            { key: 'op', header: 'Op.', cell: (r) => (
              <Badge className={cn(
                isVenta(r.operacion) ? 'bg-emerald-500/10 text-emerald-300' :
                isAlquiler(r.operacion) ? 'bg-blue-500/10 text-blue-300' :
                'bg-zinc-500/10 text-zinc-300',
              )}>{r.operacion || '-'}</Badge>
            ) },
            { key: 'etapa', header: 'Etapa', cell: (r) => <Badge className={etapaColor(r.etapa)}>{r.etapa}</Badge> },
            { key: 'score', header: 'Score', cell: (r) => <Badge className={scoreColor(r.score)}>{r.score}</Badge> },
            { key: 'zona', header: 'Zona', cell: (r) => r.zona_pref || '-' },
            { key: 'tipo', header: 'Busca', cell: (r) => `${r.tipo_propiedad || '-'} ${r.ambientes ? `· ${r.ambientes} amb` : ''}` },
            { key: 'presup', header: 'Presupuesto', cell: (r) => formatMoney(r.presupuesto_max, r.moneda) },
            { key: 'creado', header: 'Creado', cell: (r) => <span className="text-text-muted text-xs">{formatDate(r.creado_en)}</span> },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nombre || selected?.lead_id || 'Lead'}
        subtitle={selected ? `${selected.lead_id} · ${selected.telefono || 'sin teléfono'}` : ''}
        footer={selected && (
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${String(selected.telefono || '').replace(/\D/g, '')}`}
              target="_blank" rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-600/80 text-white hover:brightness-110 transition-all"
            >
              <Phone className="w-4 h-4" /> WhatsApp
            </a>
            <button
              type="button"
              onClick={() => { navigate(`/conversaciones?lead=${selected.lead_id}`); setSelected(null); }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent text-accent-fg hover:brightness-110 transition-all font-semibold"
            >
              <MessageSquare className="w-4 h-4" /> Ver chat
            </button>
          </div>
        )}
      >
        {selected && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className={etapaColor(selected.etapa)}>{selected.etapa}</Badge>
              <Badge className={scoreColor(selected.score)}>Score {selected.score}</Badge>
              <Badge className={
                isVenta(selected.operacion) ? 'bg-emerald-500/10 text-emerald-300' :
                isAlquiler(selected.operacion) ? 'bg-blue-500/10 text-blue-300' :
                'bg-zinc-500/10 text-zinc-300'
              }>{selected.operacion}</Badge>
            </div>
            <DrawerField label="Email" value={selected.email} />
            <DrawerField label="Canal" value={selected.canal} />
            <DrawerField label="Vendedor asignado" value={selected.vendedor_asignado} />
            <DrawerField label="Tipo de propiedad" value={selected.tipo_propiedad} />
            <DrawerField label="Zona preferida" value={selected.zona_pref && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.zona_pref}</span>} />
            <DrawerField label="Ambientes" value={selected.ambientes || '-'} />
            <DrawerField label="Presupuesto" value={`${formatMoney(selected.presupuesto_min, selected.moneda)} — ${formatMoney(selected.presupuesto_max, selected.moneda)}`} />
            <DrawerField label="Forma de pago" value={selected.forma_pago} />
            <DrawerField label="Urgencia" value={selected.urgencia} />
            <DrawerField label="Última intención" value={selected.ultima_intencion && <span className="italic">"{selected.ultima_intencion}"</span>} />
            <DrawerField label="Notas" value={selected.notas} />
            <DrawerField label="Creado" value={formatDate(selected.creado_en)} />
            <DrawerField label="Actualizado" value={formatDate(selected.actualizado_en)} />
          </div>
        )}
      </Drawer>
    </>
  );
}
