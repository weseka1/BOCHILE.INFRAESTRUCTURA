// Fix: el jsonBody del Responder al Cliente respond.io usa template literal con replace que NO
// escapa saltos de linea -> JSON invalido cuando Cami responde con \n.
// Solucion: usar JSON.stringify completo del objeto para escape automatico.
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
  const responder = wf.nodes.find(n => n.name === 'Responder al Cliente respond.io');

  // Body construido con JSON.stringify -> n8n evalua, queda string JSON valido con todo escapado
  responder.parameters.jsonBody = "={{ JSON.stringify({ channelId: 503760, message: { type: 'text', text: $('Vendedor CORE').item.json.output } }) }}";

  // Aviso a vendedor: revisar si tiene mismo problema
  const aviso = wf.nodes.find(n => n.name === 'Aviso a vendedor real');
  if (aviso && aviso.parameters && aviso.parameters.jsonBody) {
    console.log('[info] Aviso a vendedor real jsonBody actual:');
    console.log(aviso.parameters.jsonBody.slice(0, 300));
  }

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];

  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,500)); process.exit(1); }

  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  // Verificar
  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  const r3 = wf2.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  console.log('\n[verificacion] jsonBody nuevo:');
  console.log(r3.parameters.jsonBody);
})();
