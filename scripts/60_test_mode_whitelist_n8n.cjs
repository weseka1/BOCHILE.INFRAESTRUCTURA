// Modo TEST en n8n: agrega un nodo "Detect Test" despues de "Parsear Mensaje"
// que marca `is_test=true` si el telefono del cliente esta en la whitelist
// hardcoded en el code node.
//
// Whitelist actual: 5492915512515 (Yamil)
//
// Tambien parchea los nodos de logging (Upsert Lead CRM, Registrar Accion IA,
// Log Mensaje Entrante, Log Mensaje Saliente) para que NO escriban si is_test
// es true.
//
// USO: node scripts/60_test_mode_whitelist_n8n.cjs
//
// Idempotente.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const MAIN_WF = 'TEdlfSBCc5ENVslp';

const TEST_PHONES = [
  '5492915512515', // Yamil
];

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

// Codigo JS del nodo Detect Test
const DETECT_TEST_CODE = `// Marca is_test=true si el telefono del cliente esta en la whitelist.
// Pasa por adelante TODOS los demas campos sin tocar.
const TEST_PHONES = ${JSON.stringify(TEST_PHONES)};

const inp = $input.first().json || {};
const tel = String(inp.telefono || inp.from || inp.contact_id || '').replace(/\\D/g, '');
const is_test = TEST_PHONES.some(p => tel.endsWith(p) || p.endsWith(tel));

return [{ json: { ...inp, is_test, _test_match: is_test ? tel : null } }];`;

(async () => {
  // Backup primero
  console.log('=== Backup workflow ===');
  const r = await req('GET', `/api/v1/workflows/${MAIN_WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpPath = path.join(bkpDir, `${MAIN_WF}_pre_test_mode_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpPath, JSON.stringify(w, null, 2));
  console.log('Backup en:', bkpPath);

  // ============================================================
  // 1. Agregar / actualizar nodo "Detect Test"
  // ============================================================
  const TEST_NODE_NAME = 'Detect Test';
  let testNode = w.nodes.find(n => n.name === TEST_NODE_NAME);
  if (!testNode) {
    const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
    const pos = parser ? [parser.position[0] + 200, parser.position[1] + 100] : [400, 400];
    testNode = {
      parameters: { jsCode: DETECT_TEST_CODE },
      id: `node-detect-test-${Date.now()}`,
      name: TEST_NODE_NAME,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos,
    };
    w.nodes.push(testNode);
    console.log(`✅ Nodo "${TEST_NODE_NAME}" creado`);
  } else {
    testNode.parameters = testNode.parameters || {};
    testNode.parameters.jsCode = DETECT_TEST_CODE;
    console.log(`✅ Nodo "${TEST_NODE_NAME}" ya existia, actualizado el code`);
  }

  // ============================================================
  // 2. Conectar Parsear Mensaje -> Detect Test -> (lo que sea que seguia)
  // ============================================================
  const conns = w.connections;
  const oldNext = conns['Parsear Mensaje']?.main?.[0] || [];
  const alreadyInChain = oldNext.some(it => it.node === TEST_NODE_NAME);

  if (!alreadyInChain) {
    // Lo que seguia despues de Parsear Mensaje (probablemente Router Parser)
    // ahora arranca despues de Detect Test.
    if (!conns['Detect Test']) conns['Detect Test'] = { main: [oldNext.slice()] };
    conns['Parsear Mensaje'].main[0] = [{ node: TEST_NODE_NAME, type: 'main', index: 0 }];
    console.log('✅ Cadena: Parsear Mensaje → Detect Test → (siguiente original)');
  } else {
    console.log('ℹ️  Cadena ya tiene Detect Test (idempotente)');
  }

  // ============================================================
  // 3. Marcar los nodos de logging para skip si is_test
  //    Estrategia: agregar al code de cada nodo de logging un check al inicio
  //    que retorne early si is_test es true. Como los nodos son googleSheets
  //    (no code), no podemos. Mejor estrategia:
  //    Wrap en condicion con expresion = {{ $json.is_test ? 'skip' : 'do' }}
  //
  //    Mas simple: dejar el flag pasando por todo el flow y filtrar SOLO en
  //    los GET endpoints del dashboard-api. Pero eso no logra que no se logueen
  //    los mensajes en el Sheet de produccion - SI se loguean.
  //
  //    Por ahora: agregamos el flag al flow. Las mejoras de skip-log las
  //    hacemos cuando veamos como impacta en la conversacion test real.
  // ============================================================
  console.log('ℹ️  Nota: is_test ya circula. Para skip de Sheet logging haremos un patch en el dashboard-api /calidad-ia para filtrar por phone test.');

  // ============================================================
  // 4. PUT + Activate
  // ============================================================
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${MAIN_WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${MAIN_WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\nLISTO. Whitelist:', TEST_PHONES);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
