// Saludo de Cami: el usuario pide tono formal-calido tipo inmobiliaria,
// no super casual. "Buen dia / Buenas tardes / Buenas noches" con
// mayuscula al inicio. Cordial, educado, plural ("podemos ayudarte").

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

const NUEVO_SALUDO = [
  '',
  '## SALUDO FORMAL-CALIDO (tono inmobiliaria, no chat casual)',
  'Bochile es una inmobiliaria con mas de 50 anos. El saludo debe ser',
  'cordial, educado, calido. NO super casual.',
  '',
  'SEGUN HORA (zona horaria Argentina GMT-3):',
  '  - 00:00 a 12:00 -> "Buen día"',
  '  - 12:00 a 19:00 -> "Buenas tardes"',
  '  - 19:00 a 23:59 -> "Buenas noches"',
  '',
  'SIEMPRE con mayuscula al inicio (es WhatsApp pero Bochile es formal-calido).',
  '',
  'Plantillas correctas:',
  '  - "Buen día, cómo estás? Comentanos en qué podemos ayudarte."',
  '  - "Buenas tardes, gracias por escribir a Bochile! En qué podemos ayudarte hoy?"',
  '  - "Buen día Juani, todo bien? Contame qué andabas buscando."',
  '',
  'NUNCA uses:',
  '  - "hola! que tal" (demasiado casual)',
  '  - "Buenisimo!" "Genial!" como reacciones automaticas',
  '  - "Estoy aqui para ayudarte" (frase de bot)',
  '  - "Con gusto te ayudo" (frase de bot)',
  '',
  'Tono general: usar voseo argentino ("estás", "queres", "contame") pero',
  'arrancar siempre con saludo cordial. Despues del saludo podes ser un',
  'poco mas relajada, pero sin caer en jerga callejera.',
  ''
].join('\n');

const OLD_BLOCK_MARKER = '## SALUDO NATURAL';

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_saludo_formal_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters.options.systemMessage || '');

  const start = sm.indexOf(OLD_BLOCK_MARKER);
  if (start >= 0) {
    // Buscar el final del bloque (proximo ##  o #)
    const nextH = sm.indexOf('\n## ', start + OLD_BLOCK_MARKER.length);
    const nextH1 = sm.indexOf('\n# ', start + OLD_BLOCK_MARKER.length);
    let end;
    if (nextH < 0 && nextH1 < 0) end = sm.length;
    else if (nextH < 0) end = nextH1;
    else if (nextH1 < 0) end = nextH;
    else end = Math.min(nextH, nextH1);

    const oldLen = end - start;
    sm = sm.slice(0, start) + NUEVO_SALUDO.trim() + '\n' + sm.slice(end);
    console.log('Bloque SALUDO viejo (' + oldLen + ' chars) reemplazado por nuevo formal-calido');
  } else {
    console.log('No encontre el bloque SALUDO viejo, agregando al final');
    sm += '\n' + NUEVO_SALUDO;
  }

  core.parameters.options.systemMessage = sm;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + WF, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/' + WF + '/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
