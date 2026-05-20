import { useContratos } from '@/hooks/useContratos';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatMoney, formatDate } from '@/lib/utils';
import type { Contrato } from '@/types/domain';

export function ContratosPage() {
  const { data, isLoading, error } = useContratos();
  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  const rows = data ?? [];
  return (
    <>
      <PageHeader title="Contratos" subtitle="Alquileres vigentes" count={rows.length} />
      <Card>
        <Table<Contrato>
          rowKey={(r) => r.contrato_id}
          rows={rows}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs">{r.contrato_id}</span> },
            { key: 'inq', header: 'Inquilino', cell: (r) => <span className="font-medium">{r.inquilino_nombre}</span> },
            { key: 'dir', header: 'Dirección', cell: (r) => r.direccion },
            { key: 'monto', header: 'Monto', cell: (r) => formatMoney(r.monto_actual, r.moneda) },
            { key: 'venc', header: 'Vence día', cell: (r) => r.dia_vencimiento },
            { key: 'pago', header: 'Último pago', cell: (r) => formatDate(r.ultimo_pago) },
            {
              key: 'atraso',
              header: 'Atraso',
              cell: (r) => (
                <Badge
                  className={
                    r.dias_atraso > 0
                      ? 'bg-rose-500/10 text-rose-300'
                      : 'bg-emerald-500/10 text-emerald-300'
                  }
                >
                  {r.dias_atraso > 0 ? `${r.dias_atraso} días` : 'al día'}
                </Badge>
              ),
            },
            { key: 'estado', header: 'Estado', cell: (r) => <Badge className="bg-zinc-500/10 text-zinc-300">{r.estado}</Badge> },
          ]}
        />
      </Card>
    </>
  );
}
