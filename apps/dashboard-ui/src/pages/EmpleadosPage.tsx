import { useEmpleados, useUpdateEmpleado, useCreateEmpleado } from '@/hooks/useEmpleados';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Toolbar, ChipFilter } from '@/components/ui/Toolbar';
import { Drawer } from '@/components/ui/Drawer';
import { formatMoney, cn } from '@/lib/utils';
import type { Empleado } from '@/types/domain';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Phone, Mail, MapPin, Award, Calendar, Plus, Minus, Loader2, UserPlus, X, Power, Pencil, Check,
} from 'lucide-react';

export function EmpleadosPage() {
  const { data, isLoading, error } = useEmpleados();
  const updateEmp = useUpdateEmpleado();
  const createEmp = useCreateEmpleado();
  const [filtro, setFiltro] = useState<'todos' | 'activo' | 'inactivo'>('activo');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Empleado | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const rows = data ?? [];

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (!focusId || !rows.length) return;
    const found = rows.find(r => r.empleado_id === focusId);
    if (found) {
      setSelected(found);
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, rows, setSearchParams]);

  // mantener `selected` sincronizado con el data fresco cuando hay updates
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find(r => r.empleado_id === selected.empleado_id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    todos: rows.length,
    activo: rows.filter(r => r.activo).length,
    inactivo: rows.filter(r => !r.activo).length,
  }), [rows]);

  const filtered = useMemo(() => {
    let arr = rows;
    if (filtro === 'activo') arr = arr.filter(r => r.activo);
    if (filtro === 'inactivo') arr = arr.filter(r => !r.activo);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(r =>
        (r.nombre || '').toLowerCase().includes(ql) ||
        (r.rol || '').toLowerCase().includes(ql) ||
        (r.zona_especialidad || '').toLowerCase().includes(ql) ||
        String(r.telefono || '').includes(q) ||
        (r.email || '').toLowerCase().includes(ql),
      );
    }
    return arr;
  }, [rows, filtro, q]);

  function toggleActivo(e: Empleado) {
    const next = !e.activo;
    setSelected({ ...e, activo: next });
    updateEmp.mutate({ empleado_id: e.empleado_id, patch: { activo: next } });
  }

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Equipo" subtitle="Vendedores y administracion de Bochile" count={filtered.length} />

      <Toolbar search={q} onSearch={setQ} searchPlaceholder="Buscar por nombre, rol, zona...">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ChipFilter label="Todos" active={filtro === 'todos'} onClick={() => setFiltro('todos')} count={counts.todos} />
          <ChipFilter label="Activos" active={filtro === 'activo'} onClick={() => setFiltro('activo')} count={counts.activo} />
          <ChipFilter label="Inactivos" active={filtro === 'inactivo'} onClick={() => setFiltro('inactivo')} count={counts.inactivo} />
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" /> Agregar persona
          </button>
        </div>
      </Toolbar>

      <Card>
        <Table<Empleado>
          rowKey={(r) => r.empleado_id}
          rows={filtered}
          empty="No hay empleados con esos filtros"
          rowOnClick={(r) => setSelected(r)}
          columns={[
            { key: 'id', header: 'ID', cell: (r) => <span className="font-mono text-xs text-text-muted">{r.empleado_id}</span> },
            { key: 'nombre', header: 'Nombre', cell: (r) => <span className="font-medium text-text">{r.nombre}</span> },
            { key: 'rol', header: 'Rol', cell: (r) => <Badge className="bg-blue-500/10 text-blue-300">{r.rol}</Badge> },
            { key: 'zona', header: 'Zona', cell: (r) => r.zona_especialidad || '-' },
            { key: 'tel', header: 'Teléfono', cell: (r) => <span className="font-mono text-xs">{r.telefono}</span> },
            { key: 'visitas', header: 'Visitas mes', cell: (r) => r.visitas_mes },
            { key: 'cierres', header: 'Cierres mes', cell: (r) => <span className="font-semibold text-emerald-300">{r.cierres_mes}</span> },
            { key: 'com', header: 'Comisiones mes', cell: (r) => <span className="font-semibold">{formatMoney(r.comisiones_mes, 'ARS')}</span> },
            {
              key: 'activo',
              header: 'Estado',
              cell: (r) => (
                <Badge className={r.activo ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                  {r.activo ? 'activo' : 'inactivo'}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      {/* DRAWER del empleado */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.nombre || 'Empleado'}
        subtitle={selected ? `${selected.empleado_id} · ${selected.rol}` : ''}
        footer={selected && (
          <div className="flex gap-2">
            {selected.telefono && (
              <a href={`https://wa.me/${String(selected.telefono).replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-emerald-600/80 text-white hover:brightness-110">
                <Phone className="w-4 h-4" /> WhatsApp
              </a>
            )}
            {selected.email && (
              <a href={`mailto:${selected.email}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface-2 border border-border hover:border-accent transition-all">
                <Mail className="w-4 h-4" /> Email
              </a>
            )}
            <button
              type="button"
              onClick={() => toggleActivo(selected)}
              disabled={updateEmp.isPending}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                selected.activo
                  ? 'bg-zinc-500/15 border border-zinc-500/40 text-zinc-300 hover:bg-zinc-500/25'
                  : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25',
              )}
              title={selected.activo ? 'Marcar como inactivo' : 'Marcar como activo'}
            >
              <Power className="w-4 h-4" />
              {selected.activo ? 'Inactivar' : 'Activar'}
            </button>
          </div>
        )}
      >
        {selected && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge className="bg-blue-500/10 text-blue-300">{selected.rol}</Badge>
              <Badge className={selected.activo ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-500/10 text-zinc-300'}>
                {selected.activo ? 'activo' : 'inactivo'}
              </Badge>
            </div>

            <EditableField
              label="Email" icon={Mail}
              value={selected.email || ''} placeholder="email@bochile.com"
              onSave={v => updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { email: v } })}
              saving={updateEmp.isPending}
            />
            <EditableField
              label="Teléfono" icon={Phone}
              value={selected.telefono || ''} placeholder="5492914..."
              mono
              onSave={v => updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { telefono: v } })}
              saving={updateEmp.isPending}
            />
            <EditableField
              label="Zona especialidad" icon={MapPin}
              value={selected.zona_especialidad || ''} placeholder="Ej. Patagonia, Centro"
              onSave={v => updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { zona_especialidad: v } })}
              saving={updateEmp.isPending}
            />
            <EditableField
              label="Rol"
              value={selected.rol || ''} placeholder="vendedor"
              options={['vendedor', 'vendedora', 'admin', 'alquileres', 'captacion']}
              onSave={v => updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { rol: v } })}
              saving={updateEmp.isPending}
            />
            <EditableField
              label="Calendar ID"
              value={selected.calendar_id || ''} placeholder="opcional"
              mono
              onSave={v => updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { calendar_id: v } })}
              saving={updateEmp.isPending}
            />
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Counter
                label="Visitas mes"
                value={selected.visitas_mes || 0}
                icon={Calendar}
                color="blue"
                onChange={(next) => {
                  setSelected({ ...selected, visitas_mes: next });
                  updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { visitas_mes: next } });
                }}
                saving={updateEmp.isPending}
              />
              <Counter
                label="Cierres mes"
                value={selected.cierres_mes || 0}
                icon={Award}
                color="emerald"
                onChange={(next) => {
                  setSelected({ ...selected, cierres_mes: next });
                  updateEmp.mutate({ empleado_id: selected.empleado_id, patch: { cierres_mes: next } });
                }}
                saving={updateEmp.isPending}
              />
            </div>
            <p className="mt-2 text-[10px] text-text-subtle text-center">
              Sumá o restá con ± a medida que ocurran las visitas y cierres del mes.
            </p>
          </div>
        )}
      </Drawer>

      {/* MODAL CREAR EMPLEADO */}
      {showCreate && (
        <CrearEmpleadoModal
          onClose={() => setShowCreate(false)}
          onCreate={async (data) => {
            await createEmp.mutateAsync(data);
            setShowCreate(false);
          }}
          saving={createEmp.isPending}
        />
      )}
    </>
  );
}

