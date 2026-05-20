// Pre-test debugging fixes:
//   1. Wait 7s sin unit (defaultea a hours en algunas versiones de n8n!) -> setear seconds
//   2. Cargar Historial perdió sheetName -> restaurar 'conversaciones'
//   3. Matcher description "Llamar SOLO con ..." impedia que el LLM lo llamara -> cambiar
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

  // FIX 1: Wait 7s con unit seconds explicito
  const wait = wf.nodes.find(n => n.name === 'Wait 7s');
  wait.parameters = { amount: 7, unit: 'seconds' };

  // FIX 2: Cargar Historial - restaurar sheetName
  const ch = wf.nodes.find(n => n.name === 'Cargar Historial Conversaciones');
  ch.parameters = {
    operation: 'lookup',
    documentId: { __rl: true, mode: 'id', value: '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4' },
    sheetName: { __rl: true, mode: 'name', value: 'conversaciones' },
    filtersUI: {
      values: [
        { lookupColumn: 'telefono', lookupValue: "={{ $('Merge Caminos').item.json.telefono }}" }
      ]
    },
    combineFilters: 'AND',
    options: { returnAllMatches: true }
  };

  // FIX 3: Matcher description que invite a llamar liberalmente
  const m = wf.nodes.find(n => n.name === 'SubAgente Matcher');
  m.parameters.toolDescription = 'MATCHER. Busca propiedades reales del catalogo Bochile. Llamalo APENAS tengas DOS de estos datos: tipo (casa/depto/etc) + zona, o tipo + presupuesto, o zona + presupuesto. NO esperes a tener TODOS los datos. Devuelve hasta 3 props o SIN_STOCK.';

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };

  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  const w2 = wf2.nodes.find(n => n.name === 'Wait 7s');
  const c2 = wf2.nodes.find(n => n.name === 'Cargar Historial Conversaciones');
  const m2 = wf2.nodes.find(n => n.name === 'SubAgente Matcher');
  console.log('\n[verificacion]');
  console.log('  Wait amount/unit:', w2.parameters.amount, '/', w2.parameters.unit);
  console.log('  Cargar Historial sheet:', c2.parameters.sheetName?.value);
  console.log('  Matcher desc starts:', m2.parameters.toolDescription.slice(0, 80));
})();
