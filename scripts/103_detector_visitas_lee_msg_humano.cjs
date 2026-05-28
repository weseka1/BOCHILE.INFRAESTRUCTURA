// Fix Detector Visitas: cuando es mensaje humano, el parser pone el texto
// en msg_humano, no en mensaje_original. El detector estaba ignorando
// todos los mensajes humanos (que es justo el caso que mas queremos:
// Camila confirmando visita desde su WA Business).

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

const NEW_CODE = `// Detector de visitas en mensajes (cliente, bot, o humano via WA Business).
// El parser pone el texto en mensaje_original para cliente/bot, y en
// msg_humano para humanos (que es el caso clave: Camila confirmando visita
// desde su celu por WhatsApp Business).
const input = $input.first().json || {};
// Para mensajes humanos, skip=true es esperado (el flow principal no
// procesa con CORE) pero igual queremos analizar el texto.
// Solo skipeamos cuando es skip por alquileres bot, no por humano.
const reason = String(input.reason || '');
if (input.skip && reason !== 'humano_respondio') return [];

// Tomar texto de donde sea
const texto = String(input.mensaje_original || input.msg_humano || '').trim();
if (texto.length < 5) return [];

// Heuristica rapida: solo gasto tokens si hay palabras-tag de visita/fecha
const KEYWORDS = /\\b(visit|conoc|ver la prop|paso a|paso el|nos vemos|coordin|agend|reuni|cita|mostrarte|mostrarles|te llamo|llamarte|llamado)\\b/i;
const FECHA_HINT = /(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|manana|mañana|hoy|\\d{1,2}\\/\\d{1,2}|\\d{1,2}-\\d{1,2}|\\d{1,2}\\s+(de\\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/i;
const HORA_HINT = /\\b\\d{1,2}(:\\d{2})?\\s*(hs|hrs|am|pm|h)?\\b/i;

if (!KEYWORDS.test(texto) && !(FECHA_HINT.test(texto) && HORA_HINT.test(texto))) {
  return [];
}

const OPENAI_KEY = $env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.log('[detector_visitas] sin OPENAI_API_KEY, skip');
  return [];
}

const hoyISO = new Date().toISOString().slice(0, 10);
const esHumano = reason === 'humano_respondio';
const promptSystem = \`Sos un extractor de info de visitas inmobiliarias. Analiza el mensaje y devolve SOLO un JSON valido con este shape exacto:
{
  "es_visita": boolean,
  "estado": "confirmada" | "pendiente" | "ninguno",
  "fecha": "YYYY-MM-DD" | "",
  "hora": "HH:MM" | "",
  "prop_mencionada": "" | "<texto que dice el cliente>",
  "vendedor_mencionado": "",
  "notas": ""
}

Reglas:
- "es_visita": true si el mensaje habla de coordinar/agendar/ir a ver una propiedad
- "estado": "confirmada" SOLO si hay fecha Y hora concretas. "pendiente" si solo hay intencion. "ninguno" si no hay visita.
- Convertir referencias relativas (manana, viernes, etc) a fecha ISO usando que HOY es \${hoyISO}, timezone Argentina GMT-3
- Si NO hay visita: es_visita=false, estado=ninguno, resto vacio.
- Devolver SOLO el JSON, sin markdown, sin comentarios.\`;

let llmResponse;
try {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: promptSystem },
        { role: 'user', content: texto },
      ],
    }),
  });
  if (!r.ok) {
    const errBody = await r.text();
    console.log('[detector_visitas] openai fail:', r.status, errBody.slice(0, 200));
    return [];
  }
  llmResponse = await r.json();
} catch (e) {
  console.log('[detector_visitas] fetch fail:', e.message);
  return [];
}

const content = llmResponse?.choices?.[0]?.message?.content || '{}';
let parsed;
try { parsed = JSON.parse(content); } catch { return []; }

if (!parsed.es_visita || parsed.estado === 'ninguno') return [];

// Source del registro: si lo dijo Camila por WA -> origen=humano. Sino, bot/cliente.
const origen = esHumano ? 'humano_wa' : 'auto';

const visitaPayload = {
  lead_id: input.lead_id || '',
  cliente_nombre: input.nombre || '',
  prop_id: '',
  direccion: '',
  fecha: parsed.fecha || '',
  hora: parsed.hora || '',
  vendedor_nombre: parsed.vendedor_mencionado || (esHumano ? 'Camila Pomerich' : ''),
  estado: parsed.estado,
  observaciones: \`[Detectada automaticamente desde \${origen}] \${parsed.notas || parsed.prop_mencionada || texto.slice(0, 200)}\`,
  confirmada_cliente: false,
  notificada_vendedor: esHumano, // si lo dijo Camila, ya esta notificada
};

try {
  const r2 = await fetch('https://bochile-dashboard-api.onrender.com/api/visitas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visitaPayload),
  });
  if (!r2.ok) {
    const errBody = await r2.text();
    console.log('[detector_visitas] dashboard-api fail:', r2.status, errBody.slice(0, 200));
    return [];
  }
  const saved = await r2.json();
  return [{ json: { detector: 'visita_detectada', estado: parsed.estado, visita_id: saved.visita_id, lead_id: input.lead_id, origen } }];
} catch (e) {
  console.log('[detector_visitas] dashboard fail:', e.message);
  return [];
}
`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_detector_msg_humano_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const det = w.nodes.find(n => n.name === 'Detector Visitas');
  if (!det) { console.error('No encontre Detector Visitas'); process.exit(1); }
  det.parameters.jsCode = NEW_CODE;
  console.log('✅ Detector Visitas actualizado: ahora lee msg_humano + permite reason=humano_respondio');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
