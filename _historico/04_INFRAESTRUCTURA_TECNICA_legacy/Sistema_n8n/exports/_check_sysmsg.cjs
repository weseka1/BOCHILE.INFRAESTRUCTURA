const http = require('node:http');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
function req(p){return new Promise((res,rej)=>{const r=http.request({host:'localhost',port:5680,path:p,method:'GET',headers:{'X-N8N-API-KEY':API_KEY}},resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});r.on('error',rej);r.end()})}
(async()=>{
  const r = await req('/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  const c = wf.nodes.find(n => n.name === 'Vendedor CORE');
  const sm = c.parameters.options.systemMessage;
  console.log('len:', sm.length);
  console.log('count CONTEXTO TEMPORAL:', (sm.match(/CONTEXTO TEMPORAL/g)||[]).length);
  console.log('count HOY es:', (sm.match(/HOY es/g)||[]).length);
  console.log('count DateTime:', (sm.match(/DateTime/g)||[]).length);
  console.log('count $now:', (sm.match(/\$now/g)||[]).length);
  console.log('count Formatear Equipo y Agenda:', (sm.match(/Formatear Equipo y Agenda/g)||[]).length);
  console.log('count EQUIPO Y AGENDA:', (sm.match(/EQUIPO Y AGENDA/g)||[]).length);
  console.log('\\n=== INICIO ===');
  console.log(sm.slice(0, 1500));
  console.log('\\n=== FIN ===');
  console.log(sm.slice(-1500));
})();
