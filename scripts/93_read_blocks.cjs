const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const sm = String(w.nodes.find(n => n.name === 'Vendedor CORE').parameters.options.systemMessage);
  function getBlock(re) {
    const m = sm.match(re);
    if (!m) return 'NOT FOUND';
    const start = m.index;
    const next = sm.indexOf('\n# ', start + 5);
    return sm.slice(start, next > 0 ? next : start + 3000);
  }
  console.log('=== TONO ===');
  console.log(getBlock(/# TONO/));
  console.log('\n\n=== REGLA #0 ANTI-ALUCINACION ===');
  console.log(getBlock(/# REGLA #0 \(ABSOLUTA/));
  console.log('\n\n=== FORMATO DE RESPUESTA ===');
  console.log(getBlock(/# FORMATO DE RESPUESTA/));
})();
