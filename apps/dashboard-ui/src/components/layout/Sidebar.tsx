import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Home, Calendar, MessageSquare, UserCog, X,
  ShoppingCart, CheckSquare, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTareasCount } from '@/hooks/useTareas';
import { usePanel } from '@/panel/PanelContext';
import { PanelSwitcher } from '@/components/layout/PanelSwitcher';

type LinkDef = { to: string; label: string; icon: any; badgeKey?: 'tareas'; end?: boolean };
type Section = { title: string | null; links: LinkDef[] };

const sectionsBochile: Section[] = [
  {
    title: null,
    links: [
      { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
      { to: '/tareas', label: 'Tareas internas', icon: CheckSquare, badgeKey: 'tareas' },
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

const sectionsMarketing: Section[] = [
  {
    title: null,
    links: [
      { to: '/marketing', label: 'Tareas WESEKA.IA', icon: Cpu, end: true },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const tareasPendientes = useTareasCount();
  const { panel } = usePanel();
  const sections = panel === 'marketing' ? sectionsMarketing : sectionsBochile;
  const panelLabel = panel === 'marketing' ? 'WESEKA.IA' : 'Inmobiliaria';
  return (
    <>
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
          'md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 md:translate-x-0',
          'fixed top-0 left-0 h-full w-72 max-w-[85vw] z-40 transition-transform',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Brand header */}
        <div className="px-5 py-5 border-b border-border bg-gradient-to-br from-surface-1 to-surface-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
              panel === 'marketing'
                ? 'bg-fuchsia-500 shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)]'
                : 'bg-accent shadow-gold',
            )}>
              <span className={cn(
                'font-display text-xl font-bold',
                panel === 'marketing' ? 'text-white' : 'text-accent-fg',
              )}>B</span>
            </div>
            <div>
              <div className="font-display text-xl font-semibold text-text leading-tight">
                Bochile
              </div>
              <div className={cn(
                'text-[10px] uppercase tracking-widest font-medium transition-colors',
                panel === 'marketing' ? 'text-fuchsia-400' : 'text-accent',
              )}>
                {panelLabel} · 1970
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors"
            aria-label="Cerrar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel switcher */}
        <div className="px-3 pt-3 pb-2 border-b border-border">
          <PanelSwitcher />
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className={cn(sIdx > 0 && 'mt-4')}>
              {section.title && (
                <div className={cn(
                  'px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold transition-colors',
                  panel === 'marketing' ? 'text-fuchsia-400/80' : 'text-accent/70',
                )}>
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.links.map(({ to, label, icon: Icon, badgeKey, end }) => {
                  const badgeValue = badgeKey === 'tareas' && tareasPendientes > 0 ? tareasPendientes : null;
                  const isHashLink = to.includes('#');
                  if (isHashLink) {
                    return (
                      <a
                        key={to}
                        href={to}
                        onClick={onClose}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface-2 transition-all"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="flex-1">{label}</span>
                      </a>
                    );
                  }
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                          isActive
                            ? panel === 'marketing'
                              ? 'bg-fuchsia-500 text-white font-semibold shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)]'
                              : 'bg-accent text-accent-fg font-semibold shadow-gold'
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
                              isActive
                                ? panel === 'marketing' ? 'bg-white/25 text-white' : 'bg-accent-fg/20 text-accent-fg'
                                : panel === 'marketing' ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-accent/20 text-accent',
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
          <div className={cn(
            'font-medium tracking-wider mb-1 transition-colors',
            panel === 'marketing' ? 'text-fuchsia-400' : 'text-accent',
          )}>WESEKA · IA</div>
          <div>Powered by Camila Pomerich</div>
        </div>
      </aside>
    </>
  );
}
