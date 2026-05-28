// Fix CRITICO: el extractor URL solo cruzaba con catalogo cuando la URL
// era de bochile.com. Para portales externos (bahiablancapropiedades,
// argenprop, etc) solo extraia og:tags y dejaba que el LLM decidiera —
// resultado: el LLM no identifica que Alsina 690 del aviso externo ES la
// misma Alsina 690 que tenemos en cartera.
//
// Fix: el extractor SIEMPRE intenta detectar la direccion (calle + numero)
// del titulo/url/descripcion y buscar match en el catalogo de Bochile.
// Si encuentra match, agrega [CATALOGO_MATCH ...] con los datos reales.
//
// Ademas: reglas mas duras en CORE para que cuando vea CATALOGO_MATCH,
// NO ofrezca alternativas — confirma esa misma prop.

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

const EXTRACTOR_CODE = `// Extraer info de URLs + SIEMPRE buscar match en catalogo Bochile
const item = $input.first().json;
const original = String(item.mensaje || item.mensaje_original || '');

const urlRegex = /https?:\\/\\/[^\\s<>"\\)]+/gi;
const urls = (original.match(urlRegex) || []).slice(0, 3);

if (urls.length === 0) {
  return [{ json: item }];
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function extractOg(html) {
  const out = {};
  const grab = (rx) => { const m = html.match(rx); return m ? m[1] : ''; };
  out.title = grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
           || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
           || grab(/<title[^>]*>([^<]+)<\\/title>/i);
  out.description = grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
                 || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
                 || grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (!out.description) {
    const ld = grab(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/i);
    if (ld) { try { const j = JSON.parse(ld); out.description = j.description || j.caption || ''; } catch {} }
  }
  for (const k of ['title','description']) {
    if (out[k]) out[k] = String(out[k]).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0, 600);
  }
  return out;
}

// Decode URL path tokens to extract calle/numero ("Casa-en-Venta-en-Alsina-690-Centro" -> ["alsina 690"])
function extractAddressFromText(text) {
  if (!text) return [];
  const norm = text.toLowerCase()
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[%][0-9a-f]{2}/g, ' ')
    .replace(/[-_\\/]/g, ' ')
    .replace(/[^a-z0-9\\s]/g, ' ')
    .replace(/\\s+/g, ' ').trim();
  const STOP = new Set(['casa','en','venta','alquiler','de','el','la','un','una','del','para','con','y','o','a','centro','bahia','blanca','dpto','departamento','semipiso','ph','propiedad','venta']);
  const candidates = [];
  const re = /([a-z]+(?:\\s+[a-z]+){0,2})\\s+(\\d{1,4})\\b/g;
  let m;
  while ((m = re.exec(norm)) !== null) {
    const calle = m[1].trim();
    const num = m[2];
    const tokens = calle.split(/\\s+/).filter(t => t.length > 2 && !STOP.has(t));
    if (tokens.length === 0) continue;
    const lastTokens = tokens.slice(-2).join(' '); // tomar maximo 2 tokens (ej "san martin")
    if (lastTokens.length < 3) continue;
    candidates.push(lastTokens + ' ' + num);
  }
  return Array.from(new Set(candidates));
}

function matchCatalogo(props, candidates) {
  for (const c of candidates) {
    const tokens = c.split(/\\s+/);
    const calle = tokens.slice(0, -1).join(' ');
    const num = tokens[tokens.length - 1];
    for (const p of props) {
      const dir = String(p.direccion || '').toLowerCase()
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const tit = String(p.titulo || '').toLowerCase()
        .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      const hay = dir + ' ' + tit;
      // Si la calle Y el numero aparecen en direccion/titulo, match
      if (hay.includes(calle) && hay.includes(num)) {
        return { prop: p, matched: c };
      }
    }
  }
  return null;
}

// Cargar catalogo una sola vez
let catalogo = null;
async function getCatalogo() {
  if (catalogo) return catalogo;
  try {
    const resp = await this.helpers.httpRequest({
      method: 'GET',
      url: 'https://bochile-dashboard-api.onrender.com/api/propiedades',
      json: true,
    });
    catalogo = Array.isArray(resp) ? resp : (resp.body || []);
  } catch (e) {
    console.log('[extractor] no pude cargar catalogo:', e.message);
    catalogo = [];
  }
  return catalogo;
}

const blocks = [];
for (const url of urls) {
  let block = '';
  const isInstagram = /instagram\\.com/i.test(url);

  let html = '';
  let httpOk = false;
  let httpStatus = 0;
  try {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: url,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    });
    httpStatus = response.statusCode || 200;
    html = String(response.body || '');
    httpOk = httpStatus >= 200 && httpStatus < 400;
  } catch (e) {
    block = '[URL_ERROR ' + url + ' - ' + (e.message || 'fetch fail') + ']';
  }

  let og = { title: '', description: '' };
  if (!block) {
    if (!httpOk) {
      block = '[URL_NO_ACCESIBLE ' + url + ' - status ' + httpStatus + ']';
    } else {
      og = extractOg(html);
      if (!og.title && !og.description) {
        block = '[URL_SIN_INFO ' + url + ']';
      } else {
        block = '[URL_INFO ' + url + ']\\nTitulo: ' + (og.title || '') + '\\nDescripcion: ' + (og.description || '').slice(0, 400);
      }
    }
  }

  // SIEMPRE intentar match con catalogo Bochile, sin importar dominio.
  // Extraer direccion del titulo + descripcion + url path.
  try {
    const candidates = [
      ...extractAddressFromText(og.title || ''),
      ...extractAddressFromText(decodeURIComponent(url)),
      ...extractAddressFromText(og.description || ''),
    ];
    if (candidates.length > 0) {
      const props = await getCatalogo.call(this);
      const match = matchCatalogo(props, candidates);
      if (match) {
        const p = match.prop;
        block += '\\n[CATALOGO_MATCH detectado por "' + match.matched + '"] prop_id=' + (p.prop_id || '') + ' titulo="' + (p.titulo || '').slice(0, 80) + '" direccion=' + (p.direccion || '') + ' zona=' + (p.zona || '') + ' amb=' + (p.ambientes || '') + ' banos=' + (p.banos || '') + ' precio=' + (p.precio || '') + ' ' + (p.moneda || '') + ' superficie_cubierta=' + (p.superficie_cubierta || '');
      }
    }
  } catch (e) {
    console.log('[extractor] match catalogo fail:', e.message);
  }

  if (isInstagram && (block.startsWith('[URL_NO_ACCESIBLE') || block.startsWith('[URL_SIN_INFO') || block.startsWith('[URL_ERROR'))) {
    block = '[INSTAGRAM_BLOQUEADO ' + url + ' - no pude ver el post directo. Pedile al cliente que copie la descripcion del anuncio o decime que recuerda (zona, precio, dorms).]';
  }

  blocks.push(block);
}

const enriched = original + '\\n\\n' + blocks.join('\\n\\n');
item.mensaje = enriched;
return [{ json: item }];
`;

