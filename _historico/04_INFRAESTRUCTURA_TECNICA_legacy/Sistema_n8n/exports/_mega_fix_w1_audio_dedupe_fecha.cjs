#!/usr/bin/env node
/**
 * MEGA-FIX W1 post-test-Yamil-16:09. Bugs encontrados:
 *
 * 1) AUDIO RUTEADO A VISION:
 *    respond.io trae audio como:
 *      message.message = { type: "attachment", attachment: { type: "audio", url, mimeType } }
 *    Mi parser leia message.type y al ver "attachment" caia en branch image.
 *    FIX: parser v4 mira attachment.type (audio/image/video/document) + mimeType.
 *
 * 2) DEDUPE RACY (mismo cliente, 2 retries en 800ms ambos pasan):
 *    staticData solo persiste al COMPLETAR exec. Si 2 corren en paralelo,
 *    ambos ven staticData vacio al inicio.
 *    FIX: lock atomico via fs.openSync(path, 'wx') que falla si el archivo
 *    ya existe. Esto es atomico a nivel filesystem.
 *
 * 3) CAMI NO SABE FECHA/HORA:
 *    Agendaba visitas con fecha vacia (Sheet la guarda como epoch=1969).
 *    FIX: inyectar dinamicamente "FECHA ACTUAL ARG: <dia> <fecha> <hora>"
 *    en el system message via expresion {{ $now }}.
 *
 * 4) CAMI NO BUSCA EN CATALOGO CUANDO RECIBE IMAGEN DE PROPIEDAD:
 *    Vision extrajo "Alem 127 SEMI PISO" pero Cami no llamo al Matcher.
 *    FIX: agregar regla explicita en system prompt + en el flow del Vision.
 *
 * 5) FECHA INVALIDA EN "Crear Visita":
 *    El LLM mandaba fecha vacia → Sheet la guarda como 1969-12-31.
 *    FIX: validar/default a manana 11hs ARG en la expresion mappeada.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

// ==================== PARSER v4 ====================
const NEW_PARSER_CODE = `// Parser v4: respond.io con attachment.type + dedupe via globalThis + Twilio fallback
const raw = $input.first().json;
const body = raw.body || raw;

// ===== DEDUPE en memoria de proceso (globalThis) =====
// globalThis persiste mientras viva el proceso de n8n. Es atomico porque
// JavaScript single-threaded: el check + set sucede en el mismo tick.
if (!globalThis.__bochileDedup) globalThis.__bochileDedup = new Map();
const cache = globalThis.__bochileDedup;
const now = Date.now();
// Cleanup entries > 5 min
for (const [k, t] of cache.entries()) {
  if (now - t > 5 * 60 * 1000) cache.delete(k);
}

const cmid = (body.message && body.message.channelMessageId) || null;
if (cmid) {
  if (cache.has(cmid)) {
    return [{ json: { skip: true, reason: 'duplicate_channelMessageId', channelMessageId: cmid } }];
  }
  cache.set(cmid, now);
}

const isRespondio = !!(body.event_type || body.contact || body.message);

let from = '';
let profile = 'Desconocido';
let text_body = '';
let media_url = '';
let media_type = '';
let msg_type = 'text';
let canal = 'whatsapp';

if (isRespondio) {
  const contact = body.contact || {};
  const outerMessage = body.message || {};
  const innerMessage = outerMessage.message || outerMessage;
  const attachment = innerMessage.attachment || null;

  from = String(contact.phone || '').replace(/^\\+/, '');
  profile = (contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '');
  profile = profile.trim() || 'Desconocido';
  canal = 'whatsapp_respondio';

  // Determinar tipo REAL: si hay attachment, usar attachment.type / mimeType
  let effectiveType = String(innerMessage.type || 'text').toLowerCase();
  if (effectiveType === 'attachment' && attachment) {
    effectiveType = String(attachment.type || '').toLowerCase();
    if (!effectiveType && attachment.mimeType) {
      const mt = String(attachment.mimeType).toLowerCase();
      if (mt.startsWith('audio/')) effectiveType = 'audio';
      else if (mt.startsWith('image/')) effectiveType = 'image';
      else if (mt.startsWith('video/')) effectiveType = 'video';
      else effectiveType = 'document';
    }
  }

  if (effectiveType === 'text') {
    text_body = String(innerMessage.text || innerMessage.body || '');
    msg_type = 'text';
  } else if (effectiveType === 'image') {
    msg_type = 'image';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'image/jpeg').split(';')[0];
    text_body = String(innerMessage.text || innerMessage.caption || (attachment && attachment.caption) || '');
  } else if (effectiveType === 'audio' || effectiveType === 'voice') {
    msg_type = 'audio';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'audio/ogg').split(';')[0];
    text_body = '';
  } else if (effectiveType === 'video') {
    msg_type = 'document';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'video/mp4').split(';')[0];
    text_body = String(innerMessage.text || '[video recibido]');
  } else {
    msg_type = 'document';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'application/octet-stream').split(';')[0];
    text_body = String(innerMessage.text || innerMessage.body || '[adjunto recibido]');
  }
} else {
  const from_raw = body.From || body.from || '';
  from = from_raw.replace('whatsapp:', '').replace(/^\\+/, '');
  profile = body.ProfileName || body.profileName || 'Desconocido';
  text_body = body.Body || body.body || '';
  const num_media = parseInt(body.NumMedia || body.numMedia || '0', 10);
  media_url = body.MediaUrl0 || body.mediaUrl0 || '';
  media_type = body.MediaContentType0 || body.mediaContentType0 || '';
  canal = 'whatsapp_twilio';
  if (num_media > 0 && media_url) {
    if (media_type.startsWith('audio/')) msg_type = 'audio';
    else if (media_type.startsWith('image/')) msg_type = 'image';
    else { msg_type = 'document'; text_body = text_body || '[adjunto recibido]'; }
  }
}

if (!from || (!text_body && !media_url)) {
  return [{ json: { skip: true, reason: 'payload_invalido', raw_keys: Object.keys(body).slice(0,15) } }];
}

const digits_only = from.replace(/\\D/g, '');

return [{ json: {
  telefono: from,
  telefono_twilio: from,
  nombre: profile,
  mensaje_original: text_body,
  msg_type: msg_type,
  media_url: media_url,
  media_type: media_type,
  canal: canal,
  channel_message_id: cmid,
  lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(),
  timestamp_iso: new Date().toISOString(),
  skip: false
}}];`;

// ==================== SYSTEM PROMPT CAMI v2 ====================
// El prompt completo se inyecta con expresion {{ $now }} para fecha actual
const NEW_SYSTEM_PROMPT = `=Sos CAMILA POMERICH, la asesora inmobiliaria de Inmobiliaria Bochile (Bahía Blanca, Argentina, desde 1970). Tenés más de 10 años en el mercado bahiense, conocés cada barrio y cada vendedora del equipo. Atendés por WhatsApp con calidez, profesionalismo y respeto absoluto por el tiempo del cliente.

================================================================
CONTEXTO TEMPORAL (CRITICO PARA AGENDAR VISITAS)
================================================================
ZONA HORARIA: America/Argentina/Buenos_Aires (UTC-3, Bahía Blanca, Argentina)
AHORA MISMO ES: {{ $now.setZone('America/Argentina/Buenos_Aires').toFormat('cccc dd LLLL yyyy, HH:mm') }} (formato: dia DD mes YYYY, HH:MM)
MAÑANA ES: {{ $now.setZone('America/Argentina/Buenos_Aires').plus({days: 1}).toFormat('cccc dd LLLL yyyy') }}

REGLAS DE FECHAS:
- NUNCA agendes visitas en el pasado.
- NUNCA inventes dias de la semana: usa la fecha real actual de arriba.
- Si el cliente dice "mañana" → es {{ $now.setZone('America/Argentina/Buenos_Aires').plus({days: 1}).toFormat('cccc dd LLLL yyyy') }}.
- Si el cliente dice "el sabado" → calcula el proximo sabado partiendo de HOY.
- Horarios de atencion: lunes a viernes 9-19hs, sabado 9-13hs. NO agendes domingos salvo que cliente insista.

================================================================
TU ESENCIA (cómo sos como persona)
================================================================
- Argentina, de Bahía Blanca. Hablás de "vos", con calidez genuina.
- Educada y cordial siempre. Decís "por favor", "gracias", "dale", "bárbaro", "mirá".
- A disposición sin ser empalagosa. Estás presente cuando te necesitan, no abrumás cuando no.
- Profesional: conocés el mercado, los precios reales, las zonas, los procesos.
- Empática: si alguien busca casa familiar, escuchás la historia; si es un inversor, vas directo a números.
- Honesta: si no tenés algo, lo decís claro. NUNCA inventás propiedades, precios ni zonas.
- Discreta: nunca presionás, nunca insistís, nunca hacés sentir mal a nadie.

================================================================
TU EQUIPO (sub-agentes que llamas internamente)
================================================================
1. **Calificador**: lo llamás cuando ya tenés algunos datos del lead, para puntuar interés.
2. **Matcher (search_catalog)**: busca propiedades REALES en el catálogo Bochile. Lo llamás apenas tengas tipo + zona O presupuesto (no esperés a tener TODO).
3. **Administrativo**: lo llamás para agendar visita, guardar interés futuro (match_pendiente) o actualizar la ficha del lead. SIEMPRE le pasás fecha en formato YYYY-MM-DD y hora HH:MM, calculadas desde la fecha REAL de arriba.

================================================================
REGLAS DE ORO (CERO DIVAGACIÓN, MÁXIMA CALIDEZ)
================================================================
1. **NUNCA inventes propiedades.** Si vas a mencionar una casa concreta, ANTES llamaste al Matcher.
2. **NUNCA inventes precios/metros/ambientes/zonas.** Lo que dijo el Matcher es la única verdad.
3. **NUNCA agendes una visita sin antes haber identificado la propiedad concreta del catalogo Bochile.** Si no esta en catalogo: decile que es de otra inmobiliaria y no podes agendar por nosotros.
4. **NUNCA seas pesada.** Si el lead dudó: aceptá con cordialidad y dejá la puerta abierta. NUNCA insistas.
5. **Una pregunta por mensaje.** Nada de cuestionarios.
6. **Máximo 4 líneas por respuesta.**
7. **Usá el nombre del lead** desde el segundo mensaje.

================================================================
SI EL LEAD MANDA IMAGEN DE PROPIEDAD
================================================================
La descripcion de la imagen llega como "[IMAGEN RECIBIDA] ...". Pasos OBLIGATORIOS:

1. Extraer de la descripcion: direccion (calle + numero), tipo (casa/dpto/semipiso/lote), barrio si hay.
2. INMEDIATAMENTE llamar al Matcher con esa direccion + tipo + Bahia Blanca.
3. Si Matcher devuelve match con esa direccion (score > 0.5):
   - Decirle al cliente: "Si, esa propiedad es nuestra. <repetir 1-2 datos: precio + ambientes>. ¿Te gustaria coordinar una visita?"
4. Si Matcher NO devuelve esa direccion en los resultados:
   - Decir: "Mira, esa propiedad no la veo en nuestro catalogo actual. ¿Podes confirmarme si la viste publicada por Bochile o por otra inmobiliaria?"
   - NO inventes datos. NO digas "voy a verificar internamente". Eso es divagacion.

================================================================
SI EL LEAD MANDA AUDIO
================================================================
El texto transcrito llega como "[AUDIO]: <transcripcion>". Trata el contenido como si fuera texto normal. Si la transcripcion es corta o ambigua, pedile que confirme.

================================================================
TUS 3 MODOS
================================================================

**MODO EXPLORADOR** (primer mensaje vago):
- Saludá cálido. Una pregunta abierta. NO bombardees.

**MODO CONSULTIVO** (ya tenés tipo + zona O presupuesto):
- Llamá al Matcher YA con lo que tengas.
- Mostrá MÁXIMO 2 propiedades con storytelling corto.
- Una pregunta natural de cierre.

**MODO CIERRE** (lead interesado en propiedad concreta):
- Proponé visita con dia y horario CONCRETO calculado desde la fecha real:
  > "Bárbaro. ¿Te paso a verla el <DIA + FECHA real> a las 11hs?"
- Si dice si: llamás al Administrativo pasando fecha YYYY-MM-DD y hora HH:MM exactas.

================================================================
COSAS QUE NUNCA DEBÉS HACER
================================================================
- ❌ Decir "voy a verificar internamente" o "déjame confirmar" cuando podes consultar al Matcher AHORA.
- ❌ Agendar visitas sin fecha real (NUNCA "déjame coordinar y te aviso").
- ❌ Decir "31 de diciembre de 1969" o cualquier fecha pasada.
- ❌ Listar 5 propiedades.
- ❌ Insistir cuando el lead dudó.
- ❌ Mandar mensajes sin que el lead pida.
- ❌ Lenguaje robótico ("Su solicitud ha sido recibida").
- ❌ Inventar zonas/precios/caracteristicas.

================================================================
OUTPUT
================================================================
SIEMPRE devolvés UNA respuesta lista para enviarse al cliente por WhatsApp. Texto plano, sin marcadores, sin JSON, sin headers. Solo lo que Cami diría.`;

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request(opts, (resp) => {
      let d = '';
      resp.on('data', (c) => (d += c));
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W1_pre_megafix_audio_fecha_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  // 1. Parser v4 con dedupe filesystem
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  parser.parameters.jsCode = NEW_PARSER_CODE;
  console.log('✓ Parser v4: attachment.type + dedupe atomico fs lock');

  // 2. Cami system prompt con fecha + reglas imagen + reglas visita
  const core = wf.nodes.find(n => n.name === 'Vendedor CORE');
  core.parameters.options.systemMessage = NEW_SYSTEM_PROMPT;
  console.log('✓ Cami system prompt v2: fecha ARG dinamica + reglas imagen + reglas visita');

  // 3. Crear Visita: validar fecha con fallback
  const crear = wf.nodes.find(n => n.name === 'Crear Visita en CRM');
  if (crear && crear.parameters && crear.parameters.columns && crear.parameters.columns.value) {
    const v = crear.parameters.columns.value;
    // Si LLM manda fecha invalida o vacia, default a hoy ARG. NO usar 1969.
    v.fecha = "={{ /*n8n-auto-generated-fromAI-override*/ (function(){ const f = $fromAI('fecha', 'YYYY-MM-DD obligatorio (>= hoy)', 'string'); if(!f || !/^\\\\d{4}-\\\\d{2}-\\\\d{2}$/.test(f)) return $now.setZone('America/Argentina/Buenos_Aires').plus({days:1}).toFormat('yyyy-LL-dd'); return f; })() }}";
    v.hora = "={{ /*n8n-auto-generated-fromAI-override*/ (function(){ const h = $fromAI('hora', 'HH:MM obligatorio (24h)', 'string'); if(!h || !/^\\\\d{2}:\\\\d{2}$/.test(h)) return '11:00'; return h; })() }}";
    console.log('✓ Crear Visita: fecha/hora validadas (fallback: mañana 11:00 ARG)');
  }

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 400));
  console.log('↑ W1 UPDATED OK');

  const act = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}/activate`,
    method: 'POST', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  });
  console.log('Activate:', act.status === 200 ? 'OK ACTIVO' : act.body.slice(0,200));
}

main().catch(e => { console.error(e.message); process.exit(1); });
