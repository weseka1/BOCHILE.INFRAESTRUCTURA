// Debug del flujo de identificacion de propiedad por imagen.
// 1. Ver la ultima ejecucion del bot que recibio una imagen del lead de Yamil
// 2. Inspeccionar: Imagen Vision output, Buscar Por Imagen output, Vendedor CORE input

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
  // Buscar ejecuciones recientes con tipo imagen
  const exs = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=25`)).b);
  const candidates = (exs.data || []).filter(e => e.status === 'success').slice(0, 15);
  console.log(`Revisando ${candidates.length} ejecuciones recientes...`);

  for (const e of candidates) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
    const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (par?.msg_type !== 'image') continue;

    console.log(`\n\n========== Exec ${e.id} ${e.startedAt} ==========`);
    console.log('Lead:', par.lead_id, '| Tel:', par.telefono, '| Nombre:', par.nombre);
    console.log('Texto caption:', par.mensaje_original);
    console.log('Media URL:', par.media_url?.slice(0, 100));

    const vision = det.data?.resultData?.runData?.['Imagen - Vision']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (vision) {
      console.log('\n[Imagen Vision output]:');
      console.log(JSON.stringify(vision, null, 2).slice(0, 1500));
    }

    const setImg = det.data?.resultData?.runData?.['Imagen - Set Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (setImg) {
      console.log('\n[Imagen Set Mensaje]:');
      console.log(JSON.stringify(setImg, null, 2).slice(0, 1500));
    }

    const buscarImg = det.data?.resultData?.runData?.['Buscar Por Imagen']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (buscarImg) {
      console.log('\n[Buscar Por Imagen output]:');
      console.log(JSON.stringify(buscarImg, null, 2).slice(0, 2000));
    }

    const formatMatch = det.data?.resultData?.runData?.['Formatear Match CLIP']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (formatMatch) {
      console.log('\n[Formatear Match CLIP output]:');
      console.log(JSON.stringify(formatMatch, null, 2).slice(0, 1500));
    }

    const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
    if (core?.output) {
      console.log('\n[Vendedor CORE output]:');
      console.log(String(core.output).slice(0, 800));
    }

    break; // solo el mas reciente
  }
})().catch(e => { console.error(e.message); });
