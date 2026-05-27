// Buscar ejecuciones donde aparezca texto relacionado con la foto de la casa
// de ladrillo. Tambien encontrar respuestas del bot que mencionen Islas Malvinas
// o Monte Hermoso (sugieren alucinacion).

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

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
  let cursor = null;
  let scanned = 0;
  const MAX = 100;
  while (scanned < MAX) {
    const url = `/api/v1/executions?workflowId=${WF}&limit=30${cursor ? '&cursor=' + cursor : ''}`;
    const exs = JSON.parse((await api('GET', url)).b);
    const items = exs.data || [];
    cursor = exs.nextCursor;
    for (const e of items) {
      scanned++;
      const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (!par || par.skip) continue;
      const t = String(par.mensaje_original || '');
      const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
      const out = String(core?.output || '');
      const matchInput = /esta casa|info de esta|foto que te mande|me darias informacion/i.test(t);
      const matchOutput = /Islas Malvinas|Monte Hermoso|alem 127|Witcomb 65/i.test(out);
      if (matchInput || matchOutput) {
        console.log(`\n===== ${e.id} ${e.startedAt} (#${scanned}) =====`);
        console.log(`  TEL: ${par.telefono} CH: ${par.channel_id} ${par.msg_type}`);
        console.log(`  IN : "${t.slice(0, 120)}"`);
        if (par.media_url) console.log(`  IMG: ${String(par.media_url).slice(0, 80)}`);
        if (par.msg_type === 'image') {
          const buscarImg = det.data?.resultData?.runData?.['Buscar Por Imagen']?.[0]?.data?.main?.[0]?.[0]?.json;
          if (buscarImg) {
            const itemsBrief = (buscarImg.items || []).slice(0, 5).map(it => `${it.prop_id}=${(it.title||'').slice(0, 35)} s=${(it.score||0).toFixed(3)}`);
            console.log(`  CLIP items:\n      ${itemsBrief.join('\n      ')}`);
          }
          const fm = det.data?.resultData?.runData?.['Formatear Match CLIP']?.[0]?.data?.main?.[0]?.[0]?.json;
          if (fm) console.log(`  MATCH-FINAL: ${String(fm.mensaje || '').replace(/\n/g, ' ').slice(0, 350)}`);
        }
        console.log(`  OUT: "${out.slice(0, 350)}"`);
      }
    }
    if (!cursor || items.length === 0) break;
  }
  console.log(`\nScan complete. ${scanned} ejecuciones revisadas.`);
})().catch(e => { console.error(e.message); process.exit(1); });
