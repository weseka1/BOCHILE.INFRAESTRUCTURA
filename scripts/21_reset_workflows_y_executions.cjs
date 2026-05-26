// Despublica + republica los 7 workflows para reiniciar el ciclo
// Tambien borra las ejecuciones viejas
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(method, p) {
  return new Promise(r => {
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: { 'X-N8N-API-KEY': KEY } }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  const wfs = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  console.log('--- Reset ciclo de los ' + wfs.length + ' workflows ---');
  for (const w of wfs) {
    const off = await req('POST', '/api/v1/workflows/' + w.id + '/deactivate');
    await new Promise(r => setTimeout(r, 500));
    const on = await req('POST', '/api/v1/workflows/' + w.id + '/activate');
    console.log('  ' + w.name + ' | off:' + off.s + ' | on:' + on.s);
  }

  console.log('\n--- Borrar executions viejas ---');
  let totalDel = 0;
  for (let i = 0; i < 5; i++) {
    const r = JSON.parse((await req('GET', '/api/v1/executions?limit=100')).b);
    const exs = r.data || [];
    if (exs.length === 0) break;
    for (const e of exs) {
      await req('DELETE', '/api/v1/executions/' + e.id);
      totalDel++;
    }
    console.log('  batch ' + (i+1) + ': borradas ' + exs.length);
  }
  console.log('Total executions borradas:', totalDel);

  console.log('\n--- Estado final ---');
  const wfs2 = JSON.parse((await req('GET', '/api/v1/workflows?limit=20')).b).data;
  for (const w of wfs2) console.log('  active:', w.active, '|', w.name);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
