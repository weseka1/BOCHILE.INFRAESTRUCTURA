import { useLeads } from '@/hooks/useLeads';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { etapaColor, scoreColor, formatMoney, formatDate } from '@/lib/utils';
import type { Lead } from '@/types/domain';

export function LeadsPage() {
  const { data, isLoading, error } = useLeads();
  if (isLoading) return <div className="text-text-muted">Cargando leads...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  const leads = data ?? [];
  return (
    <>
      <PageHeader title="Leads" subtitle="Clientes captados por Camila" count={leads.length} />
      <Card>
        <Table<Lead>
          rowKey={(r) => r.lead_id}
          rows={leads}
          columns={[
            { key: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium">{r.nombre}</span> },
            { key: 'tel', header: 'Teléfono', cell: (r) => <span className="font-mono text-xs">{r.telefono}</span> },
            { key: 'etapa', header: 'Etapa', cell: (r) => <Badge className={etapaColor(r.etapa)}>{r.etapa}</Badge> },
            { key: 'score', header: 'Score', cell: (r) => <Badge className={scoreColor(r.score)}>{r.score}</Badge> },
            { key: 'zona', header: 'Zona', cell: (r) => r.zona_pref },
            { key: 'tipo', header: 'Busca', cell: (r) => `${r.tipo_propiedad} ${r.ambientes ? `· ${r.ambientes} amb` : ''}` },
            { key: 'presup', header: 'Presupuesto', cell: (r) => formatMoney(r.presupuesto_max, r.moneda) },
            { key: 'vend', header: 'Vendedor', cell: (r) => r.vendedor_asignado || '-' },
            { key: 'creado', header: 'Creado', cell: (r) => formatDate(r.creado_en) },
          ]}
        />
      </Card>
    </>
  );
}
