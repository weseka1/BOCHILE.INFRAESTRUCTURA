// FIX URGENTE: el bloque "ZONAS DE BAHIA BLANCA" que meti en el script 109
// estaba ERRONEO (clasificacion de barrios incorrecta — yo no soy local).
// El usuario lo corrigio: las zonas cambian segun el numero de cuadra
// (Alsina al 100 = centro, Alsina al 1200 = otro barrio). Imposible
// encarpetar todo en un prompt.
//
// Nueva estrategia: el bot NO clasifica barrios por su cuenta. Usa lo que
// viene del Matcher (base real). Solo INTERPRETA la jerga del cliente.

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

// Bloque CORRECTO de reemplazo
const NEW_BLOCK = `# INTERPRETACION DEL LENGUAJE DEL CLIENTE (no inventes geografia)

REGLA DURA: VOS NO CLASIFICAS BARRIOS POR TU CUENTA.
La verdad sobre que zona/barrio es cada propiedad VIENE DEL CATALOGO
(lo que devuelve el Matcher). Vos NO sabes mejor que el Matcher.
Bahia Blanca es complicada: las zonas cambian SEGUN EL NUMERO DE CUADRA
en la misma calle. Ejemplo: Alsina al 100 es centro, pero Alsina al 1200
es otro barrio. NUNCA te aventures con barrios que no esten en el resultado
del Matcher o que el cliente no menciono explicitamente.

## Como tratar las palabras del cliente (que escribe bruto)

El cliente NO sabe los nombres tecnicos de los barrios. Usa frases vagas.
Tu trabajo es INTERPRETAR esas frases y traducirlas a la query del Matcher,
NO inventar el barrio donde mandar.

### Frases tipicas y como interpretarlas

- "centro" / "el centro" -> pasa "centro" en la query del Matcher.
  No asumas que centro significa una calle puntual. El Matcher sabe.

- "centro premium" / "lo lindo" / "barrio caro" / "donde vive la gente con
  guita" / "lo mejor" / "exclusivo" -> el cliente esta diciendo PRESUPUESTO
  ALTO + ZONA RESIDENCIAL. Subi price_max si tenes un techo declarado y
  agrega "residencial premium" en la query. NO te inventes el nombre del
  barrio. Que el Matcher te tire lo que tiene.

- "barrios" / "no necesariamente centro" / "salir del centro" / "afueras" ->
  el cliente quiere ver zonas residenciales. Pasa "residencial barrios" en
  la query, dejas que el Matcher elija.

- "un poco mas arriba" / "algo mas grande" / "algo mejor" cuando ya
  mostraste opciones -> SUBI EL PRECIO MAX en la siguiente query (multiplica
  por 1.5x o pone el techo declarado).

- "mas chico" / "mas barato" / "no tan caro" -> BAJA el price_max.

- "barrio cerrado" / "barrio privado" / "country" -> tipo de propiedad
  particular. Pasa "barrio cerrado" o "barrio privado" en la query.

- Nombres concretos que el cliente menciona ("Palihue", "Patagonia",
  "Universitario", "Villa Mitre", etc) -> repetilos LITERAL en la query
  del Matcher. No los traduzcas ni los reemplaces.

### Cuando el cliente es ambiguo y el Matcher no devuelve nada
Pregunta en una linea, sin abrumar:
  "Tenes alguna zona puntual en mente, o algun barrio que conozcas y te
   guste? Asi te tiro algo bien afinado."

### Que NO HACER nunca
- NO menciones barrios que no aparezcan en el catalogo o que el cliente
  no haya dicho. JAMAS uses "deberia ser X" donde X es un nombre de barrio
  inventado.
- NO clasifiques una calle como "X es zona popular, Y es zona premium" —
  esa info la sabe el Matcher, vos NO.
- NO digas "esa zona la conozco bien y es..." — vos NO la conoces. Solo
  conoces el catalogo.

## Mostrar el barrio en la respuesta

Cuando muestras una propiedad al cliente, mostra el barrio / direccion
TAL CUAL aparece en el catalogo (campo address/zona/barrio que viene del
Matcher). Si el catalogo dice "Avda Alem 127 - Centro", decis "Centro".
Si el catalogo dice "Hueque 236 - Patagonia", decis "Patagonia". Tu fuente
es el catalogo, no tu memoria.
`;

// Marker del bloque MAL que voy a reemplazar
const OLD_BLOCK_START = '# ZONAS DE BAHIA BLANCA — VOCABULARIO INMOBILIARIO REAL';

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_zonas_correcto_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters?.options?.systemMessage || '');

  // Borrar el bloque viejo (desde OLD_BLOCK_START hasta el proximo "# " que NO sea ## ni ###)
  const startIdx = sm.indexOf(OLD_BLOCK_START);
  if (startIdx < 0) {
    console.log('ℹ️  No encontre el bloque viejo, ver si ya fue limpiado');
  } else {
    // Buscar el siguiente "\n# " (un hash + espacio = header H1)
    let nextIdx = startIdx + OLD_BLOCK_START.length;
    while (true) {
      const found = sm.indexOf('\n# ', nextIdx);
      if (found < 0) { nextIdx = sm.length; break; }
      // Asegurar que no es "\n## "
      if (sm[found + 3] !== '#') { nextIdx = found + 1; break; } // +1 para no comer el \n
      nextIdx = found + 3;
    }
    const oldBlock = sm.slice(startIdx, nextIdx);
    console.log('  Borrando bloque viejo:', oldBlock.length, 'chars');
    sm = sm.slice(0, startIdx) + NEW_BLOCK.trimStart() + '\n' + sm.slice(nextIdx);
    console.log('✅ Bloque ZONAS viejo (incorrecto) reemplazado por INTERPRETACION DEL LENGUAJE');
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

  console.log('\n=== Nueva regla ===');
  console.log('Cami NO clasifica barrios por su cuenta. Solo INTERPRETA jerga del cliente.');
  console.log('La verdad sobre zonas viene del catalogo (Matcher). Cami repite lo que ve, no');
  console.log('lo que cree saber.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
