// Re-aplica TODOS los fixes que la UI sobreescribio.
// Idempotente: corre cuantas veces quieras y deja el workflow correcto.
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

  // ============================
  // 1) PARSER: contact_id + scope
  // ============================
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  let pc = parser.parameters.jsCode;

  // a) Declarar contact_id_val arriba (idempotente)
  if (!pc.includes('let contact_id_val =')) {
    pc = pc.replace("let canal = 'whatsapp';", "let canal = 'whatsapp';\nlet contact_id_val = null;");
  }
  // b) Asignar dentro del if isRespondio (idempotente)
  if (!pc.includes('contact_id_val = contact.id')) {
    pc = pc.replace('const contact = body.contact || {};', "const contact = body.contact || {};\n  contact_id_val = contact.id || null;");
  }
  // c) Reemplazar telefono_twilio por contact_id en el return (idempotente)
  if (pc.includes('telefono_twilio: from,')) {
    pc = pc.replace('telefono_twilio: from,', 'contact_id: contact_id_val,');
  } else if (!pc.includes('contact_id: contact_id_val')) {
    pc = pc.replace('telefono: from,', 'telefono: from,\n  contact_id: contact_id_val,');
  }
  parser.parameters.jsCode = pc;

  // ============================
  // 2) RESPONDER: URL id: + jsonBody con JSON.stringify
  // ============================
  const responder = wf.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  responder.parameters.url = "=https://api.respond.io/v2/contact/id:{{ $('Parsear Mensaje').item.json.contact_id }}/message";
  responder.parameters.jsonBody = "={{ JSON.stringify({ channelId: 503760, message: { type: 'text', text: $('Vendedor CORE').item.json.output } }) }}";

  // ============================
  // 3) MATCHER TOOL: re-aplicar $fromAI (idempotente)
  // ============================
  const tool = wf.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');
  tool.parameters.workflowInputs = {
    mappingMode: 'defineBelow',
    value: {
      query: "={{ $fromAI('query', 'Descripcion natural de lo que busca el cliente, incluyendo zona, tipo, ambientes, caracteristicas', 'string') }}",
      operation: "={{ $fromAI('operation', 'Tipo de operacion: sale para venta, rent para alquiler', 'string') }}",
      property_type: "={{ $fromAI('property_type', 'Tipo: casa, departamento, ph, terreno, local, oficina, etc.', 'string') }}",
      price_max: "={{ $fromAI('price_max', 'Presupuesto maximo en entero. Ej 90000 para 90 mil USD. Si no, 0', 'number') }}",
      price_currency: "={{ $fromAI('price_currency', 'Moneda: USD o ARS', 'string') }}",
      bedrooms_min: "={{ $fromAI('bedrooms_min', 'Ambientes minimos. Si no especifica, 0', 'number') }}"
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

  // PUT
  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };

  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }

  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  // VERIFICACION
  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  const p2 = wf2.nodes.find(n => n.name === 'Parsear Mensaje');
  const r3 = wf2.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  const t2 = wf2.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');

  console.log('\n=== VERIFICACION ===');
  console.log('Parser tiene "let contact_id_val":', p2.parameters.jsCode.includes('let contact_id_val'));
  console.log('Parser tiene "contact_id: contact_id_val":', p2.parameters.jsCode.includes('contact_id: contact_id_val'));
  console.log('Parser tiene "telefono_twilio":', p2.parameters.jsCode.includes('telefono_twilio'));
  console.log('Responder URL contiene "id:":', r3.parameters.url.includes('contact/id:'));
  console.log('Responder URL contiene "phone:":', r3.parameters.url.includes('contact/phone:'));
  console.log('Responder jsonBody usa JSON.stringify:', r3.parameters.jsonBody.includes('JSON.stringify'));
  console.log('Matcher value tiene query:', !!t2.parameters.workflowInputs.value.query);
  console.log('Matcher schema removed=false:', t2.parameters.workflowInputs.schema.every(s => s.removed === false));
})();
