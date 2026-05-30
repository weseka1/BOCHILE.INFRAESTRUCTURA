// Fix critico: 33 ocurrencias de "¿" en el prompt mismo, incluyendo en
// ejemplos marcados como "✅ BIEN". El LLM aprende de esos ejemplos.

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

const REGLA_PUNT = [
  '',
  '## PUNTUACION ESTRICTA (no negociable)',
  'NUNCA uses los signos de apertura "¿" ni "¡". Solo "?" y "!" al final, una sola "!" por mensaje completo.',
  'Ejemplos reales (asi escribis SI):',
  '  "hola, como andas"',
  '  "te interesa coordinar visita?"',
  '  "buenisima la foto"',
  '  "ok dale"',
  'JAMAS escribas: "Como estas?", "Hola!", "Te interesa?", "Genial!" con apertura. Es WhatsApp argentino, no carta formal.',
  '',
  '## NO INVENTAR DATOS DE PROPIEDADES (FUERTE)',
  'Si el catalogo NO tiene un dato (banos vacio, dormitorios vacio, expensas vacio,',
  'cochera vacio), NO INVENTES. Omite ese campo en tu respuesta.',
  'Ejemplo real: el catalogo de Alsina 690 tiene banos="" (vacio). NO digas',
  '"tiene 2 banos" porque NO lo sabes. Decis solo dormitorios y m2.',
  'Si el cliente pregunta directamente por algo que no tenes:',
  '  "ese dato no lo tengo cargado, lo consulto con Camila y te confirmo"',
  '',
].join('\n');

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_limpiar_signos_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');
  const before = sm.length;

  const antesC = (sm.match(/¿/g) || []).length;
  const antesE = (sm.match(/¡/g) || []).length;

  // Quitar ¿X? -> X?  (preguntas con par)
  sm = sm.replace(/¿([^¿?]{1,150})\?/g, '$1?');
  // Quitar ¡X! -> X!  (exclamaciones con par)
  sm = sm.replace(/¡([^¡!]{1,150})!/g, '$1!');
  // Quitar ¿ y ¡ residuales NO seguidos de comilla/apostrofe (referencias entre comillas se preservan)
  sm = sm.replace(/¿(?!['"`])/g, '');
  sm = sm.replace(/¡(?!['"`])/g, '');

  const despuesC = (sm.match(/¿/g) || []).length;
  const despuesE = (sm.match(/¡/g) || []).length;
  console.log('Apertura ¿: ' + antesC + ' -> ' + despuesC);
  console.log('Apertura ¡: ' + antesE + ' -> ' + despuesE);

  // Inyectar regla dura al inicio (despues de IDENTIDAD)
  const ID_MARKER = '# IDENTIDAD - SOS UNA HUMANA';
  const idx = sm.indexOf(ID_MARKER);
  if (idx >= 0 && !sm.includes('PUNTUACION ESTRICTA')) {
    const nextH = sm.indexOf('\n# ', idx + ID_MARKER.length);
    if (nextH >= 0) {
      sm = sm.slice(0, nextH) + REGLA_PUNT + sm.slice(nextH);
      console.log('✅ Regla PUNTUACION ESTRICTA + NO INVENTAR DATOS inyectada');
    }
  } else if (sm.includes('PUNTUACION ESTRICTA')) {
    console.log('ℹ️  Regla ya estaba presente');
  }

  const after = sm.length;
  console.log('Tamano: ' + before + ' -> ' + after);

  core.parameters.options.systemMessage = sm;
  fs.writeFileSync(path.resolve(__dirname, '_sm_limpio.md'), sm);

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
