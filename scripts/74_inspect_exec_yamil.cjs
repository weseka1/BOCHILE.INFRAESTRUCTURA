// Inspecciona el detalle de las ejecuciones 1578/1579 para ver que el
// parser detecto channel_id_val=508111 correctamente.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

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
  for (const id of [1578, 1579]) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${id}?includeData=true`)).b);
    const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
    console.log(`\n=== Exec ${id} ===`);
    if (par) {
      console.log('  channel_id_val:', par.channel_id_val);
      console.log('  from:', par.from);
      console.log('  canal:', par.canal);
      console.log('  mensaje:', String(par.text_body || par.mensaje || '').slice(0, 80));
      console.log('  lead_id:', par.lead_id);
      console.log('  skip:', par.skip);
    } else {
      console.log('  Parser sin output');
    }
    // Donde fallo?
    const errNodes = Object.keys(det.data?.resultData?.runData || {}).filter(n => {
      const node = det.data.resultData.runData[n];
      return node?.[0]?.error;
    });
    console.log('  Nodos con error:', errNodes.join(', '));
  }
})().catch(e => { console.error(e.message); });
