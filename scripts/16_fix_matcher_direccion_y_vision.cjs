// FIX CRITICO:
// 1. Sub-workflow Bochile RAG Search: si query contiene direccion (num), NO aplicar filtros estrictos
// 2. systemMessage CORE: regla "si cliente da direccion, pasar SOLO query al Matcher"
// 3. SubAgente Matcher prompt: mismo
// 4. Parser: capturar attachment.description (caption WhatsApp)
// 5. Vision LLM: extraer TEXTO visible de la imagen (OCR-like)
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

// Nuevo code para "Call RAG and Format" en el sub-workflow
const NEW_SUB_CODE = `// Sub-workflow Bochile RAG Search v2: respeta direcciones especificas sin filtros estrictos
const RAG_URL = 'https://rag-bochile.onrender.com/api/search';
const inp = $input.first().json || {};
const q = String(inp.query || '').trim();
if (!q) return [{ json: { result: 'ERROR: query es obligatorio' } }];

// Detectar si la query contiene una direccion especifica (numero + calle)
// Ej: "Sarmiento 343", "Alem 127", "San Martin 566"
const tieneDireccion = /\\b\\d{2,5}\\b/.test(q);

const opMap = { venta:'sale', vender:'sale', vende:'sale', comprar:'sale', sale:'sale',
  alquiler:'rent', alquilar:'rent', alquila:'rent', renta:'rent', rent:'rent' };
const ptMap = { depto:'departamento', dept:'departamento', terreno:'lote',
  deposito:'galpon', 'depósito':'galpon', chacra:'campo', estancia:'campo',
  garage:'cochera' };

const filters = {};

// Si hay direccion en la query, NO aplicar filtros estrictos (solo busqueda semantica)
if (!tieneDireccion) {
  filters.with_image = true;
  const op = (opMap[String(inp.operation || '').toLowerCase()] || inp.operation || '').toString();
  if (op === 'sale' || op === 'rent') filters.operation = op;
  const pt = (ptMap[String(inp.property_type || '').toLowerCase()] || inp.property_type || '').toString();
  if (pt) filters.property_type = pt;
  const pc = String(inp.price_currency || '').toUpperCase();
  if (pc === 'USD' || pc === 'ARS') filters.price_currency = pc;
  if (Number(inp.price_max) > 0) filters.price_max = Number(inp.price_max);
  if (Number(inp.bedrooms_min) > 0) filters.bedrooms_min = Number(inp.bedrooms_min);
}

const body = { query: q, limit: 5, filters };

let data;
try {
  data = await this.helpers.httpRequest({
    method: 'POST',
    url: RAG_URL,
    headers: { 'Content-Type': 'application/json' },
    body,
    json: true,
  });
} catch (err) {
  return [{ json: { result: 'ERROR_RAG: ' + (err.message || err).slice(0, 200) } }];
}

if (!data || !data.items || data.items.length === 0) {
  return [{ json: { result: 'SIN_STOCK | criterios: ' + JSON.stringify(filters) + ' | query: ' + q } }];
}

const lines = data.items.map(function(p, i) {
  const precio = p.price ? p.price + ' ' + (p.price_currency || '') : (p.price_text || 'Consultar');
  const ubic = (p.barrio && p.barrio !== 'unknown') ? p.barrio : (p.address || p.zona || 'Bahia Blanca');
  return (i+1) + '. [' + p.prop_id + '] ' + p.title
    + ' | ' + (p.property_type || '?')
    + ' | ' + ubic
    + ' | ' + (p.bedrooms ? p.bedrooms + ' amb' : 'amb ?')
    + ' | ' + (p.area_m2 ? p.area_m2 + ' m2' : 'm2 ?')
    + ' | ' + precio
    + ' | URL: ' + p.url
    + ' | score: ' + p.score;
});

const modo = tieneDireccion ? 'busqueda_por_direccion' : 'busqueda_por_criterios';
return [{ json: { result: 'PROPIEDADES_ENCONTRADAS (' + data.items.length + '):\\n' + lines.join('\\n') + '\\n\\nModo: ' + modo + ' | Filtros: ' + JSON.stringify(filters) } }];`;

