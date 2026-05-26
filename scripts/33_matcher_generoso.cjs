// Sub-workflow Bochile RAG Search v6: mas generoso, no descarta props validas
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    let buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h, timeout: 30000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

const NEW_CODE = `// Bochile RAG Search v6: mas generoso, sin descartar props validas por filtros estrictos
const RAG_URL = 'https://rag-bochile.onrender.com/api/search';
const inp = $input.first().json || {};
const q = String(inp.query || '').trim();
if (!q) return [{ json: { result: 'ERROR: query es obligatorio' } }];

const palabrasNoCalle = ['ambientes','ambiente','dormitorios','dormitorio','banos','metros','m2',
  'plantas','departamento','depto','casa','ph','duplex','triplex','lote','terreno','local',
  'oficina','galpon','campo','cochera','garage','busca','quiero','necesito','tengo',
  'venta','alquiler','centro','microcentro','palihue','norte','sur','hasta','desde',
  'mil','dolar','dolares','pesos','usd','ars'];
const palabras = q.split(/\\s+/).filter(Boolean);
let tieneDireccion = false, calleQ = '', numeroQ = '';
if (palabras.length <= 4) {
  const m = q.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ\\.]{4,30})\\s+(\\d{1,4})\\b/);
  if (m && !palabrasNoCalle.includes(m[1].toLowerCase())) {
    tieneDireccion = true;
    calleQ = m[1].trim().toLowerCase();
    numeroQ = m[2];
  }
}

const opMap = { venta:'sale', vender:'sale', comprar:'sale', sale:'sale',
  alquiler:'rent', alquilar:'rent', alquila:'rent', renta:'rent', rent:'rent' };
const ptMap = { depto:'departamento', dept:'departamento', terreno:'lote',
  deposito:'galpon', chacra:'campo', estancia:'campo', garage:'cochera' };

const filters = {};
const limit = tieneDireccion ? 12 : 8;
if (!tieneDireccion) {
  const op = (opMap[String(inp.operation || '').toLowerCase()] || inp.operation || '').toString();
  if (op === 'sale' || op === 'rent') filters.operation = op;
  const pt = (ptMap[String(inp.property_type || '').toLowerCase()] || inp.property_type || '').toString();
  if (pt) filters.property_type = pt;
  const pc = String(inp.price_currency || '').toUpperCase();
  if (pc === 'USD' || pc === 'ARS') filters.price_currency = pc;
}

const body = { query: q, limit, filters };
let data;
try {
  data = await this.helpers.httpRequest({ method: 'POST', url: RAG_URL, headers: { 'Content-Type': 'application/json' }, body, json: true });
} catch (err) {
  return [{ json: { result: 'ERROR_RAG: ' + (err.message || err).slice(0, 200) } }];
}

let items = (data && data.items) ? data.items.slice() : [];

// Fallback: si trae menos de 3 con filtros, agregar resultados sin filtros para tener mas opciones
if (!tieneDireccion && items.length < 3 && Object.keys(filters).length > 0) {
  try {
    const fb = await this.helpers.httpRequest({ method: 'POST', url: RAG_URL, headers: { 'Content-Type': 'application/json' }, body: { query: q, limit: 8, filters: {} }, json: true });
    const seen = new Set(items.map(p => String(p.prop_id)));
    for (const p of (fb.items || [])) {
      if (!seen.has(String(p.prop_id))) { items.push(p); seen.add(String(p.prop_id)); }
    }
  } catch (e) {}
}

if (items.length === 0) return [{ json: { result: 'SIN_STOCK | query: ' + q } }];

if (tieneDireccion) {
  items = items.map(function(p) {
    const addr = String(p.address || '').toLowerCase();
    const title = String(p.title || '').toLowerCase();
    let boost = 0;
    if (addr.indexOf(numeroQ) >= 0) boost += 1.0;
    if (title.indexOf(numeroQ) >= 0) boost += 0.5;
    if (calleQ && (addr.indexOf(calleQ.split(' ')[0]) >= 0 || title.indexOf(calleQ.split(' ')[0]) >= 0)) boost += 0.3;
    return Object.assign({}, p, { _final_score: (p.score || 0) + boost });
  }).sort(function(a, b) { return b._final_score - a._final_score; });
}

const priceMax = Number(inp.price_max || 0);
const bedsMin = Number(inp.bedrooms_min || 0);
if (!tieneDireccion && (priceMax > 0 || bedsMin > 0)) {
  items = items.map(function(p) {
    const sc = p._final_score || p.score || 0;
    let boost = 0;
    if (priceMax > 0 && p.price && Number(p.price) <= priceMax) boost += 0.3;
    if (bedsMin > 0 && p.bedrooms && Number(p.bedrooms) >= bedsMin) boost += 0.3;
    return Object.assign({}, p, { _final_score: sc + boost });
  }).sort(function(a, b) { return (b._final_score || 0) - (a._final_score || 0); });
}

items = items.slice(0, 8);

const lines = items.map(function(p, i) {
  const precio = p.price ? p.price + ' ' + (p.price_currency || '') : (p.price_text || 'Consultar');
  const ubic = (p.barrio && p.barrio !== 'unknown') ? p.barrio : (p.address || p.zona || 'Bahia Blanca');
  const dorm = (p.bedrooms !== null && p.bedrooms !== undefined && p.bedrooms !== '') ? p.bedrooms + ' dorm' : 'dorm ?';
  const m2 = p.area_m2 ? p.area_m2 + ' m2' : 'm2 ?';
  return (i+1) + '. [' + p.prop_id + '] ' + p.title
    + ' | ' + (p.property_type || '?')
    + ' | ' + ubic + ' | ' + dorm + ' | ' + m2 + ' | ' + precio
    + ' | URL: ' + p.url
    + ' | score: ' + ((p._final_score !== undefined) ? Number(p._final_score).toFixed(3) : (p.score || 0));
});

const modo = tieneDireccion ? ('direccion (' + calleQ + ' ' + numeroQ + ')') : 'criterios_amplios';
return [{ json: { result: 'PROPIEDADES_ENCONTRADAS (' + items.length + '):\\n' + lines.join('\\n') + '\\n\\nModo: ' + modo + ' | Filtros: ' + JSON.stringify(filters) + '\\n\\nINSTRUCCION: Mostrale al cliente las 2-3 mas relevantes. Si alguna NO cumple exacto pero esta MUY cerca, igualmente mencionala. JAMAS digas \"no tengo\" si hay items en esta lista.' } }];`;

(async () => {
  const sub = JSON.parse((await req('GET', '/api/v1/workflows/mKKIYx7pA2Kr7t4L')).b);
  const code = sub.nodes.find(n => n.name === 'Call RAG and Format');
  code.parameters.jsCode = NEW_CODE;
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (sub.settings) for (const k of A) if (sub.settings[k] !== undefined) s[k] = sub.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/mKKIYx7pA2Kr7t4L', { name: sub.name, nodes: sub.nodes, connections: sub.connections, settings: s });
  await req('POST', '/api/v1/workflows/mKKIYx7pA2Kr7t4L/activate');
  console.log('SUB v6 generoso aplicado. PUT:', upd.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
