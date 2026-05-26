// SMOKE TEST PRODUCCION: 5 conversaciones reales que cubren los casos principales
// Correr DESPUES de cargar saldo OpenAI para validar que todo anda.
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function post(host, path, body) {
  return new Promise(r => {
    const data = JSON.stringify(body);
    const x = https.request({host,port:443,path,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}}, rsp=>{let d='';rsp.on('data',c=>d+=c);rsp.on('end',()=>r({s:rsp.statusCode,b:d}))});
    x.on('error',e=>r({s:0,b:e.message}));
    x.write(data); x.end();
  });
}
function reqApi(m, p) {
  return new Promise(r => {
    let buf=[];
    const x = https.request({host:'weseka.onrender.com',port:443,path:p,method:m,headers:{'X-N8N-API-KEY':KEY}}, rsp=>{rsp.on('data',c=>buf.push(c));rsp.on('end',()=>r({s:rsp.statusCode,b:Buffer.concat(buf).toString('utf8')}))});
    x.on('error',e=>r({s:0,b:e.message}));
    x.end();
  });
}

const CASES = [
  { tel:'5492914900100', nombre:'Martina', expect:'depto Palihue', msg:'Hola! Estoy buscando un departamento 3 ambientes en Palihue, para comprar, presupuesto 250 mil USD. Soy familia con 2 nenes.' },
  { tel:'5492914900200', nombre:'Diego',    expect:'address Soler 111', msg:'Hola, vi la propiedad de Soler 111, podes pasarme info?' },
  { tel:'5492914900300', nombre:'Patricia', expect:'saludo simple',    msg:'Hola buenas tardes' },
  { tel:'5492914900400', nombre:'Carlos',   expect:'local alquiler centro', msg:'Quiero alquilar local comercial en el centro, hasta 800 mil pesos por mes' },
  { tel:'5492914900500', nombre:'Romina',   expect:'PH Villa Mitre urgente', msg:'Hola, busco PH 3 ambientes en Villa Mitre, presupuesto 120 mil USD, urgente' },
];

(async () => {
  console.log('=== ENVIANDO 5 SMOKE TESTS ===\n');
  const beforeExecs = JSON.parse((await reqApi('GET','/api/v1/executions?workflowId=TEdlfSBCc5ENVslp&limit=1')).b);
  const lastIdBefore = beforeExecs.data[0]?.id || 0;
  for (const c of CASES) {
    const payload = {
      event_type: 'message.received',
      contact: { id: 'S-'+c.tel, firstName: c.nombre, lastName: 'Smoke', phone: '+'+c.tel },
      message: { messageId:'SMK-'+Date.now()+'-'+c.tel, channelMessageId:'CMID-SMK-'+Date.now()+'-'+c.tel, message:{ type:'text', text: c.msg } }
    };
    const r = await post('weseka.onrender.com','/webhook/bochile-chat', payload);
    console.log('  ' + c.nombre.padEnd(10) + ' | HTTP ' + r.s + ' | ' + c.expect);
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('\nEsperando 150s para que terminen las 5 ejecuciones...\n');
  await new Promise(r => setTimeout(r, 150000));

  const exs = JSON.parse((await reqApi('GET','/api/v1/executions?workflowId=TEdlfSBCc5ENVslp&limit=10')).b);
  const newExecs = exs.data.filter(e => Number(e.id) > Number(lastIdBefore)).slice(0, 5);
  console.log('=== RESULTADOS (' + newExecs.length + '/' + CASES.length + ' ejecuciones nuevas) ===\n');
  let ok = 0;
  for (const e of newExecs.reverse()) {
    const det = JSON.parse((await reqApi('GET','/api/v1/executions/'+e.id+'?includeData=true')).b);
    if (e.status === 'success') {
      ok++;
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
      console.log('OK ' + e.id + ' | ' + (par?.nombre||'?'));
      console.log('   IN:  ' + String(par?.mensaje_original||'').slice(0,100));
      console.log('   OUT: ' + String(core?.output||'').slice(0,200));
      console.log();
    } else {
      console.log('FAIL ' + e.id + ' | ' + det.data?.resultData?.error?.message?.slice(0,160));
    }
  }
  console.log('=== TOTAL: ' + ok + '/' + newExecs.length + ' OK ===');
  if (ok === CASES.length) console.log('\n*** PRODUCCION VALIDADA AL 100%. Listo para entregar. ***');
  else console.log('\n*** REVISAR errores arriba. ***');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
