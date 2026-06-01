// Pre-demo Camila: extender el Sanitize Output para cubrir mas casos
// que el LLM se sigue zarpando:
//
// 1. Corchetes markdown "[Ver propiedad](URL)" -> URL sola (WhatsApp no
//    renderiza markdown link, queda feo literal). Patron tipico del LLM.
// 2. "[Ver propiedad]" -> "Ver propiedad" (sin corchetes residuales).
// 3. Saludos formales tipo "todo bien por aca" -> mantener mas natural.
//    Esto NO se puede sanitizar facil (no es texto fijo), pero refuerzo
//    en el prompt.

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

const NEW_SANITIZE_CODE = [
  '// Sanitizer extendido pre-demo Camila',
  'const inp = $input.first().json;',
  "let output = String(inp.output || '');",
  'const original = output;',
  '',
  '// 1. Quitar signos de apertura ¿¡ (pares y residuales)',
  "output = output.replace(/¿([^¿?]{1,200})\\?/g, '$1?');",
  "output = output.replace(/¡([^¡!]{1,200})!/g, '$1!');",
  "output = output.replace(/¿/g, '');",
  "output = output.replace(/¡/g, '');",
  '',
  '// 2. Convertir "X ambientes" / "X amb" a "Y dormitorios"',
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
  '// 3. Markdown links "[Texto](URL)" -> "URL" (WhatsApp no renderiza markdown)',
  '// Patron: [cualquier texto](http...) -> solo el http... en su propia linea',
  "output = output.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g, '$2');",
  '',
  '// 4. Corchetes residuales que el LLM a veces deja:',
  '// "[Ver propiedad]" o "[Click aqui]" sin url -> texto sin corchetes',
  "output = output.replace(/\\[([^\\]\\[]{3,40})\\](?!\\()/g, '$1');",
  '',
  '// 5. Limpiar dobles espacios y signos duplicados',
  "output = output.replace(/  +/g, ' ').replace(/\\?\\?/g, '?').replace(/!!/g, '!');",
  '',
  'if (output !== original) {',
  "  console.log('[sanitize] limpio output. Antes:', original.slice(0, 100), '... Despues:', output.slice(0, 100));",
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
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_demo_camila_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  // 1. Update Sanitize Output con reglas extendidas
  const san = w.nodes.find(n => n.name === 'Sanitize Output');
  if (san) {
    san.parameters.jsCode = NEW_SANITIZE_CODE;
    console.log('Sanitize Output actualizado con reglas para corchetes markdown + residuales');
  }

  // 2. Reforzar prompt del CORE con regla de saludo natural
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters.options.systemMessage || '');
  const MARKER = '## SALUDO NATURAL - JAMAS "todo bien por aca"';
  if (!sm.includes(MARKER)) {
    const block = '\n\n' + MARKER + '\n' +
      'Cuando el cliente te saluda ("hola", "hola Cami", "como estas?"), JAMAS\n' +
      'respondas con la formula formal "todo bien por aca, gracias, en que te\n' +
      'puedo ayudar". Es lenguaje de bot.\n\n' +
      'Saludo natural argentino:\n' +
      '  - "hola! que tal, en que te puedo ayudar?"\n' +
      '  - "hola, contame que estas buscando"\n' +
      '  - "hola Juani! todo bien, vos? en que te ayudo?"\n' +
      '  - Si el cliente pregunta como estas: devolves la pregunta como humano.\n' +
      '    "todo bien, vos? que andabas necesitando?"\n\n' +
      'JAMAS uses: "Estoy aqui para ayudarte", "Con gusto te ayudo", "No te\n' +
      'preocupes, estoy aqui". Son frases de robot.\n\n' +
      '## FORMATO PROPIEDADES SIN CORCHETES\n' +
      'JAMAS uses markdown "[Texto](URL)" o "[Ver propiedad]" — WhatsApp no\n' +
      'renderiza markdown. Queda feo el corchete literal.\n\n' +
      'CORRECTO (URL en linea propia, sin corchetes, sin "Ver propiedad: "):\n' +
      '  🏠 Alsina 690 - Casa en venta\n' +
      '  💰 USD 160.000 · 2 dormitorios · 132 m²\n' +
      '  📍 Centro Bahia Blanca\n' +
      '  https://www.bochile.com/listing/alsina-690-propiedad-a-la-venta/\n\n' +
      'WhatsApp arma preview card cuando la URL va sola en su linea. NUNCA\n' +
      'pongas "[Ver propiedad](url)" — el cliente ve el corchete literal.\n';
    // Insertar despues de PUNTUACION ESTRICTA si existe
    const punctIdx = sm.indexOf('## PUNTUACION ESTRICTA');
    if (punctIdx >= 0) {
      const nextH = sm.indexOf('\n# ', punctIdx);
      if (nextH >= 0) {
        sm = sm.slice(0, nextH) + block + sm.slice(nextH);
        console.log('Regla SALUDO NATURAL + FORMATO PROPIEDADES inyectada en CORE');
      } else {
        sm += block;
      }
    } else {
      sm += block;
    }
    core.parameters.options.systemMessage = sm;
  } else {
    console.log('Regla SALUDO NATURAL ya estaba');
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
