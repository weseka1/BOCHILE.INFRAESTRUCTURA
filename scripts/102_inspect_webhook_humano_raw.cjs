// Inspecciona el BODY CRUDO del webhook en ejecuciones con es_humano=true
// para ver como respond.io manda los Echo Messages (Camila desde WA Business)
// y por que el parser extrae texto vacio.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }

(async () => {
  // Inspecciono 3 ejecuciones recientes con mark_pausa=true para ver body crudo
  for (const id of [2064, 2034, 2024]) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${id}?includeData=true`)).b);
    console.log(`\n===== Exec ${id} =====`);
    const wh = det.data?.resultData?.runData?.['Webhook Respond.io']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (!wh) { console.log('  Sin webhook data'); continue; }

    // Vamos al body del webhook
    const body = wh.body || wh;
    console.log('  evento:', body.event_type);
    console.log('  contact:', JSON.stringify(body.contact || {}).slice(0, 150));
    console.log('  channel:', JSON.stringify(body.channel || {}).slice(0, 100));
    console.log('  sender:', JSON.stringify(body.sender || {}).slice(0, 200));
    console.log('  message keys:', Object.keys(body.message || {}));
    console.log('  message full:', JSON.stringify(body.message || {}).slice(0, 500));
    console.log('  message.message keys:', Object.keys((body.message || {}).message || {}));
    console.log('  message.message full:', JSON.stringify((body.message || {}).message || {}).slice(0, 500));
  }
})();
