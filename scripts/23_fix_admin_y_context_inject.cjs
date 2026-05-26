// Fix final:
// 1. Sacar options.systemMessage del SubAgente Administrativo (rompia supplyData)
// 2. Inyectar lead_id real via el campo text del CORE (que SI evalua {{ }})
// 3. Revertir el bloque "CONTEXTO DEL LEAD ACTUAL" del systemMessage (no se evaluaba)
// 4. CORE prompt: usar tool 'Actualizar Lead CRM' directamente, sin pasar por sub-agente Administrativo
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

(async () => {
  const w1 = JSON.parse((await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp')).b);

  // 1. SubAgente Administrativo: limpiar systemMessage (rompia)
  const admin = w1.nodes.find(n => n.name === 'SubAgente Administrativo');
  if (admin?.parameters?.options?.systemMessage) {
    delete admin.parameters.options.systemMessage;
    console.log('Administrativo: systemMessage removido (era incompatible)');
  }

  // 2. Vendedor CORE: arreglar el text field para inyectar contexto evaluado
  const core = w1.nodes.find(n => n.name === 'Vendedor CORE');
  // El text field SI evalua expresiones (tiene prefijo =)
  core.parameters.text = "={{ '[lead_id=' + $('Merge Caminos').item.json.lead_id + ' | nombre=' + ($('Merge Caminos').item.json.nombre || 'Desconocido') + ' | tel=' + $('Merge Caminos').item.json.telefono + '] ' + $('Merge Caminos').item.json.mensaje }}";
  console.log('CORE.text: inyecta [lead_id=L-XXX | nombre | tel] mensaje');

  // 3. Limpiar el bloque "## CONTEXTO" del systemMessage (no se evaluaba)
  let sm = core.parameters.options.systemMessage;
  sm = sm.replace(/## CONTEXTO DEL LEAD ACTUAL[\s\S]*?\n\n/, '');
  // Y la nueva regla critica que use el lead_id de los corchetes
  const MARK_CTX = 'CADA MENSAJE DEL CLIENTE LLEGA PREFIJADO';
  if (!sm.includes(MARK_CTX)) {
    sm = sm + `\n\n================================================================\n` +
      `IDENTIFICACION DEL LEAD (CRITICO)\n` +
      `================================================================\n` +
      `CADA MENSAJE DEL CLIENTE LLEGA PREFIJADO con el contexto del lead asi:\n` +
      `  [lead_id=L-XXXXXXXXXX | nombre=Yamil | tel=549291XXXXXXX] mensaje del cliente\n\n` +
      `Cuando uses la tool "Actualizar Lead CRM", DEBES usar el lead_id que aparece\n` +
      `entre corchetes (ej. "L-2914100100"). NUNCA pongas "L-XXX" literal.\n` +
      `Tampoco repitas el prefijo en tu respuesta al cliente - es solo para tu uso interno.\n`;
  }
  // Refactor de la regla administrativa: usar tool directa, no sub-agente
  sm = sm.replace(/Administrativo\(\{"action":"actualizar_lead","datos":\{/g, 'Actualizar Lead CRM con campos {');
  sm = sm.replace(/llamas al sub-agente Administrativo con action="actualizar_lead"/g, 'llamas a la tool "Actualizar Lead CRM"');
  core.parameters.options.systemMessage = sm;
  console.log('CORE.systemMessage:', sm.length, 'chars (sin bloque CONTEXTO literal)');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w1.settings) for (const k of A) if (w1.settings[k] !== undefined) s[k] = w1.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w1.name, nodes: w1.nodes, connections: w1.connections, settings: s });
  await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('PUT W1:', upd.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
