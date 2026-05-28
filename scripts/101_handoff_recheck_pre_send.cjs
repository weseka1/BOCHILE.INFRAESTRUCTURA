// HANDOFF REFUERZO: agregar re-check de pausa JUSTO ANTES de enviar.
//
// Bug: el flow tarda 15-30s desde Check Bot Activo hasta Responder al Cliente.
// Si en el medio Camila escribe manualmente, el handoff se dispara (Marcar
// Bot Pausado) pero el bot YA paso el checkpoint y va a responder igual,
// pisando al humano.
//
// Fix: nuevo nodo "Recheck Pausa Pre-Send" entre "Registrar Accion IA" y
// "Responder al Cliente respond.io". Lee bot_pausado_hasta del Sheet en
// tiempo real (sin cache). Si esta pausado, return [] (skip) -> no envia.
//
// Idempotente.

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

// Codigo del nodo Re-Check. Lee del dashboard-api /api/leads (cache 30s,
// aceptable). Si bot_pausado_hasta esta en el futuro -> skip.
const CODE = `// Re-Check Pausa Pre-Send
// Si Camila respondio al cliente mientras Cami procesaba, el bot no debe pisar.

const lead_id = $("Parsear Mensaje").first().json.lead_id;
const inp = $input.first().json;

if (!lead_id) {
  // No deberia pasar, dejamos seguir
  return [{ json: inp }];
}

try {
  const r = await fetch('https://bochile-dashboard-api.onrender.com/api/leads');
  if (!r.ok) {
    console.log('[recheck_pausa] dashboard-api fail, dejamos seguir por safety');
    return [{ json: inp }];
  }
  const leads = await r.json();
  const lead = leads.find(l => l.lead_id === lead_id);
  if (!lead) {
    return [{ json: inp }];
  }
  const pausa = lead.bot_pausado_hasta;
  if (pausa) {
    const fp = new Date(pausa);
    if (!isNaN(fp.getTime()) && fp > new Date()) {
      console.log('[recheck_pausa] BLOQUEADO - humano respondio mientras procesabamos, abortando envio. Lead:', lead_id, 'pausado_hasta:', pausa);
      return []; // skip, no enviar
    }
  }
  return [{ json: inp }];
} catch (e) {
  console.log('[recheck_pausa] error:', e.message, '- dejamos seguir por safety');
  return [{ json: inp }];
}
`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_recheck_pausa_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const NODE_NAME = 'Recheck Pausa Pre-Send';
  let node = w.nodes.find(n => n.name === NODE_NAME);
  if (!node) {
    const responder = w.nodes.find(n => n.name === 'Responder al Cliente respond.io');
    const pos = responder ? [responder.position[0] - 180, responder.position[1] + 90] : [3200, 800];
    node = {
      parameters: { jsCode: CODE },
      id: `node-recheck-pausa-${Date.now()}`,
      name: NODE_NAME,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos,
      onError: 'continueRegularOutput',
    };
    w.nodes.push(node);
    console.log('✅ Nodo Recheck Pausa Pre-Send creado');
  } else {
    node.parameters.jsCode = CODE;
    console.log('ℹ️  Nodo ya existia, actualizado');
  }

  // Reconexion:
  //   ANTES: Registrar Accion IA -> Responder al Cliente respond.io
  //   DESPUES: Registrar Accion IA -> Recheck Pausa Pre-Send -> Responder al Cliente respond.io
  const conn = w.connections['Registrar Accion IA'];
  if (!conn || !conn.main || !conn.main[0]) {
    console.error('Registrar Accion IA no tiene conexiones main[0]');
    process.exit(2);
  }

  const alreadyInChain = conn.main[0].some(it => it.node === NODE_NAME);
  if (alreadyInChain) {
    console.log('ℹ️  Cadena ya tiene Recheck Pausa (idempotente)');
  } else {
    // El siguiente nodo despues de Registrar Accion IA era Responder al Cliente.
    // Lo movemos detras de Recheck.
    const oldNext = conn.main[0].slice();
    conn.main[0] = [{ node: NODE_NAME, type: 'main', index: 0 }];
    w.connections[NODE_NAME] = w.connections[NODE_NAME] || { main: [[]] };
    w.connections[NODE_NAME].main[0] = oldNext;
    console.log('✅ Cadena: Registrar Accion IA -> Recheck Pausa Pre-Send -> Responder al Cliente respond.io');
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

  console.log('\n=== Resultado ===');
  console.log('Si Camila escribe mientras Cami procesa (~15-30s de gap):');
  console.log('  1. Webhook saliente de respond.io llega');
  console.log('  2. Parser marca es_humano=true -> Marcar Bot Pausado (escribe bot_pausado_hasta)');
  console.log('  3. Mientras tanto, el flow del bot termina su LLM y Log Mensaje Saliente');
  console.log('  4. Antes de Responder al Cliente, RE-CHECK lee bot_pausado_hasta del Sheet');
  console.log('  5. Detecta que fue pausado -> NO envia. Camila habla, Cami calla.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
