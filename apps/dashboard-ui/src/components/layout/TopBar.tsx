import { useEffect, useState, useMemo, useRef } from 'react';
import { RefreshCw, Activity, Menu, Search, Users, Home } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useLeads } from '@/hooks/useLeads';
import { usePropiedades } from '@/hooks/usePropiedades';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onMenu?: () => void;
}

const routeTitles: Record<string, string> = {
  '/': 'Panel Central',
  '/tareas': 'Tareas',
  '/ventas': 'Dashboard Ventas',
  '/leads': 'Leads',
  '/propiedades': 'Propiedades',
  '/visitas': 'Visitas',
  '/conversaciones': 'Conversaciones',
  '/acciones': 'Acciones IA',
  '/empleados': 'Empleados',
};

interface SearchResult {
  kind: 'lead' | 'propiedad';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function TopBar({ onMenu }: TopBarProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: leads = [] } = useLeads();
  const { data: props = [] } = usePropiedades();

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  // Cmd/Ctrl+K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close search on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Close search on route change
  useEffect(() => {
    setSearchOpen(false);
    setSearchQ('');
  }, [location.pathname]);

  const results: SearchResult[] = useMemo(() => {
    if (!searchQ || searchQ.length < 2) return [];
    const q = searchQ.toLowerCase();
    const r: SearchResult[] = [];
    for (const l of leads) {
      if (
        (l.nombre || '').toLowerCase().includes(q) ||
        String(l.telefono || '').includes(searchQ) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.lead_id || '').toLowerCase().includes(q)
      ) {
        r.push({
          kind: 'lead',
          id: l.lead_id,
          title: l.nombre || l.lead_id,
          subtitle: `${l.telefono || ''} · ${l.zona_pref || ''} · ${l.etapa || ''}`.replace(/^· | · ·/g, ''),
          href: `/conversaciones?lead=${l.lead_id}`,
        });
        if (r.length >= 20) break;
      }
    }
    for (const p of props) {
      if (
        (p.titulo || '').toLowerCase().includes(q) ||
        (p.direccion || '').toLowerCase().includes(q) ||
        (p.zona || '').toLowerCase().includes(q) ||
        (p.prop_id || '').toLowerCase().includes(q)
      ) {
        r.push({
          kind: 'propiedad',
          id: p.prop_id,
          title: p.titulo || p.prop_id,
          subtitle: `${p.tipo || ''} · ${p.zona || ''} · ${p.operacion || ''}`,
          href: `/propiedades`,
        });
        if (r.length >= 30) break;
      }
    }
    return r.slice(0, 12);
  }, [searchQ, leads, props]);

  const fechaCorta = now.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const fechaLarga = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const pageTitle = routeTitles[location.pathname] || '';

  return (
    <div className="sticky top-0 z-30 bg-surface-0/95 backdrop-blur border-b border-border px-3 sm:px-6 py-3 flex items-center gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <button
          onClick={onMenu}
          className="md:hidden p-2 -ml-1 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="hidden lg:flex items-center gap-1.5 text-xs text-accent shrink-0">
          <Activity className="w-3 h-3 animate-pulse" />
          <span className="font-medium">Sistema activo</span>
        </span>
        <span className="hidden lg:inline text-text-subtle">·</span>
        <span className="text-xs text-text-muted capitalize truncate hidden lg:inline">{fechaLarga}</span>
        <span className="text-xs text-text-muted capitalize lg:hidden hidden sm:inline">{fechaCorta}</span>
        <span className="text-text-subtle hidden sm:inline">·</span>
        <span className="text-xs text-text-muted font-mono hidden sm:inline">{hora}</span>
      </div>

      {/* Global search */}
      <div ref={searchRef} className="flex-1 max-w-md mx-auto relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            ref={inputRef}
            value={searchQ}
            onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar leads o propiedades..."
            className="w-full pl-9 pr-12 py-2 rounded-lg bg-surface-1 border border-border text-sm placeholder:text-text-subtle focus:outline-none focus:border-accent transition-colors"
          />
          <kbd className="hidden md:inline-flex absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-subtle bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">
            Ctrl K
          </kbd>
        </div>
        {searchOpen && searchQ.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-1 border border-border rounded-lg shadow-2xl max-h-[60vh] overflow-y-auto z-50">
            {results.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-muted">
                Sin resultados para "{searchQ}"
              </div>
            ) : (
              <ul className="p-1">
                {results.map((r) => (
                  <li key={`${r.kind}_${r.id}`}>
                    <button
                      type="button"
                      onClick={() => { navigate(r.href); setSearchOpen(false); setSearchQ(''); }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-surface-2 transition-colors flex items-start gap-2.5"
                    >
                      <div className={cn(
                        'p-1.5 rounded-md shrink-0',
                        r.kind === 'lead' && 'bg-blue-500/10 text-blue-300',
                        r.kind === 'propiedad' && 'bg-accent/10 text-accent',
                      )}>
                        {r.kind === 'lead' && <Users className="w-3.5 h-3.5" />}
                        {r.kind === 'propiedad' && <Home className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{r.title}</div>
                        <div className="text-xs text-text-muted truncate">{r.subtitle}</div>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-text-subtle shrink-0">{r.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {pageTitle && (
          <Link to={location.pathname} className="hidden xl:inline text-xs text-text-muted hover:text-text font-medium">
            {pageTitle}
          </Link>
        )}
        <button
          onClick={() => qc.invalidateQueries()}
          className="btn-ghost text-xs px-2.5 sm:px-3 py-1.5"
          title="Actualizar datos"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </div>
    </div>
  );
}
