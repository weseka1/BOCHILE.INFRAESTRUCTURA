import { useVisitas, useCreateVisita, useUpdateVisita } from '@/hooks/useVisitas';
import { useEmpleados } from '@/hooks/useEmpleados';
import { usePropiedades } from '@/hooks/usePropiedades';
import { useLeads } from '@/hooks/useLeads';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { formatFechaVisita, formatHora, cn } from '@/lib/utils';
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Visita } from '@/types/domain';
import {
  Phone, MapPin, Clock, User as UserIcon, MessageSquare,
  CheckCircle2, Loader2, AlertCircle, CalendarPlus, Calendar as CalendarIcon, Sparkles,
} from 'lucide-react';

// Estados normalizados:
// - 'pendiente': el bot registro interes pero falta coordinar fecha/hora
// - 'confirmada' | 'agendada': ya hay fecha+hora+vendedor (a confirmar manualmente o detectada del chat humano)
// - 'realizada': la visita se hizo
// - 'cancelada': se cancelo
const estadoColor = (estado: string) => {
  switch (String(estado || '').toLowerCase()) {
    case 'pendiente': return 'bg-amber-500/10 text-amber-300';
    case 'agendada':
    case 'confirmada': return 'bg-blue-500/10 text-blue-300';
    case 'realizada': return 'bg-emerald-500/10 text-emerald-300';
    case 'cancelada': return 'bg-rose-500/10 text-rose-300';
    default: return 'bg-zinc-500/10 text-zinc-300';
  }
};

function esPendiente(v: Visita) { return String(v.estado || '').toLowerCase() === 'pendiente'; }
function esConfirmada(v: Visita) {
  const e = String(v.estado || '').toLowerCase();
  return e === 'confirmada' || e === 'agendada' || e === 'realizada';
}

interface FormState {
  lead_id: string;
  cliente_nombre: string;
  telefono: string;
  prop_id: string;
  direccion: string;
  fecha: string;
  hora: string;
  vendedor_id: string;
  vendedor_nombre: string;
  estado: string;
  observaciones: string;
}

const emptyForm: FormState = {
  lead_id: '', cliente_nombre: '', telefono: '', prop_id: '', direccion: '',
  fecha: '', hora: '', vendedor_id: '', vendedor_nombre: '', estado: 'confirmada', observaciones: '',
};

