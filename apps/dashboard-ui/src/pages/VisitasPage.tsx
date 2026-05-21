import { useVisitas } from '@/hooks/useVisitas';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatFechaVisita, formatHora } from '@/lib/utils';
import type { Visita } from '@/types/domain';

const estadoColor = (estado: string) => {
  switch (estado) {
    case 'agendada': return 'bg-blue-500/10 text-blue-300';
    case 'realizada': return 'bg-emerald-500/10 text-emerald-300';
    case 'cancelada': return 'bg-rose-500/10 text-rose-300';
    default: return 'bg-zinc-500/10 text-zinc-300';
  }
};

export function VisitasPage() {
  const { data, isLoading, error } = useVisitas();
  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  const rows = data ?? [];
  return (
    <>
      <PageHeader title="Visitas" subtitle="Visitas agendadas a propiedades" count={rows.length} />
      <Card>
        <Table<Visita>
          rowKey={(r) => r.visita_id}
          rows={rows}
          columns={[
            { key: 'fecha', header: 'Fecha', cell: (r) => formatFechaVisita(r.fecha) },
            { key: 'hora', header: 'Hora', cell: (r) => formatHora(r.hora) },
            { key: 'cliente', header: 'Cliente', cell: (r) => <span className="font-medium">{r.cliente_nombre}</span> },
            { key: 'prop', header: 'Prop', cell: (r) => <span className="font-mono text-xs">{r.prop_id}</span> },
            { key: 'dir', header: 'Dirección', cell: (r) => r.direccion },
            { key: 'vend', header: 'Vendedor', cell: (r) => r.vendedor_nombre },
            { key: 'estado', header: 'Estado', cell: (r) => <Badge className={estadoColor(r.estado)}>{r.estado}</Badge> },
          ]}
        />
      </Card>
    </>
  );
}
