import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

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
}

export function Table<T>({ columns, rows, empty = 'Sin datos', rowKey }: TableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-text-muted text-sm py-8 text-center">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className={cn('text-left px-3 py-2 font-medium text-text-muted', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="table-row">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-3 py-2.5 text-text', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
