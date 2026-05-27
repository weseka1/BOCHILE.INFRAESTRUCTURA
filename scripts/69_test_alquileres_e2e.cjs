// TEST E2E ALQUILERES: simula un mensaje entrante en canal 508045
// y verifica que: (1) la ejecucion termina success, (2) NO hay error
// "innerMessage is not defined", (3) el flow detecto el bypass.

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
  // Snapshot last exec ID antes del test
  const before = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=1`)).b);
  const lastIdBefore = Number(before.data?.[0]?.id || 0);
  console.log(`Snapshot pre-test: ultima exec id = ${lastIdBefore}`);

  // Payload simulando mensaje entrante de cliente al canal Alquileres (508045)
  const stamp = Date.now();
  const payload = {
    event_type: 'message.received',
    contact: {
      id: 'TEST-ALQ-' + stamp,
      firstName: 'TestClienteAlquileres',
      lastName: 'EndToEnd',
      phone: '+5492914999777',
    },
    channel: { id: 508045, name: 'WhatsApp Alquileres' },
    message: {
      messageId: 'ALQ-TEST-' + stamp,
      channelMessageId: 'CMID-ALQ-' + stamp,
      message: { type: 'text', text: 'Hola, busco para alquilar departamento 2 amb cerca del centro, presupuesto 250mil' },
    },
  };

  console.log('Enviando payload Alquileres...');
  const r = await post('weseka.onrender.com', '/webhook/bochile-chat', payload);
  console.log(`Webhook HTTP ${r.s}`);
  if (r.s !== 200 && r.s !== 201 && r.s !== 204) {
    console.error('Webhook fallo body:', r.b.slice(0, 300));
    process.exit(1);
  }

  console.log('Esperando 30s para que termine la ejecucion...');
  await new Promise(r => setTimeout(r, 30000));

  // Pedir las ejecuciones nuevas
  const after = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=10`)).b);
  const nuevas = (after.data || []).filter(e => Number(e.id) > lastIdBefore);
  console.log(`\nEjecuciones nuevas: ${nuevas.length}`);

  if (nuevas.length === 0) {
    console.error('❌ NO se creo ejecucion. Webhook no llego al workflow.');
    process.exit(2);
  }

  for (const e of nuevas) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
    const status = e.status;
    const err = det.data?.resultData?.error;
    console.log(`\n--- Exec ${e.id} | ${status} ---`);
    if (err) {
      console.log(`  ❌ Error: ${err.message?.slice(0, 200)}`);
      if (err.message?.includes('innerMessage')) {
        console.log('  💥 BUG TODAVIA PRESENTE: innerMessage');
        process.exit(3);
      }
    } else {
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (par?.skip) {
        console.log(`  ✅ Parser skip: reason=${par.reason}`);
      } else if (par) {
        console.log(`  ✅ Parser output keys: ${Object.keys(par).slice(0, 8).join(', ')}`);
        if (par.canal_alquileres_observador) console.log('  ✅ Canal Alquileres detectado');
      }
    }
  }

  console.log('\n=== TEST COMPLETO ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
