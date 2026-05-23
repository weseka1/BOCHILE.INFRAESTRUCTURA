import { useLeads } from '@/hooks/useLeads';
import { useVisitas } from '@/hooks/useVisitas';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { formatFechaVisita, formatHora, cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Visita, Lead } from '@/types/domain';
import { Phone, MapPin, Clock, User as UserIcon, MessageSquare, ArrowUpRight } from 'lucide-react';

const estadoColor = (estado: string) => {
  switch (estado) {
    case 'agendada': return 'bg-blue-500/10 text-blue-300';
    case 'realizada': return 'bg-emerald-500/10 text-emerald-300';
    case 'cancelada': return 'bg-rose-500/10 text-rose-300';
    default: return 'bg-zinc-500/10 text-zinc-300';
  }
};

export function VisitasPage() {
  const navigate = useNavigate();
  const { data: leads, isLoading: loadingLeads } = useLeads();
  const { data: visitas, isLoading: loadingVisitas } = useVisitas();

  // Solicitudes pendientes: leads con etapa Solicito_Visita que NO tienen visita ya agendada
  const solicitudes = useMemo(() => {
    const all = leads ?? [];
    return all
      .filter((l: Lead) => String(l.etapa || '').toLowerCase().replace(/[\s_]/g, '') === 'solicitovisita')
      .sort((a, b) => String(b.actualizado_en || '').localeCompare(String(a.actualizado_en || '')));
  }, [leads]);

  const visitasAgendadas = visitas ?? [];

  if (loadingLeads || loadingVisitas) return <div className="text-text-muted">Cargando...</div>;

  return (
    <>
      <PageHeader
        title="Visitas"
        subtitle="Solicitudes de visita/llamado pendientes de cerrar por Camila Pomerich"
        count={solicitudes.length + visitasAgendadas.length}
      />

      {/* SOLICITUDES PENDIENTES (Cami marco, humana tiene que cerrar) */}
      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Pendientes de coordinar ({solicitudes.length})
        </h3>
        {solicitudes.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm py-6 text-center">Sin solicitudes pendientes. Cuando Cami detecte un lead que pida visita o llamada, va a aparecer aca para que Camila Pomerich lo cierre.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {solicitudes.map((l) => (
              <Card key={l.lead_id} className="border-amber-500/30 hover:border-amber-500/60 hover:-translate-y-0.5 transition-all group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <UserIcon className="w-4 h-4 text-amber-400" />
                      <span className="font-semibold text-text">{l.nombre || l.lead_id}</span>
                      <Badge className="bg-amber-500/10 text-amber-300 text-[10px]">Solicitó visita/llamado</Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-1.5">
                      <a
                        href={`https://wa.me/${String(l.telefono || '').replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" /> {l.telefono}
                      </a>
                      <button
                        type="button"
                        onClick={() => navigate(`/conversaciones?lead=${l.lead_id}`)}
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" /> Ver chat <ArrowUpRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0">Score: {l.score || '-'}</span>
                </div>

                {l.zona_pref && (
                  <div className="text-xs text-text-muted mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Zona pref: {l.zona_pref}
                  </div>
                )}
                {(l.tipo_propiedad || l.ambientes || l.presupuesto_max) && (
                  <div className="text-xs text-text-muted mb-1">
                    {[l.tipo_propiedad, l.ambientes ? `${l.ambientes} dorm` : '', l.presupuesto_max ? `${l.presupuesto_max} ${l.moneda || ''}` : ''].filter(Boolean).join(' · ')}
                  </div>
                )}
                {l.ultima_intencion && (
                  <div className="text-xs text-text mt-2 italic border-l-2 border-amber-500/40 pl-2">
                    "{l.ultima_intencion}"
                  </div>
                )}
                {l.notas && (
                  <div className="text-[11px] text-text-muted mt-2 line-clamp-3">{l.notas}</div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* VISITAS YA AGENDADAS (que Camila marco manual o cron) */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-blue-400 mb-2">Visitas confirmadas ({visitasAgendadas.length})</h3>
        {visitasAgendadas.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm py-6 text-center">Sin visitas agendadas todavia.</p>
          </Card>
        ) : (
          <Card>
            <Table<Visita>
              rowKey={(r) => r.visita_id}
              rows={visitasAgendadas}
              rowOnClick={(r) => r.lead_id && navigate(`/conversaciones?lead=${r.lead_id}`)}
              columns={[
                { key: 'fecha', header: 'Fecha', cell: (r) => formatFechaVisita(r.fecha) },
                { key: 'hora', header: 'Hora', cell: (r) => <span className="font-mono">{formatHora(r.hora)}</span> },
                { key: 'cliente', header: 'Cliente', cell: (r) => <span className="font-medium">{r.cliente_nombre}</span> },
                { key: 'prop', header: 'Prop', cell: (r) => <span className="font-mono text-xs">{r.prop_id}</span> },
                { key: 'dir', header: 'Direccion', cell: (r) => r.direccion },
                { key: 'vend', header: 'Vendedor', cell: (r) => r.vendedor_nombre },
                { key: 'estado', header: 'Estado', cell: (r) => <Badge className={estadoColor(r.estado)}>{r.estado}</Badge> },
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}
