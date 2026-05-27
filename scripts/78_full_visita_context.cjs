// Lee el contexto completo del workflow respecto a visitas:
// - donde esta conectada Crear Visita en CRM (ai_tool de quien?)
// - todo el bloque del systemMessage sobre visitas y agenda
// - que otras tools tienen que ver con visitas (Leer Vendedores Activos, etc)

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODR8MDg3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const KEY2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

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
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);

  // 1. Para CADA nodo que sea ai_tool / tool, ver a quien esta conectado
  console.log('=== Mapa de tools ai_tool ===');
  const toolNodes = ['Crear Visita en CRM', 'Guardar Match Pendiente', 'Actualizar Lead CRM', 'Avisar Vendedor respond.io', 'Leer Agenda Vendedor', 'Leer Vendedores Activos', 'Cerrar Conversacion', 'SubAgente Calificador', 'SubAgente Matcher', 'SubAgente Administrativo', 'Buscar Propiedades en Catalogo', 'Buscar Por Imagen', 'Buscar Por Proximidad Geo'];
  for (const t of toolNodes) {
    const c = w.connections[t];
    if (!c) { console.log(`  ${t}: NO CONECTADO`); continue; }
    if (!c.ai_tool) { console.log(`  ${t}: sin ai_tool out`); continue; }
    const targets = [];
    for (const branch of c.ai_tool) for (const item of (branch || [])) targets.push(item.node);
    console.log(`  ${t.padEnd(35)} -> ai_tool: ${targets.join(', ')}`);
  }

  // 2. Bloque entero del systemMessage del CORE sobre visitas
  console.log('\n=== systemMessage CORE - bloque AGENDA Y VISITAS ===');
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  const sm = String(core.parameters?.options?.systemMessage || '');
  // Sacar el bloque entero "# AGENDA Y VISITAS" hasta el siguiente #
  const idx = sm.indexOf('# AGENDA');
  if (idx >= 0) {
    const next = sm.indexOf('\n# ', idx + 5);
    const block = sm.slice(idx, next > 0 ? next : idx + 2500);
    console.log(block);
  }

  // 3. Bloque "TOOLS" o de herramientas
  console.log('\n=== systemMessage CORE - bloque TOOLS ===');
  const idx2 = sm.search(/#\s*TOOLS|#\s*HERRAMIENT/i);
  if (idx2 >= 0) {
    const next2 = sm.indexOf('\n# ', idx2 + 5);
    const block2 = sm.slice(idx2, next2 > 0 ? next2 : idx2 + 2000);
    console.log(block2);
  }
})().catch(e => { console.error(e.message); });
