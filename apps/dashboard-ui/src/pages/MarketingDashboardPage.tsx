import { useMemo, useState, useCallback } from 'react';
import {
  CheckSquare, Square, Trash2, Plus, AlertTriangle, Flag, Clock, X,
  ListTodo, CheckCircle2, Loader2, Calendar as CalendarIcon, User as UserIcon,
  CircleDot, ArrowLeftRight, Inbox, Cpu,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useTareas, type Tarea, type TareaPrioridad, type TareaEstado } from '@/hooks/useTareas';
import { useEmpleados } from '@/hooks/useEmpleados';
import { MARKETING_ASIGNADO_ID } from '@/pages/DashboardPage';
import { cn } from '@/lib/utils';

type Filtro = 'todas' | 'pendiente' | 'en_curso' | 'completada' | 'bandeja';

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

function parseDateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  if (s.includes('T')) return new Date(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(s);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * /marketing - Panel WESEKA.IA.
 * Lista plana tabular de TODAS las tareas (mismo store del sheet) + bandeja
 * separada con las tareas que el equipo Bochile deriva al equipo WSK.
 * "Devolver" cambia asignado_a a vacio y la tarea sale de la bandeja.
 */
export function MarketingDashboardPage() {
  const { tareas, crear, actualizar, eliminar, eliminarVarios, actualizarVarios, limpiarCompletadas } = useTareas();
  const { data: empleados = [] } = useEmpleados();

  const [filtro, setFiltro] = useState<Filtro>('bandeja');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Form completo
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<TareaPrioridad>('media');
  const [asignado, setAsignado] = useState('');
  const [vencimiento, setVencimiento] = useState('');

  // Quick add
  const [qTitulo, setQTitulo] = useState('');
  const [qPrio, setQPrio] = useState<TareaPrioridad>('media');

  const bandejaWeseka = useMemo(
    () => tareas.filter(t => t.asignado_a === MARKETING_ASIGNADO_ID),
    [tareas],
  );

  const counts = useMemo(() => ({
    todas: tareas.length,
    pendiente: tareas.filter(t => t.estado === 'pendiente').length,
    en_curso: tareas.filter(t => t.estado === 'en_curso').length,
    completada: tareas.filter(t => t.estado === 'completada').length,
    bandeja: bandejaWeseka.length,
  }), [tareas, bandejaWeseka]);

  const filtradas = useMemo(() => {
    let list: Tarea[];
    if (filtro === 'todas') list = tareas;
    else if (filtro === 'bandeja') list = bandejaWeseka;
    else list = tareas.filter(t => t.estado === filtro);
    const orden: Record<TareaPrioridad, number> = { alta: 0, media: 1, baja: 2 };
    return [...list].sort((a, b) => {
      if (a.estado === 'completada' && b.estado !== 'completada') return 1;
      if (a.estado !== 'completada' && b.estado === 'completada') return -1;
      const p = orden[a.prioridad] - orden[b.prioridad];
      if (p !== 0) return p;
      return (b.creada_en || '').localeCompare(a.creada_en || '');
    });
  }, [tareas, bandejaWeseka, filtro]);

  const allFilteredIds = useMemo(() => filtradas.map(t => t.id), [filtradas]);
  const allSelected = selected.size > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
  async function handleLimpiarCompletadas() {
    if (counts.completada === 0) return;
    if (!window.confirm(`Eliminar las ${counts.completada} tarea${counts.completada > 1 ? 's completadas' : ' completada'}? Esta accion no se puede deshacer.`)) return;
    await limpiarCompletadas();
  }

  function resetForm() {
    setTitulo(''); setDescripcion(''); setPrioridad('media'); setAsignado(''); setVencimiento('');
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    // CRITICO: TODA tarea creada desde el panel WESEKA.IA debe quedar con
    // asignado_a = MARKETING_ASIGNADO_ID. Si el usuario quiere apuntar a un
    // empleado especifico, lo escribe en la descripcion. Esto evita el bug
    // de tareas WSK que "se mezclan" en la admin de Bochile.
    const empleadoTag = asignado ? `[Para: ${asignado}] ` : '';
    crear({
      titulo: titulo.trim(),
      descripcion: (empleadoTag + (descripcion.trim() || '')).trim() || undefined,
      prioridad,
      asignado_a: MARKETING_ASIGNADO_ID,
      vencimiento: vencimiento || undefined,
    });
    resetForm();
    setShowForm(false);
  }

  function quickSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = qTitulo.trim();
    if (!t) return;
    crear({ titulo: t, prioridad: qPrio, asignado_a: MARKETING_ASIGNADO_ID });
    setQTitulo('');
  }

  const WESEKA_AGENT = { empleado_id: MARKETING_ASIGNADO_ID, nombre: 'WESEKA.IA', rol: 'equipo wsk' } as const;

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    empleados.forEach(e => m.set(e.empleado_id, e.nombre));
    m.set(WESEKA_AGENT.empleado_id, WESEKA_AGENT.nombre);
    return m;
  }, [empleados]);

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  function esVencida(t: Tarea) {
    if (!t.vencimiento || t.estado === 'completada') return false;
    const d = parseDateLocal(t.vencimiento);
    return d ? d < hoy : false;
  }

  return (
    <>
      <PageHeader
        title="WESEKA.IA"
        subtitle="Bandeja interna del equipo WSK · administración tabular de tareas"
        count={counts.bandeja}
      />

      {/* Hero compacto WESEKA */}
      <div className="relative mb-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 via-surface-1 to-purple-500/5 border border-fuchsia-500/30 overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-fuchsia-500 text-white shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)]">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold text-text">Panel WESEKA.IA</h2>
            <p className="text-xs text-text-muted">
              <span className="text-fuchsia-300 font-semibold">{counts.bandeja}</span> en bandeja · <span className="text-text">{counts.todas}</span> tareas totales en el sistema
            </p>
          </div>
        </div>
      </div>

      {/* QUICK-ADD para tareas WESEKA */}
      <Card className="mb-4 border-fuchsia-500/30">
        <form onSubmit={quickSubmit} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', prioridadStyles[qPrio].dot)} />
            <input
              value={qTitulo}
              onChange={e => setQTitulo(e.target.value)}
              placeholder="Anotar tarea WESEKA y presionar Enter..."
              className="flex-1 min-w-0 bg-transparent border-none px-1 py-2 focus:outline-none text-sm sm:text-base text-text placeholder:text-text-muted"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(['alta', 'media', 'baja'] as TareaPrioridad[]).map(p => (
              <button
                key={p} type="button" onClick={() => setQPrio(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-all border',
                  qPrio === p ? prioridadStyles[p].badge : 'bg-surface-2 border-border text-text-muted hover:text-text',
                )}
              >{prioridadStyles[p].label}</button>
            ))}
            <button
              type="submit" disabled={!qTitulo.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-fuchsia-500 text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
        </form>
      </Card>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-5">
        <FilterChip label="Bandeja WSK" short="Bandeja" value={counts.bandeja} icon={Inbox} accent="fuchsia" active={filtro === 'bandeja'} onClick={() => setFiltro('bandeja')} />
        <FilterChip label="Total" short="Total" value={counts.todas} icon={ListTodo} active={filtro === 'todas'} onClick={() => setFiltro('todas')} />
        <FilterChip label="Pendientes" short="Pend." value={counts.pendiente} icon={Clock} accent="amber" active={filtro === 'pendiente'} onClick={() => setFiltro('pendiente')} />
        <FilterChip label="En curso" short="Curso" value={counts.en_curso} icon={Loader2} accent="blue" active={filtro === 'en_curso'} onClick={() => setFiltro('en_curso')} />
        <FilterChip label="Completadas" short="Compl." value={counts.completada} icon={CheckCircle2} accent="green" active={filtro === 'completada'} onClick={() => setFiltro('completada')} />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
        <button
          type="button" onClick={toggleAll} disabled={allFilteredIds.length === 0}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-surface-2 border border-border text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-fuchsia-300" />
            : someSelected ? <CircleDot className="w-3.5 h-3.5 text-fuchsia-300" />
            : <Square className="w-3.5 h-3.5" />}
          <span>{allSelected ? 'Deseleccionar todo' : someSelected ? `${selected.size} seleccionada${selected.size > 1 ? 's' : ''}` : 'Seleccionar todo'}</span>
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {filtro === 'completada' && counts.completada > 0 && (
            <button type="button" onClick={handleLimpiarCompletadas}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar {counts.completada} completada{counts.completada > 1 ? 's' : ''}</span>
              <span className="sm:hidden">Limpiar</span>
            </button>
          )}
          <button type="button" onClick={() => setShowForm(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-fuchsia-500 text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_30px_-12px_rgba(217,70,239,0.6)]">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="hidden xs:inline">{showForm ? 'Cancelar' : 'Nueva (detallada)'}</span>
            <span className="xs:hidden">{showForm ? 'Cerrar' : 'Nueva'}</span>
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {someSelected && (
        <div className="sticky top-[60px] sm:top-[68px] z-20 mb-3 p-2.5 sm:p-3 rounded-xl bg-surface-1/95 backdrop-blur-md border border-fuchsia-500/40 shadow-lg flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-semibold text-fuchsia-300 shrink-0">{selected.size}</span>
          <span className="text-xs text-text-muted hidden sm:inline">seleccionada{selected.size > 1 ? 's' : ''}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <BulkBtn icon={Clock} label="Pendiente" onClick={() => bulkEstado('pendiente')} color="zinc" />
            <BulkBtn icon={Loader2} label="En curso" onClick={() => bulkEstado('en_curso')} color="blue" />
            <BulkBtn icon={CheckCircle2} label="Completar" onClick={() => bulkEstado('completada')} color="emerald" />
            <BulkBtn icon={Trash2} label="Eliminar" onClick={bulkDelete} color="rose" />
            <button type="button" onClick={clearSelection}
              className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-colors" aria-label="Cancelar seleccion">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Form detallado */}
      {showForm && (
        <Card className="mb-4 sm:mb-5 border-fuchsia-500/40">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Titulo *</label>
              <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ej. Revisar prompt de Cami para zona Patagonia"
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-fuchsia-400 text-text" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Descripcion</label>
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
                placeholder="Detalles opcionales..."
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-fuchsia-400 text-text resize-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Prioridad</label>
              <div className="mt-1 flex gap-1">
                {(['alta', 'media', 'baja'] as TareaPrioridad[]).map(p => (
                  <button key={p} type="button" onClick={() => setPrioridad(p)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all border',
                      prioridad === p ? prioridadStyles[p].badge + ' ring-2 ring-current/30' : 'bg-surface-2 border-border text-text-muted hover:text-text',
                    )}>{prioridadStyles[p].label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Para (opcional · solo nota)</label>
              <select value={asignado} onChange={e => setAsignado(e.target.value)}
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-fuchsia-400 text-text">
                <option value="">— Sin nota —</option>
                {empleados.map(e => (
                  <option key={e.empleado_id} value={e.empleado_id}>Para {e.nombre}</option>
                ))}
              </select>
              <p className="text-[9px] text-text-subtle mt-0.5 italic">
                La tarea queda en WESEKA.IA — esto solo agrega una nota.
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Vencimiento</label>
              <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)}
                className="mt-1 w-full bg-surface-2 border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-fuchsia-400 text-text" />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                className="px-4 py-2 rounded-lg text-sm bg-surface-2 border border-border text-text-muted hover:text-text">Cancelar</button>
              <button type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-fuchsia-500 text-white hover:brightness-110 active:scale-[0.98]">Crear tarea</button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      <Card>
        {filtradas.length === 0 ? (
          <div className="text-center py-10 text-text-muted">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {filtro === 'bandeja'
                ? 'Bandeja vacía. Bochile puede derivar tareas desde su panel de Tareas.'
                : `No hay tareas en estado "${estadoStyles[filtro as TareaEstado]?.label || filtro}".`}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtradas.map(t => {
              const vencida = esVencida(t);
              const completed = t.estado === 'completada';
              const isSelected = selected.has(t.id);
              const enBandeja = t.asignado_a === MARKETING_ASIGNADO_ID;
              return (
                <li key={t.id} className={cn(
                  'group flex items-start gap-2.5 sm:gap-3 p-3 rounded-lg border transition-all',
                  isSelected ? 'border-fuchsia-500/60 bg-fuchsia-500/5'
                  : completed ? 'border-border/40 bg-surface-1/40 opacity-70'
                  : vencida ? 'border-rose-500/40 bg-rose-500/5'
                  : 'border-border bg-surface-1 hover:border-fuchsia-500/40',
                )}>
                  <button type="button" onClick={() => toggleSelect(t.id)}
                    className="mt-0.5 shrink-0 p-0.5 -m-0.5 text-text-muted hover:text-fuchsia-300 transition-colors"
                    aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}>
                    {isSelected ? <CheckSquare className="w-5 h-5 text-fuchsia-300" /> : <Square className="w-5 h-5" />}
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
                      {enBandeja && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-fuchsia-300 font-semibold bg-fuchsia-500/10 border border-fuchsia-500/30 px-1.5 py-0.5 rounded">
                          WSK
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

                  {enBandeja ? (
                    <button type="button"
                      onClick={() => actualizar(t.id, { asignado_a: '' })}
                      className="shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border border-amber-500/30 text-amber-300 bg-amber-500/5 hover:bg-amber-500/15 sm:opacity-0 group-hover:opacity-100 transition-all inline-flex items-center gap-1"
                      title="Devolver al equipo Bochile">
                      <ArrowLeftRight className="w-3 h-3" /> Devolver
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => actualizar(t.id, { asignado_a: MARKETING_ASIGNADO_ID })}
                      className="shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border border-fuchsia-500/30 text-fuchsia-300 bg-fuchsia-500/5 hover:bg-fuchsia-500/15 sm:opacity-0 group-hover:opacity-100 transition-all inline-flex items-center gap-1"
                      title="Traer a la bandeja WESEKA">
                      <Inbox className="w-3 h-3" /> A WSK
                    </button>
                  )}

                  <button type="button"
                    onClick={() => { if (window.confirm('Eliminar esta tarea?')) eliminar(t.id); }}
                    className="shrink-0 p-1.5 rounded-md text-text-muted hover:text-rose-300 hover:bg-rose-500/10 sm:opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Eliminar tarea">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-4 text-[11px] text-text-subtle text-center">
        Panel WESEKA.IA · tareas sincronizadas con Google Sheets · mismo store que el panel Bochile
      </div>
    </>
  );
}

function FilterChip({
  label, short, value, icon: Icon, accent = 'default', active, onClick,
}: {
  label: string;
  short?: string;
  value: number;
  icon: any;
  accent?: 'default' | 'amber' | 'blue' | 'green' | 'fuchsia';
  active: boolean;
  onClick: () => void;
}) {
  const accentMap = {
    default:  'text-text-muted bg-surface-2',
    amber:    'text-amber-300 bg-amber-500/10',
    blue:     'text-blue-300 bg-blue-500/10',
    green:    'text-emerald-300 bg-emerald-500/10',
    fuchsia:  'text-fuchsia-300 bg-fuchsia-500/10',
  };
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'card text-left transition-all group cursor-pointer p-2.5 sm:p-4',
        'flex items-center gap-2.5 sm:gap-3 min-w-0',
        active ? 'border-fuchsia-500/60 shadow-[0_10px_30px_-15px_rgba(217,70,239,0.45)]' : 'hover:border-fuchsia-500/30',
      )}>
      <div className={cn('p-2 rounded-lg shrink-0', accentMap[accent])}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
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
    <button type="button" onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border bg-surface-2/60 transition-all',
        map[color],
      )}>
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}
