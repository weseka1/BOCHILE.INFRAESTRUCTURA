// Simula un mensaje de respond.io con payload nativo, lo manda a n8n directo,
// y verifica la ejecucion completa. Esto valida el flow E2E sin necesidad de
// que respond.io este configurado.
const http = require('node:http');

function reqJson(host, port, path, method, body, headers){
  return new Promise((res,rej)=>{
    const data = body ? JSON.stringify(body) : null;
    const opts = {host,port,path,method,headers: {'Content-Type':'application/json', ...(headers||{})}};
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});
    r.on('error',rej);
    if(data) r.write(data);
    r.end();
  });
}

const N8N = {host:'localhost', port:5680};
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

// Payload identico al que respond.io manda (basado en exec 3521 real)
const PAYLOAD = {
  event_type: 'message.received',
  event_id: 'e2e-test-' + Date.now(),
  contact: {
    id: 450131632,
    firstName: 'Juani',
    lastName: '',
    phone: '+5492915512515',
    email: null,
    language: null,
    profilePic: null,
    countryCode: 'AR',
    status: 'open',
    assignee: { id: null, firstName: null, lastName: null, email: null },
    created_at: 1779040670
  },
  message: {
    messageId: Date.now() * 1000,
    channelMessageId: 'wamid.TEST-' + Date.now(),
    contactId: 450131632,
    channelId: 503760,
    traffic: 'incoming',
    timestamp: Date.now(),
    message: { type: 'text', text: 'hola, busco un departamento en el centro hasta 90 mil dolares' }
  },
  channel: { id: 503760, name: 'Whatsapp Business', source: 'whatsapp_business' },
  sender: { source: 'contact' }
};

(async()=>{
  console.log('=== E2E TEST ===');
  console.log('Enviando payload a webhook n8n...');
  const r = await reqJson(N8N.host, N8N.port, '/webhook/bochile-chat', 'POST', PAYLOAD);
  console.log('Webhook respondio:', r.status);
  console.log('Body:', r.body.slice(0, 300));

  // Esperar a que termine la ejecucion (Wait 7s + procesamiento)
  console.log('\nEsperando 25s para que termine la ejecucion (Wait 7s + LLM + Matcher + Responder)...');
  await new Promise(res => setTimeout(res, 25000));

  // Buscar la ultima exec
  const ex = await new Promise((res)=>{
    const r2 = http.request({host:'localhost',port:5680,path:'/api/v1/executions?workflowId=aUMQyupnGJ5IWm5e&limit=3',method:'GET',headers:{'X-N8N-API-KEY':N8N_API_KEY}}, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res(JSON.parse(d)))});
    r2.end();
  });
  console.log('\n=== ULTIMAS 3 EXEC ===');
  for (const e of ex.data) {
    console.log('  exec ' + e.id + ' | finished=' + e.finished + ' status=' + (e.status || 'n/a') + ' | ' + e.startedAt);
  }

  // Inspeccionar la ultima
  const lastId = ex.data[0].id;
  const det = await new Promise((res)=>{
    const r2 = http.request({host:'localhost',port:5680,path:'/api/v1/executions/' + lastId + '?includeData=true',method:'GET',headers:{'X-N8N-API-KEY':N8N_API_KEY}}, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res(JSON.parse(d)))});
    r2.end();
  });
  const nodes = det.data?.resultData?.runData || {};
  console.log('\n=== EXEC ' + lastId + ' NODES ===');
  console.log(Object.keys(nodes).join(' | '));

  console.log('\n=== ERROR? ===');
  console.log(det.data?.resultData?.error?.message || '(sin error)');

  console.log('\n=== Parser output ===');
  const p = nodes['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
  console.log('telefono:', p?.telefono, '| contact_id:', p?.contact_id, '| mensaje:', p?.mensaje_original?.slice(0,60));

  console.log('\n=== Cargar Historial output ===');
  const ch = nodes['Cargar Historial Conversaciones']?.[0]?.data?.main?.[0];
  console.log('rows count:', ch?.length || 0);
  if (ch?.[0]) console.log('first row keys:', Object.keys(ch[0].json).slice(0,8).join(','));

  console.log('\n=== Vendedor CORE output ===');
  const v = nodes['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
  console.log(v?.output?.slice(0,300) || '(no output)');

  console.log('\n=== Responder al Cliente respond.io ===');
  const rs = nodes['Responder al Cliente respond.io']?.[0]?.data?.main?.[0]?.[0]?.json;
  console.log(JSON.stringify(rs)?.slice(0,300) || '(no response)');
})();
