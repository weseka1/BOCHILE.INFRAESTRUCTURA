#!/usr/bin/env node
/**
 * Reemplaza TODOS los nodos Twilio de TODOS los workflows de Bochile (W1, W2,
 * W3, W4) por HTTP Request a la API de respond.io.
 *
 * Workflows afectados:
 *   W1 aUMQyupnGJ5IWm5e  - Audio/Imagen Download (auth Twilio) → sin auth (URLs publicas respond.io)
 *                         + nombre del workflow: quitar "(v4 Twilio)"
 *   W2 f1CC972kzNPR8ebi  - WhatsApp Cliente, WhatsApp Vendedor (Twilio) → respond.io
 *   W3 W327qYVE9SpwQiRi  - WhatsApp Aviso al Lead (Twilio) → respond.io
 *   W4 wrFto5o6Zk02sZty  - WhatsApp Inquilino, Escalar a Camila Pomerich (Twilio) → respond.io
 *
 * Backup automático de los 4 workflows antes de tocar nada.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

const CRED_ID = 'ZKhcvjnvP6IpEK6w';     // ID de la credencial "respond.io API" creada antes
const CHANNEL_ID = '503760';             // Channel ID del WhatsApp Business en respond.io

const WORKFLOWS = [
  { id: 'aUMQyupnGJ5IWm5e', tag: 'W1' },
  { id: 'f1CC972kzNPR8ebi', tag: 'W2' },
  { id: 'W327qYVE9SpwQiRi', tag: 'W3' },
  { id: 'wrFto5o6Zk02sZty', tag: 'W4' },
];

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

/**
 * Convierte un nodo Twilio o twilioTool a un HTTP Request a respond.io API.
 * Mantiene id, name (renombrado), position y la lógica de a qué teléfono mandar.
 *
 * Twilio típicamente tiene:
 *   parameters.toPhoneNumber = "={{ ... }}"
 *   parameters.message       = "={{ ... }}"
 *   parameters.fromNumber    = phoneId
 *
 * respond.io API:
 *   POST https://api.respond.io/v2/contact/phone:{tel}/message
 *   body: { channelId, message: { type:'text', text: '...' } }
 */
function twilioToRespondioNode(old) {
  // Determinar a qué teléfono mandar
  const params = old.parameters || {};
  let phoneExpr = '={{ $json.telefono || $json.tel || $json.lead_telefono || $json.from || $json.to }}';

  // Mirar las propiedades que Twilio expone
  if (typeof params.toPhoneNumber === 'string') phoneExpr = '=' + params.toPhoneNumber.replace(/^=/, '');
  else if (typeof params.to === 'string') phoneExpr = '=' + params.to.replace(/^=/, '');
  else if (typeof params.recipientPhoneNumber === 'string') phoneExpr = '=' + params.recipientPhoneNumber.replace(/^=/, '');

  // Mensaje
  let messageExpr = '={{ $json.mensaje || $json.message || $json.text }}';
  if (typeof params.message === 'string') messageExpr = '=' + params.message.replace(/^=/, '');
  else if (typeof params.body === 'string') messageExpr = '=' + params.body.replace(/^=/, '');
  else if (typeof params.textBody === 'string') messageExpr = '=' + params.textBody.replace(/^=/, '');

  // Limpiar telefono: sacar "whatsapp:" prefix, "+", espacios
  // Lo hacemos via Liquid en n8n con .replace()
  const phoneClean = phoneExpr.replace(/^=/, '');
  const cleanedPhoneExpr = `=${'{'}{ String(${phoneClean.replace(/\{\{|\}\}/g, '')}).replace('whatsapp:', '').replace(/[^0-9]/g, '') ${'}'}}`;

  // Detectar si es un tool (agentTool) o nodo regular
  const isTool = (old.type || '').includes('Tool');

  const newName = old.name
    .replace(/Twilio/i, 'respond.io')
    .replace(/WhatsApp/i, 'WhatsApp respond.io')
    .replace(/respond\.io respond\.io/i, 'respond.io');

  const node = {
    id: old.id,
    name: newName,
    type: isTool ? '@n8n/n8n-nodes-langchain.toolHttpRequest' : 'n8n-nodes-base.httpRequest',
    typeVersion: isTool ? 1.1 : 4.2,
    position: old.position,
    parameters: isTool
      ? {
          toolDescription: `Manda mensaje WhatsApp a un destinatario via respond.io API. Reemplazo de ${old.name} (Twilio). Usalo para notificar al vendedor o cliente.`,
          method: 'POST',
          url: `=https://api.respond.io/v2/contact/phone:${'{{ $fromAI(\'telefono_destinatario\', \'Telefono del destinatario sin + ni espacios, ej 5492914413200\', \'string\').replace(\'whatsapp:\', \'\').replace(/[^0-9]/g, \'\') }}'}/message`,
          sendBody: true,
          specifyBody: 'json',
          jsonBody: `={\n  "channelId": ${CHANNEL_ID},\n  "message": {\n    "type": "text",\n    "text": ${'"{{ $fromAI(\'mensaje\', \'Mensaje WhatsApp completo. Para visita: VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]. Score: XX. Presupuesto: USD/ARS XXX. Zona: XXX. Notas: ...\', \'string\') }}"'}\n  }\n}`,
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          options: {},
        }
      : {
          method: 'POST',
          url: `=https://api.respond.io/v2/contact/phone:${'{{ String($json.telefono || $json.lead_telefono || $json.to || \'\').replace(\'whatsapp:\', \'\').replace(/[^0-9]/g, \'\') }}'}/message`,
          authentication: 'genericCredentialType',
          genericAuthType: 'httpHeaderAuth',
          sendBody: true,
          specifyBody: 'json',
          jsonBody: `={\n  "channelId": ${CHANNEL_ID},\n  "message": {\n    "type": "text",\n    "text": ${'"' + messageExpr.replace(/^=/, '').replace(/"/g, '\\"') + '"'}\n  }\n}`,
          options: {
            response: {
              response: {
                fullResponse: false,
                neverError: true,
              },
            },
          },
        },
    credentials: {
      httpHeaderAuth: {
        id: CRED_ID,
        name: 'respond.io API',
      },
    },
  };
  return node;
}

