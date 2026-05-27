// Muestra TODOS los nodos que se ejecutaron en una exec, en orden
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  for (const id of process.argv.slice(2)) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${id}?includeData=true`)).b);
    console.log(`===== ${id} =====`);
    const runData = det.data?.resultData?.runData || {};
    // Sort by startTime
    const all = [];
    for (const [name, runs] of Object.entries(runData)) {
      for (const r of runs) {
        all.push({ name, startTime: r.startTime || 0, executionTime: r.executionTime || 0, error: r.error?.message, outputSummary: JSON.stringify(r.data?.main?.[0]?.[0]?.json || {}).slice(0, 120) });
      }
    }
    all.sort((a, b) => a.startTime - b.startTime);
    for (const r of all) {
      const flag = r.error ? '❌' : '✅';
      console.log(`  ${flag} ${r.name.padEnd(38)} t=${r.executionTime}ms ${r.error ? '[ERR: ' + r.error.slice(0,100) + ']' : r.outputSummary}`);
    }
  }
})().catch(e => { console.error(e.message); });