const NEW_CORE_RULES = `# URLS QUE TE MANDA EL CLIENTE (anuncios IG, FB, bochile, portales externos)

El sistema lee automaticamente las URLs y te las anota al mensaje con
[URL_INFO ...] / [CATALOGO_MATCH ...] / [INSTAGRAM_BLOQUEADO ...].
NUNCA digas "no puedo ver el link" cuando hay [URL_INFO ...].

## REGLA DURA: [CATALOGO_MATCH] manda

Si el mensaje del cliente trae un link Y aparece [CATALOGO_MATCH detectado por
"X"], significa que el sistema EMPAREJO la propiedad del aviso con UNA propiedad
real de NUESTRO catalogo. Tenes los datos reales (prop_id, direccion, ambientes,
precio).

EN ESE CASO:
  - Confirma con confianza que ESA propiedad la tenemos.
  - NO ofrezcas "alternativas similares". El cliente quiere ESA prop.
  - NO digas "no esta en nuestro catalogo" — ESTA, el sistema te lo dijo.
  - Mostra los datos del [CATALOGO_MATCH] (no del [URL_INFO]) porque son los
    nuestros, mas precisos.

EJEMPLO BIEN (cliente mando link de bahia blanca propiedades de Alsina 690):
  Tenes en el contexto:
    [URL_INFO https://bahiablancapropiedades.com/...]
    Titulo: Casa en Venta en Alsina 690 Centro Bahia Blanca
    Descripcion: 132 m2 cubiertos, ideal estudios u oficinas
    [CATALOGO_MATCH detectado por "alsina 690"] prop_id=P-xxx titulo="Alsina 690 - Propiedad a la venta" direccion=Alsina 690 amb=4 precio=160000 USD

  TU RESPUESTA DEBE SER:
  "Si, esa la tenemos! Es Alsina 690, USD 160.000, 4 ambientes, 132 m2 cubiertos.
  Te interesa coordinar visita o queres mas detalles?"

EJEMPLO MAL (lo que paso hoy, NO repetir):
  Cliente: "Pero esa la tienen ustedes. Alsina 690"
  Bot: "Perdon, tenes razon. La de Alsina 690 no la tenemos en nuestro catalogo
        actual. Si te interesa, puedo ofrecerte opciones similares..."
  -> MAL. Si estaba el [CATALOGO_MATCH], la teniamos. Y aunque por algo no lo
     detectara el sistema, NO inventes que no la tenes.

## Tipos de URL y como reaccionar

### a) [URL_INFO] + [CATALOGO_MATCH] = tenemos la prop
Confirma con confianza usando los datos del CATALOGO_MATCH. NO alternativas.

### b) [URL_INFO] SIN [CATALOGO_MATCH] (link de portal externo, prop que NO
       esta en nuestro catalogo)
Reconoce que viste el aviso, usa los datos extraidos para entender que busca el
cliente, y LLAMA AL MATCHER (Buscar Propiedades en Catalogo) con tipo + zona +
ambientes + presupuesto para ofrecer alternativas reales de Bochile.

### c) [INSTAGRAM_BLOQUEADO ...]
"El link de IG no me deja entrar directo (cosa de Meta). Me copias la descripcion
del aviso o me decis zona y presupuesto?"

### d) [URL_ERROR] / [URL_NO_ACCESIBLE]
Pedir mas datos al cliente.

## REGLAS DURAS
- NUNCA digas "no puedo acceder al link" cuando llega [URL_INFO ...].
- NUNCA digas "no esta en nuestro catalogo" cuando llega [CATALOGO_MATCH ...].
- NUNCA inventes una direccion. Si el aviso dice "Alsina 690", decis "Alsina 690"
  (NO "Alsina 600" ni redondeos).
- NUNCA ofrezcas alternativas si hay [CATALOGO_MATCH]. Solo en caso (b).
`;

const OLD_BLOCK_START = '# URLS QUE TE MANDA EL CLIENTE';

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  const w = JSON.parse(r.b);
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, `${WF}_pre_extractor_global_match_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(w, null, 2));

  const ext = w.nodes.find(n => n.name === 'Extraer Info URL');
  if (ext) {
    ext.parameters.jsCode = EXTRACTOR_CODE;
    console.log('✅ Extraer Info URL: ahora SIEMPRE cruza con catalogo (no solo bochile.com)');
  }

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');
  const startIdx = sm.indexOf(OLD_BLOCK_START);
  if (startIdx >= 0) {
    let nextIdx = startIdx + OLD_BLOCK_START.length;
    while (true) {
      const found = sm.indexOf('\n# ', nextIdx);
      if (found < 0) { nextIdx = sm.length; break; }
      if (sm[found + 3] !== '#') { nextIdx = found + 1; break; }
      nextIdx = found + 3;
    }
    sm = sm.slice(0, startIdx) + NEW_CORE_RULES.trimStart() + '\n' + sm.slice(nextIdx);
    console.log('✅ CORE: bloque URLs reforzado con regla dura "CATALOGO_MATCH manda"');
  } else {
    sm += '\n\n' + NEW_CORE_RULES;
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
