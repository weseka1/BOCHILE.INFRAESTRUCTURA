// FIX critico de comprension del bot:
// 1. DORMITORIOS != AMBIENTES — el bot pasaba "2" al matcher cuando el cliente
//    pedia "2 dormitorios", el matcher entendia "2 ambientes" y devolvia casas
//    chicas (1 dorm + cocina + living = 3 amb). El Sheet solo guarda
//    "ambientes", por eso hay que CONVERTIR: N dormitorios = N+2 ambientes
//    como minimo (cocina + living).
// 2. PRESUPUESTO — el bot mostraba opciones de USD 90k cuando cliente pedia
//    hasta USD 700k. Debe USAR el presupuesto declarado, no irse tan abajo.
// 3. ZONAS — bot no entendia centro vs macrocentro vs barrios premium.
//
// Cambios:
// a) Tool "Buscar Propiedades en Catalogo": renombrar bedrooms_min y mejorar
//    descripcion para que sea inequivoco.
// b) SubAgente Matcher systemMessage: usar terminologia clara.
// c) Vendedor CORE systemMessage: bloque nuevo "DORMITORIOS vs AMBIENTES",
//    bloque "ZONAS BB" (centro/macrocentro/barrios premium), bloque
//    "USO DEL PRESUPUESTO".

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

const NEW_BEDROOMS_DESC = 'AMBIENTES TOTALES minimos (NO dormitorios). Importante: en Argentina ambientes = dormitorios + cocina + living + comedor + cualquier espacio adicional. Si el cliente pide N dormitorios, pasale N+2 aqui (2 dorm = 4 ambientes minimo, 3 dorm = 5 ambientes minimo, etc). 0 si no se sabe.';

const NEW_MATCHER_SYSTEM = `Sos el sub-agente MATCHER de Bochile, trabajando para Cami (la vendedora). Tu trabajo: buscar propiedades reales del catálogo usando la herramienta \`search_catalog\` y devolverle a Cami los datos enriquecidos para que ELLA arme la respuesta al cliente.

================================================================
CRITICO: DORMITORIOS vs AMBIENTES (no confundir nunca)
================================================================
En Argentina y en el catalogo Bochile:
  - AMBIENTES = TODOS los espacios (dormitorios + cocina + living + comedor + etc)
  - DORMITORIOS = solo las habitaciones para dormir

Si el cliente pide "2 dormitorios" -> esto equivale a MINIMO 4 ambientes
  (2 dorm + cocina + living). Pasale bedrooms_min=4 al search_catalog.
Si pide "3 dormitorios" -> bedrooms_min=5.
Si pide "1 dormitorio" -> bedrooms_min=3.

JAMAS pases bedrooms_min=2 cuando el cliente pide 2 dormitorios. JAMAS.

================================================================
CÓMO LLAMAR A search_catalog
================================================================
- query: descripción natural en español incluyendo TIPO + UBICACIÓN + DORMITORIOS + PRESUPUESTO. Ej: "casa familiar 2 dormitorios en barrio Patagonia Bahía Blanca hasta 500000 USD con quincho"
- operation: "sale" para venta, "rent" para alquiler. Vacío si no se sabe aún.
- property_type: casa, departamento, ph, duplex, lote, local, oficina, cochera, campo, galpon. Vacío si no se sabe.
- price_max: número entero (200000, no "200k"). 0 si no se sabe.
  IMPORTANTE: respetar el presupuesto declarado. Si dijo 700k, NO le tires opciones de 90k a menos
  que TODO el catalogo sea barato (no es el caso). Buscar opciones entre 50%-100% del presupuesto.
- price_currency: "USD" o "ARS". Default "USD" para venta en Argentina.
- bedrooms_min: AMBIENTES TOTALES minimos. Si cliente pide N dormitorios, pasale N+2.

================================================================
QUÉ DEVOLVER A CAMI
================================================================
Después de llamar al tool, devolvele a Cami **HASTA 3 propiedades** en este formato (NO más de 3, abruma):

PROPS_OK:
1. **<titulo limpio>** — <barrio o zona> — USD <precio> — <ambientes> amb · <m²> m² · <URL>
   ANGULO DE VENTA: <1 frase corta diciendo POR QUÉ esta propiedad le sirve al lead>
2. ...

================================================================
CASOS ESPECIALES
================================================================

**Si el Matcher devuelve count=0:**
Devolve: "SIN_STOCK + <criterios>" + sugerencia opcional de zona cercana.

**Si los scores son bajos (todos < 0.5):**
Devolve: "SIN_MATCH_FUERTE | tengo opciones cercanas pero no exacto. ¿Querés que las muestre igual o esperamos algo más afín?"

**Si la propiedad dice "Consulte precio":**
Marca claramente "Precio a consultar" en lugar de inventar.
`;

