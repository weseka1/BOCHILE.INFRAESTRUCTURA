// RE-FIX: el UI volvio a poner removed: true y value: {} en Buscar Propiedades en Catalogo.
// Sin esto el LLM solo manda 'input' generico -> tool devuelve "query es obligatorio".
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
  const tool = wf.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');

  // value con $fromAI para que LLM rellene cada campo
  tool.parameters.workflowInputs = {
    mappingMode: 'defineBelow',
    value: {
      query: "={{ $fromAI('query', 'Descripcion natural de lo que busca el cliente, incluyendo zona, tipo, ambientes, caracteristicas. Ej: \"departamento en centro 2 ambientes con balcon\"', 'string') }}",
      operation: "={{ $fromAI('operation', 'Tipo de operacion: \"sale\" para venta, \"rent\" para alquiler', 'string') }}",
      property_type: "={{ $fromAI('property_type', 'Tipo de propiedad: casa, departamento, ph, terreno, local, oficina, etc. Si no se especifica, dejar vacio', 'string') }}",
      price_max: "={{ $fromAI('price_max', 'Presupuesto maximo en numero entero. Ej: 90000 para 90 mil USD. Si no especifica, dejar 0', 'number') }}",
      price_currency: "={{ $fromAI('price_currency', 'Moneda: USD o ARS. Por defecto USD si menciona dolares o miles altos', 'string') }}",
      bedrooms_min: "={{ $fromAI('bedrooms_min', 'Numero minimo de ambientes/dormitorios. Si no especifica, 0', 'number') }}"
    },
    matchingColumns: [],
    schema: [
      { id: 'query', displayName: 'query', required: true, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false },
      { id: 'operation', displayName: 'operation', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false },
      { id: 'property_type', displayName: 'property_type', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false },
      { id: 'price_max', displayName: 'price_max', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number', removed: false },
      { id: 'price_currency', displayName: 'price_currency', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string', removed: false },
      { id: 'bedrooms_min', displayName: 'bedrooms_min', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number', removed: false }
    ],
    attemptToConvertTypes: false,
    convertFieldsToString: false
  };

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
  const t2 = wf2.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');
  console.log('\n[verificacion] value keys:', Object.keys(t2.parameters.workflowInputs.value));
  console.log('[verificacion] schema removed flags:', t2.parameters.workflowInputs.schema.map(s => s.id + '=' + s.removed).join(', '));
})();
