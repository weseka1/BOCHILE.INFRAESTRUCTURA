import { useAcciones } from '@/hooks/useAcciones';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { relativeTime } from '@/lib/utils';
import type { AccionIA } from '@/types/domain';

export function AccionesPage() {
  const { data, isLoading, error } = useAcciones();
  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  const rows = (data ?? []).slice(0, 300);
  return (
    <>
      <PageHeader title="Acciones IA" subtitle="Auditoría de todas las acciones del sistema" count={data?.length} />
      <Card>
        <Table<AccionIA>
          rowKey={(r) => r.accion_id}
          rows={rows}
          columns={[
            { key: 'when', header: 'Cuándo', cell: (r) => relativeTime(r.timestamp), className: 'text-text-muted' },
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
            { key: 'ahorro', header: 'Ahorro', cell: (r) => `${r.tiempo_ahorrado_min}min`, className: 'text-text-muted' },
          ]}
        />
      </Card>
    </>
  );
}
