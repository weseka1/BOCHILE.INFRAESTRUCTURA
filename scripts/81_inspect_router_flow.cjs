// Inspecciona el Router Parser y conexiones del parser para entender donde
// inyectar el detector de visitas humanas.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function api(m, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);

  // 1. Conexiones de Parsear Mensaje
  console.log('=== Connections from Parsear Mensaje ===');
  console.log(JSON.stringify(w.connections['Parsear Mensaje'], null, 2));

  // 2. Router Parser config
  console.log('\n=== Router Parser ===');
  const rp = w.nodes.find(n => n.name === 'Router Parser');
  if (rp) console.log(JSON.stringify(rp.parameters, null, 2).slice(0, 3000));

  // 3. Conexiones del Router
  console.log('\n=== Connections from Router Parser ===');
  console.log(JSON.stringify(w.connections['Router Parser'], null, 2));

  // 4. Log Mensaje Humano - como se llega ahi?
  console.log('\n=== Quien apunta a Log Mensaje Humano? ===');
  for (const [src, c] of Object.entries(w.connections)) {
    if (c.main) {
      for (const branch of c.main) {
        for (const item of (branch || [])) {
          if (item.node === 'Log Mensaje Humano') {
            console.log(`  ${src}`);
          }
        }
      }
    }
  }
})().catch(e => { console.error(e.message); });
