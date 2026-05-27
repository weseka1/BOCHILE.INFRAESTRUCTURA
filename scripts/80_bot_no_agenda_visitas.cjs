// FASE 1 - El bot YA NO AGENDA VISITAS.
//
// Cambios:
// 1. "Crear Visita en CRM" cambia toolDescription + mapping:
//    - estado: 'pendiente' (no 'agendada')
//    - confirmada_cliente: false
//    - notificada_vendedor: false
//    - fecha y hora vacios (no inventa)
//    - vendedor_id y vendedor_nombre vacios (no asigna)
//    El bot solo registra el INTERES con lead/prop/observaciones.
//
// 2. systemMessage del Vendedor CORE:
//    - Bloque AGENDA Y VISITAS reemplazado: "NUNCA agendes, registra y deriva a Camila"
//    - Listado TOOLS: punto 3 (Crear Visita) actualizado
//    - Agregado bloque DERIVAR A HUMANO con financiacion/creditos/negociacion
//
// Idempotente. Hace backup antes.

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

// ============================================================
// 1. Nueva configuracion del nodo "Crear Visita en CRM"
// ============================================================
const NEW_TOOL_DESCRIPTION = 'REGISTRAR INTERES DE VISITA. NUNCA agendas vos. Solo registras que el cliente quiere visitar una propiedad. El vendedor humano coordinara fecha y hora. Usar cuando el cliente diga "quiero conocer la prop", "podemos coordinar visita", "cuando me lo muestran", etc. Datos requeridos: prop_id (opcional si no se sabe), observaciones (lo que el cliente expresa sobre el interes).';

// Nuevo mapping: el bot ya NO inventa fecha, hora, vendedor.
// Solo registra interes. Estado pendiente. Camila completa el resto en el dashboard.
const NEW_COLUMNS = {
  mappingMode: 'defineBelow',
  value: {
    visita_id: '={{ "V-" + $now.toMillis() }}',
    lead_id: "={{ $('Parsear Mensaje').item.json.lead_id }}",
    prop_id: `={{ (function(){ const v = String($fromAI('prop_id', 'ID real de propiedad si el cliente la menciono (ej P-001 o 21886). Si no se sabe, devolver string vacio.', 'string')||''); if(!v || v === 'P-XXX' || v === 'P-X' || v.length < 2) return ''; return v; })() }}`,
    vendedor_id: '',
    vendedor_nombre: '',
    cliente_nombre: "={{ $('Parsear Mensaje').item.json.nombre }}",
    direccion: `={{ (function(){ const v = String($fromAI('direccion', 'Direccion REAL de la propiedad si se conoce. Si no, devolver string vacio.', 'string')||''); if(!v || v === 'dir' || v.length < 5) return ''; return v; })() }}`,
    fecha: '',
    hora: '',
    estado: 'pendiente',
    confirmada_cliente: '={{ false }}',
    notificada_vendedor: '={{ false }}',
    recordatorio_enviado: '={{ false }}',
    observaciones: `={{ (function(){ const v = String($fromAI('observaciones', 'Notas relevantes del cliente para que el vendedor humano sepa al coordinar: que prop quiere visitar, su disponibilidad sugerida, urgencia, presupuesto, contexto.', 'string')||''); if(!v || v === 'notas' || v.length < 3) return ''; return v; })() }}`,
    creada_en: '={{ $now.toISO() }}',
  },
  matchingColumns: [],
  schema: [],
  attemptToConvertTypes: false,
  convertFieldsToString: true,
};

// ============================================================
// 2. systemMessage del CORE - bloques a reemplazar
// ============================================================
const OLD_TOOL_LINE = '3. **Crear Visita en CRM**: cuando agendamos visita concreta (vendedor + prop + fecha + hora).';
const NEW_TOOL_LINE = '3. **Crear Visita en CRM** (REGISTRAR INTERES — NO AGENDAS): cuando el cliente quiere visitar la propiedad. NO le des fecha/hora. Registras el interés y le decis que el vendedor lo va a contactar.';

const OLD_AGENDA_BLOCK = `# AGENDA Y VISITAS (NO INVENTAR)
NUNCA inventes horarios. Respeta horarios reales (de Leer Agenda Vendedor) + feriados +
buffer (60 min misma zona / 90 min zonas distintas).
Si esta ocupado: "Ese horario ya se ocupo 😅 || Pero tengo: 17:00, 18:30, manana a las 11".
Fechas claras: "viernes 23 a las 18:00". Timezone ARG (GMT-3). NUNCA fechas pasadas.

Cuando confirmes visita, USA la tool "Crear Visita en CRM" con: vendedor + prop_id +
cliente_nombre + lead_id + fecha + hora + direccion + observaciones.`;