// Nuevo Parser que captura attachment.description
const NEW_PARSER = `// Parser v10: respondio + handoff + buffer + caption de imagen
const raw = $input.first().json;
const body = raw.body || raw;

const isRespondio = !!(body.event_type || body.contact || body.message);
let from = '';
let profile = 'Desconocido';
let text_body = '';
let media_url = '';
let media_type = '';
let msg_type = 'text';
let canal = 'whatsapp';
let contact_id_val = null;
let evento = '';
let es_humano = false;
let es_bot_propio = false;

if (isRespondio) {
  const contact = body.contact || {};
  contact_id_val = contact.id || null;
  const outerMessage = body.message || {};
  const innerMessage = outerMessage.message || outerMessage;
  const attachment = innerMessage.attachment || null;
  const sender = body.sender || {};
  evento = String(body.event_type || '');

  from = String(contact.phone || '').replace(/^\\+/, '');
  profile = (contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '');
  profile = profile.trim() || 'Desconocido';
  canal = 'whatsapp_respondio';

  if (evento === 'message.sent' || evento === 'message_sent') {
    const src = String(sender.source || '').toLowerCase();
    if (src === 'user' || src === 'agent' || (sender.userId && src !== 'bot' && src !== 'api')) {
      es_humano = true;
    } else {
      es_bot_propio = true;
    }
  }

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

  // CAPTION: respond.io lo manda en attachment.description, .caption O en innerMessage.text
  function getCaption() {
    const candidates = [
      attachment && attachment.caption,
      attachment && attachment.description,
      innerMessage.caption,
      innerMessage.text,
      innerMessage.body
    ];
    for (const c of candidates) {
      if (c && String(c).trim()) return String(c).trim();
    }
    return '';
  }

  if (effectiveType === 'text') {
    text_body = String(innerMessage.text || innerMessage.body || '');
    msg_type = 'text';
  } else if (effectiveType === 'image') {
    msg_type = 'image';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'image/jpeg').split(';')[0];
    text_body = getCaption();
  } else if (effectiveType === 'audio' || effectiveType === 'voice') {
    msg_type = 'audio';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'audio/ogg').split(';')[0];
    text_body = '';
  } else if (effectiveType === 'video') {
    msg_type = 'document';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'video/mp4').split(';')[0];
    text_body = getCaption() || '[video recibido]';
  } else {
    msg_type = 'document';
    media_url = String((attachment && attachment.url) || innerMessage.url || '');
    media_type = String((attachment && attachment.mimeType) || 'application/octet-stream').split(';')[0];
    text_body = getCaption() || '[adjunto recibido]';
  }
} else {
  const from_raw = body.From || body.from || '';
  from = from_raw.replace('whatsapp:', '').replace(/^\\+/, '');
  profile = body.ProfileName || body.profileName || 'Desconocido';
  text_body = body.Body || body.body || '';
  canal = 'whatsapp_twilio';
}

if (!from) return [{ json: { skip: true, reason: 'sin_from' } }];
if (es_bot_propio) return [{ json: { skip: true, reason: 'bot_propio_no_procesar' } }];
if (es_humano) {
  const digits = from.replace(/\\D/g, '');
  return [{ json: { skip: true, reason: 'humano_respondio', mark_pausa: true, telefono: from, contact_id: contact_id_val, lead_id: 'L-' + digits.slice(-10), msg_humano: text_body.slice(0, 200) } }];
}
if (!text_body && !media_url) return [{ json: { skip: true, reason: 'payload_invalido' } }];

const cmid = (body.message && body.message.channelMessageId) || ('GEN-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
const digits_only = from.replace(/\\D/g, '');
const my_ts = Date.now();

try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://rag-bochile.onrender.com/api/buffer/add',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: from, cmid, ts: my_ts, msg_type, text: text_body, media_url, media_type, profile, lead_id: 'L-' + digits_only.slice(-10) },
    json: true,
  });
} catch (err) { console.log('[parser] buffer/add error:', err.message); }

return [{ json: {
  telefono: from, contact_id: contact_id_val, nombre: profile,
  mensaje_original: text_body, msg_type, media_url, media_type,
  canal, channel_message_id: cmid, lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(), timestamp_iso: new Date().toISOString(), _my_ts: my_ts,
  skip: false, mark_pausa: false
}}];`;

