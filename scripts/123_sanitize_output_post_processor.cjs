// El LLM ignora reglas del prompt sobre ¿¡ y "X ambientes". Pasamos a
// fuerza bruta: post-processor que sanitiza el output del CORE antes de
// llegar a "Log Mensaje Saliente" -> "Responder al Cliente respond.io".
//
// Reglas del sanitizer:
// 1. Reemplazar ¿X? -> X?  y ¡X! -> X!  (quitar apertura)
// 2. "X ambientes" / "X amb" -> conversion a dormitorios (X-2)
// 3. Solo modifica el campo .output del JSON del CORE.
//
// Se inserta entre "Vendedor CORE" y "Log Mensaje Saliente".

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

const SANITIZE_CODE = `// Sanitizer del output de Cami: ultima linea de defensa contra ¿¡ y "X ambientes"
// que el LLM no respeta a pesar del prompt. Llega siempre limpio al cliente.

const inp = $input.first().json;
let output = String(inp.output || '');
const original = output;

// 1. Quitar ¿X? -> X?  y ¡X! -> X!
output = output.replace(/¿([^¿?]{1,200})\\?/g, '$1?');
output = output.replace(/¡([^¡!]{1,200})!/g, '$1!');
// Quitar ¿ y ¡ residuales sueltos
output = output.replace(/¿/g, '');
output = output.replace(/¡/g, '');

// 2. Convertir "X ambientes" / "X amb" a "Y dormitorios"
// Patron: numero + espacio + (ambientes|amb)
function ambToDorm(match, num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n < 1) return match;
  if (n === 1) return 'monoambiente';
  if (n === 2) return '1 dormitorio';
  return (n - 2) + ' dormitorios';
}
output = output.replace(/(\\d+)\\s+ambientes\\b/gi, ambToDorm);
output = output.replace(/(\\d+)\\s+amb\\b(?!ient)/gi, ambToDorm);

// 3. Limpiar dobles espacios y dobles signos que puedan haber quedado
output = output.replace(/  +/g, ' ').replace(/\\?\\?/g, '?').replace(/!!/g, '!');

// Log si hubo cambios (visible en logs de n8n)
if (output !== original) {
  console.log('[sanitize] limpio output. Antes:', original.slice(0, 100), '... Despues:', output.slice(0, 100));
}

// Devolver el mismo objeto con el output sanitizado
return [{ json: Object.assign({}, inp, { output, output_raw: original }) }];
`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_sanitizer_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  // 1. Crear nodo Sanitize Output si no existe
  const NAME = 'Sanitize Output';
  let san = w.nodes.find(n => n.name === NAME);
  if (!san) {
    const core = w.nodes.find(n => n.name === 'Vendedor CORE');
    const pos = core ? [core.position[0] + 220, core.position[1]] : [3200, 600];
    san = {
      parameters: { jsCode: SANITIZE_CODE },
      id: 'node-sanitize-' + Date.now(),
      name: NAME,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos,
      onError: 'continueRegularOutput',
    };
    w.nodes.push(san);
    console.log('Nodo Sanitize Output creado');
  } else {
    san.parameters.jsCode = SANITIZE_CODE;
    console.log('Nodo Sanitize Output: code actualizado');
  }

  // 2. Reconectar: Vendedor CORE -> Sanitize Output -> Log Mensaje Saliente
  const coreConns = w.connections['Vendedor CORE'];
  if (!coreConns?.main?.[0]) { console.error('CORE sin connections'); process.exit(2); }
  const old = coreConns.main[0];
  const already = old.some(it => it.node === NAME);
  if (already) {
    console.log('Ya estaba en la cadena');
  } else {
    coreConns.main[0] = [{ node: NAME, type: 'main', index: 0 }];
    w.connections[NAME] = w.connections[NAME] || { main: [[]] };
    w.connections[NAME].main[0] = old;
    console.log('Cadena: Vendedor CORE -> Sanitize Output -> ' + old.map(o=>o.node).join(','));
  }

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
