import { useConversaciones } from '@/hooks/useConversaciones';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, ArrowLeft, User as UserIcon, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversacion } from '@/types/domain';

interface Chat {
  lead_id: string;
  nombre: string;
  telefono: string;
  ultimo: Conversacion;
  unread_in: number;
  total: number;
  mensajes: Conversacion[];
}

function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') {
    // si parece serial Sheets de fecha/hora (dias), convertir
    if (v < 100000) return Math.round((v - 25569) * 86400 * 1000);
    return v;
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatHoraCorta(v: any): string {
  const ms = tsToMs(v);
  if (!ms) return '';
  const d = new Date(ms);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  if (mismoDia) return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function iniciales(nombre: string): string {
  return (nombre || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

export function ConversacionesPage() {
  const { data, isLoading, error } = useConversaciones();
  const [q, setQ] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Agrupar por lead_id -> chats
  const chats: Chat[] = useMemo(() => {
    const all = (data ?? []) as Conversacion[];
    const map = new Map<string, Chat>();
    for (const m of all) {
      if (!m.lead_id) continue;
      const c = map.get(m.lead_id);
      if (!c) {
        map.set(m.lead_id, {
          lead_id: m.lead_id,
          nombre: (m as any).nombre || m.lead_id,
          telefono: m.telefono || '',
          ultimo: m,
          unread_in: m.direccion === 'in' ? 1 : 0,
          total: 1,
          mensajes: [m],
        });
      } else {
        c.mensajes.push(m);
        c.total++;
        if (m.direccion === 'in') c.unread_in++;
        if ((m as any).nombre && !c.nombre.match(/[a-zA-Z]/)) c.nombre = (m as any).nombre;
        if (m.telefono && !c.telefono) c.telefono = m.telefono;
        if (tsToMs(m.timestamp) > tsToMs(c.ultimo.timestamp)) c.ultimo = m;
      }
    }
    // ordenar mensajes de cada chat por timestamp asc
    for (const c of map.values()) {
      c.mensajes.sort((a, b) => tsToMs(a.timestamp) - tsToMs(b.timestamp));
    }
    return Array.from(map.values()).sort((a, b) => tsToMs(b.ultimo.timestamp) - tsToMs(a.ultimo.timestamp));
  }, [data]);

  const filteredChats = useMemo(() => {
    if (!q) return chats;
    const ql = q.toLowerCase();
    return chats.filter(c =>
      c.nombre.toLowerCase().includes(ql) ||
      c.telefono.includes(q) ||
      c.lead_id.toLowerCase().includes(ql) ||
      c.ultimo.mensaje?.toLowerCase().includes(ql),
    );
  }, [chats, q]);

  const selected = useMemo(
    () => chats.find(c => c.lead_id === selectedLeadId) || null,
    [chats, selectedLeadId],
  );

  // Auto-scroll al final cuando abre un chat
  useEffect(() => {
    if (selected) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
    }
  }, [selectedLeadId]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Conversaciones" subtitle="Chats con clientes via WhatsApp" count={chats.length} />

      {/* Layout WhatsApp: lista a la izq + chat a la der */}
      <div className="card overflow-hidden h-[calc(100vh-220px)] min-h-[500px] flex">
        {/* COLUMNA: lista de chats */}
        <div className={cn(
          'w-full md:w-80 md:shrink-0 border-r border-border flex flex-col bg-surface-1',
          selected && 'hidden md:flex',
        )}>
          {/* search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar chat..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-2 border border-border text-sm placeholder:text-text-subtle focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          {/* lista */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <p className="text-text-muted text-sm py-8 text-center">Sin chats</p>
            ) : filteredChats.map((c) => (
              <button
                key={c.lead_id}
                onClick={() => setSelectedLeadId(c.lead_id)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-border/50 hover:bg-surface-2 transition-colors flex gap-3 items-start',
                  selectedLeadId === c.lead_id && 'bg-surface-2',
                )}
              >
                {/* avatar */}
                <div className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold text-sm shrink-0">
                  {iniciales(c.nombre)}
                </div>
                {/* info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-medium text-sm text-text truncate">{c.nombre}</span>
                    <span className="text-[10px] text-text-subtle shrink-0">{formatHoraCorta(c.ultimo.timestamp)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted truncate">
                      {c.ultimo.direccion === 'out' && <span className="text-text-subtle">✓ </span>}
                      {c.ultimo.mensaje || <em>(media)</em>}
                    </span>
                    {c.total > 0 && (
                      <span className="text-[10px] text-text-subtle font-mono shrink-0">{c.total}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-subtle font-mono mt-0.5 truncate">{c.telefono}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* COLUMNA: chat seleccionado */}
        <div className={cn(
          'flex-1 flex flex-col bg-surface-0',
          !selected && 'hidden md:flex',
        )}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
              <div className="text-center">
                <div className="mb-2 text-3xl opacity-30">💬</div>
                <p>Seleccioná un chat de la izquierda</p>
              </div>
            </div>
          ) : (
            <>
              {/* header chat */}
              <div className="px-4 py-3 border-b border-border bg-surface-1 flex items-center gap-3">
                {/* back en mobile */}
                <button
                  onClick={() => setSelectedLeadId(null)}
                  className="md:hidden p-1 text-text-muted hover:text-text"
                  aria-label="Volver"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold text-sm shrink-0">
                  {iniciales(selected.nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text truncate">{selected.nombre}</div>
                  <div className="text-xs text-text-muted font-mono">{selected.telefono} · {selected.lead_id}</div>
                </div>
              </div>

              {/* mensajes */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02)_0%,_transparent_70%)]">
                {selected.mensajes.map((m) => {
                  const isIn = m.direccion === 'in';
                  return (
                    <div key={m.msg_id} className={cn('flex', isIn ? 'justify-start' : 'justify-end')}>
                      <div className={cn(
                        'max-w-[80%] sm:max-w-md px-3 py-2 rounded-2xl shadow-sm',
                        isIn
                          ? 'bg-surface-2 text-text rounded-bl-md'
                          : 'bg-emerald-600/80 text-white rounded-br-md',
                      )}>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-70 mb-0.5">
                          {isIn ? <UserIcon className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          <span>{isIn ? 'Cliente' : 'Cami'}</span>
                          <span>·</span>
                          <span>{formatHoraCorta(m.timestamp)}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {m.mensaje || <em className="opacity-60">(media)</em>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
