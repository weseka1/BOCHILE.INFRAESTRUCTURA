// Regex de direccion MUY estricto: blacklist tipos + max 4 palabras en query
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

const NEW_SUB_CODE = `// Sub-workflow Bochile RAG Search v5: address detection ESTRICTO
const RAG_URL = 'https://rag-bochile.onrender.com/api/search';
const inp = $input.first().json || {};
const q = String(inp.query || '').trim();
if (!q) return [{ json: { result: 'ERROR: query es obligatorio' } }];

// Address mode SOLO si:
// - Query es corta (<= 4 palabras)
// - Tiene patron <calle alfabetica 4-30 chars> + <numero 1-4 digitos>
// - Calle NO es palabra blacklist (tipo prop, descriptor, etc.)
const palabrasNoCalle = ['ambientes','ambiente','dormitorios','dormitorio','banos','baños',
  'metros','m2','años','plantas','planta','departamento','depto','casa','ph','dúplex','duplex',
  'triplex','lote','terreno','local','oficina','galpon','galpón','campo','cochera','garage',
  'busca','buscar','quiero','necesito','tengo','venta','alquiler','centro','microcentro',
  'palihue','norte','sur','este','oeste','hasta','desde','minimo','maximo','aproximadamente',
  'mil','dolar','dólar','dolares','dólares','pesos','peso','usd','ars'];
const palabras = q.split(/\\s+/).filter(Boolean);
let tieneDireccion = false;
let calleQ = '';
let numeroQ = '';
if (palabras.length <= 4) {
  const m = q.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ\\.]{4,30})\\s+(\\d{1,4})\\b/);
  if (m && !palabrasNoCalle.includes(m[1].toLowerCase())) {
    tieneDireccion = true;
    calleQ = m[1].trim().toLowerCase();
    numeroQ = m[2];
  }
}

const opMap = { venta:'sale', vender:'sale', vende:'sale', comprar:'sale', sale:'sale',
  alquiler:'rent', alquilar:'rent', alquila:'rent', renta:'rent', rent:'rent' };
const ptMap = { depto:'departamento', dept:'departamento', terreno:'lote',
  deposito:'galpon', 'depósito':'galpon', chacra:'campo', estancia:'campo', garage:'cochera' };

const filters = {};
const limit = tieneDireccion ? 10 : 5;
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

const body = { query: q, limit, filters };
let data;
try {
  data = await this.helpers.httpRequest({ method: 'POST', url: RAG_URL, headers: { 'Content-Type': 'application/json' }, body, json: true });
} catch (err) {
  return [{ json: { result: 'ERROR_RAG: ' + (err.message || err).slice(0, 200) } }];
}

if (!data || !data.items || data.items.length === 0) {
  // Si fue por criterios y no hay nada, intentar SIN filtros estrictos (fallback)
  if (!tieneDireccion && Object.keys(filters).length > 1) {
    const fb = await this.helpers.httpRequest({ method: 'POST', url: RAG_URL, headers: { 'Content-Type': 'application/json' }, body: { query: q, limit: 5, filters: { with_image: true } }, json: true });
    if (fb?.items?.length) {
      const lines = fb.items.map((p,i) => (i+1) + '. [' + p.prop_id + '] ' + p.title + ' | ' + (p.property_type||'?') + ' | ' + (p.barrio||p.address||'BB') + ' | ' + (p.bedrooms?p.bedrooms+' amb':'?') + ' | ' + (p.price?p.price+' '+(p.price_currency||''):'Consultar') + ' | URL: ' + p.url);
      return [{ json: { result: 'PROPIEDADES_CERCANAS (no exactas, ' + fb.items.length + '):\\n' + lines.join('\\n') + '\\n\\nModo: fallback_semantico | Filtros estrictos no devolvieron resultados' } }];
    }
  }
  return [{ json: { result: 'SIN_STOCK | criterios: ' + JSON.stringify(filters) + ' | query: ' + q } }];
}

let items = data.items.slice();
if (tieneDireccion) {
  items = items.map(function(p) {
    const addr = String(p.address || '').toLowerCase();
    const title = String(p.title || '').toLowerCase();
    let boost = 0;
    if (addr.indexOf(numeroQ) >= 0) boost += 1.0;
    if (title.indexOf(numeroQ) >= 0) boost += 0.5;
    if (calleQ && (addr.indexOf(calleQ.split(' ')[0]) >= 0 || title.indexOf(calleQ.split(' ')[0]) >= 0)) boost += 0.3;
    return Object.assign({}, p, { _final_score: (p.score || 0) + boost });
  }).sort(function(a, b) { return b._final_score - a._final_score; }).slice(0, 5);
}

const lines = items.map(function(p, i) {
  const precio = p.price ? p.price + ' ' + (p.price_currency || '') : (p.price_text || 'Consultar');
  const ubic = (p.barrio && p.barrio !== 'unknown') ? p.barrio : (p.address || p.zona || 'Bahia Blanca');
  return (i+1) + '. [' + p.prop_id + '] ' + p.title
    + ' | ' + (p.property_type || '?')
    + ' | ' + ubic
    + ' | ' + (p.bedrooms ? p.bedrooms + ' amb' : 'amb ?')
    + ' | ' + (p.area_m2 ? p.area_m2 + ' m2' : 'm2 ?')
    + ' | ' + precio
    + ' | URL: ' + p.url
    + ' | score: ' + (p._final_score ? p._final_score.toFixed(3) : p.score);
});

const modo = tieneDireccion ? ('busqueda_por_direccion (calle=' + calleQ + ', nro=' + numeroQ + ')') : 'busqueda_por_criterios';
return [{ json: { result: 'PROPIEDADES_ENCONTRADAS (' + items.length + '):\\n' + lines.join('\\n') + '\\n\\nModo: ' + modo + ' | Filtros: ' + JSON.stringify(filters) } }];`;

(async () => {
  const sub = JSON.parse((await req('GET', '/api/v1/workflows/mKKIYx7pA2Kr7t4L')).b);
  const code = sub.nodes.find(n => n.name === 'Call RAG and Format');
  code.parameters.jsCode = NEW_SUB_CODE;
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (sub.settings) for (const k of A) if (sub.settings[k] !== undefined) s[k] = sub.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  await req('PUT', '/api/v1/workflows/mKKIYx7pA2Kr7t4L', { name: sub.name, nodes: sub.nodes, connections: sub.connections, settings: s });
  await req('POST', '/api/v1/workflows/mKKIYx7pA2Kr7t4L/activate');
  console.log('SUB v5: address strict (max 4 palabras + blacklist) + fallback semantico');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
