import { Card } from '@/components/ui/Card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  color?: string;
}

export function LineChartCard({ title, data, xKey, yKey, color = '#10b981' }: Props) {
  return (
    <Card title={title}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a1f', border: '1px solid #27272a', borderRadius: 8 }}
            />
            <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
