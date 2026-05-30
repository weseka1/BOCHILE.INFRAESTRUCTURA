import { useConversaciones } from '@/hooks/useConversaciones';
import { PageHeader } from '@/components/ui/PageHeader';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, User as UserIcon, Bot, ShoppingBag, Key, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversacion } from '@/types/domain';

// ====== Channels respond.io ======
// VENTAS_IDS son canales que mappean al tab "Ventas" del dashboard: cualquier
// numero de WA donde Cami responda como vendedora. 508111 es el WA personal
// de Yamil conectado para que el equipo Bochile (Camila + Yamil) pueda probar
// el bot como cliente — funciona identico a Ventas.
const VENTAS_IDS = ['506217', '508111'];
const CHANNELS = {
  ventas: { id: VENTAS_IDS[0], label: 'Ventas', icon: ShoppingBag, color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  alquileres: { id: '508045', label: 'Alquileres', icon: Key, color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
} as const;
type ChannelKey = keyof typeof CHANNELS | 'sin_clasificar' | 'todos';

function classifyChannel(id: string | undefined | number): Exclude<ChannelKey, 'todos'> {
  const s = String(id || '').trim();
  if (VENTAS_IDS.includes(s)) return 'ventas';
  if (s === CHANNELS.alquileres.id) return 'alquileres';
  return 'sin_clasificar';
}

interface Chat {
  lead_id: string;
  nombre: string;
  telefono: string;
  channel: Exclude<ChannelKey, 'todos'>;
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

const chatKey = (leadId: string, channel: string) => `${leadId}::${channel}`;

export function ConversacionesPage() {
  const { data, isLoading, error } = useConversaciones();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  // selectedKey: 'lead_id::channel'. Soporta retrocompat con ?lead=X (sin canal).
  const initialKey = (() => {
    const lead = searchParams.get('lead');
    const ch = searchParams.get('canal');
    if (!lead) return null;
    return ch ? chatKey(lead, ch) : lead; // si no hay canal, dejamos solo lead (se resuelve abajo)
  })();
  const [selectedKey, setSelectedKey] = useState<string | null>(initialKey);
  const [tab, setTab] = useState<ChannelKey>((searchParams.get('tab') as ChannelKey) || 'ventas');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync ?tab=X
  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    if (tab && tab !== 'todos') p.set('tab', tab); else p.delete('tab');
    setSearchParams(p, { replace: true });
  }, [tab]);

  // Sync ?lead=X&canal=Y cuando cambia la seleccion
  useEffect(() => {
    const p = new URLSearchParams(searchParams);
    if (selectedKey && selectedKey.includes('::')) {
      const [lead, ch] = selectedKey.split('::');
      p.set('lead', lead);
      p.set('canal', ch);
    } else if (selectedKey) {
      p.set('lead', selectedKey);
      p.delete('canal');
    } else {
      p.delete('lead');
      p.delete('canal');
    }
    setSearchParams(p, { replace: true });
  }, [selectedKey]);

  // Agrupar por (lead_id, channel). Cada combinacion es un chat distinto:
  // un mismo cliente que escribio al WA de Ventas Y al de Alquileres aparece
  // como dos chats separados — los canales NO se mezclan jamas. En particular,
  // los mensajes de Cami (Ventas) nunca aparecen en el chat de Alquileres.
  const chats: Chat[] = useMemo(() => {
    const all = (data ?? []) as Conversacion[];
    const map = new Map<string, Chat>();
    for (const m of all) {
      if (!m.lead_id) continue;
      const ch = classifyChannel((m as any).channel_id);
      const key = `${m.lead_id}::${ch}`;
      const c = map.get(key);
      if (!c) {
        map.set(key, {
          lead_id: m.lead_id,
          nombre: (m as any).nombre || m.lead_id,
          telefono: m.telefono || '',
          channel: ch,
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
    for (const c of map.values()) {
      c.mensajes.sort((a, b) => tsToMs(a.timestamp) - tsToMs(b.timestamp));
    }
    return Array.from(map.values()).sort((a, b) => tsToMs(b.ultimo.timestamp) - tsToMs(a.ultimo.timestamp));
  }, [data]);

  // Contadores por channel — Alquileres oculto del dashboard a pedido del cliente.
  // El conteo "todos" excluye alquileres para que no infle la vista diaria.
  const tabCounts = useMemo(() => ({
    todos: chats.filter(c => c.channel !== 'alquileres').length,
    ventas: chats.filter(c => c.channel === 'ventas').length,
    alquileres: chats.filter(c => c.channel === 'alquileres').length,
    sin_clasificar: chats.filter(c => c.channel === 'sin_clasificar').length,
  }), [chats]);

  // Si el tab guardado en URL es 'alquileres' (tab oculto), forzar 'ventas'.
  useEffect(() => {
    if (tab === 'alquileres') setTab('ventas');
  }, [tab]);

  // Filtro: por tab + por busqueda. En "todos" excluimos alquileres tambien.
  const filteredChats = useMemo(() => {
    let arr = tab === 'todos'
      ? chats.filter(c => c.channel !== 'alquileres')
      : chats.filter(c => c.channel === tab);
    if (q) {
      const ql = q.toLowerCase();
      arr = arr.filter(c =>
        String(c.nombre || '').toLowerCase().includes(ql) ||
        String(c.telefono || '').includes(q) ||
        String(c.lead_id || '').toLowerCase().includes(ql) ||
        String(c.ultimo.mensaje || '').toLowerCase().includes(ql),
      );
    }
    return arr;
  }, [chats, q, tab]);

  // Buscamos el chat por la clave compuesta (lead_id::channel).
  // Si la URL trae solo ?lead (retrocompat o link viejo), resolvemos al chat
  // mas reciente para ese lead que matchee el tab activo.
  const selected = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey.includes('::')) {
      const [lead, ch] = selectedKey.split('::');
      return chats.find(c => c.lead_id === lead && c.channel === ch) || null;
    }
    const matches = chats.filter(c => c.lead_id === selectedKey);
    if (matches.length === 0) return null;
    if (tab !== 'todos') {
      const m = matches.find(c => c.channel === tab);
      if (m) return m;
    }
    return matches[0];
  }, [chats, selectedKey, tab]);

  // Auto-scroll al final cuando abre un chat
  useEffect(() => {
    if (selected) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
    }
  }, [selectedKey]);

  if (isLoading) return <div className="text-text-muted">Cargando...</div>;
  if (error) return <div className="text-rose-400">Error: {(error as Error).message}</div>;

  return (
    <>
      <PageHeader title="Mensajes" subtitle="Chats por WhatsApp" count={filteredChats.length} />

      {/* Tabs por canal — Alquileres ocultado del dashboard a pedido del cliente.
          Los mensajes siguen logueandose al Sheet (no se pierde data), solo
          no se ven aca para no saturar la vista diaria. */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <TabButton k="ventas" tab={tab} setTab={setTab} count={tabCounts.ventas} setSelected={setSelectedKey} />
        {tabCounts.sin_clasificar > 0 && (
          <TabButton k="sin_clasificar" tab={tab} setTab={setTab} count={tabCounts.sin_clasificar} setSelected={setSelectedKey} />
        )}
        <TabButton k="todos" tab={tab} setTab={setTab} count={tabCounts.todos} setSelected={setSelectedKey} />
      </div>

      {/* Layout WhatsApp: lista a la izq + chat a la der */}
      <div className="card overflow-hidden h-[calc(100vh-220px)] sm:h-[calc(100vh-260px)] min-h-[420px] flex">
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
            ) : filteredChats.map((c) => {
              const ck = chatKey(c.lead_id, c.channel);
              return (
              <button
                key={ck}
                onClick={() => setSelectedKey(ck)}
                className={cn(
                  'w-full text-left px-3 py-3 border-b border-border/50 hover:bg-surface-2 transition-colors flex gap-3 items-start',
                  selectedKey === ck && 'bg-surface-2',
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
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[10px] text-text-subtle font-mono truncate">{c.telefono}</span>
                    {c.channel !== 'sin_clasificar' && <ChannelChip channel={c.channel} small />}
                  </div>
                </div>
              </button>
              );
            })}
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
                  onClick={() => setSelectedKey(null)}
                  className="md:hidden p-1 text-text-muted hover:text-text"
                  aria-label="Volver"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold text-sm shrink-0">
                  {iniciales(selected.nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text truncate flex items-center gap-2">
                    <span>{selected.nombre}</span>
                    {selected.channel !== 'sin_clasificar' && <ChannelChip channel={selected.channel} />}
                  </div>
                  <div className="text-xs text-text-muted font-mono">{selected.telefono} · {selected.lead_id}</div>
                </div>
              </div>

              {/* mensajes */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02)_0%,_transparent_70%)]">
                {selected.mensajes.map((m) => {
                  const isIn = m.direccion === 'in';
                  const tipo = (m as any).msg_type || 'text';
                  const mediaUrl = (m as any).media_url || '';
                  const esHumano = !isIn && (m.canal === 'whatsapp_humano' || /humana/i.test(m.agente_que_respondio || ''));
                  return (
                    <div key={m.msg_id} className={cn('flex', isIn ? 'justify-start' : 'justify-end')}>
                      <div className={cn(
                        'max-w-[80%] sm:max-w-md px-3 py-2 rounded-2xl shadow-sm',
                        isIn
                          ? 'bg-surface-2 text-text rounded-bl-md'
                          : esHumano
                            ? 'bg-purple-600/80 text-white rounded-br-md'
                            : 'bg-emerald-600/80 text-white rounded-br-md',
                      )}>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-70 mb-1">
                          {isIn ? <UserIcon className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          <span>{isIn ? 'Cliente' : esHumano ? 'Humana' : 'Cami'}</span>
                          {tipo !== 'text' && (
                            <>
                              <span>·</span>
                              <span className="uppercase font-mono">{tipo}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{formatHoraCorta(m.timestamp)}</span>
                        </div>

                        {/* Audio */}
                        {tipo === 'audio' && mediaUrl && (
                          <audio
                            controls
                            preload="none"
                            src={mediaUrl}
                            className="w-full max-w-[280px] mb-1.5"
                            style={{ height: 36 }}
                          >
                            tu navegador no soporta audio
                          </audio>
                        )}

                        {/* Imagen */}
                        {tipo === 'image' && mediaUrl && (
                          <a href={mediaUrl} target="_blank" rel="noreferrer" className="block mb-1.5">
                            <img
                              src={mediaUrl}
                              alt="adjunto"
                              className="max-w-[280px] max-h-[300px] rounded-lg object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </a>
                        )}

                        {/* Documento/video u otro media: link */}
                        {(tipo === 'document' || (tipo !== 'text' && tipo !== 'audio' && tipo !== 'image')) && mediaUrl && (
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline opacity-80 mb-1.5 block break-all"
                          >
                            {tipo === 'document' ? 'Ver documento' : 'Abrir adjunto'}
                          </a>
                        )}

                        {/* Texto (mensaje o transcripcion) */}
                        {m.mensaje && (
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {m.mensaje}
                          </div>
                        )}
                        {!m.mensaje && !mediaUrl && (
                          <em className="opacity-60 text-sm">(vacio)</em>
                        )}
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

// ====== Tab por canal ======
function TabButton({
  k, tab, setTab, count, setSelected,
}: {
  k: ChannelKey; tab: ChannelKey;
  setTab: (k: ChannelKey) => void;
  count: number;
  setSelected: (id: string | null) => void;
}) {
  const isActive = tab === k;
  const label =
    k === 'ventas' ? 'Ventas' :
    k === 'alquileres' ? 'Alquileres' :
    k === 'sin_clasificar' ? 'Sin clasificar' :
    'Todos';
  const Icon =
    k === 'ventas' ? ShoppingBag :
    k === 'alquileres' ? Key :
    Inbox;
  const colorClass =
    k === 'ventas' ? 'border-emerald-500/50 text-emerald-300 bg-emerald-500/10' :
    k === 'alquileres' ? 'border-blue-500/50 text-blue-300 bg-blue-500/10' :
    'border-accent/50 text-accent bg-accent/10';
  return (
    <button
      type="button"
      onClick={() => { setTab(k); setSelected(null); }}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all',
        isActive
          ? colorClass
          : 'border-border text-text-muted hover:text-text hover:bg-surface-2',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-medium">{label}</span>
      <span className={cn(
        'text-[10px] font-mono px-1.5 py-0.5 rounded',
        isActive ? 'bg-black/30' : 'bg-surface-2',
      )}>{count}</span>
    </button>
  );
}

// ====== Chip badge de canal en lista ======
function ChannelChip({ channel, small }: { channel: 'ventas' | 'alquileres'; small?: boolean }) {
  const c = CHANNELS[channel];
  const Icon = c.icon;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded font-medium border',
      c.color, c.bg, c.border,
      small ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5',
    )}>
      <Icon className={small ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      <span className="uppercase tracking-wider">{c.label}</span>
    </span>
  );
}
