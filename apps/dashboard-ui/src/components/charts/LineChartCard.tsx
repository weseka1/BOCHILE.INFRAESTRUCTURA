import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { Maximize2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface Props {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  color?: string;
}

function makeId(seed: string) {
  return 'lgrad-' + seed.replace(/[^a-z0-9]/gi, '').slice(0, 12) + '-' + Math.random().toString(36).slice(2, 7);
}

const tooltipStyle = {
  background: 'rgba(20, 20, 24, 0.95)',
  border: '1px solid rgba(212, 175, 55, 0.3)',
  borderRadius: 12,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

function CustomTooltip({ active, payload, label, color }: any) {
  if (!active || !payload || !payload.length) return null;
  const v = Number(payload[0].value || 0);
  return (
    <div className="px-3 py-2 rounded-xl backdrop-blur-md" style={tooltipStyle}>
      <div className="text-text font-semibold text-sm mb-0.5">{label}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-bold" style={{ color }}>{v.toLocaleString('es-AR')}</span>
      </div>
    </div>
  );
}

export function LineChartCard({ title, data, xKey, yKey, color = '#10b981' }: Props) {
  const gradId = useMemo(() => makeId(title), [title]);
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const vals = data.map(d => Number(d[yKey] || 0));
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = vals.length ? Math.round(sum / vals.length) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    const min = vals.length ? Math.min(...vals) : 0;
    const last = vals.at(-1) || 0;
    const prev = vals.at(-2) || 0;
    const deltaPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
    return { sum, avg, max, min, last, deltaPct };
  }, [data, yKey]);

  const showDetail = data.length > 0;
  const TrendIcon = stats.deltaPct > 0 ? TrendingUp : stats.deltaPct < 0 ? TrendingDown : Minus;
  const trendColor = stats.deltaPct > 0 ? 'text-emerald-400' : stats.deltaPct < 0 ? 'text-rose-400' : 'text-text-muted';

  return (
    <>
      <Card
        title={title}
        action={showDetail ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[10px] text-text-muted hover:text-accent inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            title="Ver detalle"
          >
            <Maximize2 className="w-3 h-3" /> Detalle
          </button>
        ) : undefined}
        className="bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2/30 transition-all"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
              <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: '#27272a' }} />
              <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
                content={<CustomTooltip color={color} />}
              />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                dot={{ fill: color, r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={`${data.length} puntos · suma total ${stats.sum.toLocaleString('es-AR')}`}
      >
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="card p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Promedio</div>
            <div className="font-display text-xl font-semibold text-text mt-1">{stats.avg.toLocaleString('es-AR')}</div>
          </div>
          <div className="card p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Pico máximo</div>
            <div className="font-display text-xl font-semibold text-emerald-300 mt-1">{stats.max.toLocaleString('es-AR')}</div>
          </div>
          <div className="card p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Último valor</div>
            <div className="font-display text-xl font-semibold text-text mt-1">{stats.last.toLocaleString('es-AR')}</div>
          </div>
          <div className="card p-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider">Variación</div>
            <div className={`font-display text-xl font-semibold mt-1 flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="w-4 h-4" />
              {stats.deltaPct > 0 ? '+' : ''}{stats.deltaPct}%
            </div>
          </div>
        </div>

        {/* Listado por punto */}
        <div className="mb-3 text-xs text-text-muted">Serie completa</div>
        <ul className="space-y-1.5">
          {[...data].reverse().map((d, i) => {
            const v = Number(d[yKey] || 0);
            const w = stats.max > 0 ? (v / stats.max) * 100 : 0;
            return (
              <li key={i} className="p-2.5 rounded-lg bg-surface-2/50 border border-border/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-muted">{d[xKey]}</span>
                  <span className="text-sm font-semibold" style={{ color }}>{v.toLocaleString('es-AR')}</span>
                </div>
                <div className="h-1 bg-surface-1 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
