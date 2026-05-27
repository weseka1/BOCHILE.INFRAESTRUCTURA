const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  const sm = String(core.parameters?.options?.systemMessage || '');
  console.log('TOTAL chars:', sm.length);
  // Listar headers
  const headers = sm.match(/^#+\s+.+$/gm) || [];
  console.log('\nHeaders:');
  for (let i = 0; i < headers.length; i++) console.log(`  ${i+1}. ${headers[i]}`);
})();
