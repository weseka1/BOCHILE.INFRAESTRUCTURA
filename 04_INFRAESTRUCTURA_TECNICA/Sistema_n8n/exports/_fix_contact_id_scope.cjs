// Fix scope bug: contact_id_val declarado con const adentro del if -> no visible en return.
// Solucion: declarar let arriba, asignar adentro sin const.
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
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');

  let code = parser.parameters.jsCode;

  // 1) Inicializar contact_id_val arriba (antes del if)
  if (!code.includes('let contact_id_val =')) {
    code = code.replace(
      "let canal = 'whatsapp';",
      "let canal = 'whatsapp';\nlet contact_id_val = null;"
    );
  }

  // 2) Quitar el "const" del scope local
  code = code.replace(
    'const contact_id_val = contact.id || null;',
    'contact_id_val = contact.id || null;'
  );

  parser.parameters.jsCode = code;

  // Limpiar campos read-only para PUT (settings solo acepta ciertos campos)
  const ALLOWED_SETTINGS = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) {
    for (const k of ALLOWED_SETTINGS) {
      if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
    }
  }
  const clean = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: settingsClean,
  };

  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT status:', upd.status);
  if (upd.status !== 200) {
    console.log('Body:', upd.body.slice(0, 500));
    process.exit(1);
  }

  // Reactivar
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate status:', act.status);

  // Verificar
  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  const p2 = wf2.nodes.find(n => n.name === 'Parsear Mensaje');
  const lines = p2.parameters.jsCode.split('\n');
  console.log('\n[verificacion] linea 12-17:');
  for (let i = 11; i < 18; i++) console.log((i+1) + ': ' + lines[i]);
  console.log('\n[verificacion] linea 100-103:');
  for (let i = 99; i < 104; i++) console.log((i+1) + ': ' + lines[i]);
})();
