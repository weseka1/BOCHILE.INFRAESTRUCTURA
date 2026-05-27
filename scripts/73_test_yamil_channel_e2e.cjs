// Simula un mensaje entrante por el canal 508111 (WA Yamil) y verifica que
// el workflow procesa bien (Cami responde, no falla, channelId dinamico).

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function post(host, p, body) {
  return new Promise(r => {
    const d = JSON.stringify(body);
    const x = https.request({ host, port: 443, path: p, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) }, timeout: 25000 }, rsp => {
      let s = '';
      rsp.on('data', c => s += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: s }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.write(d); x.end();
  });
}

function api(m, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  const before = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=1`)).b);
  const lastIdBefore = Number(before.data?.[0]?.id || 0);
  console.log(`Snapshot pre-test: ultima exec id = ${lastIdBefore}`);

  const stamp = Date.now();
  const payload = {
    event_type: 'message.received',
    contact: {
      id: 'TEST-YAMIL-' + stamp,
      firstName: 'YamilTest',
      lastName: 'CanalNuevo',
      phone: '+5492915512515',
    },
    channel: { id: 508111, name: 'WA Yamil Test' },
    message: {
      messageId: 'YAMIL-' + stamp,
      channelMessageId: 'CMID-YAMIL-' + stamp,
      message: { type: 'text', text: 'Hola, busco departamento 2 ambientes en Bahia Blanca, presupuesto 80 mil USD' },
    },
  };

  console.log('Enviando payload simulado desde canal 508111...');
  const r = await post('weseka.onrender.com', '/webhook/bochile-chat', payload);
  console.log(`Webhook HTTP ${r.s}`);
  if (r.s !== 200 && r.s !== 201 && r.s !== 204) {
    console.error('Webhook fallo body:', r.b.slice(0, 300));
    process.exit(1);
  }

  console.log('Esperando 60s para que Cami procese y termine...');
  await new Promise(r => setTimeout(r, 60000));

  const after = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=10`)).b);
  const nuevas = (after.data || []).filter(e => Number(e.id) > lastIdBefore);
  console.log(`\nEjecuciones nuevas: ${nuevas.length}`);

  if (nuevas.length === 0) {
    console.error('❌ NO se creo ejecucion');
    process.exit(2);
  }

  for (const e of nuevas) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
    console.log(`\n--- Exec ${e.id} | ${e.status} ---`);
    const err = det.data?.resultData?.error;
    if (err) {
      console.log(`  ❌ Error: ${err.message?.slice(0, 300)}`);
    } else {
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      console.log(`  Parser: channel_id_val=${par?.channel_id_val} from=${par?.from} mensaje="${String(par?.text_body || '').slice(0, 60)}"`);
      const core = det.data?.resultData?.runData?.['Vendedor CORE']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (core?.output) {
        console.log(`  Cami: "${String(core.output).slice(0, 200)}"`);
      }
      const responder = det.data?.resultData?.runData?.['Responder al Cliente respond.io']?.[0];
      if (responder) {
        const status = responder.data?.main?.[0]?.[0]?.json?.status || responder.error?.message;
        console.log(`  Responder: ${status || 'ejecutado'}`);
        // Si fallo, hay error
        if (responder.error) console.log(`    ❌ ${responder.error.message?.slice(0, 200)}`);
      }
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
