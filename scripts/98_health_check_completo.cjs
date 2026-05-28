// Health check end-to-end pre-arranque del dia:
// 1. OpenAI: ver si las ultimas ejecuciones del workflow tuvieron exito
//    (si fallaron por "Insufficient quota" todavia esta sin saldo)
// 2. Estado del Detector Visitas (nodo + conexion + env OPENAI_API_KEY)
// 3. Estado de los 3 leads de testing (pausados o no)
// 4. Ultimas conversaciones para ver si el bot esta hablando natural

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function api(m, p) { return new Promise(r => { const buf = []; const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); }); x.on('error', e => r({ s: 0, b: e.message })); x.end(); }); }

(async () => {
  // === 1. Saldo OpenAI: revisar status de ultimas ejecs ===
  console.log('=== 1. SALDO OPENAI (via ultimas 20 ejecs) ===');
  const exs = JSON.parse((await api('GET', `/api/v1/executions?workflowId=${WF}&limit=20`)).b);
  let openaiErrors = 0, success = 0, totalConCore = 0;
  const errMessages = new Set();
  for (const e of (exs.data || [])) {
    const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
    const runData = det.data?.resultData?.runData || {};
    const hasCore = !!runData['Vendedor CORE'];
    if (hasCore) totalConCore++;
    for (const [name, runs] of Object.entries(runData)) {
      for (const r of runs) {
        if (r.error) {
          if (/insufficient.*quota|api key|rate limit|billing/i.test(r.error.message || '')) {
            openaiErrors++;
            errMessages.add(r.error.message.slice(0, 80));
          }
        }
      }
    }
    if (e.status === 'success' && hasCore) success++;
  }
  console.log(`  Ejecs con CORE: ${totalConCore} | OK: ${success} | OpenAI errors: ${openaiErrors}`);
  if (errMessages.size > 0) {
    console.log('  Errores OpenAI vistos:');
    for (const m of errMessages) console.log('    -', m);
  } else {
    console.log('  ✅ No hay errores OpenAI en las ultimas 20 ejecs');
  }

  // === 2. Estado del Detector Visitas ===
  console.log('\n=== 2. DETECTOR VISITAS ===');
  const r = await api('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const det = w.nodes.find(n => n.name === 'Detector Visitas');
  if (det) {
    console.log(`  ✅ Nodo "Detector Visitas" existe`);
    const conn = w.connections['Parsear Mensaje']?.main?.[0]?.some(it => it.node === 'Detector Visitas');
    console.log(`  ${conn ? '✅' : '❌'} Conectado a Parsear Mensaje`);
    const usesEnv = /\$env\.OPENAI_API_KEY/.test(det.parameters?.jsCode || '');
    console.log(`  ${usesEnv ? '✅' : '❌'} Usa $env.OPENAI_API_KEY`);
    console.log('  ⚠️  No puedo verificar si la env var esta seteada en Render desde aca');
    console.log('     Para chequear: dashboard Render -> servicio n8n -> Environment -> ver OPENAI_API_KEY');
  } else {
    console.log('  ❌ Nodo no existe');
  }

  // === 3. Leads pausados (necesita endpoint /api/leads del dashboard-api) ===
  console.log('\n=== 3. LEADS DE TESTING ===');
  const tels = [
    { tel: '5492915512515', lead: 'L-2915512515', alias: 'Yamil' },
    { tel: '5492915770521', lead: 'L-2915770521', alias: 'Test foto' },
    { tel: '5492915074095', lead: 'L-2915074095', alias: 'Test casa ladrillo' },
  ];
  // Trato de leerlos del dashboard-api
  const fetchLeads = await new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'bochile-dashboard-api.onrender.com', port: 443, path: '/api/leads', method: 'GET', timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
  if (fetchLeads.s === 200) {
    const leads = JSON.parse(fetchLeads.b);
    const ahora = new Date();
    for (const t of tels) {
      const l = leads.find(x => x.lead_id === t.lead);
      if (!l) { console.log(`  ${t.alias.padEnd(20)} ${t.lead}: no existe en el Sheet`); continue; }
      const pausa = String(l.bot_pausado_hasta || '').trim();
      let estado = 'ACTIVO';
      if (pausa) {
        const fp = new Date(pausa);
        if (!isNaN(fp.getTime()) && fp > ahora) {
          estado = `PAUSADO hasta ${pausa} (${Math.round((fp - ahora) / 60000)} min)`;
        }
      }
      console.log(`  ${t.alias.padEnd(20)} ${t.lead}: ${estado}`);
    }
  } else {
    console.log(`  ⚠️  No pude leer leads (${fetchLeads.s}): ${fetchLeads.b.slice(0, 150)}`);
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
