// Inserta historial persistente desde Sheet 'conversaciones' al systemMessage del Vendedor CORE.
// Fix definitivo a la perdida de contexto: memoryBufferWindow es in-memory y se borra con reinicios.
// Plan:
//   1) Insertar "Cargar Historial Conversaciones" (Sheets read filtrado por telefono)
//   2) Insertar "Formatear Historial" (Code)
//   3) Reconectar: Log Mensaje Entrante -> Cargar Historial -> Formatear Historial -> Vendedor CORE
//   4) Inyectar en systemMessage del Vendedor CORE un bloque "## HISTORIAL"
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

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);

  const logNode = wf.nodes.find(n => n.name === 'Log Mensaje Entrante');
  const coreNode = wf.nodes.find(n => n.name === 'Vendedor CORE');

  // Si ya existen, idempotente
  if (wf.nodes.some(n => n.name === 'Cargar Historial Conversaciones')) {
    console.log('[skip] nodos ya existen, solo re-inyectando system prompt');
  } else {
    const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
    const cargarHist = {
      parameters: {
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'conversaciones' },
        filtersUI: {
          values: [
            { lookupColumn: 'telefono', lookupValue: "={{ $('Merge Caminos').item.json.telefono }}" }
          ]
        },
        options: { returnFirstMatch: false }
      },
      name: 'Cargar Historial Conversaciones',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [logNode.position[0] + 220, logNode.position[1]],
      id: crypto.randomUUID(),
      credentials: { googleSheetsOAuth2Api: { id: '9NvEcPkNdH6i0j3L', name: 'Google Sheets account' } }
    };

    const formatearHist = {
      parameters: {
        jsCode: [
          '// Formatea las ultimas 20 conversaciones para inyectar al systemMessage del CORE.',
          'const items = $input.all();',
          '// Cada item es una fila del sheet conversaciones',
          'const filas = items.map(i => i.json);',
          '// Ordenar por timestamp asc (mas viejo primero), tomar las ultimas 20',
          'filas.sort((a,b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));',
          'const recientes = filas.slice(-20);',
          '',
          'if (recientes.length === 0) {',
          '  return [{ json: { historial: "(sin historial previo, este es el primer contacto)" } }];',
          '}',
          '',
          'const lineas = recientes.map(f => {',
          '  const who = f.direccion === "in" ? "Cliente" : "Cami";',
          '  const msg = String(f.mensaje || "").replace(/\\n/g, " ").slice(0, 300);',
          '  const ts = String(f.timestamp || "").slice(0, 19).replace("T", " ");',
          '  return `[${ts}] ${who}: ${msg}`;',
          '});',
          '',
          'return [{ json: { historial: lineas.join("\\n") } }];'
        ].join('\n')
      },
      name: 'Formatear Historial',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [logNode.position[0] + 440, logNode.position[1]],
      id: crypto.randomUUID()
    };

    wf.nodes.push(cargarHist, formatearHist);

    // Reconectar: Log Mensaje Entrante -> Cargar Historial -> Formatear Historial -> Vendedor CORE
    wf.connections['Log Mensaje Entrante'] = {
      main: [[{ node: 'Cargar Historial Conversaciones', type: 'main', index: 0 }]]
    };
    wf.connections['Cargar Historial Conversaciones'] = {
      main: [[{ node: 'Formatear Historial', type: 'main', index: 0 }]]
    };
    wf.connections['Formatear Historial'] = {
      main: [[{ node: 'Vendedor CORE', type: 'main', index: 0 }]]
    };
  }

  // Inyectar bloque historial al systemMessage del Vendedor CORE
  let sm = coreNode.parameters.options.systemMessage;
  const MARK_START = '\n\n================================================================\nHISTORIAL DE CONVERSACION CON ESTE CLIENTE (Sheet, persistente)\n================================================================\n';
  const MARK_BLOCK = MARK_START + "{{ $('Formatear Historial').item.json.historial }}\n";

  if (sm.includes(MARK_START)) {
    console.log('[skip] systemMessage ya tiene el bloque historial');
  } else {
    sm = sm + MARK_BLOCK;
    coreNode.parameters.options.systemMessage = sm;
  }

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];

  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }

  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  // Verificar
  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  console.log('\n[verificacion] nodos historial:');
  console.log('  Cargar Historial:', !!wf2.nodes.find(n => n.name === 'Cargar Historial Conversaciones'));
  console.log('  Formatear Historial:', !!wf2.nodes.find(n => n.name === 'Formatear Historial'));
  console.log('  Log -> next:', JSON.stringify(wf2.connections['Log Mensaje Entrante']));
  console.log('  Cargar -> next:', JSON.stringify(wf2.connections['Cargar Historial Conversaciones']));
  console.log('  Formatear -> next:', JSON.stringify(wf2.connections['Formatear Historial']));
  const core2 = wf2.nodes.find(n => n.name === 'Vendedor CORE');
  console.log('  systemMessage incluye historial:', core2.parameters.options.systemMessage.includes('HISTORIAL DE CONVERSACION'));
})();
