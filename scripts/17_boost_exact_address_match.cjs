// Mejora sub-workflow RAG Search: cuando hay direccion, REORDENA top-5 por match exacto
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

const NEW_SUB_CODE = `// Sub-workflow Bochile RAG Search v3: direcciones con re-ranking exacto
const RAG_URL = 'https://rag-bochile.onrender.com/api/search';
const inp = $input.first().json || {};
const q = String(inp.query || '').trim();
if (!q) return [{ json: { result: 'ERROR: query es obligatorio' } }];

// Detectar direccion: calle + numero (ej. "Sarmiento 343")
const dirMatch = q.match(/([A-Za-zÁÉÍÓÚÑáéíóúñ\\.\\s]{3,30})\\s+(\\d{2,5})/);
const tieneDireccion = !!dirMatch;
const calleQ = tieneDireccion ? dirMatch[1].trim().toLowerCase() : '';
const numeroQ = tieneDireccion ? dirMatch[2] : '';

const opMap = { venta:'sale', vender:'sale', vende:'sale', comprar:'sale', sale:'sale',
  alquiler:'rent', alquilar:'rent', alquila:'rent', renta:'rent', rent:'rent' };
const ptMap = { depto:'departamento', dept:'departamento', terreno:'lote',
  deposito:'galpon', 'depósito':'galpon', chacra:'campo', estancia:'campo',
  garage:'cochera' };

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

let items = data.items.slice();

// RE-RANKING por direccion exacta cuando hay direccion en la query
if (tieneDireccion) {
  items = items.map(function(p) {
    const addr = String(p.address || '').toLowerCase();
    const title = String(p.title || '').toLowerCase();
    let boost = 0;
    // Match exacto del numero en address
    if (addr.indexOf(numeroQ) >= 0) boost += 1.0;
    if (title.indexOf(numeroQ) >= 0) boost += 0.5;
    // Match de calle
    if (calleQ && addr.indexOf(calleQ.split(' ')[0]) >= 0) boost += 0.3;
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
  const wfs = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  const sub = wfs.find(w => w.name.includes('RAG Search'));
  if (!sub) { console.log('NO SUB'); return; }
  const full = JSON.parse((await req('GET', '/api/v1/workflows/' + sub.id)).b);
  const code = full.nodes.find(n => n.name === 'Call RAG and Format');
  code.parameters.jsCode = NEW_SUB_CODE;
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/' + sub.id, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
  await req('POST', '/api/v1/workflows/' + sub.id + '/activate');
  console.log('SUB updated v3:', upd.s);
})();
