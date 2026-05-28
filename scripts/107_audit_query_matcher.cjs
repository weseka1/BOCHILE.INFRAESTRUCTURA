// Auditar cómo el LLM arma la query al Matcher y qué filtros pasa.
// Necesito ver las llamadas a "Buscar Propiedades en Catalogo" en la
// conversacion reciente del lead L-2915770521 (post-reset).
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }
(async () => {
  // Buscar ejecuciones recientes del L-2915770521 con CORE corriendo
  let cursor = null;
  let scanned = 0;
  const MAX = 100;
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
      if (!par || par.telefono !== '5492915770521') continue;
      if (par.skip) continue;
      const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
      const matcher = det.data?.resultData?.runData?.['SubAgente Matcher'];
      const buscar = det.data?.resultData?.runData?.['Buscar Propiedades en Catalogo'];
      found.push({ id: e.id, ts: e.startedAt, txt: par.mensaje_original, out: core?.output, matcherRuns: matcher?.length || 0, buscarRuns: buscar?.length || 0, matcher: matcher, buscar: buscar });
    }
    if (!cursor || items.length === 0) break;
  }
  found.sort((a, b) => a.ts.localeCompare(b.ts));
  for (const f of found) {
    console.log(`\n===== ${f.id} ${f.ts} =====`);
    console.log(`IN : "${(f.txt || '').slice(0, 100)}"`);
    console.log(`OUT: "${(f.out || '').slice(0, 200)}"`);
    if (f.matcherRuns > 0) {
      console.log(`Matcher runs: ${f.matcherRuns}`);
      for (let i = 0; i < f.matcher.length; i++) {
        const r = f.matcher[i];
        const input = r.inputOverride || r.input;
        const inp = JSON.stringify(input?.main?.[0]?.[0]?.json || {}).slice(0, 200);
        console.log(`  matcher[${i}] input: ${inp}`);
      }
    }
    if (f.buscarRuns > 0) {
      console.log(`Buscar runs: ${f.buscarRuns}`);
      for (let i = 0; i < f.buscar.length; i++) {
        const r = f.buscar[i];
        const inp = r.inputOverride?.ai_tool?.[0]?.[0]?.json || r.input?.main?.[0]?.[0]?.json;
        const out = r.data?.main?.[0]?.[0]?.json || r.data?.ai_tool?.[0]?.[0]?.json;
        if (inp) console.log(`  buscar[${i}] query: ${JSON.stringify(inp).slice(0, 500)}`);
        if (out) console.log(`  buscar[${i}] result: ${JSON.stringify(out).slice(0, 500)}`);
      }
    }
  }
})();