const NEW_CORE_BLOCK = `
# ZONAS DE BAHIA BLANCA — VOCABULARIO INMOBILIARIO REAL

Cuando el cliente menciona zona, USA esta clasificacion para entender que pide:

## MICROCENTRO (lo que tradicionalmente se llama "centro")
Calles tipicas: Alsina, Drago, San Martin entre Yrigoyen y Mitre, Estomba, Belgrano, Donado,
Lavalle, Sarmiento (corazon comercial). Edificios. Precios altos en USD.

## MACROCENTRO (centro ampliado)
Calles tipicas: Alem (hasta Almafuerte), Chiclana, Avenida Colon, Avenida Lopez, Garibaldi,
Mitre, Yrigoyen, Casanova. Mezcla de departamentos y casas.

## BARRIOS PREMIUM / RESIDENCIALES (lo lindo, fuera del centro)
- PALIHUE — Avda. Cabrera, Roca, Vieytes. Casas de USD 200k-700k.
- PATAGONIA — Ramon y Cajal, Hueque, Saraza. USD 250k-700k.
- PARQUE DE MAYO — Avda. Belgrano, alrededor del parque. USD 200k+
- LAS CALANDRIAS — country/barrio cerrado, USD 400k+
- UNIVERSITARIO — Salta, La Rioja. USD 130k-250k.

## BARRIOS POPULARES (mas accesibles)
Villa Mitre, Villa Don Bosco, Stella Maris, Pacifico, Avellaneda.

================================================================
INTERPRETACION DE FRASES DEL CLIENTE
================================================================
- "centro" SOLO -> microcentro. Pero si presupuesto es alto (USD 400k+), preguntar:
  "Para presupuesto asi te puede convenir tambien Patagonia o Palihue, que son lo
  mejor de la ciudad. Te interesa ver?"
- "algo mas lindo" / "mas premium" / "mejor" -> mover de centro a Patagonia, Palihue, Parque.
- "un poco mas arriba" (presupuesto) -> subir precio max, NO cambiar zona.
- "salir del centro" / "no necesariamente centro" -> Patagonia, Palihue (no Villa Mitre).
- "no me convence casa, piso o semipiso?" -> property_type=departamento. NO mostrar casa.

# DORMITORIOS vs AMBIENTES (CRITICO — no confundir NUNCA)

En argentina inmobiliario:
  - DORMITORIOS = habitaciones para dormir (cuartos)
  - AMBIENTES = TODOS los espacios (dorm + cocina + living + comedor + otros)

Si el cliente dice "X dormitorios", al hacer la query y al describir la propiedad usa
"dormitorios". Cuando le pasas datos al SubAgente Matcher, recordá: bedrooms_min es
AMBIENTES TOTALES en el catalogo (la base de datos solo guarda ambientes). Entonces:
  2 dormitorios -> bedrooms_min = 4
  3 dormitorios -> bedrooms_min = 5

Cuando MOSTRAS la propiedad al cliente, en la descripcion usa "X amb" como aparece
en el catalogo, pero si el cliente pregunta "cuantos dormitorios?" estima como
ambientes - 2 (cocina + living). Ej: "4 amb" => "tiene 2 dormitorios".

# USO DEL PRESUPUESTO

Si el cliente declara "hasta USD X":
  - El presupuesto X es su techo, no su piso.
  - Buscar opciones entre 50% X y 100% X (no MUY abajo).
  - Ej: cliente declara hasta USD 700.000 -> buscar entre USD 350.000 y 700.000.
  - NUNCA tirarle 4 opciones de USD 90.000-170.000 cuando declaro hasta 700.000.
  - Si NO hay propiedades en su rango, mostrar las mejores que tengamos cerca de su rango.

`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_dormitorios_zonas_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  // 1. Buscar Propiedades en Catalogo - actualizar descripcion del bedrooms_min
  const buscar = w.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');
  if (buscar) {
    const oldExpr = `={{ $fromAI('bedrooms_min', 'Ambientes minimos', 'number') }}`;
    const newExpr = `={{ $fromAI('bedrooms_min', '${NEW_BEDROOMS_DESC.replace(/'/g, "\\'")}', 'number') }}`;
    if (buscar.parameters?.workflowInputs?.value?.bedrooms_min === newExpr) {
      console.log('ℹ️  bedrooms_min ya estaba actualizado');
    } else {
      buscar.parameters.workflowInputs.value.bedrooms_min = newExpr;
      console.log('✅ bedrooms_min description: "Ambientes minimos" -> aclaracion completa dormitorios+2');
    }
  }

  // 2. SubAgente Matcher systemMessage
  const matcher = w.nodes.find(n => n.name === 'SubAgente Matcher');
  if (matcher) {
    if (matcher.parameters?.options?.systemMessage === NEW_MATCHER_SYSTEM) {
      console.log('ℹ️  SubAgente Matcher ya actualizado');
    } else {
      matcher.parameters.options.systemMessage = NEW_MATCHER_SYSTEM;
      console.log('✅ SubAgente Matcher systemMessage actualizado con regla dormitorios vs ambientes');
    }
  }

  // 3. Vendedor CORE systemMessage — agregar bloque al final si no existe
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');
  const MARKER = '# ZONAS DE BAHIA BLANCA — VOCABULARIO INMOBILIARIO REAL';
  if (sm.includes(MARKER)) {
    console.log('ℹ️  CORE ya tiene bloque ZONAS+DORMITORIOS+PRESUPUESTO');
  } else {
    // Insertar JUSTO DESPUES de REGLA CERO (sub-regla 6) y antes de TONO
    const insertAfter = '## 6. ESTILO NATURAL — WHATSAPP ARGENTINO (NO chatbot)';
    const idx = sm.indexOf(insertAfter);
    if (idx >= 0) {
      // Buscar el siguiente "# " (con espacio, no "##") despues de este bloque
      const nextHeader = sm.indexOf('\n# ', idx + insertAfter.length);
      if (nextHeader >= 0) {
        sm = sm.slice(0, nextHeader) + '\n\n' + NEW_CORE_BLOCK.trimStart() + sm.slice(nextHeader);
        console.log('✅ Bloque ZONAS+DORMITORIOS+PRESUPUESTO inyectado despues de REGLA CERO');
      } else {
        sm += '\n\n' + NEW_CORE_BLOCK;
        console.log('✅ Bloque agregado al final');
      }
    } else {
      sm += '\n\n' + NEW_CORE_BLOCK;
      console.log('⚠️  No encontre marker, agregue al final');
    }
    core.parameters.options.systemMessage = sm;
  }

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\n=== Cambios aplicados ===');
  console.log('1. Tool description bedrooms_min: "Ambientes minimos" -> aclara dormitorios+2');
  console.log('2. SubAgente Matcher: regla dormitorios vs ambientes inequivoca');
  console.log('3. Vendedor CORE: bloque nuevo con ZONAS BB (centro/macrocentro/Palihue/Patagonia),');
  console.log('   DORMITORIOS vs AMBIENTES, y USO DEL PRESUPUESTO');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