/**
 * Campo editable inline. Click sobre el valor (o sobre el lapiz) -> input.
 * Enter o blur guarda. Esc cancela.
 * Si se le pasan `options`, renderiza como <select>.
 */
function EditableField({
  label, icon: Icon, value, placeholder, mono, options, onSave, saving,
}: {
  label: string;
  icon?: any;
  value: string;
  placeholder?: string;
  mono?: boolean;
  options?: string[];
  onSave: (next: string) => void;
  saving?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    const next = String(draft || '').trim();
    if (next !== String(value || '').trim()) onSave(next);
    setEditing(false);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return (
    <div className="py-2 border-b border-border-subtle group">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1 flex items-center gap-1">
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      </div>
      {editing ? (
        options ? (
          <div className="flex items-center gap-1.5">
            <select
              ref={ref as React.RefObject<HTMLSelectElement>}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
              className="flex-1 input"
            >
              {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={commit}
              className="p-1.5 rounded-md text-emerald-300 hover:bg-emerald-500/15">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={cancel}
              className="p-1.5 rounded-md text-text-muted hover:bg-surface-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              ref={ref as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') cancel();
              }}
              placeholder={placeholder}
              className={cn('flex-1 input', mono && 'font-mono')}
            />
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={commit}
              className="p-1.5 rounded-md text-emerald-300 hover:bg-emerald-500/15">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={cancel}
              className="p-1.5 rounded-md text-text-muted hover:bg-surface-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left text-sm text-text bg-transparent border-b border-dashed border-transparent hover:border-accent/40 hover:text-accent transition-colors py-1 flex items-center gap-2 group/edit"
          title="Click para editar"
        >
          {Icon && value && <Icon className="w-3 h-3 text-text-muted shrink-0" />}
          <span className={cn('flex-1 truncate', mono && 'font-mono text-xs', !value && 'italic text-text-subtle')}>
            {value || placeholder || 'Sin definir'}
          </span>
          <Pencil className="w-3 h-3 text-text-subtle opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0" />
        </button>
      )}
    </div>
  );
}

function Counter({
  label, value, icon: Icon, color, onChange, saving,
}: {
  label: string;
  value: number;
  icon: any;
  color: 'blue' | 'emerald';
  onChange: (next: number) => void;
  saving: boolean;
}) {
  const colorMap = {
    blue:    { dot: 'text-blue-400',    num: 'text-text',         btn: 'hover:bg-blue-500/15 hover:text-blue-300' },
    emerald: { dot: 'text-emerald-400', num: 'text-emerald-300',  btn: 'hover:bg-emerald-500/15 hover:text-emerald-300' },
  } as const;
  const c = colorMap[color];
  return (
    <div className="card p-3 text-center">
      <Icon className={`w-4 h-4 mx-auto ${c.dot} mb-1`} />
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <button
          type="button"
          onClick={() => value > 0 && onChange(value - 1)}
          disabled={value <= 0 || saving}
          className={`p-1 rounded-md text-text-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${c.btn}`}
          aria-label={`Restar 1 a ${label}`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          type="number" min="0"
          value={value}
          onChange={e => {
            const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
            onChange(n);
          }}
          className={`w-16 bg-transparent border-none text-center font-display text-2xl font-bold ${c.num} focus:outline-none focus:ring-1 focus:ring-accent rounded`}
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={saving}
          className={`p-1 rounded-md text-text-muted transition-colors disabled:opacity-30 ${c.btn}`}
          aria-label={`Sumar 1 a ${label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-[10px] text-text-muted uppercase tracking-wider flex items-center justify-center gap-1">
        {label}
        {saving && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      </div>
    </div>
  );
}

function CrearEmpleadoModal({
  onClose, onCreate, saving,
}: {
  onClose: () => void;
  onCreate: (data: Partial<Empleado>) => Promise<void>;
  saving: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('vendedor');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [zona, setZona] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) { setError('Nombre obligatorio'); return; }
    try {
      await onCreate({
        nombre: nombre.trim(),
        rol: rol.trim() || 'vendedor',
        telefono: telefono.trim(),
        email: email.trim(),
        zona_especialidad: zona.trim(),
        activo: true,
      });
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadein"
      onClick={onClose}
      role="dialog" aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-surface-1 border-2 border-accent/40 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/15 text-accent"><UserPlus className="w-5 h-5" /></div>
            <h3 className="font-display text-lg font-bold text-text">Agregar persona al equipo</h3>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted">Nombre *</label>
            <input
              autoFocus
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Juan Perez"
              className="mt-1 input"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Rol</label>
              <select value={rol} onChange={e => setRol(e.target.value)} className="mt-1 input">
                <option value="vendedor">vendedor</option>
                <option value="vendedora">vendedora</option>
                <option value="admin">admin</option>
                <option value="alquileres">alquileres</option>
                <option value="captacion">captacion</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-text-muted">Teléfono</label>
              <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="5492914..." className="mt-1 input font-mono" />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@bochile.com" className="mt-1 input" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-muted">Zona especialidad</label>
            <input value={zona} onChange={e => setZona(e.target.value)} placeholder="Ej. Patagonia, Centro" className="mt-1 input" />
          </div>

          <p className="text-[11px] text-text-subtle italic">
            El empleado se crea como <strong className="text-emerald-300">activo</strong>.
          </p>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-surface-2 border border-border text-text-muted hover:text-text">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !nombre.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
