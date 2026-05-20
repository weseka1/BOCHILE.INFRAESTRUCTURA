import { usePropiedades } from '@/hooks/usePropiedades';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/utils';
import type { Propiedad } from '@/types/domain';

export function PropiedadesPage() {
  const { data, isLoading, error } = usePropiedades();
  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  const rows = data ?? [];
  return (
    <>
      <PageHeader title="Propiedades" subtitle="Catálogo de propiedades en cartera" count={rows.length} />
      <Card>
        <Table<Propiedad>
          rowKey={(r) => r.prop_id}
          rows={rows}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs">{r.prop_id}</span> },
            { key: 'titulo', header: 'Título', cell: (r) => <span className="font-medium">{r.titulo}</span> },
            { key: 'op', header: 'Op.', cell: (r) => <Badge className="bg-blue-500/10 text-blue-300">{r.operacion}</Badge> },
            { key: 'tipo', header: 'Tipo', cell: (r) => r.tipo },
            { key: 'zona', header: 'Zona', cell: (r) => r.zona },
            { key: 'amb', header: 'Amb', cell: (r) => r.ambientes || '-' },
            { key: 'precio', header: 'Precio', cell: (r) => formatMoney(r.precio, r.moneda) },
            {
              key: 'estado',
              header: 'Estado',
              cell: (r) => (
                <Badge className={r.publicada ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                  {r.estado || (r.publicada ? 'publicada' : 'inactiva')}
                </Badge>
              ),
            },
            {
              key: 'tour',
              header: 'Tour 360',
              cell: (r) =>
                r.tour_360_url ? (
                  <a href={r.tour_360_url} target="_blank" rel="noreferrer" className="text-accent text-xs hover:underline">
                    abrir
                  </a>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}
