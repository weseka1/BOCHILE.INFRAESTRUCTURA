// El SubAgente Matcher devuelve al CORE info en formato "X amb · Y m²".
// El CORE lo repite literal al cliente como "4 ambientes". Necesito que
// el Matcher entregue "X dormitorios" en su PROPS_OK output.
//
// Tambien refuerzo en el CORE una regla muy dura al final del IDENTIDAD:
// "Si en tu contexto interno aparece 'amb' o 'ambientes', NUNCA lo
// repitas al cliente. Convertilo antes."

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

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_matcher_dorm_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  // 1. SUBAGENTE MATCHER
  const matcher = w.nodes.find(n => n.name === 'SubAgente Matcher');
  let smm = String(matcher?.parameters?.options?.systemMessage || '');
  const beforeM = smm.length;
  // Reemplazar todas las apariciones de "amb" en contextos de salida.
  // Conservadora: solo "X amb" / "amb ·" / "ambientes" en oraciones tecnicas.
  smm = smm.replace(/<ambientes>\s*amb/g, '<dormitorios> dormitorios');
  smm = smm.replace(/\bambientes\b/g, 'dormitorios');
  smm = smm.replace(/(\d+)\s*amb\b/g, '$1 dormitorios');
  // bedrooms_min: cambiar su descripcion para que sea clara
  // (la dejamos como ambientes minimos = dormitorios + 2)
  console.log('Matcher systemMessage: ' + beforeM + ' -> ' + smm.length + ' chars (cambios en jerga)');
  matcher.parameters.options.systemMessage = smm;

  // 2. CORE — agregar regla DURA al final de IDENTIDAD
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters.options.systemMessage || '');
  const MARK_NUEVA = '## OUTPUT FILTER - JAMAS "AMBIENTES" AL CLIENTE';
  if (!sm.includes(MARK_NUEVA)) {
    const block = '\n\n' + MARK_NUEVA + '\n' +
      'Si en tu contexto interno (resultado del Matcher, CATALOGO_MATCH, etc) aparece\n' +
      'la palabra "amb" o "ambientes" o el patron "X amb", JAMAS lo repitas literal\n' +
      'al cliente. Convertilo SIEMPRE antes de escribir:\n' +
      '  - "X ambientes" donde X >= 3 → "(X-2) dormitorios"\n' +
      '  - "2 ambientes" → "1 dormitorio"\n' +
      '  - "1 ambiente" → "monoambiente"\n' +
      'Ejemplo: el contexto dice "amb=4 132 m²", vos decis "2 dormitorios, 132 m²".\n' +
      'JAMAS escribas la palabra "ambientes" en un mensaje al cliente. NUNCA.\n';
    // Insertar despues de PUNTUACION ESTRICTA
    const punctIdx = sm.indexOf('## PUNTUACION ESTRICTA');
    if (punctIdx >= 0) {
      const nextH = sm.indexOf('\n# ', punctIdx);
      if (nextH >= 0) {
        sm = sm.slice(0, nextH) + block + sm.slice(nextH);
        console.log('Regla "OUTPUT FILTER - JAMAS AMBIENTES" inyectada despues de PUNTUACION ESTRICTA');
      }
    }
    core.parameters.options.systemMessage = sm;
  } else {
    console.log('Regla OUTPUT FILTER ya estaba');
  }

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
