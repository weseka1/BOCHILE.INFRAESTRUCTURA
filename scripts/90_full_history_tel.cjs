// Historico completo del/los telefono(s) pasado(s) como args.
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  const tels = process.argv.slice(2);
  let cursor = null;
  let scanned = 0;
  const MAX = 150;
  const found = [];
  while (scanned < MAX) {
    const url = `/api/v1/executions?workflowId=${WF}&limit=30${cursor ? '&cursor=' + cursor : ''}`;
    const exs = JSON.parse((await api('GET', url)).b);
    const items = exs.data || [];
    cursor = exs.nextCursor;
    for (const e of items) {
      scanned++;
      const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (!par) continue;
      if (!tels.includes(par.telefono)) continue;
      const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
      const skip = par.skip ? '[SKIP ' + (par.reason||'') + ']' : '';
      const pausa = par.mark_pausa ? '[PAUSA]' : '';
      found.push({ id: e.id, ts: e.startedAt, tel: par.telefono, tipo: par.msg_type, skip, pausa, txt: String(par.mensaje_original || '').slice(0, 100), out: String(core?.output || '').slice(0, 200) });
    }
    if (!cursor || items.length === 0) break;
  }
  found.sort((a, b) => a.ts.localeCompare(b.ts));
  for (const f of found) {
    console.log(`${f.ts} ${f.id} [${f.tel}] ${f.tipo} ${f.skip}${f.pausa}`);
    if (f.txt) console.log(`  IN : "${f.txt}"`);
    if (f.out) console.log(`  OUT: "${f.out}"`);
  }
  console.log(`\n(${found.length} ejecuciones encontradas en ${scanned} escaneadas)`);
})().catch(e => { console.error(e.message); process.exit(1); });
