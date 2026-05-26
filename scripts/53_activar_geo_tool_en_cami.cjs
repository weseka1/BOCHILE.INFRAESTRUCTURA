// HITO 1.7 - Activar la geo-tool en n8n + actualizar prompt Cami.
//
// Pasos:
//   1. Importar workflows/08_SUB_Buscar_Por_Proximidad_Geo.json como nuevo workflow
//      en n8n (via POST /api/v1/workflows).
//   2. Guardar el ID nuevo del sub-workflow.
//   3. Modificar el workflow principal (TEdlfSBCc5ENVslp):
//      - Agregar nodo "Buscar Por Proximidad Geo" tipo toolWorkflow apuntando al SUB.
//      - Conectarlo al Vendedor CORE como ai_tool.
//   4. Activar el sub-workflow.
//   5. Patch del systemMessage de Vendedor CORE agregando instrucciones de uso.
//   6. Backup del workflow principal antes de tocar.
//
// PRE-REQUISITO: rag-bochile.onrender.com debe tener /api/search-by-geo activo.
//   Test: curl -X POST https://rag-bochile.onrender.com/api/search-by-geo -d '{"lat":-38.7,"lng":-62.2,"radius_km":1}'
//
// USO: node scripts/53_activar_geo_tool_en_cami.cjs
//
// Reversible:
//   - Backup del workflow en scripts/_workflow_backups/
//   - El sub-workflow se puede eliminar desde n8n UI.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const MAIN_WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY, Accept: 'application/json' };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 30000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

