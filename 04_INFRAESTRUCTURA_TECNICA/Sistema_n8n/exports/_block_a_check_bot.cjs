// BLOQUE A parte 2: Check Bot Activo
// Nodo Sheets lookup que lee el lead, despues un Switch que skipea si pausado.
// Insertado entre Log Mensaje Entrante y Cargar Historial Conversaciones.
const http = require('node:http');
const crypto = require('node:crypto');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

function req(method, path, body){
  return new Promise((res,rej)=>{
    const data = body ? JSON.stringify(body) : null;
    const opts = {host:'localhost',port:5680,path,method,headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}};
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});
    r.on('error',rej);
    if(data) r.write(data);
    r.end();
  });
}

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: '9NvEcPkNdH6i0j3L', name: 'Google Sheets account' } };

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);

  const log = wf.nodes.find(n => n.name === 'Log Mensaje Entrante');
  const cargarHist = wf.nodes.find(n => n.name === 'Cargar Historial Conversaciones');

  // 1) Nodo "Cargar Estado Lead" (Sheets lookup en leads por lead_id)
  let cargarEstado = wf.nodes.find(n => n.name === 'Cargar Estado Lead');
  if (!cargarEstado) {
    cargarEstado = {
      parameters: {
        operation: 'lookup',
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'leads' },
        filtersUI: {
          values: [
            { lookupColumn: 'lead_id', lookupValue: "={{ $('Merge Caminos').item.json.lead_id }}" }
          ]
        },
        combineFilters: 'AND',
        options: { returnAllMatches: false }
      },
      name: 'Cargar Estado Lead',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [log.position[0] + 220, log.position[1]],
      id: crypto.randomUUID(),
      credentials: SHEETS_CRED,
      alwaysOutputData: true,
      onError: 'continueRegularOutput'
    };
    wf.nodes.push(cargarEstado);
  }

  // 2) Nodo "Check Bot Activo" (Code que evalua estado y devuelve {skip, reason})
  let checkBot = wf.nodes.find(n => n.name === 'Check Bot Activo');
  if (!checkBot) {
    checkBot = {
      parameters: {
        jsCode: [
          '// Lee estado del lead (bot_pausado_hasta, conversacion_cerrada) y decide si seguir.',
          'const lead = $input.first().json || {};',
          'const mensaje = String(($("Merge Caminos").first().json.mensaje || $("Merge Caminos").first().json.mensaje_original || "")).toLowerCase().trim();',
          'const ahora = new Date();',
          '',
          '// Check pausa por humano',
          'const pausadoHasta = lead.bot_pausado_hasta;',
          'if (pausadoHasta) {',
          '  const fp = new Date(pausadoHasta);',
          '  if (!isNaN(fp.getTime()) && fp > ahora) {',
          '    return [{ json: { skip: true, reason: "bot_pausado_por_humano", pausado_hasta: pausadoHasta } }];',
          '  }',
          '}',
          '',
          '// Check conversacion cerrada (si lo esta, solo reactivar si el cliente saluda nuevo)',
          'const cerrada = String(lead.conversacion_cerrada || "").toLowerCase() === "true";',
          'if (cerrada) {',
          '  const esSaludoNuevo = /^(hola|buen[oa]s|qué tal|hi |hey |holi)/i.test(mensaje);',
          '  if (!esSaludoNuevo) {',
          '    return [{ json: { skip: true, reason: "conversacion_cerrada_sin_saludo" } }];',
          '  }',
          '  // Es saludo: continuar (el flujo despues va a re-activar via Admin)',
          '}',
          '',
          '// Bot activo, continuar. Propagar campos del Merge Caminos para los nodos siguientes.',
          'const merge = $("Merge Caminos").first().json || {};',
          'return [{ json: Object.assign({}, merge, { skip: false, reason: "bot_activo" }) }];'
        ].join('\n')
      },
      name: 'Check Bot Activo',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [log.position[0] + 440, log.position[1]],
      id: crypto.randomUUID()
    };
    wf.nodes.push(checkBot);
  }

  // 3) Switch que separa skip vs continue
  let switchBot = wf.nodes.find(n => n.name === 'Switch Bot Activo');
  if (!switchBot) {
    switchBot = {
      parameters: {
        rules: {
          values: [
            { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: 's1', leftValue: '={{ $json.skip }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'skip' },
            { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ id: 's2', leftValue: '={{ $json.skip }}', rightValue: false, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'continue' }
          ]
        },
        options: {}
      },
      name: 'Switch Bot Activo',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3,
      position: [log.position[0] + 660, log.position[1]],
      id: crypto.randomUUID()
    };
    wf.nodes.push(switchBot);
  }

  // 4) Reconectar: Log Mensaje Entrante -> Cargar Estado Lead -> Check Bot Activo -> Switch -> (skip|Cargar Historial)
  wf.connections['Log Mensaje Entrante'] = { main: [[{ node: 'Cargar Estado Lead', type: 'main', index: 0 }]] };
  wf.connections['Cargar Estado Lead'] = { main: [[{ node: 'Check Bot Activo', type: 'main', index: 0 }]] };
  wf.connections['Check Bot Activo'] = { main: [[{ node: 'Switch Bot Activo', type: 'main', index: 0 }]] };
  wf.connections['Switch Bot Activo'] = {
    main: [
      [],  // skip output -> nada
      [{ node: 'Cargar Historial Conversaciones', type: 'main', index: 0 }]
    ]
  };

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);
})();
