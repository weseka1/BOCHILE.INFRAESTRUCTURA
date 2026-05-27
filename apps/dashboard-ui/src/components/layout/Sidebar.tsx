import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Home, Calendar, MessageSquare, Sparkles, UserCog, X, ShoppingCart, CheckSquare, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTareasCount } from '@/hooks/useTareas';

const sections: { title: string | null; links: { to: string; label: string; icon: any; badgeKey?: 'tareas' }[] }[] = [
  {
    title: null,
    links: [
      { to: '/', label: 'Inicio', icon: LayoutDashboard },
      { to: '/tareas', label: 'Tareas', icon: CheckSquare, badgeKey: 'tareas' },
    ],
  },
  {
    title: 'Negocio',
    links: [
      { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
      { to: '/leads', label: 'Clientes', icon: Users },
      { to: '/propiedades', label: 'Propiedades', icon: Home },
    ],
  },
  {
    title: 'Operacion',
    links: [
      { to: '/visitas', label: 'Visitas', icon: Calendar },
      { to: '/conversaciones', label: 'Mensajes', icon: MessageSquare },
      { to: '/empleados', label: 'Equipo', icon: UserCog },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const tareasPendientes = useTareasCount();
  return (
    <>
      {/* Backdrop (solo mobile cuando esta abierto) */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'bg-surface-1 border-r border-border flex flex-col',
          // Desktop: sidebar fijo de 240px siempre visible
          'md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 md:translate-x-0',
          // Mobile: drawer fixed 80% ancho que entra desde la izquierda
          'fixed top-0 left-0 h-full w-72 max-w-[85vw] z-40 transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className="px-5 py-5 border-b border-border bg-gradient-to-br from-surface-1 to-surface-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shadow-gold">
              <span className="font-display text-xl font-bold text-accent-fg">B</span>
            </div>
            <div>
              <div className="font-display text-xl font-semibold text-text leading-tight">
                Bochile
              </div>
              <div className="text-[10px] text-accent uppercase tracking-widest font-medium">
                Inmobiliaria · 1970
              </div>
            </div>
          </div>
          {/* Boton X cerrar (solo mobile) */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors"
            aria-label="Cerrar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pb-3 text-xs text-text-muted italic border-b border-border">
          Bochile · Desde 1970
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={cn(sIdx > 0 && 'mt-4')}>
              {section.title && (
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-accent/70 font-semibold">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.links.map(({ to, label, icon: Icon, badgeKey }) => {
                  const badgeValue = badgeKey === 'tareas' && tareasPendientes > 0 ? tareasPendientes : null;
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                          isActive
                            ? 'bg-accent text-accent-fg font-semibold shadow-gold'
                            : 'text-text-muted hover:text-text hover:bg-surface-2',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                          {badgeValue !== null && (
                            <span className={cn(
                              'text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center',
                              isActive ? 'bg-accent-fg/20 text-accent-fg' : 'bg-accent/20 text-accent',
                            )}>
                              {badgeValue}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-border text-[10px] text-text-subtle text-center">
          <div className="text-accent font-medium tracking-wider mb-1">WESEKA · IA</div>
          <div>Powered by Camila Pomerich</div>
        </div>
      </aside>
    </>
  );
}
