// Inspecciona ejecuciones puntuales pasadas via args.
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODR8MDg3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const KEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
function api(m, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY2 }, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}
(async () => {
  const ids = process.argv.slice(2);
  for (const id of ids) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${id}?includeData=true`)).b);
    console.log(`===== ${id} =====`);
    console.log('  status:', det.status);
    console.log('  error?:', det.data?.resultData?.error?.message?.slice(0, 200));

    const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (par) {
      console.log('  IN:', par.msg_type, JSON.stringify(par.mensaje_original));
      console.log('  TEL:', par.telefono, 'CH:', par.channel_id);
    }

    const fm = det.data?.resultData?.runData?.['Formatear Match CLIP']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (fm) console.log('  MATCH-FINAL:\n', fm.mensaje);

    // Inspeccionar TODOS los nodos del CORE para ver si hubo errores
    const runData = det.data?.resultData?.runData || {};
    const nodesWithError = [];
    for (const [name, runs] of Object.entries(runData)) {
      for (const r of runs) {
        if (r.error) nodesWithError.push({ name, msg: r.error.message });
      }
    }
    if (nodesWithError.length) {
      console.log('  Nodos con error:');
      for (const ne of nodesWithError) console.log(`    ${ne.name}: ${ne.msg?.slice(0, 200)}`);
    }

    const core = det.data?.resultData?.runData?.['Vendedor CORE'];
    if (core) {
      console.log('  CORE runs:', core.length);
      for (let i = 0; i < core.length; i++) {
        const c = core[i];
        console.log(`    Run ${i} status: ${c.error ? 'ERROR: ' + c.error.message?.slice(0, 200) : 'OK'}`);
        const out = c.data?.main?.[0]?.[0]?.json?.output;
        console.log(`    Output: ${JSON.stringify(out)?.slice(0, 400)}`);
      }
    }

    const responder = det.data?.resultData?.runData?.['Responder al Cliente respond.io'];
    if (responder) {
      console.log('  Responder al Cliente runs:', responder.length);
      for (let i = 0; i < responder.length; i++) {
        const r = responder[i];
        console.log(`    Run ${i} status: ${r.error ? 'ERROR: ' + r.error.message?.slice(0, 200) : 'OK'}`);
        const data = r.data?.main?.[0]?.[0]?.json;
        console.log(`    Response: ${JSON.stringify(data)?.slice(0, 300)}`);
      }
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