export function VisitasPage() {
  const navigate = useNavigate();
  const { data: visitas, isLoading: loadingVisitas } = useVisitas();
  const { data: leads } = useLeads();
  const { data: empleados = [] } = useEmpleados();
  const { data: props = [] } = usePropiedades();
  const create = useCreateVisita();
  const update = useUpdateVisita();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  // modo del form: confirmar una pendiente (con visita_id) o crear manual
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const all = (visitas ?? []) as Visita[];
  const pendientes = useMemo(
    () => all.filter(esPendiente).sort((a, b) => String(b.creada_en || '').localeCompare(String(a.creada_en || ''))),
    [all],
  );
  const confirmadas = useMemo(
    () => all.filter(esConfirmada).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))),
    [all],
  );

  function leadOf(visita: Visita) {
    return (leads ?? []).find(l => l.lead_id === visita.lead_id);
  }

  function openConfirm(v: Visita) {
    const lead = leadOf(v);
    setConfirmingId(v.visita_id);
    setForm({
      lead_id: v.lead_id || '',
      cliente_nombre: v.cliente_nombre || lead?.nombre || '',
      telefono: lead?.telefono || '',
      prop_id: v.prop_id || '',
      direccion: v.direccion || '',
      fecha: v.fecha || '',
      hora: v.hora || '',
      vendedor_id: v.vendedor_id || '',
      vendedor_nombre: v.vendedor_nombre || '',
      estado: 'confirmada',
      observaciones: v.observaciones || '',
    });
    setSubmitError(null);
    setFormOpen(true);
  }

  function openManual() {
    setConfirmingId(null);
    setForm(emptyForm);
    setSubmitError(null);
    setFormOpen(true);
  }

  function close() {
    setFormOpen(false);
    setConfirmingId(null);
    setSubmitError(null);
    setForm(emptyForm);
  }

  // Auto-fill direccion al elegir prop
  useEffect(() => {
    if (!form.prop_id) return;
    const p = props.find((x) => x.prop_id === form.prop_id);
    if (p && !form.direccion) {
      setForm(s => ({ ...s, direccion: p.direccion || s.direccion }));
    }
  }, [form.prop_id]);

  // Auto-fill vendedor nombre al elegir id
  function onVendedorChange(id: string) {
    const e = empleados.find(x => x.empleado_id === id);
    setForm(s => ({ ...s, vendedor_id: id, vendedor_nombre: e?.nombre || s.vendedor_nombre }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!form.cliente_nombre.trim() || !form.fecha || !form.hora) {
      setSubmitError('Faltan datos obligatorios: cliente, fecha y hora.');
      return;
    }
    try {
      const payload: Partial<Visita> = {
        lead_id: form.lead_id || undefined,
        cliente_nombre: form.cliente_nombre.trim(),
        prop_id: form.prop_id || undefined,
        direccion: form.direccion,
        fecha: form.fecha,
        hora: form.hora,
        vendedor_id: form.vendedor_id || undefined,
        vendedor_nombre: form.vendedor_nombre,
        estado: form.estado,
        observaciones: form.observaciones,
        confirmada_cliente: true,
        notificada_vendedor: true,
        recordatorio_enviado: false,
      };

      let savedId: string | null = null;
      if (confirmingId) {
        const saved = await update.mutateAsync({ visita_id: confirmingId, patch: payload });
        savedId = saved.visita_id || confirmingId;
      } else {
        const saved = await create.mutateAsync(payload);
        savedId = saved.visita_id || null;
      }
      setJustSavedId(savedId);
      setTimeout(() => setJustSavedId(null), 4000);
      close();
    } catch (err: any) {
      setSubmitError(err?.message || 'Error guardando visita');
    }
  }

  async function cancelarPendiente(v: Visita) {
    if (!confirm(`Cancelar la solicitud de visita de ${v.cliente_nombre || v.lead_id}?`)) return;
    try {
      await update.mutateAsync({ visita_id: v.visita_id, patch: { estado: 'cancelada' } });
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'no se pudo cancelar'));
    }
  }

  if (loadingVisitas) return <div className="text-text-muted">Cargando...</div>;

  return (
    <>
      <PageHeader
        title="Visitas"
        subtitle="Solicitudes pendientes y visitas coordinadas"
        count={pendientes.length + confirmadas.length}
      />

      {/* Banner success */}
      {justSavedId && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>Visita <span className="font-mono">{justSavedId}</span> guardada correctamente ✓</span>
        </div>
      )}

      {/* Action bar */}
      <div className="mb-5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-text-muted">Pendientes: <strong className="text-amber-400">{pendientes.length}</strong></span>
          <span className="text-text-subtle">·</span>
          <span className="text-text-muted">Confirmadas: <strong className="text-blue-400">{confirmadas.length}</strong></span>
        </div>
        <button
          type="button"
          onClick={openManual}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-accent-fg shadow-gold hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <CalendarPlus className="w-4 h-4" /> Agregar visita manual
        </button>
      </div>

      {/* SOLICITUDES PENDIENTES */}
      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Pendientes de coordinar ({pendientes.length})
          <span className="ml-2 text-[10px] normal-case text-text-subtle tracking-normal">
            <Sparkles className="w-3 h-3 inline" /> registradas por Cami cuando el cliente pide visita
          </span>
        </h3>
        {pendientes.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm py-6 text-center">
              Sin solicitudes pendientes. Cuando un cliente pida visita por WhatsApp va a aparecer acá.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendientes.map((v) => {
              const lead = leadOf(v);
              const tel = lead?.telefono || '';
              return (
                <Card key={v.visita_id} className="border-amber-500/30 hover:border-amber-500/60 hover:-translate-y-0.5 transition-all group">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <UserIcon className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-text">{v.cliente_nombre || lead?.nombre || v.lead_id || '-'}</span>
                        <Badge className="bg-amber-500/10 text-amber-300 text-[10px]">Quiere coordinar visita</Badge>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap mt-1.5">
                        {tel && (
                          <a
                            href={`https://wa.me/${String(tel).replace(/\D/g, '')}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" /> {tel}
                          </a>
                        )}
                        {v.lead_id && (
                          <button type="button" onClick={() => navigate(`/conversaciones?lead=${v.lead_id}`)}
                            className="text-xs text-text-muted hover:text-accent flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Ver chat
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0 font-mono">{v.visita_id}</span>
                  </div>

                  {v.prop_id && (
                    <div className="text-xs text-text-muted mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Propiedad: <span className="font-mono">{v.prop_id}</span> {v.direccion && `· ${v.direccion}`}
                    </div>
                  )}
                  {v.observaciones && (
                    <div className="text-xs text-text mt-2 italic border-l-2 border-amber-500/40 pl-2 line-clamp-3">
                      "{v.observaciones}"
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openConfirm(v)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600/80 text-white hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelarPendiente(v)}
                      className="px-3 py-2 rounded-lg text-sm bg-surface-2 border border-border text-text-muted hover:text-rose-300 hover:border-rose-500/50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* VISITAS CONFIRMADAS */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Visitas confirmadas ({confirmadas.length})
        </h3>
        {confirmadas.length === 0 ? (
          <Card>
            <p className="text-text-muted text-sm py-6 text-center">Sin visitas confirmadas todavía. Confirmá una pendiente o agregá una manual.</p>
          </Card>
        ) : (
          <Card>
            <Table<Visita>
              rowKey={(r) => r.visita_id}
              rows={confirmadas}
              rowOnClick={(r) => r.lead_id && navigate(`/conversaciones?lead=${r.lead_id}`)}
              columns={[
                { key: 'fecha', header: 'Fecha', cell: (r) => formatFechaVisita(r.fecha) },
                { key: 'hora', header: 'Hora', cell: (r) => <span className="font-mono">{formatHora(r.hora)}</span> },
                { key: 'cliente', header: 'Cliente', cell: (r) => <span className="font-medium">{r.cliente_nombre}</span> },
                { key: 'prop', header: 'Prop', cell: (r) => <span className="font-mono text-xs">{r.prop_id}</span> },
                { key: 'dir', header: 'Dirección', cell: (r) => r.direccion },
                { key: 'vend', header: 'Vendedor', cell: (r) => r.vendedor_nombre || '-' },
                { key: 'estado', header: 'Estado', cell: (r) => <Badge className={estadoColor(r.estado)}>{r.estado}</Badge> },
              ]}
            />
          </Card>
        )}
      </div>

      {/* DRAWER FORM */}
      <Drawer
        open={formOpen}
        onClose={close}
        title={confirmingId ? `Confirmar visita: ${form.cliente_nombre || form.lead_id}` : 'Nueva visita manual'}
        subtitle={confirmingId ? `Solicitud ${confirmingId}` : 'Registrar una visita coordinada fuera del sistema'}
        footer={
          <div className="flex items-center gap-2">
            <button type="button" onClick={close}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-surface-2 border border-border text-text-muted hover:text-text">
              Cancelar
            </button>
            <button type="submit" form="visita-form" disabled={create.isPending}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
                create.isPending
                  ? 'bg-accent/50 text-accent-fg cursor-not-allowed'
                  : 'bg-accent text-accent-fg hover:brightness-110 active:scale-[0.98] shadow-gold',
              )}>
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {create.isPending ? 'Guardando...' : 'Registrar visita'}
            </button>
          </div>
        }
      >
        <form id="visita-form" onSubmit={submit} className="space-y-3">
          {submitError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {submitError}
            </div>
          )}

          <Field label="Cliente *">
            <input
              required
              value={form.cliente_nombre}
              onChange={e => setForm({ ...form, cliente_nombre: e.target.value })}
              placeholder="Nombre del cliente"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Teléfono">
              <input
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                placeholder="54911..."
                className="input"
              />
            </Field>
            <Field label="Lead ID (opcional)">
              <input
                value={form.lead_id}
                onChange={e => setForm({ ...form, lead_id: e.target.value })}
                placeholder="L-..."
                className="input font-mono"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha *">
              <input
                required
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Hora *">
              <input
                required
                type="time"
                value={form.hora}
                onChange={e => setForm({ ...form, hora: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <Field label="Propiedad">
            <select
              value={form.prop_id}
              onChange={e => setForm({ ...form, prop_id: e.target.value })}
              className="input"
            >
              <option value="">— Sin propiedad / definir luego —</option>
              {props.map(p => (
                <option key={p.prop_id} value={p.prop_id}>
                  {p.prop_id} · {p.titulo || p.direccion}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Dirección">
            <input
              value={form.direccion}
              onChange={e => setForm({ ...form, direccion: e.target.value })}
              placeholder="Calle 123, Bahía Blanca"
              className="input"
            />
          </Field>

          <Field label="Vendedor que atiende">
            <select
              value={form.vendedor_id}
              onChange={e => onVendedorChange(e.target.value)}
              className="input"
            >
              <option value="">— Sin vendedor asignado —</option>
              {empleados.filter(e => e.activo).map(e => (
                <option key={e.empleado_id} value={e.empleado_id}>
                  {e.nombre} · {e.rol}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado">
            <select
              value={form.estado}
              onChange={e => setForm({ ...form, estado: e.target.value })}
              className="input"
            >
              <option value="confirmada">Confirmada</option>
              <option value="realizada">Realizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </Field>

          <Field label="Observaciones">
            <textarea
              rows={3}
              value={form.observaciones}
              onChange={e => setForm({ ...form, observaciones: e.target.value })}
              placeholder="Notas internas para el vendedor..."
              className="input resize-none"
            />
          </Field>

          <p className="text-[11px] text-text-subtle italic">
            * campos obligatorios. La visita queda registrada en el sistema con ID auto-generado.
          </p>
        </form>
      </Drawer>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">{label}</div>
      {children}
    </label>
  );
}
