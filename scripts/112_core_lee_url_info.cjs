// Actualizar systemMessage del CORE para que sepa interpretar las anotaciones
// [URL_INFO ...], [CATALOGO_MATCH ...], [INSTAGRAM_BLOQUEADO ...] que
// inyecta el nodo "Extraer Info URL".

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

const BLOCK = `# URLS QUE TE MANDA EL CLIENTE (anuncios IG, FB, bochile, MercadoLibre, etc)

Cuando el cliente te pega un link de un anuncio, el sistema lo lee
automaticamente y te lo agrega al mensaje en formato:

  [URL_INFO <url>]
  Titulo: ...
  Descripcion: ...

USALO COMO INFO REAL DEL ANUNCIO. NO digas "no puedo ver el link" — ya lo
lei por vos. Mostra que entendiste y avanza:
  "Si, vi el aviso de la casa en Alem 127. Te confirmo, esta a USD..."
  o si tenes datos del catalogo:
  "Vi el aviso, es la prop P-001 que tenemos en cartera. Te cuento mas..."

Si llega anotacion adicional:
  [CATALOGO_MATCH] prop_id=X direccion=Y zona=Z amb=N precio=P
=> esa propiedad ESTA en nuestro catalogo, tenemos info real. Usala
para responder con confianza.

Si llega:
  [INSTAGRAM_BLOQUEADO <url> - no pude ver el post directo]
=> Instagram te bloqueo el scrape. Pedile al cliente que copie y pegue
la descripcion del anuncio, o que te diga zona/precio/dormitorios que recuerde.
Decile algo como:
  "El link de IG no me deja entrar directo (cosa de privacidad de Meta).
  Me copias la descripcion del aviso o me decis que zona y presupuesto?
  Asi te tiro la prop al toque."

Si llega:
  [URL_NO_ACCESIBLE <url> - status X]
  [URL_ERROR <url> - mensaje]
=> El link no se pudo leer. Pedi mas info al cliente.

NUNCA digas "no puedo acceder a Instagram" o "no veo el link" cuando hay
[URL_INFO ...] — eso es FAIL, el sistema YA te dio la info.
`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, `${WF}_pre_core_url_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(w, null, 2));

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');
  const MARKER = '# URLS QUE TE MANDA EL CLIENTE';
  if (sm.includes(MARKER)) {
    console.log('ℹ️  CORE ya tiene bloque URLs');
    return;
  }
  // Insertar despues de INTERPRETACION DEL LENGUAJE
  const insertAfter = '# INTERPRETACION DEL LENGUAJE DEL CLIENTE';
  const idx = sm.indexOf(insertAfter);
  if (idx >= 0) {
    const next = sm.indexOf('\n# ', idx + insertAfter.length);
    if (next >= 0) {
      sm = sm.slice(0, next) + '\n\n' + BLOCK.trimStart() + sm.slice(next);
      console.log('✅ Bloque URLs inyectado despues de INTERPRETACION DEL LENGUAJE');
    } else { sm += '\n\n' + BLOCK; console.log('✅ Bloque agregado al final'); }
  } else {
    sm += '\n\n' + BLOCK;
    console.log('⚠️  Insertado al final (marker no encontrado)');
  }
  core.parameters.options.systemMessage = sm;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
