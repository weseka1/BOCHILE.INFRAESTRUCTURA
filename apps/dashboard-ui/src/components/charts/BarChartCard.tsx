import { Card } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  color?: string;
}

export function BarChartCard({ title, data, xKey, yKey, color = '#10b981' }: Props) {
  return (
    <Card title={title}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a1f', border: '1px solid #27272a', borderRadius: 8 }}
              labelStyle={{ color: '#f5f5f7' }}
            />
            <Bar dataKey={yKey} fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
