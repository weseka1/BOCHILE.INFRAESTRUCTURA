const http = require('node:http');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
function reqp(opts, body){return new Promise((res,rej)=>{const r=http.request(opts,resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});r.on('error',rej);if(body)r.write(body);r.end()})}
(async()=>{
  const r = await reqp({host:'localhost',port:5680,path:'/api/v1/workflows/aUMQyupnGJ5IWm5e',method:'GET',headers:{'X-N8N-API-KEY':API_KEY}});
  const wf = JSON.parse(r.body);
  const cv = wf.nodes.find(n => n.name === 'Crear Visita en CRM');
  // Validacion: si LLM manda fecha invalida o pasada, default a manana 11:00 ARG
  cv.parameters.columns.value.fecha = "={{ (function(){ const f = String($fromAI('fecha', 'YYYY-MM-DD obligatorio futuro', 'string')||''); const now = $now.setZone('America/Argentina/Buenos_Aires'); if(!/^\d{4}-\d{2}-\d{2}$/.test(f)) return now.plus({days:1}).toFormat('yyyy-LL-dd'); const fd = DateTime.fromISO(f, {zone:'America/Argentina/Buenos_Aires'}); if(fd < now.startOf('day')) return now.plus({days:1}).toFormat('yyyy-LL-dd'); return f; })() }}";
  cv.parameters.columns.value.hora = "={{ (function(){ const h = String($fromAI('hora', 'HH:MM 24h obligatorio', 'string')||''); if(!/^\d{2}:\d{2}$/.test(h)) return '11:00'; return h; })() }}";
  console.log('fecha:', cv.parameters.columns.value.fecha.slice(0,100));
  console.log('hora:', cv.parameters.columns.value.hora.slice(0,80));
  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = {executionOrder:'v1'};
  if(wf.settings) for(const k of allowed) if(wf.settings[k] !== undefined) settings[k]=wf.settings[k];
  const put = await reqp({host:'localhost',port:5680,path:'/api/v1/workflows/aUMQyupnGJ5IWm5e',method:'PUT',headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}},JSON.stringify({name:wf.name,nodes:wf.nodes,connections:wf.connections,settings}));
  console.log('PUT:', put.status);
  const act = await reqp({host:'localhost',port:5680,path:'/api/v1/workflows/aUMQyupnGJ5IWm5e/activate',method:'POST',headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}});
  console.log('Activate:', act.status === 200 ? 'OK' : 'FAIL');
})();
