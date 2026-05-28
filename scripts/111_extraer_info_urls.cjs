// FEATURE: Cami ahora puede leer URLs que el cliente le manda.
//
// Cuando el cliente pega un link de Instagram, Facebook, MercadoLibre,
// Argenprop, Zonaprop, bochile.com, etc., un nodo nuevo "Extraer Info URL"
// hace fetch del HTML, extrae los Open Graph tags (og:title, og:description,
// og:image) y los anota al mensaje que recibe el CORE. Asi Cami "ve" el
// anuncio en vez de decir "no puedo acceder".
//
// Casos especiales:
// - bochile.com: buscamos el slug en el catalogo (mas info, datos reales)
// - Instagram: hace best-effort (suelen tener og:tags incluso con login wall)
// - Otros: og tags normales
// - Si todo falla: el bot recibe [URL_NO_ACCESIBLE...] y pregunta amable
//
// Idempotente.

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
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

const CODE = `// Extraer info de URLs en el mensaje del cliente
const item = $input.first().json;
const original = String(item.mensaje || item.mensaje_original || '');

// Regex para detectar URLs http(s)
const urlRegex = /https?:\\/\\/[^\\s<>"\\)]+/gi;
const urls = (original.match(urlRegex) || []).slice(0, 3); // max 3 URLs

if (urls.length === 0) {
  return [{ json: item }];
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function extractOg(html) {
  const out = {};
  const grab = (rx) => {
    const m = html.match(rx);
    return m ? m[1] : '';
  };
  out.title = grab(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
           || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
           || grab(/<title[^>]*>([^<]+)<\\/title>/i);
  out.description = grab(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
                 || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
                 || grab(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  out.image = grab(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || grab(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  // Algunas paginas (instagram) usan json-ld con descripcion
  if (!out.description) {
    const ld = grab(/<script[^>]+type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/i);
    if (ld) {
      try {
        const j = JSON.parse(ld);
        out.description = j.description || j.caption || '';
      } catch {}
    }
  }
  // Decode entities basicas
  for (const k of ['title','description']) {
    if (out[k]) out[k] = String(out[k]).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0, 600);
  }
  return out;
}

const blocks = [];
for (const url of urls) {
  let block = '';
  const isBochile = /bochile\\.com\\/listing\\//i.test(url);
  const isInstagram = /instagram\\.com/i.test(url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      redirect: 'follow',
    });
    if (!res.ok && res.status !== 200) {
      // Tipico de IG / FB con login wall
      block = '[URL_NO_ACCESIBLE ' + url + ' - status ' + res.status + ']';
    } else {
      const html = await res.text();
      const og = extractOg(html);
      if (!og.title && !og.description) {
        block = '[URL_SIN_INFO ' + url + ']';
      } else {
        block = '[URL_INFO ' + url + ']\\nTitulo: ' + (og.title || '') + '\\nDescripcion: ' + (og.description || '').slice(0, 400);
      }
    }
  } catch (e) {
    block = '[URL_ERROR ' + url + ' - ' + e.message + ']';
  }

  // Si es bochile, intentar buscar la prop en el catalogo via dashboard-api
  if (isBochile) {
    try {
      const r = await fetch('https://bochile-dashboard-api.onrender.com/api/propiedades');
      if (r.ok) {
        const props = await r.json();
        // Match por slug en la URL
        const slugMatch = url.match(/listing\\/([^\\/?#]+)/i);
        const slug = slugMatch ? decodeURIComponent(slugMatch[1]).toLowerCase() : '';
        const found = (props || []).find(p => {
          if (!p || !p.titulo) return false;
          const titulo = String(p.titulo).toLowerCase();
          // Compare por palabras clave del slug vs titulo
          const slugTokens = slug.split(/[-_]/).filter(t => t.length > 2);
          return slugTokens.length > 0 && slugTokens.every(t => titulo.includes(t)) || titulo.replace(/\\s+/g,'-').includes(slug.slice(0, 30));
        });
        if (found) {
          block += '\\n[CATALOGO_MATCH] prop_id=' + (found.prop_id || '') + ' direccion=' + (found.direccion || '') + ' zona=' + (found.zona || '') + ' amb=' + (found.ambientes || '') + ' precio=' + (found.precio || '') + ' ' + (found.moneda || '');
        }
      }
    } catch (e) {
      // ignore - el bloque ya tiene la info de og:tags
    }
  }

  if (isInstagram && block.startsWith('[URL_NO_ACCESIBLE')) {
    block = '[INSTAGRAM_BLOQUEADO ' + url + ' - no pude ver el post directo. Pedile al cliente que copie la descripcion del anuncio o decime que recuerda (zona, precio, dorms).]';
  }

  blocks.push(block);
}

const enriched = original + '\\n\\n' + blocks.join('\\n\\n');
item.mensaje = enriched;
item.mensaje_original = original; // dejamos el original tambien por si acaso
return [{ json: item }];
`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_extractor_url_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const NAME = 'Extraer Info URL';
  let node = w.nodes.find(n => n.name === NAME);
  if (!node) {
    const setTexto = w.nodes.find(n => n.name === 'Texto - Set Mensaje');
    const pos = setTexto ? [setTexto.position[0] + 180, setTexto.position[1]] : [1500, 200];
    node = {
      parameters: { jsCode: CODE },
      id: `node-extraer-url-${Date.now()}`,
      name: NAME,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: pos,
      onError: 'continueRegularOutput',
    };
    w.nodes.push(node);
    console.log('✅ Nodo "Extraer Info URL" creado');
  } else {
    node.parameters.jsCode = CODE;
    console.log('ℹ️  Nodo ya existia, code actualizado');
  }

  // Reconectar: Texto - Set Mensaje -> Extraer Info URL -> Merge Caminos
  const conns = w.connections;
  const setTextoConns = conns['Texto - Set Mensaje'];
  if (!setTextoConns?.main?.[0]) { console.error('Texto - Set Mensaje sin connections'); process.exit(2); }

  const old = setTextoConns.main[0];
  const alreadyInChain = old.some(it => it.node === NAME);
  if (alreadyInChain) {
    console.log('ℹ️  Cadena ya tiene Extraer Info URL');
  } else {
    setTextoConns.main[0] = [{ node: NAME, type: 'main', index: 0 }];
    conns[NAME] = conns[NAME] || { main: [[]] };
    conns[NAME].main[0] = old;
    console.log('✅ Cadena: Texto - Set Mensaje -> Extraer Info URL -> Merge Caminos');
  }

  // Tambien lo agrego al camino de Imagen - Set Mensaje (el caption puede ser una URL)
  // y al camino de Audio - Set Mensaje (la transcripcion puede mencionar URL)
  // Por ahora solo texto; los otros son muy raros y agregaran latencia.

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\n=== Listo ===');
  console.log('Si el cliente manda un link de Instagram/Facebook/bochile/MercadoLibre/etc:');
  console.log('  - Cami hace fetch del HTML');
  console.log('  - Extrae og:title + og:description');
  console.log('  - Si es bochile.com, busca la prop en el catalogo y agrega prop_id, direccion, etc');
  console.log('  - Si es IG con login wall, le dice al cliente que copie la descripcion');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