(async () => {
  // ============================================================
  // 0. Pre-check: RAG geo endpoint live?
  // ============================================================
  console.log('=== Pre-check: /api/search-by-geo live en RAG ===');
  const ragTest = await new Promise((resolve) => {
    const data = JSON.stringify({ lat: -38.72, lng: -62.27, radius_km: 1, limit: 1 });
    const r = https.request({
      host: 'rag-bochile.onrender.com', port: 443, path: '/api/search-by-geo',
      method: 'POST', timeout: 15000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, rsp => {
      const buf = [];
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => resolve({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    r.on('error', () => resolve({ s: 0, b: 'error' }));
    r.on('timeout', () => { r.destroy(); resolve({ s: 0, b: 'timeout' }); });
    r.write(data); r.end();
  });
  if (ragTest.s !== 200) {
    console.error(`❌ RAG geo no responde 200 (got ${ragTest.s}). Deploy bochile-rag primero.`);
    console.error('   Response:', ragTest.b.slice(0, 200));
    process.exit(1);
  }
  console.log('✅ RAG geo endpoint OK\n');

  // ============================================================
  // 1. Backup del workflow principal
  // ============================================================
  console.log('=== Backup workflow principal ===');
  const mainResp = await req('GET', `/api/v1/workflows/${MAIN_WF}`);
  if (mainResp.s !== 200) { console.error('GET main fallo:', mainResp.s); process.exit(1); }
  const main = JSON.parse(mainResp.b);
  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpPath = path.join(bkpDir, `${MAIN_WF}_pre_geo_tool_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpPath, JSON.stringify(main, null, 2));
  console.log(`✅ Backup en: ${bkpPath}\n`);

  // ============================================================
  // 2. Crear sub-workflow desde 08_SUB_*.json
  // ============================================================
  console.log('=== Crear sub-workflow geo ===');
  const subDef = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../workflows/08_SUB_Buscar_Por_Proximidad_Geo.json'), 'utf8'));

  // n8n API espera solo {name, nodes, connections, settings}
  const createResp = await req('POST', '/api/v1/workflows', {
    name: subDef.name,
    nodes: subDef.nodes,
    connections: subDef.connections,
    settings: subDef.settings || { executionOrder: 'v1' },
  });
  if (createResp.s < 200 || createResp.s >= 300) {
    console.error(`❌ Create sub fallo: ${createResp.s}`);
    console.error(createResp.b.slice(0, 500));
    process.exit(1);
  }
  const sub = JSON.parse(createResp.b);
  const subId = sub.id;
  console.log(`✅ Sub-workflow creado, id: ${subId}\n`);

  // ============================================================
  // 3. Activar el sub-workflow
  // ============================================================
  const actSub = await req('POST', `/api/v1/workflows/${subId}/activate`);
  console.log(`✅ Sub-workflow activado: ${actSub.s}\n`);

  // ============================================================
  // 4. Agregar tool node al workflow principal apuntando al sub
  // ============================================================
  console.log('=== Agregar toolWorkflow node al workflow principal ===');

  const toolName = 'Buscar Por Proximidad Geo';

  // Si ya existe (idempotente), skip
  if (main.nodes.some(n => n.name === toolName)) {
    console.log(`ℹ️  Tool "${toolName}" ya existe en el workflow principal. Skip.`);
  } else {
    // Posicion: cerca del Matcher tool (Buscar Propiedades en Catalogo)
    const matcherTool = main.nodes.find(n => n.name === 'Buscar Propiedades en Catalogo');
    const basePos = matcherTool ? matcherTool.position : [1320, 760];

    const newTool = {
      parameters: {
        name: 'buscar_por_proximidad_geo',
        description:
          'Busca propiedades por proximidad geografica (lat/lng + radio) en lugar de por similitud textual. ' +
          'USAR cuando el cliente menciona un LANDMARK conocido o referencia geografica difusa: ' +
          '"cerca de la olla", "cerca de la UNS", "frente al mar", "cerca del faro", "cerca del shopping", ' +
          '"barrio Patagonia", "Palihue", "Villa Mitre", "centro de Monte Hermoso", etc. ' +
          'Tambien usar cuando el cliente da un landmark pero NO una direccion exacta. ' +
          'Input: { landmark_key (string) O { lat, lng, radius_km }, opcional: query, operation, property_type, price_max }. ' +
          'Landmarks disponibles: centro_bb, uns, shopping_bahia_plaza, hospital_penna, palihue, villa_mitre, villa_belgrano, patagonia, ' +
          'parque_de_mayo, hipodromo, ingeniero_white_puerto, centro_mh, costanera_mh, las_dunas_complejo, la_olla, camping_americano, ' +
          'faro_recalada, sauce_grande, monte_del_este, centro_pa, pehuen_co, sierra_de_la_ventana, tornquist, villa_ventana, ' +
          'medanos_villarino, pedro_luro, cabildo.',
        workflowId: { __rl: true, value: subId, mode: 'list' },
        workflowInputs: {
          mappingMode: 'defineBelow',
          value: {
            landmark_key: '={{ $fromAI("landmark_key", "Landmark conocido. Si no aplica, deja vacio y usa lat/lng.", "string") }}',
            lat: '={{ $fromAI("lat", "Latitud explicita si no hay landmark", "number") }}',
            lng: '={{ $fromAI("lng", "Longitud explicita si no hay landmark", "number") }}',
            radius_km: '={{ $fromAI("radius_km", "Radio en km. Default 2.", "number") }}',
            query: '={{ $fromAI("query", "Query semantica opcional para re-rankear los resultados", "string") }}',
            operation: '={{ $fromAI("operation", "sale o rent", "string") }}',
            property_type: '={{ $fromAI("property_type", "departamento, casa, lote, etc", "string") }}',
            price_max: '={{ $fromAI("price_max", "Maximo precio numerico", "number") }}',
          },
          schema: [
            { id: 'landmark_key', displayName: 'landmark_key', type: 'string' },
            { id: 'lat', displayName: 'lat', type: 'number' },
            { id: 'lng', displayName: 'lng', type: 'number' },
            { id: 'radius_km', displayName: 'radius_km', type: 'number' },
            { id: 'query', displayName: 'query', type: 'string' },
            { id: 'operation', displayName: 'operation', type: 'string' },
            { id: 'property_type', displayName: 'property_type', type: 'string' },
            { id: 'price_max', displayName: 'price_max', type: 'number' },
          ],
        },
      },
      id: `tool-geo-${Date.now()}`,
      name: toolName,
      type: '@n8n/n8n-nodes-langchain.toolWorkflow',
      typeVersion: 2.2,
      position: [basePos[0] + 220, basePos[1] + 80],
    };

    main.nodes.push(newTool);
    console.log(`✅ Tool node agregado: "${toolName}"`);
  }

  // Conectar al Vendedor CORE como ai_tool
  if (!main.connections[toolName]) {
    main.connections[toolName] = { ai_tool: [[{ node: 'Vendedor CORE', type: 'ai_tool', index: 0 }]] };
    console.log(`✅ Conectado: ${toolName} ─[ai_tool]→ Vendedor CORE`);
  } else {
    console.log(`ℹ️  Conexion ya existia`);
  }

  // ============================================================
  // 5. Patch del systemMessage: instrucciones de uso de la geo-tool
  // ============================================================
  console.log('\n=== Patch del prompt Cami: agregar regla de uso geo-tool ===');
  const core = main.nodes.find(n => n.name === 'Vendedor CORE');
  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;

  const GEO_RULE = `

# ====================================================
# REGLA NUEVA - TOOL GEO (Buscar Por Proximidad Geo)
# ====================================================
Tenes una tool nueva: **Buscar Por Proximidad Geo** que busca propiedades por
DISTANCIA REAL en metros desde un landmark conocido. Es MAS PRECISA que el Matcher
de texto cuando el cliente da una referencia GEOGRAFICA difusa.

## Cuando usar la GEO TOOL en vez del Matcher de texto
- ✅ "cerca de la olla" → landmark_key=la_olla
- ✅ "cerca de la UNS" → landmark_key=uns
- ✅ "frente al mar en monte" → landmark_key=costanera_mh
- ✅ "cerca del shopping" → landmark_key=shopping_bahia_plaza
- ✅ "cerca del faro" → landmark_key=faro_recalada
- ✅ "barrio Patagonia" → landmark_key=patagonia
- ✅ "Palihue" → landmark_key=palihue
- ✅ "Villa Mitre" → landmark_key=villa_mitre
- ✅ "cerca del Camping Americano" → landmark_key=camping_americano

## Cuando seguir usando el Matcher de texto (Buscar Propiedades en Catalogo)
- ✅ Cliente da DIRECCION EXACTA: "Av. Colon 1100", "Pueyrredon 330"
- ✅ Cliente da CALLE sin barrio: "algo en Sarmiento"
- ✅ Cliente describe la prop sin geografia: "depto 2 ambientes en venta"
- ✅ Cliente pide features especificos: "con cochera y balcon"

## Landmarks disponibles (key → descripcion)
- **Bahia Blanca:** centro_bb, uns, shopping_bahia_plaza, hospital_penna,
  hospital_italiano, teatro_municipal, parque_de_mayo, palihue, villa_mitre,
  villa_belgrano, patagonia, estacion_sud, hipodromo, ingeniero_white_puerto
- **Monte Hermoso:** centro_mh, costanera_mh, las_dunas_complejo, la_olla,
  camping_americano, faro_recalada, sauce_grande, monte_del_este, punto_blanco
- **Punta Alta:** centro_pa, base_naval
- **Pehuen Co:** pehuen_co
- **Sierras:** sierra_de_la_ventana, tornquist, villa_ventana
- **Villarino:** medanos_villarino, pedro_luro, cabildo

## Como invocar (ejemplos)
Cliente: "Busco algo cerca de la olla"
  Llama: Buscar Por Proximidad Geo con { landmark_key: "la_olla" }
  Respuesta: "En la olla son medanos, pero te paso el complejo Las Dunas pegado || [props]"

Cliente: "Cerca del shopping pero 2 ambientes"
  Llama: Buscar Por Proximidad Geo con { landmark_key: "shopping_bahia_plaza", query: "2 ambientes" }

Cliente: "Algo en Palihue para alquilar"
  Llama: Buscar Por Proximidad Geo con { landmark_key: "palihue", operation: "rent" }

La tool devuelve las props ORDENADAS por distancia real. Si la respuesta dice
SIN_PROPIEDADES_GEO, no hay nada cerca con esa coord/radio - en ese caso probas
con radio mayor o caes al Matcher de texto.`;

  if (!msg.includes('Buscar Por Proximidad Geo')) {
    msg += GEO_RULE;
    console.log(`✅ Agregada seccion GEO TOOL al prompt: ${before} → ${msg.length} chars`);
  } else {
    console.log(`ℹ️  El prompt ya tiene la seccion GEO TOOL`);
  }
  core.parameters.options.systemMessage = msg;

  // ============================================================
  // 6. PUT main workflow + activar
  // ============================================================
  console.log('\n=== Guardar workflow principal ===');
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (main.settings) for (const k of A) if (main.settings[k] !== undefined) s[k] = main.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${MAIN_WF}`, {
    name: main.name, nodes: main.nodes, connections: main.connections, settings: s,
  });
  console.log(`PUT main workflow: ${upd.s}`);
  const act = await req('POST', `/api/v1/workflows/${MAIN_WF}/activate`);
  console.log(`Activate: ${act.s}`);

  console.log('\n🎯 LISTO. Sub-workflow:', subId);
  console.log('   Main workflow patched: prompt +', (msg.length - before), 'chars');
  console.log('   Backup en:', bkpPath);
  console.log('\n   Probar: mandale a Cami "busco algo cerca de la olla"');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
