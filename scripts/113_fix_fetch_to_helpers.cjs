// BUG CRITICO: los Code nodes de n8n NO tienen 'fetch' global. Hay que usar
// this.helpers.httpRequest(). El Extractor URL fallaba con "fetch is not
// defined" y el Detector Visitas estaba SILENCIOSAMENTE roto por lo mismo.
//
// Este script reescribe ambos Code nodes usando this.helpers.httpRequest
// (que es la API soportada en n8n).

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
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

const EXTRACTOR_CODE = `// Extraer info de URLs en el mensaje del cliente (usa helpers.httpRequest)
const item = $input.first().json;
const original = String(item.mensaje || item.mensaje_original || '');

const urlRegex = /https?:\\/\\/[^\\s<>"\\)]+/gi;
const urls = (original.match(urlRegex) || []).slice(0, 3);

if (urls.length === 0) {
  return [{ json: item }];
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function extractOg(html) {
  const out = {};
  const grab = (rx) => { const m = html.match(rx); return m ? m[1] : ''; };
  out.title = grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
           || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
           || grab(/<title[^>]*>([^<]+)<\\/title>/i);
  out.description = grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
                 || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
                 || grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  out.image = grab(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (!out.description) {
    const ld = grab(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/i);
    if (ld) { try { const j = JSON.parse(ld); out.description = j.description || j.caption || ''; } catch {} }
  }
  for (const k of ['title','description']) {
    if (out[k]) out[k] = String(out[k]).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0, 600);
  }
  return out;
}

const blocks = [];
for (const url of urls) {
  let block = '';
  const isBochile = /bochile\\.com\\/listing\\//i.test(url);
  const isInstagram = /instagram\\.com/i.test(url);

  let html = '';
  let httpOk = false;
  let httpStatus = 0;
  try {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: url,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    });
    httpStatus = response.statusCode || 200;
    html = String(response.body || '');
    httpOk = httpStatus >= 200 && httpStatus < 400;
  } catch (e) {
    block = '[URL_ERROR ' + url + ' - ' + (e.message || 'fetch fail') + ']';
  }

  if (!block) {
    if (!httpOk) {
      block = '[URL_NO_ACCESIBLE ' + url + ' - status ' + httpStatus + ']';
    } else {
      const og = extractOg(html);
      if (!og.title && !og.description) {
        block = '[URL_SIN_INFO ' + url + ']';
      } else {
        block = '[URL_INFO ' + url + ']\\nTitulo: ' + (og.title || '') + '\\nDescripcion: ' + (og.description || '').slice(0, 400);
      }
    }
  }

  if (isBochile) {
    try {
      const resp = await this.helpers.httpRequest({
        method: 'GET',
        url: 'https://bochile-dashboard-api.onrender.com/api/propiedades',
        returnFullResponse: false,
        json: true,
      });
      const props = Array.isArray(resp) ? resp : (resp.body || []);
      const slugMatch = url.match(/listing\\/([^\\/?#]+)/i);
      const slug = slugMatch ? decodeURIComponent(slugMatch[1]).toLowerCase() : '';
      const found = (props || []).find(p => {
        if (!p || !p.titulo) return false;
        const titulo = String(p.titulo).toLowerCase();
        const slugTokens = slug.split(/[-_]/).filter(t => t.length > 2);
        return (slugTokens.length > 0 && slugTokens.every(t => titulo.includes(t))) || titulo.replace(/\\s+/g,'-').includes(slug.slice(0, 30));
      });
      if (found) {
        block += '\\n[CATALOGO_MATCH] prop_id=' + (found.prop_id || '') + ' direccion=' + (found.direccion || '') + ' zona=' + (found.zona || '') + ' amb=' + (found.ambientes || '') + ' precio=' + (found.precio || '') + ' ' + (found.moneda || '');
      }
    } catch (e) {
      // ignore - ya tenemos og:tags
    }
  }

  if (isInstagram && (block.startsWith('[URL_NO_ACCESIBLE') || block.startsWith('[URL_SIN_INFO') || block.startsWith('[URL_ERROR'))) {
    block = '[INSTAGRAM_BLOQUEADO ' + url + ' - no pude ver el post directo. Pedile al cliente que copie la descripcion del anuncio o decime que recuerda (zona, precio, dorms).]';
  }

  blocks.push(block);
}

const enriched = original + '\\n\\n' + blocks.join('\\n\\n');
item.mensaje = enriched;
return [{ json: item }];
`;

