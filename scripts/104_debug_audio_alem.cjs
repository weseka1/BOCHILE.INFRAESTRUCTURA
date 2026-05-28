// Debug del audio reciente de Yamil para ver por que Cami escribio "M127"
// en vez de "Alem 127"
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  // Buscar las ultimas ejecs del tel Yamil con tipo audio
  let cursor = null;
  let found = 0;
  while (found < 5) {
    const url = `/api/v1/executions?workflowId=${WF}&limit=30${cursor ? '&cursor=' + cursor : ''}`;
    const exs = JSON.parse((await api('GET', url)).b);
    const items = exs.data || [];
    cursor = exs.nextCursor;
    for (const e of items) {
      const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (!par || par.telefono !== '5492915512515') continue;
      if (par.msg_type !== 'audio') continue;
      found++;
      console.log(`\n===== ${e.id} ${e.startedAt} =====`);
      const wh = det.data?.resultData?.runData?.['Audio - Whisper']?.[0]?.data?.main?.[0]?.[0]?.json;
      console.log('  Whisper transcript:', JSON.stringify(wh).slice(0, 500));
      const setMsg = det.data?.resultData?.runData?.['Audio - Set Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      console.log('  Audio Set Mensaje (lo que ve CORE):');
      console.log('   ', String(setMsg?.mensaje || '').slice(0, 400));
      const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
      console.log('  CORE response:');
      console.log('   ', String(core?.output || '').slice(0, 400));
      if (found >= 3) break;
    }
    if (!cursor || items.length === 0 || found >= 3) break;
  }
})();
