// Fix Upsert Lead CRM: leer del nodo 'Merge Caminos' (donde estan lead_id/telefono/nombre)
// no del 'Buscar Lead Existente' (que devuelve vacio para leads nuevos)
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

  const u = w1.nodes.find(n => n.name === 'Upsert Lead CRM');
  // Reescribir los campos basicos que vienen del Merge Caminos.
  // Los campos enriquecidos (operacion, presupuesto, etc.) los va a llenar el Agent
  // via Actualizar Lead CRM, asi que aca solo seteamos lo basico.
  u.parameters.columns.value = {
    lead_id: "={{ $('Merge Caminos').item.json.lead_id }}",
    nombre: "={{ $('Merge Caminos').item.json.nombre }}",
    telefono: "={{ $('Merge Caminos').item.json.telefono }}",
    email: "={{ ($json && $json.email) || '' }}",
    canal: "={{ $('Merge Caminos').item.json.canal }}",
    operacion: "={{ ($json && $json.operacion) || '' }}",
    tipo_propiedad: "={{ ($json && $json.tipo_propiedad) || '' }}",
    zona_pref: "={{ ($json && $json.zona_pref) || '' }}",
    ambientes: "={{ ($json && $json.ambientes) || '' }}",
    presupuesto_min: "={{ ($json && $json.presupuesto_min) || '' }}",
    presupuesto_max: "={{ ($json && $json.presupuesto_max) || '' }}",
    moneda: "={{ ($json && $json.moneda) || '' }}",
    forma_pago: "={{ ($json && $json.forma_pago) || '' }}",
    urgencia: "={{ ($json && $json.urgencia) || '' }}",
    score: "={{ ($json && $json.score) || '' }}",
    etapa: "={{ ($json && $json.etapa) || 'Nuevo' }}",
    vendedor_asignado: "={{ ($json && $json.vendedor_asignado) || '' }}",
    ultima_intencion: "={{ ($json && $json.ultima_intencion) || '' }}",
    notas: "={{ ($json && $json.notas) || '' }}",
    creado_en: "={{ ($json && $json.creado_en) || $now.toISO() }}",
    actualizado_en: "={{ $now.toISO() }}",
  };

  // Asegurar matching column
  u.parameters.columns.matchingColumns = ['lead_id'];

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w1.settings) for (const k of A) if (w1.settings[k] !== undefined) s[k] = w1.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w1.name, nodes: w1.nodes, connections: w1.connections, settings: s });
  await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('Upsert Lead CRM: ahora lee de Merge Caminos para basicos. PUT', upd.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
