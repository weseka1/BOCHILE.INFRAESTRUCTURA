// Inspecciona la ultima conversacion entera del lead Yamil con foco en:
// 1. Audios: que transcribio Whisper, como llego al CORE
// 2. Repeticiones: secuencia de respuestas del bot
// 3. Si la transcripcion del audio se uso como ground truth o se ignoro

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
  // Las ultimas 20 ejecuciones del workflow
  const lasts = (exs.data || []).slice(0, 20);

  console.log('Ultimas 20 ejecs:');
  for (const e of lasts) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
    const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (!par || par.skip || par.telefono !== '5492915512515') continue;

    const ts = par.timestamp_iso || e.startedAt;
    const tipo = par.msg_type || 'text';
    const texto = String(par.mensaje_original || '').slice(0, 80);

    console.log(`\n--- ${e.id} ${ts} [${e.status}] ---`);
    console.log(`  IN ${tipo}: "${texto}"`);

    if (tipo === 'audio') {
      const wh = det.data?.resultData?.runData?.['Audio - Whisper']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (wh) console.log(`    [Whisper transcript]: ${JSON.stringify(wh).slice(0, 400)}`);
      const sa = det.data?.resultData?.runData?.['Audio - Set Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (sa) console.log(`    [Audio Set mensaje final]: ${String(sa.mensaje || '').slice(0, 400)}`);
    }

    if (tipo === 'image') {
      const buscarImg = det.data?.resultData?.runData?.['Buscar Por Imagen']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (buscarImg) {
        const itemsBrief = (buscarImg.items || []).slice(0, 3).map(it => `${it.prop_id}=${it.title?.slice(0, 30)} (s=${it.score?.toFixed(3)})`).join(' | ');
        console.log(`    [Buscar Img]: ${itemsBrief}`);
      }
      const fm = det.data?.resultData?.runData?.['Formatear Match CLIP']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (fm) console.log(`    [Match Final]: ${String(fm.mensaje || '').slice(0, 300)}`);
    }

    const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (core?.output) console.log(`  OUT: "${String(core.output).slice(0, 200)}"`);
  }
})().catch(e => { console.error(e.message); });
