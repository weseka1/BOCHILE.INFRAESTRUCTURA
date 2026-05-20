#!/usr/bin/env node
/**
 * Suma al SubAgente Administrativo un tool "Leer Agenda Vendedor" que devuelve
 * las visitas YA agendadas de un vendedor en los proximos 7 dias. Asi el Admin
 * puede proponer slots libres sin chocar agendas.
 *
 * Tambien actualiza el prompt del Admin con el flujo de chequear-disponibilidad
 * antes-de-agendar.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
const W1_ID = 'aUMQyupnGJ5IWm5e';

function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request(opts, (resp) => {
      let d = '';
      resp.on('data', (c) => (d += c));
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}

const NEW_ADMIN_PROMPT = `Sos el sub-agente ADMINISTRATIVO de Bochile. Tu trabajo: ejecutar tareas concretas en el CRM (Google Sheet) y devolver al CORE (Camila) un resumen claro de lo que hiciste.

================================================================
TUS HERRAMIENTAS
================================================================
- **Leer Vendedores Activos**: lista de vendedores con sus zonas de cobertura
- **Leer Agenda Vendedor**: visitas ya agendadas de un vendedor (proximos 7 dias)
- **Crear Visita en CRM**: agenda una nueva visita
- **Guardar Match Pendiente**: registra busqueda de lead cuando no hay stock
- **Actualizar Lead CRM**: actualiza score, etapa, datos del lead
- **Avisar Vendedor por WhatsApp Twilio**: notifica al vendedor de la visita

================================================================
TUS FLUJOS
================================================================

**1) AGENDAR VISITA (cuando el CORE te pide agendar)**

Paso 1: Llama a "Leer Vendedores Activos" y elegi el mejor vendedor segun la zona de la propiedad. Si zona = "Palihue" y un vendedor tiene zona_especialidad = "Palihue, Villa Belgrano", ese es el indicado.

Paso 2: Llama a "Leer Agenda Vendedor" con su empleado_id para ver sus visitas agendadas.

Paso 3: Propone 2 slots libres en horario de oficina dentro de los proximos 7 dias:
- Lunes a Viernes: 10hs, 14hs, 16hs, 18hs
- Sabado: 10hs, 11hs, 12hs
- Domingos: NO (cerrado)
- Evita slots que ya esten ocupados en la agenda del vendedor.
- Respeta minimo 1 hora entre visitas (gap para traslados).

Paso 4: Devolve al CORE: "DISPONIBILIDAD: vendedor X tiene libre <slot1> o <slot2>. Proponer al lead."

Paso 5: Cuando el CORE te confirma que el lead acepto un slot:
- Llama a "Crear Visita en CRM" con todos los datos.
- Llama a "Avisar Vendedor por WhatsApp Twilio" con formato:
  "VISITA AGENDADA PARA EL <dia> <fecha> A LAS <hora> CON [NOMBRE CLIENTE] EN [DIRECCION COMPLETA]. Score del lead: XX. Presupuesto: USD/ARS XXX.XXX. Zona: XXX. Tour 360: <url>. Notas: ..."
- Llama a "Actualizar Lead CRM" para mover el lead a etapa "Visita agendada".
- Devolve al CORE: "VISITA_OK: <vendedor> visita a <cliente> en <direccion> el <fecha> <hora>. visita_id: V-XXX."

**2) GUARDAR MATCH PENDIENTE (cuando no hay stock)**
- Llama a "Guardar Match Pendiente" con los criterios del lead.
- Llama a "Actualizar Lead CRM" para dejar etapa "En espera de stock".
- Devolve al CORE: "MATCH_PENDIENTE_OK: criterios guardados, se le va a avisar al lead cuando entre algo."

**3) ACTUALIZAR FICHA LEAD (siempre que el CORE te pase datos nuevos)**
- Llama a "Actualizar Lead CRM" con presupuesto, zona, tipo, urgencia, score, etapa.
- Devolve al CORE: "LEAD_ACTUALIZADO: <campos>."

================================================================
REGLAS DURAS
================================================================
- NUNCA inventes vendedores o agendas. Siempre llama a los tools.
- NUNCA propongas slots fuera de horario (madrugadas, despues de las 19hs, domingos).
- NUNCA dupliques visitas para el mismo cliente con el mismo vendedor el mismo dia.
- Si la "Leer Agenda Vendedor" devuelve 0 visitas, el vendedor esta totalmente libre — propone slots de oficina sin restriccion.

Devolves SIEMPRE un resumen plano y conciso al CORE. El CORE arma la respuesta natural al cliente con esa info.`;

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  const wf = JSON.parse(get.body);

  const bk = path.join(__dirname, '_backups',
    `W1_pre_agenda_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', path.basename(bk));

  // Tomar credencial de Google Sheets del nodo existente "Leer Vendedores Activos"
  const leerVend = wf.nodes.find(n => n.name === 'Leer Vendedores Activos');
  if (!leerVend) throw new Error('No encontre Leer Vendedores Activos');
  const gsCreds = leerVend.credentials;
  const sheetId = leerVend.parameters?.documentId?.value
    || leerVend.parameters?.documentId
    || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
  console.log('Usando credencial GS:', JSON.stringify(gsCreds));

  // Agregar nodo Leer Agenda Vendedor (googleSheetsTool)
  const existing = wf.nodes.find(n => n.name === 'Leer Agenda Vendedor');
  if (existing) {
    console.log('Nodo "Leer Agenda Vendedor" ya existe, lo sobrescribo');
  }

  const agendaNode = {
    id: existing?.id || crypto.randomUUID(),
    name: 'Leer Agenda Vendedor',
    type: 'n8n-nodes-base.googleSheetsTool',
    typeVersion: 4.6,
    position: existing?.position || [1900, 800],
    parameters: {
      descriptionType: 'manual',
      toolDescription:
        'Devuelve las visitas YA agendadas de un vendedor especifico en los proximos 7 dias. Util para encontrar slots libres antes de proponer un horario al cliente.',
      operation: 'lookup',
      documentId: typeof leerVend.parameters?.documentId === 'object'
        ? leerVend.parameters.documentId
        : { __rl: true, value: sheetId, mode: 'id' },
      sheetName: { __rl: true, value: 'visitas', mode: 'name' },
      filtersUI: {
        values: [
          {
            lookupColumn: 'vendedor_id',
            lookupValue: "={{ $fromAI('vendedor_id', 'ID del vendedor, ej E-1, E-2, E-1B', 'string') }}",
          },
        ],
      },
      combineFilters: 'AND',
      options: { returnAllMatches: true },
    },
    credentials: gsCreds,
  };

  if (existing) {
    const idx = wf.nodes.findIndex(n => n.name === 'Leer Agenda Vendedor');
    wf.nodes[idx] = agendaNode;
  } else {
    wf.nodes.push(agendaNode);
  }

  // Conectar al SubAgente Administrativo via ai_tool
  if (!wf.connections['Leer Agenda Vendedor']) {
    wf.connections['Leer Agenda Vendedor'] = {
      ai_tool: [[{ node: 'SubAgente Administrativo', type: 'ai_tool', index: 0 }]],
    };
  }

  // Update prompt del Admin
  const admin = wf.nodes.find(n => n.name === 'SubAgente Administrativo');
  if (admin) {
    admin.parameters = admin.parameters || {};
    admin.parameters.options = admin.parameters.options || {};
    admin.parameters.options.systemMessage = NEW_ADMIN_PROMPT;
    console.log('Prompt Admin actualizado con flujo de agenda');
  }

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body);
  console.log('OK: tool Leer Agenda Vendedor agregado + prompt del Admin actualizado');
}

main().catch(e => { console.error(e.message); process.exit(1); });
