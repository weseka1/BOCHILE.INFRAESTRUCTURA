import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Boundary global. Si CUALQUIER componente del arbol tira excepcion,
 * mostramos un mensaje en vez del "pantalla azul" (background pelado).
 * Permite recargar la app sin perder el resto.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface-0 text-text flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-surface-1 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-red-400 text-3xl">⚠</div>
              <div>
                <h1 className="font-display text-xl font-bold text-text">Algo se rompió en el dashboard</h1>
                <p className="text-sm text-text-muted mt-1">
                  Esto no debería pasar. Probá refrescar la página.
                  Si persiste, mostrale al equipo técnico el mensaje de abajo.
                </p>
              </div>
            </div>

            <details className="mt-3" open>
              <summary className="cursor-pointer text-sm text-text-muted hover:text-text">
                Detalle técnico
              </summary>
              <div className="mt-2 p-3 rounded-lg bg-black/40 border border-border font-mono text-[11px] text-red-300 overflow-auto max-h-[40vh]">
                <div className="text-red-400 font-bold mb-1">{this.state.error.name}: {this.state.error.message}</div>
                <pre className="text-text-muted whitespace-pre-wrap">{this.state.error.stack}</pre>
                {this.state.info && (
                  <>
                    <div className="text-text-muted font-bold mt-2 mb-1">Component stack:</div>
                    <pre className="text-text-subtle whitespace-pre-wrap">{this.state.info.componentStack}</pre>
                  </>
                )}
              </div>
            </details>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => location.reload()}
                className="flex-1 px-4 py-2 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 transition"
              >
                Refrescar página
              </button>
              <button
                onClick={this.reset}
                className="px-4 py-2 rounded-lg bg-surface-2 border border-border hover:border-accent text-text transition"
              >
                Volver a intentar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
