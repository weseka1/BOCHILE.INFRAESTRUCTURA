// Fix operativo de la pausa del bot:
// 1. Bajar la pausa por intervencion humana de 24h a 2h (mas razonable para
//    produccion real - 24h dejaba al cliente sin respuesta todo el dia)
// 2. Despausar manualmente los telefonos de testing que quedaron bloqueados:
//    - 5492915512515 (Yamil)
//    - 5492915770521 (test)
//    - 5492915074095 (test casa ladrillo)

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

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_pausa_2h_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const node = w.nodes.find(n => n.name === 'Marcar Bot Pausado');
  if (!node) { console.error('No encontre Marcar Bot Pausado'); process.exit(1); }

  const oldExpr = '={{ new Date(Date.now() + 24*60*60*1000).toISOString() }}';
  const newExpr = '={{ new Date(Date.now() + 2*60*60*1000).toISOString() }}';

  const currentValue = node.parameters?.columns?.value?.bot_pausado_hasta;
  if (currentValue === newExpr) {
    console.log('ℹ️  Pausa ya estaba en 2h');
  } else {
    node.parameters.columns.value.bot_pausado_hasta = newExpr;
    console.log('✅ Pausa bot ajustada: 24h -> 2h');
  }

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  // Despausar leads de testing por la API del dashboard - usamos el endpoint
  // que tendria que existir o el sheet directamente. Como no tenemos endpoint,
  // simplemente informamos al usuario que para despausar manual hay que editar
  // la columna bot_pausado_hasta en el Sheet 'leads'.
  console.log('\n=== Manual: despausar leads de testing ===');
  console.log('Si querés probar AHORA con estos numeros pausados, editá el Sheet');
  console.log('  https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4');
  console.log('Tab "leads" -> columna "bot_pausado_hasta" -> dejar vacio o fecha pasada');
  console.log('Para los leads:');
  console.log('  L-2915512515 (Yamil)');
  console.log('  L-2915770521 (test foto)');
  console.log('  L-2915074095 (test casa ladrillo)');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
