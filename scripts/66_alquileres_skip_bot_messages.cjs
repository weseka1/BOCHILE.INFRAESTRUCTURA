// Refinamiento del bypass Alquileres: en channel 508045, NUNCA loguear
// mensajes de bot (es_bot_propio=true). Solo cliente (in) y empleado humano (out).
//
// Requerimiento del cliente: "ALQUILERES SOLO DEBERA TENER ENTRADA Y SALIDA
// DE MENSAJERIA REAL ENTRE EMPLEADO Y CLIENTE (SIN IA)"
//
// Cami no envia mensajes a Alquileres (bypass activo desde script 65), pero
// si respond.io tiene algun automated message interno, igual lo filtramos.

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

const OLD_BLOCK = `  // ====== BYPASS ALQUILERES: solo logear, no procesar con Cami ======
  // El WA de Alquileres (508045) tiene su propio depto humano.
  // Solo registramos la conversacion para que los duenos vean en el dashboard.
  if (String(channel_id_val) === '508045') {
    const isOut = (evento === 'message.sent' || evento === 'message_sent');
    const dir = isOut ? 'out' : 'in';
    const ag = es_bot_propio ? 'Bot Alquileres' : (es_humano ? 'Empleado Alquileres' : '');`;

const NEW_BLOCK = `  // ====== BYPASS ALQUILERES: solo logear humanos, NO bots ni Cami ======
  // El WA de Alquileres (508045) tiene su propio depto humano.
  // Solo registramos cliente <-> empleado humano. Cualquier bot se ignora.
  if (String(channel_id_val) === '508045') {
    // Filtro: ignorar mensajes de bot/IA en Alquileres (requerimiento del cliente)
    if (es_bot_propio) {
      return [{ json: { skip: true, reason: 'canal_alquileres_bot_ignorado' } }];
    }
    const isOut = (evento === 'message.sent' || evento === 'message_sent');
    const dir = isOut ? 'out' : 'in';
    const ag = es_humano ? 'Empleado Alquileres' : '';`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_skip_bot_alquileres_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  if (!parser) { console.error('No Parsear Mensaje'); process.exit(1); }
  let code = parser.parameters?.jsCode || '';

  if (code.includes('canal_alquileres_bot_ignorado')) {
    console.log('ℹ️  Filtro ya aplicado (idempotente)');
    return;
  }

  if (!code.includes(OLD_BLOCK)) {
    console.error('No encontre el bloque alquileres viejo. Verificar que script 65 corrio.');
    process.exit(2);
  }

  code = code.replace(OLD_BLOCK, NEW_BLOCK);
  parser.parameters.jsCode = code;
  console.log('✅ Filtro aplicado: en Alquileres se ignoran mensajes de bot. Solo humanos.');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\nMatriz final de captura:');
  console.log('  VENTAS (506217)      | cliente in: SI | Cami out: SI | empleado out: SI');
  console.log('  ALQUILERES (508045)  | cliente in: SI | Cami out: NO | empleado out: SI | bots: NO');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
