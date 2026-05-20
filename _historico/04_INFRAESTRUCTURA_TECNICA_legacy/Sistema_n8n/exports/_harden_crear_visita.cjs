// Refuerza Crear Visita: rechaza placeholders, fuerza valores reales o defaults.
const http = require('node:http');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

function req(method, path, body){
  return new Promise((res,rej)=>{
    const data = body ? JSON.stringify(body) : null;
    const opts = {host:'localhost',port:5680,path,method,headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}};
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});
    r.on('error',rej);
    if(data) r.write(data);
    r.end();
  });
}

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  const cv = wf.nodes.find(n => n.name === 'Crear Visita en CRM');

  // Refuerzo: para cada campo, rechazar placeholders conocidos
  cv.parameters.columns.value.prop_id = "={{ (function(){ const v = String($fromAI('prop_id', 'ID real de propiedad del catalogo, ej P-001 o 21886. NUNCA usar placeholders como P-XXX', 'string')||''); if(!v || v === 'P-XXX' || v === 'P-X' || v.length < 2) return 'NO_PROP_INFO'; return v; })() }}";
  cv.parameters.columns.value.vendedor_id = "={{ (function(){ const v = String($fromAI('vendedor_id', 'ID real del vendedor, ej E-1B. NUNCA placeholders como E-X', 'string')||''); if(!v || v === 'E-X' || v.length < 2) return 'E-1B'; return v; })() }}";
  cv.parameters.columns.value.vendedor_nombre = "={{ (function(){ const v = String($fromAI('vendedor_nombre', 'Nombre real del vendedor asignado, ej Camila Pomerich. NUNCA placeholders como Nombre Vendedor', 'string')||''); if(!v || v === 'nombre' || v === 'Nombre Vendedor' || v.length < 3) return 'Camila Pomerich'; return v; })() }}";
  cv.parameters.columns.value.direccion = "={{ (function(){ const v = String($fromAI('direccion', 'Direccion REAL de la propiedad, ej San Martin 566. NUNCA placeholders como dir', 'string')||''); if(!v || v === 'dir' || v.length < 5) return 'DIRECCION_PENDIENTE'; return v; })() }}";
  cv.parameters.columns.value.observaciones = "={{ (function(){ const v = String($fromAI('observaciones', 'Notas relevantes del cliente o de la conversacion', 'string')||''); if(!v || v === 'notas' || v.length < 3) return ''; return v; })() }}";

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);
})();
