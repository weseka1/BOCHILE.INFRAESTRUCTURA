import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Home, Calendar, FileText, MessageSquare, Sparkles, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/propiedades', label: 'Propiedades', icon: Home },
  { to: '/visitas', label: 'Visitas', icon: Calendar },
  { to: '/contratos', label: 'Contratos', icon: FileText },
  { to: '/conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { to: '/acciones', label: 'Acciones IA', icon: Sparkles },
  { to: '/empleados', label: 'Empleados', icon: UserCog },
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-surface-1 border-r border-border h-screen sticky top-0 flex flex-col">
      {/* Brand header con paleta Bochile (navy + champagne) */}
      <div className="px-5 py-5 border-b border-border bg-gradient-to-br from-surface-1 to-surface-2">
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
        <div className="text-xs text-text-muted mt-2 italic">
          Sistema Operativo IA
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-accent text-accent-fg font-semibold shadow-gold'
                  : 'text-text-muted hover:text-text hover:bg-surface-2',
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border text-[10px] text-text-subtle text-center">
        <div className="text-accent font-medium tracking-wider mb-1">WESEKA · IA</div>
        <div>Powered by Camila Pomerich</div>
      </div>
    </aside>
  );
}
