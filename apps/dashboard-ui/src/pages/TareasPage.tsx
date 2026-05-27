import { useMemo, useState, useCallback } from 'react';
import {
  CheckSquare, Square, Trash2, Plus, AlertTriangle, Flag, Clock, X,
  ListTodo, CheckCircle2, Loader2, Calendar as CalendarIcon, User as UserIcon,
  CircleDot, MoreHorizontal,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTareas, type Tarea, type TareaPrioridad, type TareaEstado } from '@/hooks/useTareas';
import { useEmpleados } from '@/hooks/useEmpleados';
import { cn } from '@/lib/utils';

type Filtro = 'todas' | 'pendiente' | 'en_curso' | 'completada';

const prioridadStyles: Record<TareaPrioridad, { dot: string; badge: string; label: string }> = {
  alta:  { dot: 'bg-rose-400',    badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',    label: 'Alta' },
  media: { dot: 'bg-amber-400',   badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30', label: 'Media' },
  baja:  { dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', label: 'Baja' },
};

const estadoStyles: Record<TareaEstado, { badge: string; label: string }> = {
  pendiente:  { badge: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30', label: 'Pendiente' },
  en_curso:   { badge: 'bg-blue-500/15 text-blue-300 border border-blue-500/30', label: 'En curso' },
  completada: { badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', label: 'Completada' },
};

export function TareasPage() {
  const { tareas, crear, actualizar, eliminar, eliminarVarios, actualizarVarios } = useTareas();
  const { data: empleados = [] } = useEmpleados();

  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<TareaPrioridad>('media');
  const [asignado, setAsignado] = useState('');
  const [vencimiento, setVencimiento] = useState('');

  const counts = useMemo(() => ({
    todas: tareas.length,
    pendiente: tareas.filter(t => t.estado === 'pendiente').length,
    en_curso: tareas.filter(t => t.estado === 'en_curso').length,
    completada: tareas.filter(t => t.estado === 'completada').length,
  }), [tareas]);

  const filtradas = useMemo(() => {
    const list = filtro === 'todas' ? tareas : tareas.filter(t => t.estado === filtro);
    const orden: Record<TareaPrioridad, number> = { alta: 0, media: 1, baja: 2 };
    return [...list].sort((a, b) => {
      if (a.estado === 'completada' && b.estado !== 'completada') return 1;
      if (a.estado !== 'completada' && b.estado === 'completada') return -1;
      const p = orden[a.prioridad] - orden[b.prioridad];
      if (p !== 0) return p;
      return (b.creada_en || '').localeCompare(a.creada_en || '');
    });
  }, [tareas, filtro]);

  const allFilteredIds = useMemo(() => filtradas.map(t => t.id), [filtradas]);
  const allSelected = selected.size > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (allFilteredIds.every(id => prev.has(id))) {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allFilteredIds.forEach(id => next.add(id));
      return next;
    });
  }, [allFilteredIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  function bulkEstado(estado: TareaEstado) {
    actualizarVarios(Array.from(selected), { estado });
    clearSelection();
  }

  function bulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Eliminar ${selected.size} tarea${selected.size > 1 ? 's' : ''}? Esta accion no se puede deshacer.`)) return;
    eliminarVarios(Array.from(selected));
    clearSelection();
  }

  function resetForm() {
    setTitulo(''); setDescripcion(''); setPrioridad('media'); setAsignado(''); setVencimiento('');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    crear({
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      prioridad,
      asignado_a: asignado || undefined,
      vencimiento: vencimiento || undefined,
    });
    resetForm();
    setShowForm(false);
  }

  // Opción fija: WESEKA.IA siempre asignable como "agente IA" externo,
  // independiente de los empleados del Sheet del cliente.
  const WESEKA_AGENT = { empleado_id: 'weseka_ia', nombre: 'WESEKA.IA', rol: 'agente IA' } as const;

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    empleados.forEach(e => m.set(e.empleado_id, e.nombre));
    m.set(WESEKA_AGENT.empleado_id, WESEKA_AGENT.nombre);
    return m;
  }, [empleados]);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  // Parsea "2026-05-30" como fecha LOCAL (no UTC) para evitar off-by-one por timezone.
  // Sin esto, new Date("2026-05-30") es UTC midnight = ART 21:00 del dia anterior.
  function parseDateLocal(s: string | undefined): Date | null {
    if (!s) return null;
    // Si viene full ISO con T, usar Date directo (es timestamp UTC, OK)
    if (s.includes('T')) return new Date(s);
    // Si viene solo "YYYY-MM-DD", parsear como local midnight
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return new Date(s);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function esVencida(t: Tarea) {
    if (!t.vencimiento || t.estado === 'completada') return false;
    const d = parseDateLocal(t.vencimiento);
    return d ? d < hoy : false;
  }

  return (
    <>
      <PageHeader title="Tareas" subtitle="Gestion interna del equipo · pendientes, en curso y completadas" count={counts.todas} />

      {/* Stats / filtros - layout estable mobile + desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <FilterChip label="Total" short="Total" value={counts.todas} icon={ListTodo} active={filtro === 'todas'} onClick={() => setFiltro('todas')} />
        <FilterChip label="Pendientes" short="Pend." value={counts.pendiente} icon={Clock} accent="amber" active={filtro === 'pendiente'} onClick={() => setFiltro('pendiente')} />
        <FilterChip label="En curso" short="Curso" value={counts.en_curso} icon={Loader2} accent="blue" active={filtro === 'en_curso'} onClick={() => setFiltro('en_curso')} />
        <FilterChip label="Completadas" short="Compl." value={counts.completada} icon={CheckCircle2} accent="green" active={filtro === 'completada'} onClick={() => setFiltro('completada')} />
      </div>

      {/* Action bar superior */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
        <button
          type="button"
          onClick={toggleAll}
          disabled={allFilteredIds.length === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-surface-2 border border-border text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {allSelected
            ? <CheckSquare className="w-3.5 h-3.5 text-accent" />
            : someSelected
              ? <CircleDot className="w-3.5 h-3.5 text-accent" />
              : <Square className="w-3.5 h-3.5" />}
          <span>{allSelected ? 'Deseleccionar todo' : someSelected ? `${selected.size} seleccionada${selected.size > 1 ? 's' : ''}` : 'Seleccionar todo'}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] transition-all"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span className="hidden xs:inline">{showForm ? 'Cancelar' : 'Nueva tarea'}</span>
          <span className="xs:hidden">{showForm ? 'Cerrar' : 'Nueva'}</span>
        </button>
      </div>

      {/* Bulk actions sticky bar */}
      {someSelected && (
        <div className="sticky top-[60px] sm:top-[68px] z-20 mb-3 p-2.5 sm:p-3 rounded-xl bg-surface-1/95 backdrop-blur-md border border-accent/40 shadow-lg flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold text-accent shrink-0">{selected.size}</span>
          <span className="text-xs text-text-muted hidden sm:inline">seleccionada{selected.size > 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <BulkBtn icon={Clock} label="Pendiente" onClick={() => bulkEstado('pendiente')} color="zinc" />
            <BulkBtn icon={Loader2} label="En curso" onClick={() => bulkEstado('en_curso')} color="blue" />
            <BulkBtn icon={CheckCircle2} label="Completar" onClick={() => bulkEstado('completada')} color="emerald" />
            <BulkBtn icon={Trash2} label="Eliminar" onClick={bulkDelete} color="rose" />
            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              aria-label="Cancelar seleccion"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Form crear */}
      {showForm && (
        <Card className="mb-4 sm:mb-5 border-accent/40">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Titulo *</label>
              <input
                autoFocus
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ej. Llamar a Maria Celia para visita Patagonia"
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent text-text"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Descripcion</label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Detalles opcionales..."
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent text-text resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Prioridad</label>
              <div className="mt-1 flex gap-1">
                {(['alta', 'media', 'baja'] as TareaPrioridad[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridad(p)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all border',
                      prioridad === p ? prioridadStyles[p].badge + ' ring-2 ring-current/30' : 'bg-surface-2 border-border text-text-muted hover:text-text',
                    )}
                  >
                    {prioridadStyles[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Asignado a</label>
              <select
                value={asignado}
                onChange={e => setAsignado(e.target.value)}
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent text-text"
              >
                <option value="">Sin asignar</option>
                {empleados.map(e => (
                  <option key={e.empleado_id} value={e.empleado_id}>{e.nombre} · {e.rol}</option>
                ))}
                <option key={WESEKA_AGENT.empleado_id} value={WESEKA_AGENT.empleado_id}>
                  {WESEKA_AGENT.nombre} · {WESEKA_AGENT.rol}
                </option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Vencimiento</label>
              <input
                type="date"
                value={vencimiento}
                onChange={e => setVencimiento(e.target.value)}
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent text-text"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                className="px-4 py-2 rounded-lg text-sm bg-surface-2 border border-border text-text-muted hover:text-text">
                Cancelar
              </button>
              <button type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98]">
                Crear tarea
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      <Card>
        {filtradas.length === 0 ? (
          <div className="text-center py-10 text-text-muted">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay tareas {filtro !== 'todas' ? `en estado "${estadoStyles[filtro as TareaEstado].label}"` : 'todavia'}.</p>
            {!showForm && (
              <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-accent hover:underline">
                Crear la primera →
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtradas.map(t => {
              const vencida = esVencida(t);
              const completed = t.estado === 'completada';
              const isSelected = selected.has(t.id);
              return (
                <li
                  key={t.id}
                  className={cn(
                    'group flex items-start gap-2.5 sm:gap-3 p-3 rounded-lg border transition-all',
                    isSelected ? 'border-accent/60 bg-accent/5'
                    : completed ? 'border-border/40 bg-surface-1/40 opacity-70'
                    : vencida ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-border bg-surface-1 hover:border-accent/40',
                  )}
                >
                  {/* CHECKBOX = SELECCION (no marca completada) */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(t.id)}
                    className="mt-0.5 shrink-0 p-0.5 -m-0.5 text-text-muted hover:text-accent transition-colors"
                    aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                  >
                    {isSelected
                      ? <CheckSquare className="w-5 h-5 text-accent" />
                      : <Square className="w-5 h-5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', prioridadStyles[t.prioridad].dot)} />
                      <h4 className={cn('font-medium text-sm break-words', completed && 'line-through text-text-muted')}>
                        {t.titulo}
                      </h4>
                      {vencida && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> VENCIDA
                        </span>
                      )}
                    </div>
                    {t.descripcion && (
                      <p className={cn('text-xs mt-1 break-words', completed ? 'text-text-subtle' : 'text-text-muted')}>
                        {t.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap text-[11px]">
                      <Badge className={prioridadStyles[t.prioridad].badge}>
                        <Flag className="w-3 h-3 inline mr-1" />{prioridadStyles[t.prioridad].label}
                      </Badge>
                      <select
                        value={t.estado}
                        onChange={e => actualizar(t.id, { estado: e.target.value as TareaEstado, completada_en: e.target.value === 'completada' ? new Date().toISOString() : undefined })}
                        className={cn('text-[11px] rounded-md px-1.5 py-0.5 border outline-none cursor-pointer', estadoStyles[t.estado].badge)}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_curso">En curso</option>
                        <option value="completada">Completada</option>
                      </select>
                      {t.asignado_a && (
                        <span className="inline-flex items-center gap-1 text-text-muted truncate max-w-[180px]">
                          <UserIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{nombrePorId.get(t.asignado_a) || t.asignado_a}</span>
                        </span>
                      )}
                      {t.vencimiento && (
                        <span className={cn('inline-flex items-center gap-1', vencida ? 'text-rose-300' : 'text-text-muted')}>
                          <CalendarIcon className="w-3 h-3" />
                          {(parseDateLocal(t.vencimiento) || new Date()).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Eliminar esta tarea?')) eliminar(t.id);
                    }}
                    className="shrink-0 p-1.5 rounded-md text-text-muted hover:text-rose-300 hover:bg-rose-500/10 sm:opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Eliminar tarea"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-4 text-[11px] text-text-subtle text-center">
        Tareas sincronizadas con Google Sheets · las completadas se archivan automaticamente en 3 seg
      </div>
    </>
  );
}

/** Tarjeta filtro estable a cualquier ancho: label en una linea + numero grande + icono fijo. */
function FilterChip({
  label, short, value, icon: Icon, accent = 'default', active, onClick,
}: {
  label: string;
  short?: string;
  value: number;
  icon: any;
  accent?: 'default' | 'amber' | 'blue' | 'green';
  active: boolean;
  onClick: () => void;
}) {
  const accentMap = {
    default: 'text-text-muted bg-surface-2',
    amber:   'text-amber-300 bg-amber-500/10',
    blue:    'text-blue-300 bg-blue-500/10',
    green:   'text-emerald-300 bg-emerald-500/10',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'card text-left transition-all group cursor-pointer p-2.5 sm:p-4',
        'flex items-center gap-2.5 sm:gap-3 min-w-0',
        active
          ? 'border-accent/60 shadow-[0_10px_30px_-15px_rgba(255,200,80,0.45)]'
          : 'hover:border-accent/30',
      )}
    >
      {/* icono fijo a la izquierda - no se mueve */}
      <div className={cn('p-2 rounded-lg shrink-0', accentMap[accent])}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      {/* texto flexible que NUNCA se rompe */}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.15em] text-text-muted font-medium leading-tight whitespace-nowrap truncate">
          <span className="sm:hidden">{short || label}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <p className="font-display text-xl sm:text-2xl md:text-3xl font-semibold mt-0.5 text-text leading-none">{value}</p>
      </div>
    </button>
  );
}

function BulkBtn({ icon: Icon, label, onClick, color }: { icon: any; label: string; onClick: () => void; color: 'zinc' | 'blue' | 'emerald' | 'rose' }) {
  const map = {
    zinc:    'text-zinc-300 hover:bg-zinc-500/10 hover:text-zinc-100 border-zinc-500/30',
    blue:    'text-blue-300 hover:bg-blue-500/10 hover:text-blue-200 border-blue-500/30',
    emerald: 'text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 border-emerald-500/30',
    rose:    'text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 border-rose-500/30',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border bg-surface-2/60 transition-all',
        map[color],
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}
