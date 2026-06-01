// El LLM ignora la regla del prompt sobre "Buen dia/Buenas tardes/noches".
// Sigue diciendo "Hola Juani". Lo forzamos en el Sanitize Output.
//
// Logica:
// - Si la respuesta empieza con "Hola" + cualquier cosa, reemplazo por el
//   saludo correcto segun hora ART (zona horaria Argentina).
// - Horarios del cliente:
//     06:00 - 12:59 -> "Buen día"
//     13:00 - 20:00 -> "Buenas tardes"
//     20:01 - 05:59 -> "Buenas noches"
//
// Reemplazos:
//   "Hola" -> "Buen día/Buenas tardes/Buenas noches"
//   "Holaa" -> idem
//   "Hola!" -> idem (sin !)
//   "Hola Juani" -> "Buenas tardes Juani"

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

const NEW_CODE = [
  '// Sanitize Output: limpia ¿¡, "ambientes", corchetes, markdown links',
  '// y FUERZA el saludo formal-calido segun hora ART.',
  '',
  'const inp = $input.first().json;',
  "let output = String(inp.output || '');",
  'const original = output;',
  '',
  '// 1. Signos de apertura ¿¡',
  "output = output.replace(/¿([^¿?]{1,200})\\?/g, '$1?');",
  "output = output.replace(/¡([^¡!]{1,200})!/g, '$1!');",
  "output = output.replace(/¿/g, '');",
  "output = output.replace(/¡/g, '');",
  '',
  '// 2. "X ambientes" -> "Y dormitorios"',
  'function ambToDorm(match, num) {',
  '  const n = parseInt(num, 10);',
  '  if (isNaN(n) || n < 1) return match;',
  "  if (n === 1) return 'monoambiente';",
  "  if (n === 2) return '1 dormitorio';",
  "  return (n - 2) + ' dormitorios';",
  '}',
  "output = output.replace(/(\\d+)\\s+ambientes\\b/gi, ambToDorm);",
  "output = output.replace(/(\\d+)\\s+amb\\b(?!ient)/gi, ambToDorm);",
  '',
  '// 3. Markdown links [Texto](URL) -> URL',
  "output = output.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g, '$2');",
  '',
  '// 4. Corchetes residuales',
  "output = output.replace(/\\[([^\\]\\[]{3,40})\\](?!\\()/g, '$1');",
  '',
  '// 5. FORZAR SALUDO FORMAL segun hora ART (zona Argentina GMT-3)',
  '// Reemplazar "Hola[a]*" + opcional "!" al inicio de la respuesta',
  'function getSaludoArt() {',
  '  // Calcular hora actual en ART',
  "  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));",
  '  const h = now.getHours();',
  "  if (h >= 6 && h < 13) return 'Buen día';",
  "  if (h >= 13 && h <= 20) return 'Buenas tardes';",
  "  return 'Buenas noches';",
  '}',
  'const saludo = getSaludoArt();',
  '// Reemplazar saludo al inicio si no corresponde a la hora.',
  '// Cubre: "Hola", "Buen dia", "Buen día", "Buenas tardes", "Buenas noches"',
  "const saludoRx = /^(Hola+|hola+|HOLA+|Buen\\s+d[íi]a|Buenas\\s+tardes|Buenas\\s+noches)(!?)(\\s|,|$)/i;",
  'const matchSaludo = output.match(saludoRx);',
  'if (matchSaludo) {',
  '  const usado = matchSaludo[1];',
  '  // Solo reemplazar si el saludo usado no coincide con el correcto',
  '  const usadoNorm = usado.toLowerCase().replace(/í/g, "i");',
  '  const correctoNorm = saludo.toLowerCase().replace(/í/g, "i");',
  '  if (!usadoNorm.startsWith(correctoNorm.split(" ")[0])) {',
  "    output = output.replace(saludoRx, saludo + '$3');",
  '  }',
  '}',
  '',
  '// 6. Limpieza final',
  "output = output.replace(/  +/g, ' ').replace(/\\?\\?/g, '?').replace(/!!/g, '!');",
  '',
  'if (output !== original) {',
  "  console.log('[sanitize] cambio output. Antes:', original.slice(0, 100), '... Despues:', output.slice(0, 100));",
  '}',
  '',
  'return [{ json: Object.assign({}, inp, { output, output_raw: original }) }];',
  ''
].join('\n');

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_saludo_horario_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  const san = w.nodes.find(n => n.name === 'Sanitize Output');
  if (!san) { console.error('No encontre Sanitize Output'); process.exit(1); }
  san.parameters.jsCode = NEW_CODE;
  console.log('Sanitize Output: ahora fuerza saludo segun hora ART');

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
