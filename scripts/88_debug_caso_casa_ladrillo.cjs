// Debug del caso de la casa de ladrillo (no es Alem ni Witcomb).
// Cliente mando foto de casa de ladrillo con porton de madera + texto
// "hola! me darias informacion de esta casa?". El bot dijo "Alem 127"
// (mal) y luego "Islas Malvinas 300 Monte Hermoso USD 57.000" (mal).

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
  const exs = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=30`)).b);
  const lasts = (exs.data || []).slice(0, 30);

  // Buscar ejecuciones donde el caption contenga "esta casa"
  for (const e of lasts) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
    const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (!par || par.skip) continue;

    const texto = String(par.mensaje_original || '');
    const isInteresting = /esta casa|me darias|me daria|info|foto que te mande|isla|malvina|monte hermoso/i.test(texto);
    if (!isInteresting) continue;

    console.log(`\n========== Exec ${e.id} ${e.startedAt} ==========`);
    console.log(`  TEL: ${par.telefono} | LEAD: ${par.lead_id} | CHANNEL: ${par.channel_id}`);
    console.log(`  IN ${par.msg_type}: "${texto}"`);
    if (par.media_url) console.log(`  MEDIA: ${String(par.media_url).slice(0, 100)}`);

    if (par.msg_type === 'image') {
      const buscarImg = det.data?.resultData?.runData?.['Buscar Por Imagen']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (buscarImg) {
        const itemsBrief = (buscarImg.items || []).slice(0, 5).map(it => `${it.prop_id}=${it.title?.slice(0, 40)} (s=${it.score?.toFixed(3)})`).join('\n      ');
        console.log(`  BUSCAR-IMG (count=${buscarImg.count}):\n      ${itemsBrief}`);
      }
      const fm = det.data?.resultData?.runData?.['Formatear Match CLIP']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (fm) console.log(`  MATCH-FINAL: ${String(fm.mensaje || '').slice(0, 500)}`);
    }

    const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (core?.output) console.log(`  BOT OUT: "${String(core.output).slice(0, 400)}"`);
  }
})().catch(e => { console.error(e.message); });
