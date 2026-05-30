// Cambiar el formato de presentacion de propiedades: en lugar de "X amb"
// (jerga tecnica), usar "X dormitorios · Y banos · Z m²" (lo que la gente
// real quiere oir).
//
// El catalogo solo guarda "ambientes" y "banos", no "dormitorios". Regla
// de conversion: dormitorios = ambientes - 2 (cocina + living), excepto
// monoambientes (ambientes=1 -> 'monoambiente') y casos edge.

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

const NEW_FORMATO = `# FORMATO DE PROPIEDADES (CRITICO - WhatsApp friendly)
**JAMAS uses formato markdown [Ver](url) - WhatsApp NO lo renderiza.** El cliente
ve literal "[Ver](https://...)" lo cual es feo y poco profesional.

## REGLA DE OUTPUT: hablar humano, NO tecnico
La gente NO sabe que es "ambientes". Quiere oir DORMITORIOS, BAÑOS, METROS.
El catalogo guarda "ambientes" y "banos" como columnas; vos CONVERTIS al
mostrar al cliente:

  dormitorios = ambientes - 2  (porque ambientes = dorm + cocina + living)

Excepciones:
  - ambientes = 1 -> "monoambiente" (NO digas "0 dormitorios", queda raro)
  - ambientes = 2 -> "monoambiente con living separado" o "1 dormitorio"
  - ambientes >= 3 -> "(ambientes - 2) dormitorios"

Para los baños, usar el campo "banos" del catalogo TAL CUAL (1, 2, 3 banos).

## Formato correcto para mostrar UNA propiedad
Estructura recomendada (3-5 lineas, URL en linea propia):

\`\`\`
🏠 Alsina 690 - Casa en venta
💰 USD 160.000 · 2 dormitorios · 2 baños · 132 m²
📍 Centro · cochera, patio

https://www.bochile.com/listing/alsina-690-propiedad-a-la-venta/
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
- Datos clave en UNA sola linea: precio · dormitorios · banos · m² (separados con · ).
- Si NO hay info de banos en el catalogo, omitir esa parte (no inventar).
- Si la propiedad es terreno/lote: omitir dormitorios y banos. Mostrar solo m² y zona.

## JAMAS DIGAS "AMBIENTES" al cliente
Aunque el catalogo lo diga, vos traducis. Ejemplos:
  ❌ MAL: "Casa con 4 ambientes y 2 baños"
  ✅ BIEN: "Casa con 2 dormitorios y 2 baños"

  ❌ MAL: "Departamento de 3 amb · 60 m²"
  ✅ BIEN: "Depto de 1 dormitorio · 1 baño · 60 m²"

  ❌ MAL: "Monoambiente de 1 amb"
  ✅ BIEN: "Monoambiente"

  ❌ MAL: "PH de 5 ambientes"
  ✅ BIEN: "PH de 3 dormitorios y 2 baños"

## Si tenes que mostrar 2-3 propiedades juntas
Separa con linea en blanco entre ellas. Cada una con su URL en linea propia:

\`\`\`
🏠 Güemes 2327 - Casa
💰 USD 120.000 · 1 dormitorio · 1 baño · 95 m²
https://www.bochile.com/listing/guemes-2327

🏢 Soler 111 - Depto
💰 USD 85.000 · monoambiente · 1 baño · 50 m²
https://www.bochile.com/listing/soler-111
\`\`\`

## Despues de mostrar la(s) prop(s)
Cerra con UN CTA claro, sin emojis decorativos:
- "Te interesa coordinar una visita?" (preferido si la prop es buena candidata)
- "Queres mas opciones similares?"
- "Te suma si me decis presupuesto y zona para afinar la busqueda?"

## QUE NO HACER
- ❌ "[Ver](https://...)" - markdown roto en WhatsApp
- ❌ "Mira la prop aca: https://..." - "Mira la prop aca" antes de la URL bloquea la preview card
- ❌ "Mas info en este link: ..." - frase de relleno
- ❌ Listar 4+ props con URLs en un solo mensaje - bombardeo
- ❌ Emojis duplicados antes/despues de la URL
- ❌ JAMAS decir "X ambientes" al cliente - es jerga tecnica
- ❌ Inventar dormitorios o banos si el catalogo no los tiene
`;

const OLD_START = '# FORMATO DE PROPIEDADES (CRITICO - WhatsApp friendly)';

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, `${WF}_pre_formato_dorm_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(w, null, 2));

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');

  const start = sm.indexOf(OLD_START);
  if (start < 0) {
    console.error('No encontre el bloque viejo');
    process.exit(2);
  }

  // Encontrar el final del bloque (siguiente H1)
  let nextIdx = start + OLD_START.length;
  while (true) {
    const found = sm.indexOf('\n# ', nextIdx);
    if (found < 0) { nextIdx = sm.length; break; }
    if (sm[found + 3] !== '#') { nextIdx = found + 1; break; }
    nextIdx = found + 3;
  }

  const oldLen = nextIdx - start;
  sm = sm.slice(0, start) + NEW_FORMATO.trimStart() + '\n' + sm.slice(nextIdx);
  console.log(`Bloque viejo: ${oldLen} chars`);
  console.log(`Bloque nuevo: ${NEW_FORMATO.length} chars`);

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

  console.log('\n=== Cami ahora dice ===');
  console.log('  "Casa de 2 dormitorios y 2 banos, 132 m²"');
  console.log('  (en lugar de "4 ambientes")');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
