import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | null | undefined;
  rowOnClick?: (row: T) => void;
}

export function Table<T>({ columns, rows, empty = 'Sin datos', rowKey, rowHref, rowOnClick }: TableProps<T>) {
  const navigate = useNavigate();
  if (rows.length === 0) {
    return <p className="text-text-muted text-sm py-8 text-center">{empty}</p>;
  }
  const interactive = Boolean(rowHref || rowOnClick);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className={cn('text-left px-3 py-2 font-medium text-text-muted text-[11px] uppercase tracking-wider', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            const handle = () => {
              if (href) navigate(href);
              else rowOnClick?.(row);
            };
            return (
              <tr
                key={rowKey(row)}
                onClick={interactive ? handle : undefined}
                className={cn(
                  'table-row border-b border-border/30',
                  interactive && 'cursor-pointer hover:bg-surface-2 transition-colors group',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2.5 text-text', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
