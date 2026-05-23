import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { useVisitas } from '@/hooks/useVisitas';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/charts/StatCard';
import { Users, Home, Calendar, TrendingUp, DollarSign, Sparkles, ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lead, Propiedad } from '@/types/domain';

const isVenta = (op?: string) => {
  const s = String(op || '').toLowerCase();
  return s === 'venta' || s === 'sale' || s === 'comprar' || s.includes('vent');
};

export function VentasPage() {
  const navigate = useNavigate();
  const { data: leads, isLoading: l1 } = useLeads();
  const { data: props, isLoading: l2 } = usePropiedades();
  const { isLoading: l3 } = useVisitas();

  const stats = useMemo(() => {
    const lv = (leads ?? []).filter((l: Lead) => isVenta(l.operacion));
    const pv = (props ?? []).filter((p: Propiedad) => isVenta(p.operacion));
    const calif = lv.filter(l => Number(l.score || 0) >= 70).length;
    const solicitudes = lv.filter(l => String(l.etapa||'').toLowerCase().replace(/[\s_]/g,'') === 'solicitovisita').length;
    const presupProm = lv.length > 0 ? Math.round(lv.reduce((s,l)=>s+Number(l.presupuesto_max||0),0)/lv.length) : 0;
    const precios = pv.map(p => Number(p.precio||0)).filter(n => n>0);
    const precioProm = precios.length ? Math.round(precios.reduce((s,p)=>s+p,0)/precios.length) : 0;
    return { leadsTotal: lv.length, leadsCalif: calif, solicitudes, propsTotal: pv.length, presupProm, precioProm };
  }, [leads, props]);

  if (l1 || l2 || l3) return <div className="text-text-muted">Cargando ventas...</div>;

  const leadsVenta = (leads ?? []).filter((l: Lead) => isVenta(l.operacion));

  return (
    <>
      <PageHeader title="Dashboard Ventas" subtitle="KPIs e indicadores del área de venta de propiedades" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Leads de venta" value={stats.leadsTotal} icon={Users} accent="blue" to="/leads?op=venta" />
        <StatCard label="Calificados ≥70" value={stats.leadsCalif} icon={Sparkles} accent="pink" to="/leads?op=venta&score=70" />
        <StatCard label="Solicitan visita/llamado" value={stats.solicitudes} icon={Calendar} accent="amber" to="/visitas" />
        <StatCard label="Propiedades en venta" value={stats.propsTotal} icon={Home} accent="gold" to="/propiedades?op=venta" />
        <StatCard label="Presup. promedio leads" value={stats.presupProm ? 'USD ' + stats.presupProm.toLocaleString('es-AR') : '-'} icon={DollarSign} accent="green" />
        <StatCard label="Precio promedio props" value={stats.precioProm ? 'USD ' + stats.precioProm.toLocaleString('es-AR') : '-'} icon={TrendingUp} accent="green" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm uppercase tracking-wider text-text-muted">Leads de venta recientes</h3>
          <Link to="/leads?op=venta" className="text-xs text-accent hover:underline flex items-center gap-1">
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-1">
          {leadsVenta.slice(0, 10).map((l: Lead) => (
            <button
              key={l.lead_id}
              type="button"
              onClick={() => navigate(`/conversaciones?lead=${l.lead_id}`)}
              className="w-full flex items-center justify-between gap-2 py-2 px-2 -mx-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-surface-2 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{l.nombre || l.lead_id}</div>
                <div className="text-xs text-text-muted truncate">{l.tipo_propiedad || '?'} · {l.zona_pref || '?'} · {l.ambientes ? l.ambientes + ' dorm' : '?'} · {l.presupuesto_max ? l.presupuesto_max + ' ' + (l.moneda || '') : '?'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-400">{l.etapa || 'Nuevo'} · {l.score || 0}</span>
                <ArrowUpRight className="w-3 h-3 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
          {leadsVenta.length === 0 && (
            <p className="text-text-muted text-sm text-center py-4">Sin leads de venta todavía.</p>
          )}
        </div>
      </Card>
    </>
  );
}
