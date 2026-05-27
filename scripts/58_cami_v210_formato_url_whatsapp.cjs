// CAMI v2.10 - Formato URL friendly para WhatsApp.
//
// Bug detectado por cliente: el formato markdown [Ver](url) NO renderiza en WhatsApp.
// El cliente ve literalmente "[Ver](https://www.bochile.com/listing/...)" - feo.
//
// Fix: cambiar formato a URL en linea propia (WhatsApp auto-renderiza preview card
// con foto + titulo + descripcion = mucho mas atractivo).
//
// Tambien refino el bloque "Cuando muestres una prop" con formato visual mas claro:
// emojis ubicacionales + precio + URL + CTA.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

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

// Varias variantes del bloque viejo a buscar y reemplazar
const OLD_PATTERNS = [
  // v1 - mas comun
  /6\. Cuando muestres una prop, incluye SIEMPRE: direccion \+ ambientes \+ m2 \+ precio \+ moneda \+ URL \(formato markdown \[Ver\]\(url\)\)\.\n7\. Maximo 2-3 propiedades por mensaje\. Si tenes mas, decile "tengo mas opciones, ¿queres que te muestre\?"/,
  // v2 - misma idea otra version
  /6\. Muestra cada prop con: direccion \+ ambientes \+ m2 \+ precio \+ moneda \+ URL \(\[Ver\]\(url\)\)\.\n7\. Maximo 2-3 props por mensaje\. "Tengo mas, ¿queres que te muestre\?"/,
  // v3 - desde script 41
  /7\. Muestra cada prop con: direccion \+ ambientes \+ m2 \+ precio \+ moneda \+ URL \(\[Ver\]\(url\)\)\.\n8\. Maximo 2-3 props por mensaje\. "Tengo mas, ¿queres que te muestre\?"/,
];

const NEW_BLOCK = `# ========================================
# FORMATO DE PROPIEDADES (CRITICO - WhatsApp friendly)
# ========================================
**JAMAS uses formato markdown [Ver](url) - WhatsApp NO lo renderiza.** El cliente
ve literal "[Ver](https://...)" lo cual es feo y poco profesional.

## Formato correcto para mostrar UNA propiedad
Estructura recomendada (3-5 lineas, URL en linea propia):

\`\`\`
🏠 Güemes 2327 - Casa en venta
💰 USD 120.000 · 3 amb · 95 m²
📍 Centro · cochera, patio

https://www.bochile.com/listing/casa-guemes-2327
\`\`\`

WhatsApp auto-renderiza una **preview card** (imagen + titulo + descripcion del
listing) cuando la URL va sola en su linea. Es MUCHO mas atractivo que el link
crudo o markdown.

## Reglas
- **URL siempre sola en su linea**, sin texto antes ni despues en la misma linea.
- **NO usar [Ver](url) ni [Click aqui](url) ni similar** - markdown no funciona en WA.
- **NO escribir "URL:" antes** - el cliente no necesita saber que es una URL.
- **NO acortar URLs** (bit.ly etc) - WhatsApp solo previewea URLs originales del sitio.
- Maximo 1 emoji de encabezado por bloque de prop (🏠/🏢/🏡/🏖). Ese SI ayuda visualmente.
- Datos clave en una sola linea: precio · ambientes · m² (separados con · ).

## Si tenes que mostrar 2-3 propiedades juntas
Separa con linea en blanco entre ellas. Cada una con su URL en linea propia:

\`\`\`
🏠 Güemes 2327 - Casa
💰 USD 120.000 · 3 amb · 95 m²
https://www.bochile.com/listing/guemes-2327

🏢 Soler 111 - Depto
💰 USD 85.000 · 2 amb · 50 m²
https://www.bochile.com/listing/soler-111
\`\`\`

## Despues de mostrar la(s) prop(s)
Cerra con UN CTA claro, sin emojis decorativos:
- "¿Te interesa coordinar una visita?" (preferido si la prop es buena candidata)
- "¿Te paso mas opciones similares?"
- "¿Te suma si me decis presupuesto y zona para afinar la busqueda?"

## QUE NO HACER
- ❌ "[Ver](https://...)" - markdown roto en WhatsApp
- ❌ "Mira la prop aca: https://..." - "Mira la prop aca" antes de la URL bloquea la preview card
- ❌ "Mas info en este link: ..." - frase de relleno
- ❌ Listar 4+ props con URLs en un solo mensaje - bombardeo
- ❌ Emojis duplicados antes/despues de la URL`;

const NEW_RULE_67 = `6. Cuando muestres una prop, usa el formato WhatsApp-friendly: titulo con emoji,
precio+ambientes+m² en una linea, URL **sola en su propia linea** (para que WhatsApp
genere el preview card automatico). NUNCA [Ver](url) - markdown no funciona en WA.
Ver bloque "FORMATO DE PROPIEDADES" mas abajo.
7. Maximo 2-3 propiedades por mensaje. Si tenes mas, decile "tengo mas opciones,
¿queres que te muestre?"`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;
  let changes = 0;

  // Patch 1: reemplazar la regla 6/7 que tenia [Ver](url)
  let replaced = false;
  for (const pat of OLD_PATTERNS) {
    if (pat.test(msg)) {
      msg = msg.replace(pat, NEW_RULE_67);
      console.log('✅ Patched: regla 6/7 del Matcher con formato WhatsApp friendly');
      replaced = true;
      changes++;
      break;
    }
  }
  if (!replaced) {
    // fallback: buscar [Ver](url) literal y reemplazar
    if (msg.includes('[Ver](url)') || msg.includes('formato markdown')) {
      // Reemplazo line-by-line donde aparece el patron
      msg = msg.replace(/\(formato markdown \[Ver\]\(url\)\)/g, '(formato WhatsApp - URL sola en linea, ver bloque FORMATO DE PROPIEDADES)');
      msg = msg.replace(/\(\[Ver\]\(url\)\)/g, '(URL sola en linea - ver FORMATO DE PROPIEDADES)');
      console.log('✅ Patched: limpieza in-place de [Ver](url)');
      replaced = true;
      changes++;
    }
  }

  // Patch 2: agregar el bloque NEW_BLOCK si no existe
  if (!msg.includes('FORMATO DE PROPIEDADES (CRITICO - WhatsApp friendly)')) {
    if (msg.includes('# REGLAS DEL CRM') || msg.includes('# REGLAS CRITICAS DEL CRM')) {
      // Insertar antes del bloque CRM
      msg = msg.replace(/(# REGLAS (CRITICAS )?DEL CRM)/, NEW_BLOCK + '\n\n$1');
      console.log('✅ Insertado bloque FORMATO DE PROPIEDADES antes del bloque CRM');
    } else if (msg.includes('# PRIORIDAD MAXIMA')) {
      msg = msg.replace('# PRIORIDAD MAXIMA', NEW_BLOCK + '\n\n# PRIORIDAD MAXIMA');
      console.log('✅ Insertado bloque FORMATO DE PROPIEDADES antes de PRIORIDAD MAXIMA');
    } else {
      msg += '\n\n' + NEW_BLOCK;
      console.log('✅ Append bloque FORMATO DE PROPIEDADES al final');
    }
    changes++;
  } else {
    console.log('ℹ️  Bloque FORMATO DE PROPIEDADES ya existe');
  }

  console.log(`\nsystemMessage: ${before} -> ${msg.length} chars (delta ${msg.length - before})`);
  if (changes === 0) { console.log('Nada que cambiar.'); return; }

  core.parameters.options.systemMessage = msg;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
