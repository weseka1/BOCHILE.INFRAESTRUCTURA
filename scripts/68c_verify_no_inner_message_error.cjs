// Verifica las ultimas ejecuciones del workflow para confirmar que
// el error "innerMessage is not defined" ya no aparece.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  // Confirmamos que el parser ya no contiene "if (innerMessage)"
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  const code = parser.parameters.jsCode;

  const stillHasBug = code.includes('if (innerMessage)');
  console.log('Bug "if (innerMessage)" sigue?', stillHasBug ? '❌ SI' : '✅ NO');

  const hasFix = code.includes('const snapText = String(text_body');
  console.log('Fix aplicado?', hasFix ? '✅ SI' : '❌ NO');

  // Listamos las ultimas 20 ejecuciones
  const ex = await req('GET', `/api/v1/executions?workflowId=${WF}&limit=20`);
  if (ex.s !== 200) { console.error('Listing fail:', ex.s); process.exit(1); }
  const data = JSON.parse(ex.b);
  const items = data.data || [];

  console.log(`\nUltimas ${items.length} ejecuciones del workflow:`);
  for (const e of items) {
    const time = e.startedAt;
    const status = e.status || (e.finished ? 'success' : (e.stoppedAt ? 'stopped' : '?'));
    const flag = e.status === 'error' || e.status === 'crashed' ? '❌' : '✅';
    console.log(`  ${flag} ${e.id}  ${time}  ${status}`);
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