const VISION_PROMPT_NEW = "Sos un asistente experto de Inmobiliaria Bochile (Bahia Blanca). Analiza esta foto y devolve EN FORMATO ESTRUCTURADO:\n\n1. TIPO: [propiedad-foto-real | propiedad-screenshot-listing | plano | documento | otro]\n2. TEXTO_VISIBLE: cualquier texto que aparezca en la imagen (direcciones, titulos, precios, m2, etc.) - copialo TAL CUAL\n3. DESCRIPCION: 1-2 lineas describiendo lo visual (estilo, ambientes, materiales, estado)\n4. DIRECCION_DETECTADA: si en TEXTO_VISIBLE hay una direccion concreta (ej. 'Sarmiento 343', 'Alem 127'), copiala aca. Sino 'NO_DETECTADA'.\n\nFormato exacto:\nTIPO: ...\nTEXTO_VISIBLE: ...\nDESCRIPCION: ...\nDIRECCION_DETECTADA: ...";

(async () => {
  // 1. Update sub-workflow RAG Search
  const wfs = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  const sub = wfs.find(w => w.name.includes('RAG Search'));
  if (sub) {
    const full = JSON.parse((await req('GET', '/api/v1/workflows/' + sub.id)).b);
    const codeNode = full.nodes.find(n => n.name === 'Call RAG and Format');
    if (codeNode) {
      codeNode.parameters.jsCode = NEW_SUB_CODE;
      const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
      const s = {};
      if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
      if (!s.executionOrder) s.executionOrder = 'v1';
      s.timezone = 'America/Argentina/Buenos_Aires';
      const upd = await req('PUT', '/api/v1/workflows/' + sub.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
      await req('POST', '/api/v1/workflows/' + sub.id + '/activate');
      console.log('SUB updated:', upd.s);
    }
  }

  // 2. Update W1: Parser + Vision prompt + CORE prompt
  const w1 = wfs.find(w => w.name.includes('CORE'));
  const full = JSON.parse((await req('GET', '/api/v1/workflows/' + w1.id)).b);

  // 2a. Parser nuevo
  const parser = full.nodes.find(n => n.name === 'Parsear Mensaje');
  if (parser) parser.parameters.jsCode = NEW_PARSER;

  // 2b. Vision prompt mejorado
  const vision = full.nodes.find(n => n.name === 'Imagen - Vision');
  if (vision) vision.parameters.text = VISION_PROMPT_NEW;

  // 2c. CORE: agregar regla critica direcciones
  const core = full.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = core.parameters.options.systemMessage;
  const MARK_DIR = 'REGLA CRITICA - DIRECCIONES Y MATCHER';
  if (!sm.includes(MARK_DIR)) {
    sm = sm + '\n\n================================================================\n' + MARK_DIR + '\n================================================================\n' +
      'Si el cliente da una DIRECCION ESPECIFICA (calle + numero, ej. "Sarmiento 343", "Alem 127", "San Martin 566"):\n' +
      '1. Llama al Matcher PASANDO SOLO ESA QUERY (sin filtros de price/type/operation).\n' +
      '2. El Matcher detecta que es direccion y busca por similitud semantica pura.\n' +
      '3. Si devuelve resultados, muestra la propiedad encontrada con sus detalles.\n' +
      '4. JAMAS digas "no tengo esa direccion" sin antes haber llamado al Matcher con esa query exacta.\n\n' +
      'Si llega una IMAGEN con DIRECCION_DETECTADA en el output del Vision, USA esa direccion como query al Matcher.\n' +
      'Si llega una IMAGEN con TEXTO_VISIBLE que menciona una calle especifica, USA ese texto como query.\n';
    core.parameters.options.systemMessage = sm;
  }

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + w1.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
  await req('POST', '/api/v1/workflows/' + w1.id + '/activate');
  console.log('W1 updated:', upd.s, '| systemMessage:', sm.length, 'chars');
})();
