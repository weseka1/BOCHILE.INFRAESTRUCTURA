import { useCalidadIa } from '@/hooks/useCalidadIa';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle, MessageSquare, ShieldCheck, RefreshCw, Activity, TrendingDown, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CalidadIaIssue } from '@/services/api';

const ISSUE_LABELS: Record<string, string> = {
  rule_zero_violation: 'Regla #0 violada (dijo "no tengo" sin Matcher)',
  premature_pivot: 'Pivot prematuro (perdió contexto)',
  tech_leak: 'Texto técnico filtrado al cliente',
  weak_decline: 'Decline pobre (no listó todas las localidades)',
  context_loss: 'Pérdida de contexto',
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; ring: string; icon: any }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-300', ring: 'ring-red-500/30', icon: AlertCircle },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-300', ring: 'ring-amber-500/30', icon: AlertTriangle },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-300', ring: 'ring-blue-500/30', icon: Activity },
};

function timeAgo(iso: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function CalidadIaPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useCalidadIa();
  const qc = useQueryClient();
  const [filtroSev, setFiltroSev] = useState<'all' | 'critical' | 'warning'>('all');
  const [filtroTipo, setFiltroTipo] = useState<string>('all');

  if (isLoading) return <div className="text-text-muted">Cargando auditoría de IA... (puede tardar unos segundos)</div>;
  if (isError) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const { kpis, issues_by_type, issues } = data;

  const filtered = issues.filter((i) => {
    if (filtroSev !== 'all' && i.severity !== filtroSev) return false;
    if (filtroTipo !== 'all' && i.type !== filtroTipo) return false;
    return true;
  });

  const failRateColor = kpis.fail_rate_pct < 3 ? 'text-emerald-300' : kpis.fail_rate_pct < 6 ? 'text-amber-300' : 'text-red-300';

  return (
    <>
      {/* HEADER */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-accent" /> Calidad IA · Auditoría de Cami
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Detecta automáticamente fails en las respuestas de Cami: regla #0 violada, pivots prematuros, leaks técnicos, declines pobres.
          </p>
        </div>
        <button
          onClick={() => { qc.invalidateQueries({ queryKey: ['calidad-ia'] }); refetch(); }}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Auditando...' : 'Refrescar análisis'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Fails totales" value={kpis.fails_totales} accent={failRateColor} icon={AlertTriangle} hint={`${kpis.fail_rate_pct}% del out`} />
        <KpiCard label="Críticos" value={kpis.fails_criticos} accent="text-red-300" icon={AlertCircle} hint="Regla #0 / leaks" />
        <KpiCard label="Warnings" value={kpis.fails_warning} accent="text-amber-300" icon={AlertTriangle} hint="Pivots / declines" />
        <KpiCard label="Leads únicos" value={kpis.total_leads} accent="text-blue-300" icon={MessageSquare} />
        <KpiCard label="Mensajes IN" value={kpis.mensajes_in} accent="text-text" />
        <KpiCard label="Mensajes OUT" value={kpis.mensajes_out} accent="text-text" />
      </div>

      {/* Tipos de fail (cards horizontales) */}
      {Object.keys(issues_by_type).length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold text-text">Distribución de fails por tipo</h2>
            <span className="text-xs text-text-muted">Última actualización: {timeAgo(kpis.ultima_actualizacion)} atrás</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroTipo('all')}
              className={`px-3 py-1.5 rounded-full text-xs border ${filtroTipo === 'all' ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border text-text-muted hover:text-text'}`}
            >
              Todos ({kpis.fails_totales})
            </button>
            {Object.entries(issues_by_type).map(([t, n]) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-full text-xs border ${filtroTipo === t ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border text-text-muted hover:text-text'}`}
              >
                {ISSUE_LABELS[t] || t} ({n})
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* FILTROS SEVERIDAD */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['all', 'critical', 'warning'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroSev(s)}
            className={`px-3 py-1.5 rounded-lg text-xs border ${filtroSev === s ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border text-text-muted hover:text-text'}`}
          >
            {s === 'all' ? 'Todas severidades' : s === 'critical' ? '🔴 Críticos' : '🟡 Warnings'}
          </button>
        ))}
      </div>

      {/* LISTA DE ISSUES */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
          <p className="text-emerald-300 font-medium">¡Sin issues con esos filtros! 🎉</p>
          <p className="text-xs text-text-muted mt-1">Cami está respondiendo limpio en esa categoría.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue, i) => (
            <IssueCard key={`${issue.lead_id}-${issue.timestamp}-${i}`} issue={issue} />
          ))}
        </div>
      )}

      {/* Footer info */}
      <Card className="mt-6 p-3 text-xs text-text-muted flex items-center justify-center gap-2">
        <TrendingDown className="w-3 h-3" />
        Análisis sobre {kpis.total_mensajes} mensajes · {kpis.total_leads} leads · Fail rate global {kpis.fail_rate_pct}%
      </Card>
    </>
  );
}

function KpiCard({ label, value, accent, icon: Icon, hint }: { label: string; value: number | string; accent: string; icon?: any; hint?: string }) {
  return (
    <Card className="p-3 sm:p-4 hover:border-accent/30 transition">
      <div className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className={`font-display text-2xl sm:text-3xl font-bold mt-1 ${accent}`}>{value}</div>
      {hint && <div className="text-[10px] text-text-muted mt-0.5">{hint}</div>}
    </Card>
  );
}

function IssueCard({ issue }: { issue: CalidadIaIssue }) {
  const sev = SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.warning!;
  const SevIcon = sev.icon;
  return (
    <Card className={`p-4 ${sev.bg} ring-1 ${sev.ring}`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className={`p-2 rounded-lg ${sev.bg} ${sev.text}`}>
          <SevIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <Badge className={`${sev.bg} ${sev.text} text-[10px]`}>{ISSUE_LABELS[issue.type] || issue.type}</Badge>
              <span className="ml-2 text-xs text-text-muted">{timeAgo(issue.timestamp)} atrás</span>
            </div>
            <Link
              to={`/conversaciones?lead=${issue.lead_id}`}
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              Ver chat <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-medium text-text">{issue.nombre || 'Sin nombre'}</span>
            <span className="text-xs text-text-muted">· {issue.lead_id}</span>
          </div>
          {issue.context_before && (
            <div className="mt-2 p-2 rounded bg-surface-1/50 border-l-2 border-blue-400/40">
              <div className="text-[10px] uppercase text-text-muted mb-1">Cliente dijo antes:</div>
              <div className="text-xs text-text-muted italic">&ldquo;{issue.context_before}&rdquo;</div>
            </div>
          )}
          <div className="mt-2 p-2 rounded bg-surface-1/50 border-l-2 border-accent/40">
            <div className="text-[10px] uppercase text-text-muted mb-1">Cami respondió:</div>
            <div className="text-sm text-text">&ldquo;{issue.snippet}&rdquo;</div>
          </div>
          <div className="mt-2 text-xs text-text-muted">
            💡 <strong>{issue.recomendacion}</strong>
          </div>
        </div>
      </div>
    </Card>
  );
}
