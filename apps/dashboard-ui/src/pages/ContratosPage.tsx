import { useContratos } from '@/hooks/useContratos';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Toolbar, ChipFilter } from '@/components/ui/Toolbar';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { formatMoney, formatDate } from '@/lib/utils';
import type { Contrato } from '@/types/domain';
import { useMemo, useState } from 'react';
import { Phone, MapPin, AlertTriangle } from 'lucide-react';

export function ContratosPage() {
  const { data, isLoading, error } = useContratos();
  const [filtro, setFiltro] = useState<'todos' | 'atrasados' | 'al_dia'>('todos');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Contrato | null>(null);

  const rows = data ?? [];

  const counts = useMemo(() => ({
    todos: rows.length,
    atrasados: rows.filter(r => r.dias_atraso > 0).length,
    al_dia: rows.filter(r => r.dias_atraso <= 0).length,
  }), [rows]);

  const filtered = useMemo(() => {
    let arr = rows;
    if (filtro === 'atrasados') arr = arr.filter(r => r.dias_atraso > 0);
    if (filtro === 'al_dia') arr = arr.filter(r => r.dias_atraso <= 0);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(r =>
        (r.inquilino_nombre || '').toLowerCase().includes(ql) ||
        (r.direccion || '').toLowerCase().includes(ql) ||
        (r.propietario || '').toLowerCase().includes(ql) ||
        (r.contrato_id || '').toLowerCase().includes(ql),
      );
    }
    return arr;
  }, [rows, filtro, q]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Contratos" subtitle="Alquileres vigentes" count={filtered.length} />

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="Buscar por inquilino, dirección, propietario...">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todos" active={filtro === 'todos'} onClick={() => setFiltro('todos')} count={counts.todos} />
          <ChipFilter label="Atrasados" active={filtro === 'atrasados'} onClick={() => setFiltro('atrasados')} count={counts.atrasados} />
          <ChipFilter label="Al día" active={filtro === 'al_dia'} onClick={() => setFiltro('al_dia')} count={counts.al_dia} />
        </div>
      </Toolbar>

      <Card>
        <Table<Contrato>
          rowKey={(r) => r.contrato_id}
          rows={filtered}
          empty="No hay contratos con esos filtros"
          rowOnClick={(r) => setSelected(r)}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs text-text-muted">{r.contrato_id}</span> },
            { key: 'inq', header: 'Inquilino', cell: (r) => <span className="font-medium">{r.inquilino_nombre}</span> },
            { key: 'dir', header: 'Dirección', cell: (r) => r.direccion },
            { key: 'monto', header: 'Monto', cell: (r) => <span className="font-semibold">{formatMoney(r.monto_actual, r.moneda)}</span> },
            { key: 'venc', header: 'Vence día', cell: (r) => r.dia_vencimiento },
            { key: 'pago', header: 'Último pago', cell: (r) => <span className="text-text-muted text-xs">{formatDate(r.ultimo_pago)}</span> },
            {
              key: 'atraso',
              header: 'Atraso',
              cell: (r) => (
                <Badge className={r.dias_atraso > 0 ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}>
                  {r.dias_atraso > 0 ? `${r.dias_atraso} días` : 'al día'}
                </Badge>
              ),
            },
            { key: 'estado', header: 'Estado', cell: (r) => <Badge className="bg-zinc-500/10 text-zinc-300">{r.estado}</Badge> },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.inquilino_nombre || 'Contrato'}
        subtitle={selected ? `${selected.contrato_id} · ${selected.direccion}` : ''}
        footer={selected?.inquilino_telefono && (
          <a href={`https://wa.me/${selected.inquilino_telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-600/80 text-white hover:brightness-110">
            <Phone className="w-4 h-4" /> WhatsApp inquilino
          </a>
        )}
      >
        {selected && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className={selected.dias_atraso > 0 ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}>
                {selected.dias_atraso > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                {selected.dias_atraso > 0 ? `${selected.dias_atraso} días atraso` : 'Al día'}
              </Badge>
              <Badge className="bg-zinc-500/10 text-zinc-300">{selected.estado}</Badge>
            </div>
            <DrawerField label="Dirección" value={selected.direccion && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.direccion}</span>} />
            <DrawerField label="Inquilino" value={selected.inquilino_nombre} />
            <DrawerField label="Tel inquilino" value={selected.inquilino_telefono} />
            <DrawerField label="Propietario" value={selected.propietario} />
            <DrawerField label="Monto actual" value={<span className="font-bold text-lg text-accent">{formatMoney(selected.monto_actual, selected.moneda)}</span>} />
            <DrawerField label="Día vencimiento" value={selected.dia_vencimiento} />
            <DrawerField label="Frecuencia ajuste" value={selected.frecuencia_ajuste} />
            <DrawerField label="Índice ajuste" value={selected.indice_ajuste} />
            <DrawerField label="Fecha inicio" value={formatDate(selected.fecha_inicio)} />
            <DrawerField label="Fecha fin" value={formatDate(selected.fecha_fin)} />
            <DrawerField label="Último pago" value={formatDate(selected.ultimo_pago)} />
            <DrawerField label="Propiedad ID" value={<span className="font-mono text-xs">{selected.prop_id}</span>} />
          </div>
        )}
      </Drawer>
    </>
  );
}
