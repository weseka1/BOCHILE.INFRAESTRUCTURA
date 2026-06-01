// El extractor URL inyecta al CORE el contexto del CATALOGO_MATCH como:
//   "amb=4 banos= precio=160000 USD ..."
// El CORE ve "amb=4" y lo repite literal al cliente como "4 ambientes",
// aunque las reglas digan que use dormitorios. La palabra "amb" en el
// contexto contamina la respuesta.
//
// Fix: que el extractor pase YA CONVERTIDO el dato:
//   dormitorios=2 banos=null precio=160000 USD ...
// Mas explicito y el LLM no tiene que convertir.

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

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_extractor_dorm_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  const ext = w.nodes.find(n => n.name === 'Extraer Info URL');
  if (!ext) { console.error('No encontre Extraer Info URL'); process.exit(1); }

  let code = ext.parameters.jsCode || '';

  // Reemplazo la linea que arma el bloque CATALOGO_MATCH:
  // antes: ' amb=' + (p.ambientes || '') + ' banos=' + (p.banos || '')
  // ahora: ' dormitorios=' + dorm + ' banos=' + (p.banos || '<sin dato>') + ' ambientes_catalogo=' + (p.ambientes || '')
  // Tambien agregamos calculo de dormitorios en el JS

  const OLD = "block += '\\n[CATALOGO_MATCH detectado por \"' + match.matched + '\"] prop_id=' + (p.prop_id || '') + ' titulo=\"' + (p.titulo || '').slice(0, 80) + '\" direccion=' + (p.direccion || '') + ' zona=' + (p.zona || '') + ' amb=' + (p.ambientes || '') + ' banos=' + (p.banos || '') + ' precio=' + (p.precio || '') + ' ' + (p.moneda || '') + ' superficie_cubierta=' + (p.superficie_cubierta || '');";

  const NEW = "var dorm = '';\n        var amb = parseInt(p.ambientes||0,10);\n        if (amb === 1) dorm = 'monoambiente';\n        else if (amb === 2) dorm = '1 dormitorio';\n        else if (amb >= 3) dorm = String(amb - 2) + ' dormitorios';\n        var banos = (p.banos === '' || p.banos === null || p.banos === undefined) ? '<sin dato en catalogo, NO inventar>' : String(p.banos) + ' banos';\n        block += '\\n[CATALOGO_MATCH detectado por \"' + match.matched + '\"] prop_id=' + (p.prop_id || '') + ' titulo=\"' + (p.titulo || '').slice(0, 80) + '\" direccion=' + (p.direccion || '') + ' zona=' + (p.zona || '') + ' dormitorios=\"' + dorm + '\" banos=\"' + banos + '\" precio=' + (p.precio || '') + ' ' + (p.moneda || '') + ' superficie_cubierta=' + (p.superficie_cubierta || '') + ' m2';";

  if (code.includes('dormitorios=')) {
    console.log('Ya estaba aplicado');
    return;
  }

  if (!code.includes(OLD)) {
    console.error('No encontre el patron original. Imprimo lo que esta:');
    const m = code.match(/block \+= '[^']*CATALOGO_MATCH[^']*[^\n]*/);
    if (m) console.log(m[0].slice(0, 400));
    process.exit(2);
  }

  code = code.replace(OLD, NEW);
  ext.parameters.jsCode = code;
  console.log('Extractor: ahora pasa dormitorios convertidos + banos con "<sin dato>" si vacio');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + WF, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/' + WF + '/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
