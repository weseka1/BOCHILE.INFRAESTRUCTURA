#!/usr/bin/env node
/**
 * Reemplaza los 2 nodos Twilio del W1 por HTTP Request a la API de respond.io:
 *   - "Responder al Cliente Twilio" → "Responder al Cliente respond.io" (HTTP Request)
 *   - "Avisar Vendedor por WhatsApp Twilio" → "Avisar Vendedor respond.io" (HTTP Request)
 *
 * Mantiene IDs y connections para no romper el flow.
 *
 * El HTTP Request usa env vars:
 *   RESPONDIO_API_TOKEN   - Bearer token de respond.io
 *   RESPONDIO_CHANNEL_ID  - ID del canal WhatsApp Business en respond.io
 *
 * Setearlas en docker-compose.yml del n8n local o en el dashboard de Render.
 *
 * Antes de ejecutar: yo hago backup automático en _backups/
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

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

/**
 * Genera un nodo HTTP Request que pega a respond.io API
 * https://docs.respond.io/messaging-apis/api-v2/messages
 */
function respondioHttpNode({ id, name, position, phoneExpr, messageExpr }) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    parameters: {
      method: 'POST',
      url: `=https://api.respond.io/v2/contact/phone:${phoneExpr}/message`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={\n  "channelId": ${'{{$env.RESPONDIO_CHANNEL_ID}}'},\n  "message": {\n    "type": "text",\n    "text": ${messageExpr}\n  }\n}`,
      options: {
        response: {
          response: {
            fullResponse: false,
            neverError: true, // no rompe el workflow si respond.io tira un 5xx transitorio
          },
        },
      },
    },
    credentials: {
      httpHeaderAuth: {
        // El user va a crear esta credencial en n8n con:
        //   Name: respond.io API
        //   Header Name: Authorization
        //   Header Value: Bearer <RESPONDIO_API_TOKEN>
        id: 'PLACEHOLDER_RESPONDIO_CRED_ID',
        name: 'respond.io API',
      },
    },
  };
}

async function main() {
  const get = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'GET', headers: { 'X-N8N-API-KEY': API_KEY },
  });
  if (get.status !== 200) throw new Error('GET: ' + get.body.slice(0, 200));
  const wf = JSON.parse(get.body);

  // Backup
  const bk = path.join(__dirname, '_backups',
    `W1_pre_respondio_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(bk), { recursive: true });
  fs.writeFileSync(bk, JSON.stringify(wf, null, 2));
  console.log('Backup:', path.basename(bk));

  // 1) Reemplazar "Responder al Cliente Twilio"
  const idxCliente = wf.nodes.findIndex(n => n.name === 'Responder al Cliente Twilio');
  if (idxCliente !== -1) {
    const old = wf.nodes[idxCliente];
    wf.nodes[idxCliente] = respondioHttpNode({
      id: old.id,
      name: 'Responder al Cliente respond.io',
      position: old.position,
      // Telefono del lead — viene del Normalizar Mensaje sin el +
      phoneExpr: '{{ $(\'Parsear Mensaje\').item.json.from.replace(/[^0-9]/g, \'\') }}',
      messageExpr: '"{{ $(\'Vendedor CORE\').item.json.output.replace(/\\"/g, \'\\\\"\') }}"',
    });
    // Renombrar la connection key
    if (wf.connections['Responder al Cliente Twilio']) {
      wf.connections['Responder al Cliente respond.io'] = wf.connections['Responder al Cliente Twilio'];
      delete wf.connections['Responder al Cliente Twilio'];
    }
    console.log('Reemplazado: Responder al Cliente Twilio → respond.io HTTP');
  } else {
    console.log('NO encontre "Responder al Cliente Twilio" (quiza ya esta cambiado)');
  }

  // 2) Reemplazar "Avisar Vendedor por WhatsApp Twilio"
  const idxVend = wf.nodes.findIndex(n => n.name === 'Avisar Vendedor por WhatsApp Twilio');
  if (idxVend !== -1) {
    const old = wf.nodes[idxVend];
    wf.nodes[idxVend] = {
      id: old.id,
      name: 'Avisar Vendedor respond.io',
      type: '@n8n/n8n-nodes-langchain.toolHttpRequest',
      typeVersion: 1.1,
      position: old.position,
      parameters: {
        toolDescription: 'Avisa al vendedor real (Camila Pomerich u otro) por WhatsApp via respond.io API que hay una visita agendada. Usalo despues de crear visita.',
        method: 'POST',
        url: `=https://api.respond.io/v2/contact/phone:${'{{ $fromAI("telefono_vendedor", "Telefono del vendedor sin + ni espacios, ej 5492914413200", "string") }}'}/message`,
        sendBody: true,
        specifyBody: 'json',
        jsonBody: `={\n  "channelId": ${'{{$env.RESPONDIO_CHANNEL_ID}}'},\n  "message": {\n    "type": "text",\n    "text": ${'"{{ $fromAI(\'mensaje\', \'Mensaje formato: VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]. Score: XX. Presupuesto: USD/ARS XXX. Zona: XXX. Notas: ...\', \'string\') }}"'}\n  }\n}`,
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        options: {},
      },
      credentials: {
        httpHeaderAuth: {
          id: 'PLACEHOLDER_RESPONDIO_CRED_ID',
          name: 'respond.io API',
        },
      },
    };
    if (wf.connections['Avisar Vendedor por WhatsApp Twilio']) {
      wf.connections['Avisar Vendedor respond.io'] = wf.connections['Avisar Vendedor por WhatsApp Twilio'];
      delete wf.connections['Avisar Vendedor por WhatsApp Twilio'];
    }
    console.log('Reemplazado: Avisar Vendedor Twilio → respond.io HTTP (tool)');
  }

  // Settings limpios
  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = { executionOrder: 'v1' };
  if (wf.settings) for (const k of allowed) if (wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const put = await req({
    host: 'localhost', port: 5680, path: `/api/v1/workflows/${W1_ID}`,
    method: 'PUT', headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings }));
  if (put.status >= 300) throw new Error('PUT: ' + put.body.slice(0, 300));

  console.log('');
  console.log('OK: W1 patcheado para respond.io.');
  console.log('FALTA PARA QUE FUNCIONE:');
  console.log('  1. Crear credencial en n8n: Settings > Credentials > New');
  console.log('     Type: HTTP Header Auth');
  console.log('     Name: respond.io API');
  console.log('     Header Name: Authorization');
  console.log('     Header Value: Bearer <tu API token de respond.io>');
  console.log('  2. Setear env var en n8n (docker-compose.yml):');
  console.log('     RESPONDIO_CHANNEL_ID: "<channel id del WA en respond.io>"');
  console.log('  3. Restart n8n: docker compose restart n8n');
  console.log('  4. En el W1 UI, abrir los 2 nodos nuevos y asignarles la credencial');
  console.log('     creada en el paso 1 (n8n no la asocia auto via API).');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
