// ENTERPRISE UPGRADE - "Empleada administrativa que deja TODO claro":
// 1. Fix header de 'conversaciones' en el Sheet (estaba clonado de 'leads')
// 2. Fix 'Log Mensaje Entrante' para que escriba msg_id, mensaje, direccion=in, msg_type, media_url, intencion_detectada, timestamp
// 3. Mejorar SubAgente Administrativo prompt (system message profesional)
// 4. Mejorar Registrar Accion IA con intencion_detectada
// 5. CORE: regla critica "DESPUES de cada mensaje del cliente, llama al Administrativo para actualizar_lead con TODOS los datos"
const https = require('node:https');
const path = require('path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const KEY_PATH = path.join(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');
const W1_ID = 'TEdlfSBCc5ENVslp';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h }, rsp => {
      let d = ''; rsp.on('data', c => d += c);
      rsp.on('end', () => r({ s: rsp.statusCode, b: d }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

const ADMIN_SYSTEM = `Sos el ASISTENTE ADMINISTRATIVO de Inmobiliaria Bochile. Tu trabajo es mantener
PERFECTAMENTE actualizado el CRM despues de cada interaccion con el cliente.

REGLAS:
- Tu unica funcion es ejecutar acciones administrativas concretas, no hablar con el cliente.
- Recibis una orden tipo {"action":"...","datos":{...}} y la ejecutas usando las tools disponibles.

ACCIONES POSIBLES:

1. actualizar_lead: usar tool "Actualizar Lead CRM" para guardar TODOS los datos que el
   cliente vaya revelando (nombre, telefono, operacion, tipo_propiedad, zona_pref,
   ambientes, presupuesto_min, presupuesto_max, moneda, forma_pago, urgencia, score,
   etapa, ultima_intencion, notas, vendedor_asignado).
   IMPORTANTE: si un dato es desconocido, NO lo pongas (no inventes). Solo escribe
   los que el cliente realmente dijo.

2. crear_visita: usar tool "Crear Visita en CRM" cuando el cliente confirma una visita
   concreta (vendedor + prop + fecha + hora).

3. guardar_match_pendiente: cuando hay propiedades del Matcher para mostrar al cliente.

4. avisar_vendedor: usar tool "Avisar Vendedor respond.io" cuando hay que escalar a humano.

5. cerrar_conversacion: usar tool "Cerrar Conversacion" cuando el cliente se despide.

PROFESIONALISMO:
- Loguea TODO. Mejor sobre-loguear que perder informacion.
- Si la orden dice "actualizar_lead" con datos vacios, no actualices nada (no escribas
  filas en blanco).
- Devolve siempre un resumen corto de lo que ejecutaste (ej: "Lead L-2914999000 actualizado:
  presupuesto_max=90000, zona_pref=centro").`;

const CORE_RULE_ADMIN = `

================================================================
REGLA CRITICA - REGISTRAR DATOS EN EL CRM (EMPLEADA ADMINISTRATIVA)
================================================================
Sos una empleada administrativa modelo. DESPUES de CADA mensaje del cliente, ANTES
de mandar tu respuesta final, llamas al sub-agente Administrativo con action="actualizar_lead"
y le pasas TODOS los datos nuevos que el cliente revelo en ese mensaje + datos previos
que tenes del contexto:

DATOS A EXTRAER Y GUARDAR (si el cliente los menciono o se infieren del contexto):
- nombre (si no esta o cambio)
- operacion (venta / alquiler / alquiler_temporario / comercial)
- tipo_propiedad (departamento / casa / ph / duplex / lote / local / oficina / galpon / campo)
- zona_pref (Centro / Microcentro / Palihue / Villa Mitre / Villa Belgrano / Parque Norte / etc.)
- ambientes (1 / 2 / 3 / 4+)
- presupuesto_max (numero - el techo que dijo el cliente)
- presupuesto_min (numero - si dio un rango)
- moneda (USD / ARS)
- forma_pago (contado / credito / mixto)
- urgencia (alta / media / baja - inferida de "lo necesito ya" vs "estoy viendo opciones")
- ultima_intencion (1 linea: "busca depto 2 amb venta centro 90k usd")
- notas (datos extra: composicion familiar, mascota, observaciones)
- etapa (Nuevo / Calificado / Visita_Agendada / En_Negociacion / Cerrado / Perdido)
- score (0-100 - inferido por interes mostrado)

EJEMPLO DE LLAMADA:
Cliente: "Hola, busco depto 2 amb en el centro hasta 90 mil USD para vivir yo"
Vos llamas: Administrativo({"action":"actualizar_lead","datos":{
  "operacion":"venta","tipo_propiedad":"departamento","zona_pref":"centro",
  "ambientes":2,"presupuesto_max":90000,"moneda":"USD","forma_pago":"contado",
  "urgencia":"media","ultima_intencion":"busca depto 2 amb venta centro 90k USD",
  "notas":"para vivienda propia","etapa":"Calificado","score":70
}})

JAMAS dejes pasar un mensaje del cliente sin actualizar el CRM. Es tu responsabilidad
administrativa #1. El dashboard tiene que mostrar SIEMPRE los datos al dia.`;

(async () => {
  // PARTE A: Fix header de 'conversaciones' en Sheet
  console.log('--- A. Fix header de conversaciones ---');
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const CONV_HEADER = ['msg_id','lead_id','telefono','nombre','canal','direccion','mensaje','msg_type','media_url','intencion_detectada','agente_que_respondio','requiere_humano','timestamp','id','createdAt','updatedAt'];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'conversaciones!A1:Z1',
    valueInputOption: 'RAW',
    requestBody: { values: [CONV_HEADER] },
  });
  console.log('  Header conversaciones actualizado:', CONV_HEADER.length, 'cols');

  // PARTE B: Fix workflow W1
  console.log('\n--- B. Fix workflow W1 (Logs + Admin + CORE) ---');
  const full = JSON.parse((await req('GET', '/api/v1/workflows/' + W1_ID)).b);

  // B1) Log Mensaje Entrante: completar campos
  const logIn = full.nodes.find(n => n.name === 'Log Mensaje Entrante');
  if (logIn) {
    logIn.parameters.columns = logIn.parameters.columns || {};
    logIn.parameters.columns.value = {
      msg_id: "={{ 'M-' + $now.toMillis() + '-in' }}",
      lead_id: "={{ $('Merge Caminos').item.json.lead_id }}",
      telefono: "={{ $('Merge Caminos').item.json.telefono }}",
      nombre: "={{ $('Merge Caminos').item.json.nombre || '' }}",
      canal: "={{ $('Merge Caminos').item.json.canal }}",
      direccion: "in",
      mensaje: "={{ $('Merge Caminos').item.json.mensaje || $('Merge Caminos').item.json.mensaje_original || '' }}",
      msg_type: "={{ $('Merge Caminos').item.json.msg_type || 'text' }}",
      media_url: "={{ $('Merge Caminos').item.json.media_url || '' }}",
      intencion_detectada: "received",
      agente_que_respondio: "",
      requiere_humano: "={{ false }}",
      timestamp: "={{ $now.toISO() }}",
    };
    // Asegurar matching column
    logIn.parameters.columns.matchingColumns = ['msg_id'];
    console.log('  Log Mensaje Entrante: 13 cols');
  }

  // B2) Log Mensaje Saliente: agregar 'nombre'
  const logOut = full.nodes.find(n => n.name === 'Log Mensaje Saliente');
  if (logOut && logOut.parameters.columns?.value) {
    logOut.parameters.columns.value.nombre = "={{ $('Merge Caminos').item.json.nombre || '' }}";
    logOut.parameters.columns.value.msg_type = "text";
    logOut.parameters.columns.value.media_url = "";
    console.log('  Log Mensaje Saliente: +nombre +msg_type +media_url');
  }

  // B3) SubAgente Administrativo: agregar system message profesional
  const admin = full.nodes.find(n => n.name === 'SubAgente Administrativo');
  if (admin) {
    admin.parameters.options = admin.parameters.options || {};
    admin.parameters.options.systemMessage = ADMIN_SYSTEM;
    console.log('  Administrativo systemMessage:', ADMIN_SYSTEM.length, 'chars');
  }

  // B4) Vendedor CORE: agregar regla critica
  const core = full.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = core.parameters.options.systemMessage;
  const MARK = 'REGLA CRITICA - REGISTRAR DATOS EN EL CRM';
  if (!sm.includes(MARK)) {
    sm = sm + CORE_RULE_ADMIN;
    core.parameters.options.systemMessage = sm;
    console.log('  CORE: +regla administrativa | total', sm.length, 'chars');
  } else {
    console.log('  CORE: regla ya estaba');
  }

  // B5) Registrar Accion IA: detalle mas rico
  const acc = full.nodes.find(n => n.name === 'Registrar Accion IA');
  if (acc && acc.parameters.columns?.value) {
    acc.parameters.columns.value.tipo = "={{ $('Merge Caminos').item.json.msg_type === 'image' ? 'imagen_atendida' : ($('Merge Caminos').item.json.msg_type === 'audio' ? 'audio_atendido' : 'conversacion_atendida') }}";
    acc.parameters.columns.value.resumen = "={{ 'In: ' + ($('Merge Caminos').item.json.mensaje || '[media]').substring(0, 80) }}";
    acc.parameters.columns.value.detalle = "={{ 'Out: ' + ($('Vendedor CORE').item.json.output || '').substring(0, 300) }}";
    console.log('  Registrar Accion IA: detalle mejorado');
  }

  // Guardar
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (full.settings) for (const k of A) if (full.settings[k] !== undefined) s[k] = full.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + W1_ID, { name: full.name, nodes: full.nodes, connections: full.connections, settings: s });
  console.log('\nPUT W1:', upd.s);
  const act = await req('POST', '/api/v1/workflows/' + W1_ID + '/activate');
  console.log('Activate W1:', act.s);
  console.log('Done.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
