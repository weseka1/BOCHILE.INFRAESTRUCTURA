// Re-aplica fixes + Responder con FALLBACK al webhook directo.
// Aunque la UI sobreescriba el Parser, el Responder sigue funcionando.
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

  // Detectar el nombre real del webhook (Webhook Twilio, Webhook respond.io, etc.)
  const webhookNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  const WEBHOOK_NAME = webhookNode ? webhookNode.name : 'Webhook Twilio';
  console.log('[info] webhook detectado:', WEBHOOK_NAME);

  // ============================
  // 1) PARSER FIX
  // ============================
  const parser = wf.nodes.find(n => n.name === 'Parsear Mensaje');
  let pc = parser.parameters.jsCode;

  if (!pc.includes('let contact_id_val =')) {
    pc = pc.replace("let canal = 'whatsapp';", "let canal = 'whatsapp';\nlet contact_id_val = null;");
  }
  if (!pc.includes('contact_id_val = contact.id')) {
    pc = pc.replace('const contact = body.contact || {};', "const contact = body.contact || {};\n  contact_id_val = contact.id || null;");
  }
  if (pc.includes('telefono_twilio: from,')) {
    pc = pc.replace('telefono_twilio: from,', 'contact_id: contact_id_val,');
  } else if (!pc.includes('contact_id: contact_id_val')) {
    pc = pc.replace('telefono: from,', 'telefono: from,\n  contact_id: contact_id_val,');
  }
  parser.parameters.jsCode = pc;

  // ============================
  // 2) RESPONDER: URL CON FALLBACK + JSON.stringify body
  // Lee primero del Parser, si falla lee directo del Webhook input.
  // Si la UI pisa el Parser, el Webhook input siempre tiene body.contact.id.
  // ============================
  const responder = wf.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  responder.parameters.url = "=https://api.respond.io/v2/contact/id:{{ $('Parsear Mensaje').item.json.contact_id || $('" + WEBHOOK_NAME + "').first().json.body.contact.id }}/message";
  responder.parameters.jsonBody = "={{ JSON.stringify({ channelId: 503760, message: { type: 'text', text: $('Vendedor CORE').item.json.output } }) }}";

  // ============================
  // 3) MATCHER TOOL: $fromAI
  // ============================
  const tool = wf.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');
  tool.parameters.workflowInputs = {
    mappingMode: 'defineBelow',
    value: {
      query: "={{ $fromAI('query', 'Descripcion natural de lo que busca el cliente', 'string') }}",
      operation: "={{ $fromAI('operation', 'sale o rent', 'string') }}",
      property_type: "={{ $fromAI('property_type', 'casa, departamento, ph, terreno, local, oficina', 'string') }}",
      price_max: "={{ $fromAI('price_max', 'Presupuesto max entero. 90000 para 90 mil USD', 'number') }}",
      price_currency: "={{ $fromAI('price_currency', 'USD o ARS', 'string') }}",
      bedrooms_min: "={{ $fromAI('bedrooms_min', 'Ambientes minimos', 'number') }}"
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

  // VERIFY
  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  const r3 = wf2.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  console.log('\nResponder URL final:', r3.parameters.url);
})();
