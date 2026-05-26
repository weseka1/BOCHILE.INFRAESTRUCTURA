import { useEmpleados } from '@/hooks/useEmpleados';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Toolbar, ChipFilter } from '@/components/ui/Toolbar';
import { Drawer, DrawerField } from '@/components/ui/Drawer';
import { formatMoney } from '@/lib/utils';
import type { Empleado } from '@/types/domain';
import { useMemo, useState } from 'react';
import { Phone, Mail, MapPin, Award, Calendar } from 'lucide-react';

export function EmpleadosPage() {
  const { data, isLoading, error } = useEmpleados();
  const [filtro, setFiltro] = useState<'todos' | 'activo' | 'inactivo'>('activo');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Empleado | null>(null);

  const rows = data ?? [];

  const counts = useMemo(() => ({
    todos: rows.length,
    activo: rows.filter(r => r.activo).length,
    inactivo: rows.filter(r => !r.activo).length,
  }), [rows]);

  const filtered = useMemo(() => {
    let arr = rows;
    if (filtro === 'activo') arr = arr.filter(r => r.activo);
    if (filtro === 'inactivo') arr = arr.filter(r => !r.activo);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(r =>
        (r.nombre || '').toLowerCase().includes(ql) ||
        (r.rol || '').toLowerCase().includes(ql) ||
        (r.zona_especialidad || '').toLowerCase().includes(ql) ||
        String(r.telefono || '').includes(q) ||
        (r.email || '').toLowerCase().includes(ql),
      );
    }
    return arr;
  }, [rows, filtro, q]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Empleados" subtitle="Equipo de Bochile (vendedores + admins)" count={filtered.length} />

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="Buscar por nombre, rol, zona...">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todos" active={filtro === 'todos'} onClick={() => setFiltro('todos')} count={counts.todos} />
          <ChipFilter label="Activos" active={filtro === 'activo'} onClick={() => setFiltro('activo')} count={counts.activo} />
          <ChipFilter label="Inactivos" active={filtro === 'inactivo'} onClick={() => setFiltro('inactivo')} count={counts.inactivo} />
        </div>
      </Toolbar>

      <Card>
        <Table<Empleado>
          rowKey={(r) => r.empleado_id}
          rows={filtered}
          empty="No hay empleados con esos filtros"
          rowOnClick={(r) => setSelected(r)}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs text-text-muted">{r.empleado_id}</span> },
            { key: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium text-text">{r.nombre}</span> },
            { key: 'rol', header: 'Rol', cell: (r) => <Badge className="bg-blue-500/10 text-blue-300">{r.rol}</Badge> },
            { key: 'zona', header: 'Zona', cell: (r) => r.zona_especialidad || '-' },
            { key: 'tel', header: 'Teléfono', cell: (r) => <span className="font-mono text-xs">{r.telefono}</span> },
            { key: 'visitas', header: 'Visitas mes', cell: (r) => r.visitas_mes },
            { key: 'cierres', header: 'Cierres mes', cell: (r) => <span className="font-semibold text-emerald-300">{r.cierres_mes}</span> },
            { key: 'com', header: 'Comisiones mes', cell: (r) => <span className="font-semibold">{formatMoney(r.comisiones_mes, 'ARS')}</span> },
            {
              key: 'activo',
              header: 'Estado',
              cell: (r) => (
                <Badge className={r.activo ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                  {r.activo ? 'activo' : 'inactivo'}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nombre || 'Empleado'}
        subtitle={selected ? `${selected.empleado_id} · ${selected.rol}` : ''}
        footer={selected && (
          <div className="flex gap-2">
            {selected.telefono && (
              <a href={`https://wa.me/${String(selected.telefono).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-600/80 text-white hover:brightness-110">
                <Phone className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {selected.email && (
              <a href={`mailto:${selected.email}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface-2 border border-border hover:border-accent transition-all">
                <Mail className="w-4 h-4" /> Email
              </a>
            )}
          </div>
        )}
      >
        {selected && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className="bg-blue-500/10 text-blue-300">{selected.rol}</Badge>
              <Badge className={selected.activo ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                {selected.activo ? 'activo' : 'inactivo'}
              </Badge>
            </div>
            <DrawerField label="Email" value={selected.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {selected.email}</span>} />
            <DrawerField label="Teléfono" value={selected.telefono} />
            <DrawerField label="Zona especialidad" value={selected.zona_especialidad && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.zona_especialidad}</span>} />
            <DrawerField label="Calendar ID" value={selected.calendar_id && <span className="font-mono text-xs">{selected.calendar_id}</span>} />
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="card p-3 text-center">
                <Calendar className="w-4 h-4 mx-auto text-blue-400 mb-1" />
                <div className="font-display text-xl font-bold text-text">{selected.visitas_mes}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Visitas mes</div>
              </div>
              <div className="card p-3 text-center">
                <Award className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
                <div className="font-display text-xl font-bold text-emerald-300">{selected.cierres_mes}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Cierres mes</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-accent text-xl mb-1">$</div>
                <div className="font-display text-sm font-bold text-accent">{formatMoney(selected.comisiones_mes, 'ARS')}</div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Comisiones</div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
