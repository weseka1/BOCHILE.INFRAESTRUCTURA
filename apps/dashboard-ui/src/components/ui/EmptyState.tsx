import { LucideIcon } from 'lucide-react';

interface Props {
  icon?: LucideIcon;
  title: string;
  message?: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, message, hint }: Props) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="inline-flex p-4 rounded-2xl bg-accent/10 ring-1 ring-accent/20 mb-4">
          <Icon className="w-8 h-8 text-accent" />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="text-sm text-text-muted max-w-md mx-auto">{message}</p>}
      {hint && (
        <p className="text-xs text-text-subtle mt-3 italic">{hint}</p>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Cargando datos del Sheet…' }: { label?: string }) {
  return (
    <div className="empty-state">
      <div className="inline-flex items-center gap-2 text-accent">
        <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
        <span className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
      </div>
      <p className="text-text-muted text-sm mt-3 italic">{label}</p>
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="empty-state">
      <h3 className="empty-state-title text-rose-300">Algo salió mal</h3>
      <p className="text-sm text-rose-400/80 max-w-md mx-auto">{error.message}</p>
      <p className="text-xs text-text-subtle mt-3 italic">
        Probá refrescar la página. Si persiste, mirá `08_HANDOFF/04_QUE_PASA_SI.md` para diagnosticarlo.
      </p>
    </div>
  );
}
