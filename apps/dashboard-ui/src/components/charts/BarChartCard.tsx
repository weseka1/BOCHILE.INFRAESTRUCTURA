import { Card } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface Props {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  color?: string;
}

// Genera ID unico por instancia (evita choques entre charts en la misma pagina)
function makeGradientId(seed: string) {
  return 'grad-' + seed.replace(/[^a-z0-9]/gi, '').slice(0, 12) + '-' + Math.random().toString(36).slice(2, 7);
}

export function BarChartCard({ title, data, xKey, yKey, color = '#10b981' }: Props) {
  const gradId = makeGradientId(title);
  return (
    <Card title={title} className="bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2/30 hover:shadow-glow transition-all">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.35} />
              </linearGradient>
              <filter id={`shadow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.5" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
            <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={{ stroke: '#27272a' }} />
            <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: 'rgba(20, 20, 24, 0.95)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                borderRadius: 12,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: '#f5f5f7', fontWeight: 600 }}
              itemStyle={{ color: color }}
            />
            <Bar
              dataKey={yKey}
              radius={[8, 8, 2, 2]}
              filter={`url(#shadow-${gradId})`}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#${gradId})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