function cleanAudioImagenDownloadNode(old) {
  // Mantener el nodo HTTP Request pero quitar la auth Twilio (las URLs de respond.io
  // son públicas). Si en el futuro respond.io requiere Bearer, se cambia acá.
  const newName = old.name.replace(/\s*Twilio\s*/i, '').trim();
  const params = { ...old.parameters };
  delete params.authentication;
  delete params.genericAuthType;
  return {
    ...old,
    name: newName,
    parameters: params,
    credentials: undefined,
  };
}

async function processWorkflow(wfMeta) {
  console.log('');
  console.log(`════════════ ${wfMeta.tag} (${wfMeta.id}) ════════════`);

  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${wfMeta.id}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  if (get.status !== 200) throw new Error(`GET ${wfMeta.tag} fail: ${get.body.slice(0, 200)}`);
  const wf = JSON.parse(get.body);

  // Backup
  const bk = path.join(__dirname, '_backups',
    `${wfMeta.tag}_pre_full_respondio_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log(`  backup: ${path.basename(bk)}`);

  let changed = 0;
  const renames = []; // [oldName, newName] para actualizar connections

  for (let i = 0; i < wf.nodes.length; i++) {
    const n = wf.nodes[i];
    const type = n.type || '';
    const name = n.name || '';

    // Caso 1: nodo Twilio puro → reemplazar por HTTP Request a respond.io
    if (type === 'n8n-nodes-base.twilio' || type === 'n8n-nodes-base.twilioTool' || type.startsWith('n8n-nodes-base.twilio')) {
      const newNode = twilioToRespondioNode(n);
      wf.nodes[i] = newNode;
      if (n.name !== newNode.name) renames.push([n.name, newNode.name]);
      console.log(`  ✓ ${name} → ${newNode.name} (respond.io HTTP)`);
      changed++;
    }
    // Caso 2: HTTP Request para Download de Audio/Imagen Twilio → limpiar auth
    else if ((type === 'n8n-nodes-base.httpRequest' || type === 'n8n-nodes-base.httpRequestTool')
             && /twilio/i.test(name)
             && /download/i.test(name)) {
      const newNode = cleanAudioImagenDownloadNode(n);
      wf.nodes[i] = newNode;
      if (n.name !== newNode.name) renames.push([n.name, newNode.name]);
      console.log(`  ✓ ${name} → ${newNode.name} (auth Twilio removida)`);
      changed++;
    }
  }

  // Actualizar nombres en connections
  if (renames.length > 0) {
    const newConns = {};
    for (const [k, v] of Object.entries(wf.connections)) {
      const newKey = renames.find(([o]) => o === k)?.[1] || k;
      const newValue = JSON.parse(JSON.stringify(v));
      // Tambien actualizar referencias dentro de los conn targets
      for (const portType of Object.keys(newValue)) {
        for (const branch of newValue[portType]) {
          for (const target of (branch || [])) {
            const r = renames.find(([o]) => o === target.node);
            if (r) target.node = r[1];
          }
        }
      }
      newConns[newKey] = newValue;
    }
    wf.connections = newConns;
  }

  // W1: actualizar nombre del workflow para reflejar respond.io
  if (wfMeta.tag === 'W1' && /v4 Twilio/i.test(wf.name)) {
    wf.name = wf.name.replace(/\(v4 Twilio\)/i, '(v5 respond.io)');
    console.log(`  ✓ renamed workflow → ${wf.name}`);
  }

  console.log(`  ${changed} nodos modificados, ${renames.length} renames`);

  if (changed === 0) {
    console.log(`  ↻ nada que actualizar en ${wfMeta.tag}`);
    return;
  }

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${wfMeta.id}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) {
    console.log(`  ✗ PUT fail: ${put.body.slice(0, 300)}`);
    throw new Error(`PUT ${wfMeta.tag} fail`);
  }
  console.log(`  ↑ UPDATED OK`);
}

async function main() {
  for (const wf of WORKFLOWS) {
    try {
      await processWorkflow(wf);
    } catch (e) {
      console.error(`${wf.tag}: ${e.message}`);
    }
  }
  console.log('');
  console.log('════════════ LISTO ════════════');
  console.log('Verificar en n8n UI que los nodos estan con credencial respond.io API');
  console.log('Cuando hagas un cambio en n8n UI, hacé Save para que se persista.');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
