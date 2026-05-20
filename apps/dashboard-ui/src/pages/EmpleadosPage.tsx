import { useEmpleados } from '@/hooks/useEmpleados';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/utils';
import type { Empleado } from '@/types/domain';

export function EmpleadosPage() {
  const { data, isLoading, error } = useEmpleados();
  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  const rows = data ?? [];
  return (
    <>
      <PageHeader title="Empleados" subtitle="Equipo de Bochile (vendedores + admins)" count={rows.length} />
      <Card>
        <Table<Empleado>
          rowKey={(r) => r.empleado_id}
          rows={rows}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs">{r.empleado_id}</span> },
            { key: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium">{r.nombre}</span> },
            { key: 'rol', header: 'Rol', cell: (r) => <Badge className="bg-blue-500/10 text-blue-300">{r.rol}</Badge> },
            { key: 'zona', header: 'Zona especialidad', cell: (r) => r.zona_especialidad || '-' },
            { key: 'tel', header: 'Teléfono', cell: (r) => <span className="font-mono text-xs">{r.telefono}</span> },
            { key: 'visitas', header: 'Visitas mes', cell: (r) => r.visitas_mes },
            { key: 'cierres', header: 'Cierres mes', cell: (r) => r.cierres_mes },
            { key: 'com', header: 'Comisiones mes', cell: (r) => formatMoney(r.comisiones_mes, 'ARS') },
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
    </>
  );
}
