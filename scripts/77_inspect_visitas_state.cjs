// Inspecciona estado actual del flow respecto a visitas:
// 1. Que tools tiene conectadas SubAgente Administrativo (en particular Crear Visita en CRM)
// 2. systemMessage del Vendedor CORE y SubAgente Administrativo
// 3. Si hay alguna logica que prevenga al bot de agendar
// 4. Ultimas visitas creadas en el Sheet (para saber si efectivamente esta agendando)

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
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);

  // 1. Que esta conectado al SubAgente Administrativo via ai_tool
  console.log('=== Conexiones ai_tool -> SubAgente Administrativo ===');
  for (const [src, c] of Object.entries(w.connections)) {
    if (c.ai_tool) {
      for (const branch of c.ai_tool) {
        for (const item of (branch || [])) {
          if (item.node === 'SubAgente Administrativo') console.log(`  ${src}`);
        }
      }
    }
  }

  // 2. Tipo y descripcion de Crear Visita en CRM
  console.log('\n=== Crear Visita en CRM ===');
  const cv = w.nodes.find(n => n.name === 'Crear Visita en CRM');
  if (cv) {
    console.log('  Type:', cv.type);
    console.log('  toolDescription:', String(cv.parameters?.toolDescription || '').slice(0, 250));
    console.log('  operation:', cv.parameters?.operation);
    console.log('  sheetName:', cv.parameters?.sheetName?.value);
  } else {
    console.log('  No existe el nodo');
  }

  // 3. systemMessage del CORE (buscar "visita", "agendar")
  console.log('\n=== Vendedor CORE systemMessage (extracto) ===');
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (core) {
    const sm = String(core.parameters?.options?.systemMessage || '');
    console.log('  Tamano total:', sm.length, 'chars');
    // Sacar lineas que mencionen visita/agendar/crear visita
    const lines = sm.split('\n');
    const relevant = lines.map((l, i) => ({ l, i })).filter(({ l }) => /visit|agend|reuni/i.test(l));
    console.log(`  Lineas con visita/agendar/reunion: ${relevant.length}`);
    for (const { l, i } of relevant.slice(0, 30)) console.log(`    L${i}: ${l.slice(0, 180)}`);
  }

  // 4. systemMessage del SubAgente Administrativo
  console.log('\n=== SubAgente Administrativo systemMessage / toolDescription ===');
  const admin = w.nodes.find(n => n.name === 'SubAgente Administrativo');
  if (admin) {
    console.log('  toolDescription:', String(admin.parameters?.toolDescription || '').slice(0, 300));
    const sm = String(admin.parameters?.options?.systemMessage || '');
    console.log('  systemMessage tamano:', sm.length);
    if (sm) {
      const lines = sm.split('\n');
      const relevant = lines.map((l, i) => ({ l, i })).filter(({ l }) => /visit|agend|reuni/i.test(l));
      console.log(`  Lineas con visita/agendar: ${relevant.length}`);
      for (const { l, i } of relevant.slice(0, 20)) console.log(`    L${i}: ${l.slice(0, 180)}`);
    }
  }
})().catch(e => { console.error(e.message); });
