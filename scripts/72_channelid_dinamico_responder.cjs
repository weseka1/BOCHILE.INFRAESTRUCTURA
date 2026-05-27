// Hace el channelId del nodo "Responder al Cliente respond.io" DINAMICO
// segun el canal por donde llego el mensaje original.
//
// Mapping:
//   webhook 506217 (WA Ventas)  -> API 505934  (comportamiento actual, intacto)
//   webhook 508111 (WA Yamil)   -> API 508111  (canal de test para probar Cami)
//   cualquier otro              -> API 505934  (fallback al actual)
//
// Asi: producción Ventas no cambia, y el canal de Yamil queda conectado para
// que el equipo Bochile pueda probar a Cami como clienta.
//
// Idempotente. Hace backup antes de modificar.

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

// Nuevo jsonBody: mapea channel_id_val del parser al channelId de API respond.io
const NEW_JSON_BODY = `={{ JSON.stringify({ channelId: ({'506217': 505934, '508111': 508111}[String($('Parsear Mensaje').item.json.channel_id_val || '')] || 505934), message: { type: 'text', text: $('Vendedor CORE').item.json.output } }) }}`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpPath = path.join(bkpDir, `${WF}_pre_channelid_dinamico_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpPath, JSON.stringify(w, null, 2));
  console.log('Backup:', bkpPath);

  const responder = w.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  if (!responder) { console.error('No encontre el nodo'); process.exit(1); }

  const oldBody = responder.parameters.jsonBody || '';
  console.log('\nBODY ACTUAL:');
  console.log(' ', oldBody.slice(0, 200));

  if (oldBody === NEW_JSON_BODY) {
    console.log('\nℹ️  Ya estaba aplicado (idempotente)');
    return;
  }

  responder.parameters.jsonBody = NEW_JSON_BODY;
  console.log('\nBODY NUEVO:');
  console.log(' ', NEW_JSON_BODY.slice(0, 200));

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('\nPUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);
  console.log('\n✅ channelId ahora es dinamico. Ventas (506217) sigue usando 505934. Yamil (508111) usa 508111.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
