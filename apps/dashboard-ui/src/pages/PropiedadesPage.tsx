import { usePropiedades } from '@/hooks/usePropiedades';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Toolbar, ChipFilter } from '@/components/ui/Toolbar';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { formatMoney } from '@/lib/utils';
import type { Propiedad } from '@/types/domain';
import { useMemo, useState } from 'react';
import { ExternalLink, MapPin, Phone, User as UserIcon } from 'lucide-react';

const isVenta = (op?: string) => {
  const s = String(op || '').toLowerCase();
  if (!s) return true; // sin operacion definida: incluir
  return /vent|sale/.test(s);
};

export function PropiedadesPage() {
  const { data, isLoading, error } = usePropiedades();
  const [estado, setEstado] = useState<'todos' | 'publicada' | 'inactiva'>('todos');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Propiedad | null>(null);

  // Solo ventas
  const props = useMemo(() => (data ?? []).filter(p => isVenta(p.operacion)), [data]);

  const counts = useMemo(() => ({
    todos: props.length,
    publicada: props.filter(p => p.publicada).length,
    inactiva: props.filter(p => !p.publicada).length,
  }), [props]);

  const filtered = useMemo(() => {
    let arr = props;
    if (estado === 'publicada') arr = arr.filter(p => p.publicada);
    if (estado === 'inactiva') arr = arr.filter(p => !p.publicada);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(p =>
        (p.titulo || '').toLowerCase().includes(ql) ||
        (p.direccion || '').toLowerCase().includes(ql) ||
        (p.zona || '').toLowerCase().includes(ql) ||
        (p.tipo || '').toLowerCase().includes(ql) ||
        (p.prop_id || '').toLowerCase().includes(ql),
      );
    }
    return arr;
  }, [props, estado, q]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Propiedades" subtitle="Catálogo de propiedades en cartera" count={filtered.length} />

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="Buscar por título, dirección, zona...">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todas" active={estado === 'todos'} onClick={() => setEstado('todos')} count={counts.todos} />
          <ChipFilter label="Publicadas" active={estado === 'publicada'} onClick={() => setEstado('publicada')} count={counts.publicada} />
          <ChipFilter label="Inactivas" active={estado === 'inactiva'} onClick={() => setEstado('inactiva')} count={counts.inactiva} />
        </div>
      </Toolbar>

      <Card>
        <Table<Propiedad>
          rowKey={(r) => r.prop_id}
          rows={filtered}
          empty="No hay propiedades con esos filtros"
          rowOnClick={(r) => setSelected(r)}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs text-text-muted">{r.prop_id}</span> },
            { key: 'titulo', header: 'Título', cell: (r) => <span className="font-medium text-text">{r.titulo || '-'}</span> },
            { key: 'tipo', header: 'Tipo', cell: (r) => r.tipo || '-' },
            { key: 'zona', header: 'Zona', cell: (r) => r.zona || '-' },
            { key: 'amb', header: 'Amb', cell: (r) => r.ambientes || '-' },
            { key: 'precio', header: 'Precio', cell: (r) => <span className="font-semibold">{formatMoney(r.precio, r.moneda)}</span> },
            {
              key: 'estado',
              header: 'Estado',
              cell: (r) => (
                <Badge className={r.publicada ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                  {r.estado || (r.publicada ? 'publicada' : 'inactiva')}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.titulo || selected?.prop_id || 'Propiedad'}
        subtitle={selected ? `${selected.prop_id} · ${selected.tipo} · ${selected.zona}` : ''}
        footer={selected && (
          <div className="flex gap-2 flex-wrap">
            {selected.tour_360_url && (
              <a href={selected.tour_360_url} target="_blank" rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent text-accent-fg hover:brightness-110 font-semibold">
                <ExternalLink className="w-4 h-4" /> Tour 360°
              </a>
            )}
            {selected.propietario_telefono && (
              <a href={`https://wa.me/${selected.propietario_telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-600/80 text-white hover:brightness-110">
                <Phone className="w-4 h-4" /> Propietario
              </a>
            )}
          </div>
        )}
      >
        {selected && (
          <div className="space-y-1">
            {selected.foto_principal && (
              <img src={selected.foto_principal} alt={selected.titulo} className="w-full rounded-lg mb-3 object-cover max-h-64" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className={selected.publicada ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                {selected.estado || (selected.publicada ? 'publicada' : 'inactiva')}
              </Badge>
            </div>
            <DrawerField label="Precio" value={<span className="font-bold text-lg text-accent">{formatMoney(selected.precio, selected.moneda)}</span>} />
            {selected.expensas > 0 && <DrawerField label="Expensas" value={formatMoney(selected.expensas, selected.moneda)} />}
            <DrawerField label="Dirección" value={selected.direccion && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.direccion}</span>} />
            <DrawerField label="Zona" value={selected.zona} />
            <DrawerField label="Tipo" value={selected.tipo} />
            <DrawerField label="Ambientes / Baños" value={`${selected.ambientes || '-'} amb · ${selected.banos || '-'} baños`} />
            <DrawerField label="Superficie" value={`${selected.superficie_cubierta || '-'} m² cubierta · ${selected.superficie_total || '-'} m² total`} />
            <DrawerField label="Características" value={selected.caracteristicas} />
            <DrawerField label="Propietario" value={selected.propietario && <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> {selected.propietario}</span>} />
            <DrawerField label="Tel propietario" value={selected.propietario_telefono} />
            <DrawerField label="Vendedor a cargo" value={selected.vendedor_a_cargo} />
            <DrawerField label="Fecha alta" value={selected.fecha_alta} />
          </div>
        )}
      </Drawer>
    </>
  );
}