const DETECTOR_CODE = `// Detector de visitas (usa helpers.httpRequest, no fetch)
const input = $input.first().json || {};
const reason = String(input.reason || '');
if (input.skip && reason !== 'humano_respondio') return [];
const texto = String(input.mensaje_original || input.msg_humano || '').trim();
if (texto.length < 5) return [];

const KEYWORDS = /\\b(visit|conoc|ver la prop|paso a|paso el|nos vemos|coordin|agend|reuni|cita|mostrarte|mostrarles|te llamo|llamarte|llamado)\\b/i;
const FECHA_HINT = /(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|manana|mañana|hoy|\\d{1,2}\\/\\d{1,2}|\\d{1,2}-\\d{1,2}|\\d{1,2}\\s+(de\\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/i;
const HORA_HINT = /\\b\\d{1,2}(:\\d{2})?\\s*(hs|hrs|am|pm|h)?\\b/i;
if (!KEYWORDS.test(texto) && !(FECHA_HINT.test(texto) && HORA_HINT.test(texto))) return [];

const OPENAI_KEY = $env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.log('[detector_visitas] sin OPENAI_API_KEY, skip'); return []; }

const hoyISO = new Date().toISOString().slice(0, 10);
const esHumano = reason === 'humano_respondio';
const promptSystem = \`Sos un extractor de info de visitas inmobiliarias. Analiza el mensaje y devolve SOLO un JSON valido con este shape:
{"es_visita":boolean,"estado":"confirmada"|"pendiente"|"ninguno","fecha":"YYYY-MM-DD"|"","hora":"HH:MM"|"","prop_mencionada":"","vendedor_mencionado":"","notas":""}
Reglas:
- "confirmada" SOLO si hay fecha Y hora concretas. "pendiente" si solo intencion. "ninguno" si no hay visita.
- Convertir referencias relativas (manana, viernes) a fecha ISO usando que HOY es \${hoyISO}, timezone GMT-3.
- Devolver SOLO el JSON.\`;

let parsed;
try {
  const r = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
    body: {
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: promptSystem },
        { role: 'user', content: texto },
      ],
    },
    json: true,
  });
  const content = r?.choices?.[0]?.message?.content || '{}';
  parsed = JSON.parse(content);
} catch (e) {
  console.log('[detector_visitas] fail:', e.message);
  return [];
}

if (!parsed.es_visita || parsed.estado === 'ninguno') return [];

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
  observaciones: '[Detectada automaticamente desde ' + origen + '] ' + (parsed.notas || parsed.prop_mencionada || texto.slice(0, 200)),
  confirmada_cliente: false,
  notificada_vendedor: esHumano,
};

try {
  const saved = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://bochile-dashboard-api.onrender.com/api/visitas',
    headers: { 'Content-Type': 'application/json' },
    body: visitaPayload,
    json: true,
  });
  return [{ json: { detector: 'visita_detectada', estado: parsed.estado, visita_id: saved.visita_id, lead_id: input.lead_id, origen } }];
} catch (e) {
  console.log('[detector_visitas] dashboard fail:', e.message);
  return [];
}
`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, `${WF}_pre_fix_fetch_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(w, null, 2));

  const ext = w.nodes.find(n => n.name === 'Extraer Info URL');
  if (ext) { ext.parameters.jsCode = EXTRACTOR_CODE; console.log('✅ Extraer Info URL: fetch -> this.helpers.httpRequest'); }
  const det = w.nodes.find(n => n.name === 'Detector Visitas');
  if (det) { det.parameters.jsCode = DETECTOR_CODE; console.log('✅ Detector Visitas: fetch -> this.helpers.httpRequest'); }

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
