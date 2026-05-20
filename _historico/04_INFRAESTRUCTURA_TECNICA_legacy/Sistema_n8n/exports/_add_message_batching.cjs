#!/usr/bin/env node
/**
 * MEGA-REDISEÑO W1: agregar batching humano de mensajes.
 *
 * PROBLEMA: respond.io manda 2 webhooks por mensaje (confirmado: mismo
 * channelMessageId en exec 3267 y 3271). Resultado: Cami responde 2 veces.
 * Ademas el usuario quiere que si manda 3 msgs en 5s, Cami responda UNA
 * vez con todo en cuenta (como humano).
 *
 * ARQUITECTURA:
 *   Webhook → Parser+Buffer → Wait 7s → Consolidate/Skip → Switch → ...
 *
 *   Parser+Buffer:
 *     - Parsea el msg
 *     - Lo agrega al staticData.pending[telefono] (deduped por channel_message_id)
 *     - Retorna el msg con un "_my_ts" (timestamp para luego decidir si soy el ultimo)
 *
 *   Wait 7s:
 *     - Pausa la exec. n8n FLUSHEA staticData al pausar.
 *     - Cuando 2 webhooks duplicados llegan, ambos llegan al Wait casi simultaneo.
 *     - Despues de 7s, ambos resumen.
 *
 *   Consolidate/Skip:
 *     - Lee staticData.pending[telefono]
 *     - Encuentra el msg con max ts (el ultimo del usuario)
 *     - Si mi _my_ts != max ts → return [] (skip, otra exec se encarga)
 *     - Si mi _my_ts == max ts → consolido texto de TODOS los msgs pending, clear buffer, return UN solo msg con texto consolidado
 *     - Para audio/image: si soy el ultimo y soy media, proceso solo (ignoro textos pendings — son contexto que vendra despues)
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

const NEW_PARSER_CODE = `// Parser v5: parsear + escribir al buffer + retornar (deduplica por channel_message_id)
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

if (isRespondio) {
  const contact = body.contact || {};
  const outerMessage = body.message || {};
  const innerMessage = outerMessage.message || outerMessage;
  const attachment = innerMessage.attachment || null;

  from = String(contact.phone || '').replace(/^\\+/, '');
  profile = (contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '');
  profile = profile.trim() || 'Desconocido';
  canal = 'whatsapp_respondio';

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

const cmid = (body.message && body.message.channelMessageId) || ('GEN-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
const digits_only = from.replace(/\\D/g, '');
const my_ts = Date.now();

// ===== Escribir al buffer (deduped por channel_message_id) =====
const sd = $getWorkflowStaticData('global');
sd.pendingByPhone = sd.pendingByPhone || {};
sd.pendingByPhone[from] = sd.pendingByPhone[from] || [];
const already = sd.pendingByPhone[from].some(m => m.cmid === cmid);
if (!already) {
  sd.pendingByPhone[from].push({
    cmid, ts: my_ts, msg_type, text: text_body,
    media_url, media_type, profile, lead_id: 'L-' + digits_only.slice(-10)
  });
}

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
  _my_ts: my_ts,
  skip: false
}}];`;

const CONSOLIDATE_CODE = `// Despues del Wait: decido si soy el ultimo y consolido
const input = $input.first().json;
const phone = input.telefono;
const my_ts = input._my_ts;
const my_type = input.msg_type;

const sd = $getWorkflowStaticData('global');
const buffer = (sd.pendingByPhone && sd.pendingByPhone[phone]) || [];

if (buffer.length === 0) {
  // Buffer fue limpiado por otra exec → soy duplicado o tardio
  return [];
}

// Encontrar max ts en buffer
const maxTs = Math.max(...buffer.map(m => m.ts));

if (my_ts < maxTs) {
  // Otra exec del mismo telefono es mas reciente → ella se encarga, yo skip
  return [];
}

// Soy el ultimo. Consolido y limpio.
// Estrategia:
//   - Texto: concatenar todos los textos del buffer (en orden cronologico) separados por "\\n"
//   - Audio/Image: si soy media, proceso solo MI media. Los textos pendings se ignoran
//     (es complejo mezclar y rompe el Switch). Si querias prepender texto + media,
//     mejor mandar primero el media y luego el texto, no al reves.
let consolidatedText = '';
if (my_type === 'text') {
  const allTexts = buffer.filter(m => m.msg_type === 'text').map(m => m.text).filter(t => t && t.trim());
  consolidatedText = allTexts.join('\\n');
} else {
  // Media: solo mi texto/caption (si lo hubiera)
  consolidatedText = input.mensaje_original || '';
}

// Limpio el buffer para este telefono
delete sd.pendingByPhone[phone];

// Retorno UN solo item con el texto consolidado
return [{
  json: {
    ...input,
    mensaje_original: consolidatedText,
    _consolidated_count: buffer.length,
    _consolidated_msgs: buffer.map(m => ({ ts: m.ts, type: m.msg_type, text: (m.text||'').slice(0,80) }))
  }
}];`;

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

function newId() {
  return 'b-' + Math.random().toString(36).slice(2, 10);
}

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W1_pre_batching_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', bk);

  // 1) Reemplazar Parser
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  parser.parameters.jsCode = NEW_PARSER_CODE;
  console.log('✓ Parser v5 con buffer write');

  // 2) Insertar Wait 7s + Consolidate entre Parser y Switch Tipo Mensaje
  const switchNode = wf.nodes.find(n => n.name === 'Switch Tipo Mensaje');
  if (!switchNode) throw new Error('Switch Tipo Mensaje no existe');

  // Posiciones
  const parserPos = parser.position;
  const switchPos = switchNode.position;

  // Si ya existen los nodos (re-ejecucion), borrarlos primero
  wf.nodes = wf.nodes.filter(n => !['Wait 7s', 'Consolidate Or Skip'].includes(n.name));

  const waitNode = {
    parameters: { amount: 7, unit: 'seconds' },
    id: newId(),
    name: 'Wait 7s',
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    position: [parserPos[0] + 200, parserPos[1]],
    webhookId: newId(),
  };
  const consolidateNode = {
    parameters: { language: 'javaScript', jsCode: CONSOLIDATE_CODE },
    id: newId(),
    name: 'Consolidate Or Skip',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [parserPos[0] + 400, parserPos[1]],
  };
  wf.nodes.push(waitNode, consolidateNode);

  // 3) Re-wire conexiones:
  //    antes: Parser → Switch
  //    despues: Parser → Wait 7s → Consolidate Or Skip → Switch
  const parserConns = wf.connections['Parsear Mensaje'];
  if (parserConns && parserConns.main && parserConns.main[0]) {
    // Borrar la conexion vieja Parser → Switch (la guardo para el Consolidate)
    const oldTargets = parserConns.main[0]; // [{node:'Switch Tipo Mensaje',...}]
    parserConns.main[0] = [{ node: 'Wait 7s', type: 'main', index: 0 }];

    wf.connections['Wait 7s'] = {
      main: [[{ node: 'Consolidate Or Skip', type: 'main', index: 0 }]]
    };
    wf.connections['Consolidate Or Skip'] = {
      main: [oldTargets]
    };
    console.log('✓ Insertados Wait 7s + Consolidate entre Parser y Switch');
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
