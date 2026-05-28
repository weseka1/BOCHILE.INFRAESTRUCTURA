// Mejora el bloque "URLS" del systemMessage para reconocer portales
// inmobiliarios externos (bahiablancapropiedades, argenprop, zonaprop,
// mercadolibre, etc) y reaccionar bien: usar la info del aviso para
// entender que busca el cliente y ofrecer alternativas de Bochile via
// el Matcher.
//
// El extractor URL ya funciona para todos esos sitios (og:tags estandar),
// solo hay que decirle al bot como leer la info.

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

// Nuevo bloque que reemplaza al anterior
const NEW_BLOCK = `# URLS QUE TE MANDA EL CLIENTE (anuncios IG, FB, bochile, portales)

El sistema lee automaticamente las URLs y te las anota al mensaje en formato
[URL_INFO ...] / [CATALOGO_MATCH ...] / [INSTAGRAM_BLOQUEADO ...].
USA LA INFO QUE VIENE. NUNCA digas "no puedo ver el link" cuando hay
[URL_INFO ...]. JAMAS.

## Tipos de URL y como reaccionar

### a) Link de bochile.com
Va a venir con [URL_INFO] + [CATALOGO_MATCH] prop_id=... direccion=... zona=...
Esa propiedad ESTA en nuestra cartera. Confirma con confianza:
  "Si, vi la prop. Es la de Alem 127, USD 750.000, 2 amb / 190 m². Te interesa
  coordinar visita o queres mas detalles?"

### b) Link de PORTAL INMOBILIARIO EXTERNO (bahiablancapropiedades.com,
        argenprop.com, zonaprop.com.ar, mercadolibre.com.ar, properati,
        idealista, etc)
Va a venir con [URL_INFO]. ES de un portal de la competencia.
NO digas que ya la viste en Bochile a menos que el [CATALOGO_MATCH] te lo
confirme. La estrategia es:
  1. Reconoce que VISTE el aviso (no decir que no puedo).
  2. Extrae lo importante: tipo (casa/depto), zona, ambientes, presupuesto.
  3. Llama AL MATCHER (Buscar Propiedades en Catalogo) con esos datos para
     ver si tenes algo parecido en Bochile.
  4. Respondele con tu opcion (si la hay) o decile que le buscas y le aviso:
     "Si, vi el aviso en Bahia Blanca Propiedades — depto 3 amb en
     Universitario, USD 180k. Tengo varios similares en Bochile, te paso 2
     o 3 opciones para que veas..."
NO te limites a copiar la descripcion del portal externo. Tu valor es
ofrecer alternativas REALES de Bochile.

### c) Link de Instagram / Facebook con [URL_INFO]
Lograste leer el caption. Usalo como info real:
  "Vi el post, es un depto en Patagonia, ambientes 2. Te interesa que te tire
  similares de Bochile?"

### d) Link de Instagram BLOQUEADO ([INSTAGRAM_BLOQUEADO ...])
IG te cerro la puerta. Pedi cordial sin dar excusas tecnicas:
  "El link de IG no me deja entrar directo (cosa de Meta). Me copias la
  descripcion del aviso o me decis que zona y presupuesto? Asi te tiro
  algo en Bochile al toque."

### e) Link roto / [URL_ERROR ...]
Pedi mas datos amable:
  "El link no me cargo. Me decis que prop es (zona o calle) y le busco
  alternativas."

## REGLAS DURAS
- NUNCA digas "no puedo acceder al link" si hay [URL_INFO ...].
- NUNCA copies tal cual la descripcion del portal — siempre ofrece valor
  ofreciendo opciones de NUESTRO catalogo via el Matcher.
- Para portales externos, despues de leer el aviso, SIEMPRE consultar el
  Matcher con los datos del aviso para ofrecer alternativas Bochile.
`;

// El marker viejo
const OLD_BLOCK_START = '# URLS QUE TE MANDA EL CLIENTE';

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, `${WF}_pre_portales_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(w, null, 2));

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');

  // Borrar el bloque viejo (desde OLD_BLOCK_START hasta el proximo "# " H1)
  const startIdx = sm.indexOf(OLD_BLOCK_START);
  if (startIdx < 0) {
    console.log('No encontre el bloque viejo, lo agrego al final');
    sm += '\n\n' + NEW_BLOCK;
  } else {
    let nextIdx = startIdx + OLD_BLOCK_START.length;
    while (true) {
      const found = sm.indexOf('\n# ', nextIdx);
      if (found < 0) { nextIdx = sm.length; break; }
      if (sm[found + 3] !== '#') { nextIdx = found + 1; break; }
      nextIdx = found + 3;
    }
    const oldBlockLen = nextIdx - startIdx;
    console.log(`  Reemplazando bloque viejo: ${oldBlockLen} chars`);
    sm = sm.slice(0, startIdx) + NEW_BLOCK.trimStart() + '\n' + sm.slice(nextIdx);
  }

  core.parameters.options.systemMessage = sm;
  console.log('✅ Bloque URLs actualizado con casos: bochile, portal competidor, IG bloqueado, etc');

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
