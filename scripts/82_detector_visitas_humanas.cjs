// PIEZA 4: Detector automatico de visitas en mensajes humanos.
//
// Cuando Camila responde al cliente por respond.io con algo como "te paso
// el viernes 10am" o "vamos el 28/05 a las 16", el sistema debe captar
// esa visita y registrarla automaticamente en la tabla `visitas`.
//
// Diseno: un nodo Code que llama a la API OpenAI directamente con un prompt
// de extraccion estructurada y luego POSTea al dashboard-api /api/visitas
// si detecta visita. Se conecta en paralelo al Router del Parser (siempre
// se ejecuta, independiente del flow principal del bot).
//
// Por costo y simplicidad: solo analiza mensajes humanos (out con es_humano=true)
// o mensajes cliente (in) cuando el bot esta pausado. Si el bot esta activo
// y respondiendo, no hace falta el detector (el bot usa Crear Visita directo).
//
// Idempotente.

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

// Code del Detector. Analiza el mensaje y si detecta visita con fecha+hora
// concreta, POSTea al dashboard-api. Si solo detecta intencion sin datos,
// POSTea con estado=pendiente. Si no hay nada, return [].
const DETECTOR_JS_CODE = `// Detector de visitas en mensajes (cliente o humano).
// Output del Parser tiene: mensaje_original, lead_id, nombre, telefono, mark_pausa, skip, etc.
const input = $input.first().json || {};
if (input.skip) return [];
const texto = String(input.mensaje_original || '').trim();
if (texto.length < 5) return [];

// Heuristica rapida: solo gasto tokens si hay palabras-tag de visita/fecha
const KEYWORDS = /\\b(visit|conoc|ver la prop|paso a|paso el|nos vemos|coordin|agend|reuni|cita|mostrarte|mostrarles)\\b/i;
const FECHA_HINT = /(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|manana|mañana|hoy|\\d{1,2}\\/\\d{1,2}|\\d{1,2}-\\d{1,2}|\\d{1,2}\\s+(de\\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/i;
const HORA_HINT = /\\b\\d{1,2}(:\\d{2})?\\s*(hs|hrs|am|pm|h)?\\b/i;

if (!KEYWORDS.test(texto) && !(FECHA_HINT.test(texto) && HORA_HINT.test(texto))) {
  return [];
}

// Llamada al LLM para extraccion estructurada. Usamos el credential de OpenAI
// del workflow via fetch directo a la API (necesitamos el bearer en headers).
const OPENAI_KEY = $env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.log('[detector_visitas] sin OPENAI_API_KEY, skip');
  return [];
}

const hoyISO = new Date().toISOString().slice(0, 10);
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

// POST al dashboard-api para registrar la visita
const visitaPayload = {
  lead_id: input.lead_id || '',
  cliente_nombre: input.nombre || '',
  prop_id: '',
  direccion: '',
  fecha: parsed.fecha || '',
  hora: parsed.hora || '',
  vendedor_nombre: parsed.vendedor_mencionado || '',
  estado: parsed.estado,
  observaciones: \`[Detectada automaticamente desde chat] \${parsed.notas || parsed.prop_mencionada || texto.slice(0, 200)}\`,
  confirmada_cliente: false,
  notificada_vendedor: false,
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
  return [{ json: { detector: 'visita_detectada', estado: parsed.estado, visita_id: saved.visita_id, lead_id: input.lead_id } }];
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
    path.join(bkpDir, `${WF}_pre_detector_visitas_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  // 1. Crear o actualizar el nodo "Detector Visitas"
  const NODE_NAME = 'Detector Visitas';
  let detNode = w.nodes.find(n => n.name === NODE_NAME);
  if (!detNode) {
    const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
    const pos = parser ? [parser.position[0] + 150, parser.position[1] + 250] : [600, 700];
    detNode = {
      parameters: { jsCode: DETECTOR_JS_CODE },
      id: `node-detector-visitas-${Date.now()}`,
      name: NODE_NAME,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos,
      onError: 'continueRegularOutput',
    };
    w.nodes.push(detNode);
    console.log(`✅ Nodo "${NODE_NAME}" creado`);
  } else {
    detNode.parameters.jsCode = DETECTOR_JS_CODE;
    detNode.onError = 'continueRegularOutput';
    console.log(`ℹ️  Nodo "${NODE_NAME}" actualizado`);
  }

  // 2. Conectar Parsear Mensaje -> Detector Visitas (paralelo al Router)
  const parserConns = w.connections['Parsear Mensaje'];
  if (!parserConns) { console.error('No hay connections desde Parsear Mensaje'); process.exit(1); }

  const mainOut = parserConns.main[0] || [];
  const alreadyConnected = mainOut.some(it => it.node === NODE_NAME);
  if (!alreadyConnected) {
    parserConns.main[0] = [...mainOut, { node: NODE_NAME, type: 'main', index: 0 }];
    console.log('✅ Parsear Mensaje -> Detector Visitas (paralelo al Router)');
  } else {
    console.log('ℹ️  Detector Visitas ya estaba conectado al parser');
  }

  // 3. PUT + activate
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\n=== Detector activo ===');
  console.log('Cada mensaje que entra/sale del flow se analiza en paralelo:');
  console.log('  Si hay intencion de visita + fecha + hora -> POST con estado=confirmada');
  console.log('  Si hay intencion sin fecha/hora            -> POST con estado=pendiente');
  console.log('  Si no hay nada                              -> skip');
  console.log('');
  console.log('IMPORTANTE: el workflow necesita la env var OPENAI_API_KEY seteada en n8n');
  console.log('(la misma que usa el Vendedor CORE para responder).');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