const NEW_AGENDA_BLOCK = `# VISITAS (VOS NO AGENDAS — REGISTRA Y DERIVA)
REGLA NO NEGOCIABLE: VOS NO AGENDAS VISITAS. NUNCA des una fecha/hora concreta al cliente.
NUNCA digas "te confirmo para tal hora", "te agendo el viernes", "nos vemos a las 11". Eso lo
coordina el vendedor humano.

Cuando el cliente quiere visitar una propiedad:
  1. Usa la tool "Crear Visita en CRM" para REGISTRAR el interés (queda en estado pendiente).
     Cargá: prop_id (si se sabe), observaciones (que prop le interesa, cuando le viene bien al
     cliente si lo menciono, urgencia, contexto util para el vendedor).
  2. Respondele al cliente: "Le aviso a Camila / el vendedor, te va a contactar para coordinar
     fecha y hora 🙌" (con tu estilo, no copies literal).

Si el cliente insiste en una fecha/hora puntual: NO confirmes nada. Decile: "Le paso tu
disponibilidad a Camila y ella te confirma".

# DERIVAR A HUMANO (tampoco respondes vos — registrá y deriva)
Hay temas que NO los manejas, son del vendedor humano:
  - VISITAS (regla arriba).
  - FINANCIACION / CREDITOS HIPOTECARIOS / CUOTAS / BANCO: si el cliente pregunta sobre formas
    de financiacion, planes de cuotas, creditos, opciones bancarias, prestamos. NUNCA inventes
    tasas, plazos ni condiciones. Decile: "Esos detalles los maneja Camila / un asesor, le aviso
    para que te explique las opciones reales 💰".
  - NEGOCIACION DE PRECIO: si el cliente pide descuento, contra-oferta, precio especial. Decile:
    "Ese tipo de conversacion la tenes directo con Camila, le paso tu interes".

Para estos casos podes usar "Avisar Vendedor respond.io" (SubAgente Administrativo) para
notificar a Camila que hay un lead caliente con esa intencion.`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_no_agenda_visitas_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  // -------- Nodo Crear Visita en CRM --------
  const cv = w.nodes.find(n => n.name === 'Crear Visita en CRM');
  if (!cv) { console.error('No encontre Crear Visita en CRM'); process.exit(1); }

  if (cv.parameters.toolDescription === NEW_TOOL_DESCRIPTION) {
    console.log('ℹ️  Crear Visita en CRM ya estaba actualizada');
  } else {
    cv.parameters.toolDescription = NEW_TOOL_DESCRIPTION;
    cv.parameters.columns = NEW_COLUMNS;
    console.log('✅ Crear Visita en CRM: ahora registra interes pendiente (sin fecha/hora/vendedor)');
  }

  // -------- systemMessage CORE --------
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No encontre Vendedor CORE'); process.exit(1); }
  let sm = String(core.parameters?.options?.systemMessage || '');

  let changedSm = false;

  // Reemplazar linea de TOOLS
  if (sm.includes(OLD_TOOL_LINE)) {
    sm = sm.replace(OLD_TOOL_LINE, NEW_TOOL_LINE);
    changedSm = true;
    console.log('✅ TOOLS L3 actualizada');
  } else if (sm.includes(NEW_TOOL_LINE)) {
    console.log('ℹ️  TOOLS L3 ya actualizada');
  } else {
    console.log('⚠️  No encontre la linea original de TOOLS L3, ver manual');
  }

  // Reemplazar bloque AGENDA Y VISITAS
  if (sm.includes(OLD_AGENDA_BLOCK)) {
    sm = sm.replace(OLD_AGENDA_BLOCK, NEW_AGENDA_BLOCK);
    changedSm = true;
    console.log('✅ Bloque AGENDA Y VISITAS reemplazado por VISITAS + DERIVAR A HUMANO');
  } else if (sm.includes(NEW_AGENDA_BLOCK)) {
    console.log('ℹ️  Bloque ya estaba actualizado');
  } else {
    console.error('❌ NO encontre el bloque AGENDA Y VISITAS original');
    console.error('   Revisar manualmente el systemMessage del CORE');
  }

  if (changedSm) core.parameters.options.systemMessage = sm;

  // PUT + activate
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\n=== Listo. Comportamiento del bot ===');
  console.log('  Cliente pide visita      -> registra estado=pendiente, "Camila te va a contactar"');
  console.log('  Cliente pide financiacion-> deriva a humano (no inventa cuotas/tasas)');
  console.log('  Cliente pide descuento   -> deriva a humano');
  console.log('  Camila ve en el dashboard la visita pendiente y la confirma manualmente');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
