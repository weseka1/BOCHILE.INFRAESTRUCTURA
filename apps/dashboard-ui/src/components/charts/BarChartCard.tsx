import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { Maximize2, BarChart3, TrendingUp, ArrowDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';

interface Props {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  color?: string;
}

function makeGradientId(seed: string) {
  return 'grad-' + seed.replace(/[^a-z0-9]/gi, '').slice(0, 12) + '-' + Math.random().toString(36).slice(2, 7);
}

const tooltipStyle = {
  background: 'rgba(20, 20, 24, 0.95)',
  border: '1px solid rgba(212, 175, 55, 0.3)',
  borderRadius: 12,
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

function CustomTooltip({ active, payload, label, color, total }: any) {
  if (!active || !payload || !payload.length) return null;
  const v = Number(payload[0].value || 0);
  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
  return (
    <div className="px-3 py-2 rounded-xl backdrop-blur-md" style={tooltipStyle}>
      <div className="text-text font-semibold text-sm mb-0.5">{label}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="font-bold" style={{ color }}>{v.toLocaleString('es-AR')}</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">{pct}% del total</span>
      </div>
    </div>
  );
}

export function BarChartCard({ title, data, xKey, yKey, color = '#10b981' }: Props) {
  const gradId = useMemo(() => makeGradientId(title), [title]);
  const [open, setOpen] = useState(false);

  const total = useMemo(() => data.reduce((acc, d) => acc + Number(d[yKey] || 0), 0), [data, yKey]);
  const max = useMemo(() => Math.max(...data.map(d => Number(d[yKey] || 0)), 1), [data, yKey]);
  const sorted = useMemo(() => [...data].sort((a, b) => Number(b[yKey] || 0) - Number(a[yKey] || 0)), [data, yKey]);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const showDetail = data.length > 0;

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
        className="bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2/30 hover:shadow-glow transition-all"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -20, right: 10, top: 18, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
              <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: '#27272a' }} />
              <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={<CustomTooltip color={color} total={total} />}
              />
              <Bar
                dataKey={yKey}
                radius={[8, 8, 2, 2]}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
                onClick={() => setOpen(true)}
                style={{ cursor: showDetail ? 'pointer' : 'default' }}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={`url(#${gradId})`} />
                ))}
                <LabelList
                  dataKey={yKey}
                  position="top"
                  fontSize={10}
                  fill="#cbd5e1"
                  formatter={(v: any) => (v > 0 ? v : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={`Total: ${total.toLocaleString('es-AR')} · ${data.length} categorías`}
      >
        {/* Mini KPIs */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {top && (
            <div className="card p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider">
                <TrendingUp className="w-3 h-3 text-emerald-400" /> Más alto
              </div>
              <div className="font-display text-lg font-semibold text-emerald-300 mt-1 truncate">{top[xKey]}</div>
              <div className="text-xs text-text-muted">{Number(top[yKey]).toLocaleString('es-AR')}</div>
            </div>
          )}
          {bottom && bottom !== top && (
            <div className="card p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider">
                <ArrowDown className="w-3 h-3 text-rose-400" /> Más bajo
              </div>
              <div className="font-display text-lg font-semibold text-rose-300 mt-1 truncate">{bottom[xKey]}</div>
              <div className="text-xs text-text-muted">{Number(bottom[yKey]).toLocaleString('es-AR')}</div>
            </div>
          )}
        </div>

        {/* Tabla con bar visual */}
        <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Desglose completo</span>
        </div>
        <ul className="space-y-2">
          {sorted.map((d, i) => {
            const v = Number(d[yKey] || 0);
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            const w = max > 0 ? (v / max) * 100 : 0;
            return (
              <li key={i} className="p-3 rounded-lg bg-surface-2/50 border border-border/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-text">{d[xKey]}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color }}>{v.toLocaleString('es-AR')}</span>
                    <span className="text-[10px] text-text-muted">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${w}%`, background: `linear-gradient(90deg, ${color}, ${color}80)` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Drawer>
    </>
  );
}
