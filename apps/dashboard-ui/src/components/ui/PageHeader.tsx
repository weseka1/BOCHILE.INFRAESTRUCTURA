interface Props {
  title: string;
  subtitle?: string;
  count?: number;
}

export function PageHeader({ title, subtitle, count }: Props) {
  return (
    <div className="mb-6 pb-4 border-b border-border-subtle">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-text tracking-tight">
          {title}
        </h1>
        {count !== undefined && (
          <span className="badge bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 text-xs font-medium">
            {count}
          </span>
        )}
      </div>
      {subtitle && <p className="text-text-muted text-sm mt-1.5 italic">{subtitle}</p>}
    </div>
  );
}
