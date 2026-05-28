// Inspecciona el path desde Vendedor CORE hasta Responder al Cliente para
// ver si hay un check de pausa pre-send. Si no hay, hay race condition:
// el bot puede tardar 15-30s procesando y mientras tanto un humano responde
// pero el bot ya pasó el checkpoint inicial.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  // Conexiones desde CORE
  console.log('=== Vendedor CORE main connections ===');
  console.log(JSON.stringify(w.connections['Vendedor CORE'], null, 2));
  // Conexiones que llegan a Responder al Cliente respond.io
  console.log('\n=== Quien apunta a Responder al Cliente respond.io ===');
  for (const [src, c] of Object.entries(w.connections)) {
    if (c.main) {
      for (let i = 0; i < c.main.length; i++) {
        for (const item of (c.main[i] || [])) {
          if (item.node === 'Responder al Cliente respond.io') {
            console.log(`  ${src} main[${i}]`);
          }
        }
      }
    }
  }
  // Conexiones desde Switch Bot Activo (el check inicial)
  console.log('\n=== Switch Bot Activo connections ===');
  console.log(JSON.stringify(w.connections['Switch Bot Activo'], null, 2));
})();
