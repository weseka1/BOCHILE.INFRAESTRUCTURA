import { useMemo, useState } from 'react';
import {
  CheckSquare, Square, Trash2, Plus, AlertTriangle, Flag, Clock, X, Filter,
  ListTodo, CheckCircle2, Loader2, Calendar as CalendarIcon, User as UserIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTareas, type Tarea, type TareaPrioridad, type TareaEstado } from '@/hooks/useTareas';
import { useEmpleados } from '@/hooks/useEmpleados';
import { cn } from '@/lib/utils';

type Filtro = 'todas' | 'pendientes' | 'en_curso' | 'completadas';

const prioridadStyles: Record<TareaPrioridad, { dot: string; badge: string; label: string }> = {
  alta:  { dot: 'bg-rose-400', badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/30', label: 'Alta' },
  media: { dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30', label: 'Media' },
  baja:  { dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', label: 'Baja' },
};

const estadoStyles: Record<TareaEstado, { badge: string; label: string }> = {
  pendiente:  { badge: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30', label: 'Pendiente' },
  en_curso:   { badge: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',  label: 'En curso' },
  completada: { badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', label: 'Completada' },
};

export function TareasPage() {
  const { tareas, crear, actualizar, eliminar, toggleCompletada } = useTareas();
  const { data: empleados = [] } = useEmpleados();

  const [filtro, setFiltro] = useState<Filtro>('pendientes');
  const [showForm, setShowForm] = useState(false);

  // form state
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<TareaPrioridad>('media');
  const [asignado, setAsignado] = useState('');
  const [vencimiento, setVencimiento] = useState('');

  const counts = useMemo(() => ({
    todas: tareas.length,
    pendientes: tareas.filter(t => t.estado === 'pendiente').length,
    en_curso: tareas.filter(t => t.estado === 'en_curso').length,
    completadas: tareas.filter(t => t.estado === 'completada').length,
  }), [tareas]);

  const filtradas = useMemo(() => {
    const list = filtro === 'todas'
      ? tareas
      : filtro === 'pendientes'  ? tareas.filter(t => t.estado === 'pendiente')
      : filtro === 'en_curso'    ? tareas.filter(t => t.estado === 'en_curso')
      :                            tareas.filter(t => t.estado === 'completada');
    const orden: Record<TareaPrioridad, number> = { alta: 0, media: 1, baja: 2 };
    return [...list].sort((a, b) => {
      if (a.estado === 'completada' && b.estado !== 'completada') return 1;
      if (a.estado !== 'completada' && b.estado === 'completada') return -1;
      const p = orden[a.prioridad] - orden[b.prioridad];
      if (p !== 0) return p;
      return (b.creada_en || '').localeCompare(a.creada_en || '');
    });
  }, [tareas, filtro]);

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

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    empleados.forEach(e => m.set(e.empleado_id, e.nombre));
    return m;
  }, [empleados]);

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  function esVencida(t: Tarea) {
    if (!t.vencimiento || t.estado === 'completada') return false;
    return new Date(t.vencimiento) < hoy;
  }

  return (
    <>
      <PageHeader title="Tareas" subtitle="Gestión interna del equipo · pendientes, en curso y completadas" count={counts.todas} />

      {/* Stats + acciones */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <FilterStat label="Total" value={counts.todas} icon={ListTodo} active={filtro === 'todas'} onClick={() => setFiltro('todas')} />
        <FilterStat label="Pendientes" value={counts.pendientes} icon={Clock} accent="amber" active={filtro === 'pendientes'} onClick={() => setFiltro('pendientes')} />
        <FilterStat label="En curso" value={counts.en_curso} icon={Loader2} accent="blue" active={filtro === 'en_curso'} onClick={() => setFiltro('en_curso')} />
        <FilterStat label="Completadas" value={counts.completadas} icon={CheckCircle2} accent="green" active={filtro === 'completadas'} onClick={() => setFiltro('completadas')} />
      </div>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Filter className="w-3.5 h-3.5" />
          <span>Filtro:</span>
          <span className="font-semibold text-text capitalize">{filtro.replace('_', ' ')}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
            'bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98]',
          )}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nueva tarea'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="mb-5 border-accent/40">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Título *</label>
              <input
                autoFocus
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ej. Llamar a María Celia para visita Patagonia"
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Descripción</label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Detalles opcionales..."
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text resize-none"
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
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text"
              >
                <option value="">Sin asignar</option>
                {empleados.map(e => (
                  <option key={e.empleado_id} value={e.empleado_id}>{e.nombre} · {e.rol}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Vencimiento</label>
              <input
                type="date"
                value={vencimiento}
                onChange={e => setVencimiento(e.target.value)}
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text"
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
            <p className="text-sm">No hay tareas {filtro !== 'todas' ? `en estado "${filtro.replace('_', ' ')}"` : 'todavía'}.</p>
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
              return (
                <li
                  key={t.id}
                  className={cn(
                    'group flex items-start gap-3 p-3 rounded-lg border transition-all',
                    completed ? 'border-border/40 bg-surface-1/40 opacity-70'
                    : vencida ? 'border-rose-500/40 bg-rose-500/5'
                    : 'border-border bg-surface-1 hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-12px_rgba(255,200,80,0.35)]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleCompletada(t.id)}
                    className="mt-0.5 shrink-0 text-text-muted hover:text-accent transition-colors"
                    aria-label={completed ? 'Marcar pendiente' : 'Marcar completada'}
                  >
                    {completed ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-block w-2 h-2 rounded-full', prioridadStyles[t.prioridad].dot)} />
                      <h4 className={cn('font-medium text-sm', completed && 'line-through text-text-muted')}>
                        {t.titulo}
                      </h4>
                      {vencida && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> VENCIDA
                        </span>
                      )}
                    </div>
                    {t.descripcion && (
                      <p className={cn('text-xs mt-1', completed ? 'text-text-subtle' : 'text-text-muted')}>
                        {t.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px]">
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
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <UserIcon className="w-3 h-3" />
                          {nombrePorId.get(t.asignado_a) || t.asignado_a}
                        </span>
                      )}
                      {t.vencimiento && (
                        <span className={cn('inline-flex items-center gap-1', vencida ? 'text-rose-300' : 'text-text-muted')}>
                          <CalendarIcon className="w-3 h-3" />
                          {new Date(t.vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminar(t.id)}
                    className="shrink-0 p-1.5 rounded-md text-text-muted hover:text-rose-300 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
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
        Tareas persistidas localmente · sincronización con backend próximamente
      </div>
    </>
  );
}

function FilterStat({
  label, value, icon: Icon, accent = 'default', active, onClick,
}: {
  label: string;
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
        'card p-3 sm:p-4 text-left transition-all group cursor-pointer',
        active
          ? 'border-accent/60 shadow-[0_10px_30px_-15px_rgba(255,200,80,0.45)] -translate-y-0.5'
          : 'hover:border-accent/30 hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium">{label}</p>
          <p className="font-display text-2xl sm:text-3xl font-semibold mt-1 text-text">{value}</p>
        </div>
        <div className={cn('p-2 rounded-lg shrink-0', accentMap[accent])}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </button>
  );
}
