// BLOQUE A: Human Handoff
// 1. Parser detecta message.sent de humano (sender.source != 'contact')
// 2. Nuevo nodo "Marcar Bot Pausado" (Sheets update) si humano respondio
// 3. Nuevo nodo "Cargar Estado Bot" (Sheets read) para chequear bot_pausado_hasta/conversacion_cerrada
// 4. Nuevo nodo "Check Bot Activo" (If) que skipea si bot esta pausado
const http = require('node:http');
const crypto = require('node:crypto');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

function req(method, path, body){
  return new Promise((res,rej)=>{
    const data = body ? JSON.stringify(body) : null;
    const opts = {host:'localhost',port:5680,path,method,headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}};
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});
    r.on('error',rej);
    if(data) r.write(data);
    r.end();
  });
}

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '9NvEcPkNdH6i0j3L', name: 'Google Sheets account' } };

// Parser nuevo: detecta humano + lee buffer + escribe buffer
const NEW_PARSER = `// Parser v7: respond.io con detección de humano (handoff) + buffer
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

  // Detectar humano: message.sent con sender NO contact y NO bot/api
  if (evento === 'message.sent' || evento === 'message_sent') {
    const src = String(sender.source || '').toLowerCase();
    // 'user' = humano desde app; 'api'/'bot' = el propio Cami
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
  canal = 'whatsapp_twilio';
}

if (!from) {
  return [{ json: { skip: true, reason: 'sin_from' } }];
}

// Si es el bot propio respondiendo, ignorar (no procesar)
if (es_bot_propio) {
  return [{ json: { skip: true, reason: 'bot_propio_no_procesar' } }];
}

// Si es humano respondiendo, marcar pausa y skip flow
if (es_humano) {
  const digits = from.replace(/\\D/g, '');
  return [{ json: {
    skip: true,
    reason: 'humano_respondio',
    mark_pausa: true,
    telefono: from,
    contact_id: contact_id_val,
    lead_id: 'L-' + digits.slice(-10),
    msg_humano: text_body.slice(0, 200)
  }}];
}

// Mensaje normal del contacto: continuar al buffer + flujo
if (!text_body && !media_url) {
  return [{ json: { skip: true, reason: 'payload_invalido' } }];
}

const cmid = (body.message && body.message.channelMessageId) || ('GEN-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
const digits_only = from.replace(/\\D/g, '');
const my_ts = Date.now();

try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: 'http://host.docker.internal:3003/api/buffer/add',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: from, cmid, ts: my_ts, msg_type, text: text_body, media_url, media_type, profile, lead_id: 'L-' + digits_only.slice(-10) },
    json: true,
  });
} catch (err) {
  console.log('[parser] buffer/add error:', err.message);
}

return [{ json: {
  telefono: from,
  contact_id: contact_id_val,
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
  skip: false,
  mark_pausa: false
}}];`;

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);

  // 1) Actualizar Parser
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  parser.parameters.jsCode = NEW_PARSER;

  // 2) Si no existe "Marcar Bot Pausado", crearlo (Sheets update)
  let marcar = wf.nodes.find(n => n.name === 'Marcar Bot Pausado');
  const parserPos = parser.position;
  if (!marcar) {
    marcar = {
      parameters: {
        operation: 'appendOrUpdate',
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'leads' },
        columns: {
          mappingMode: 'defineBelow',
          value: {
            lead_id: "={{ $('Parsear Mensaje').item.json.lead_id }}",
            telefono: "={{ $('Parsear Mensaje').item.json.telefono }}",
            bot_pausado_hasta: "={{ new Date(Date.now() + 24*60*60*1000).toISOString() }}",
            ultimo_humano_respondio: "={{ new Date().toISOString() }}",
            actualizado_en: "={{ new Date().toISOString() }}"
          },
          matchingColumns: ['lead_id'],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true
        },
        options: {}
      },
      name: 'Marcar Bot Pausado',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [parserPos[0] + 220, parserPos[1] + 200],
      id: crypto.randomUUID(),
      credentials: SHEETS_CRED
    };
    wf.nodes.push(marcar);
  }

  // 3) Switch "Router Parser" despues del parser:
  //    - si mark_pausa -> Marcar Bot Pausado
  //    - si skip -> end
  //    - else -> Wait 7s (flujo normal)
  let router = wf.nodes.find(n => n.name === 'Router Parser');
  if (!router) {
    router = {
      parameters: {
        rules: {
          values: [
            { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: 'r1', leftValue: '={{ $json.mark_pausa }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'humano' },
            { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: 'r2', leftValue: '={{ $json.skip }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'skip' },
            { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: 'r3', leftValue: '={{ $json.skip }}', rightValue: false, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'continue' }
          ]
        },
        options: {}
      },
      name: 'Router Parser',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3,
      position: [parserPos[0] + 220, parserPos[1]],
      id: crypto.randomUUID()
    };
    wf.nodes.push(router);
  }

  // 4) Reconectar: Parser -> Router. Router output 'humano' -> Marcar Bot Pausado. Output 'continue' -> Wait 7s.
  //    'skip' -> nada (termina).
  wf.connections['Parsear Mensaje'] = { main: [[{ node: 'Router Parser', type: 'main', index: 0 }]] };
  wf.connections['Router Parser'] = {
    main: [
      [{ node: 'Marcar Bot Pausado', type: 'main', index: 0 }],
      [],
      [{ node: 'Wait 7s', type: 'main', index: 0 }]
    ]
  };

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);
})();
