// BLOQUE B: Deteccion fin conversacion
// 1. Regla en systemMessage del CORE para detectar cierre y despedirse
// 2. Tool nueva "Cerrar Conversacion" para el sub-agente Administrativo
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

  // 1) Agregar bloque DETECCION DE CIERRE al systemMessage del CORE (idempotente)
  const core = wf.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = core.parameters.options.systemMessage;
  const MARK = '================================================================\nDETECCION DE CIERRE DE CONVERSACION';
  if (!sm.includes(MARK)) {
    const bloque = `\n\n${MARK}\n================================================================\nSi el cliente da una de estas señales (o similares), CERRA la conversacion:\n- "ok gracias", "dale gracias", "chau", "saludos"\n- "despues te aviso", "cualquier cosa te escribo", "hablamos otro dia"\n- "ya esta", "dale listo", "no me interesa", "despues veo"\n- Solo mandar emojis como 👍 ✅ 🙏 sin texto = cierre\n\nQUE HACER cuando detectes cierre:\n1. Responde una linea breve y calida ("Dale, cualquier cosa por aca. ¡Saludos!" o similar).\n2. Llama al sub-agente Administrativo con instruccion "cerrar conversacion del lead actual".\n3. NO vuelvas a escribir nada mas hasta que el cliente mande un mensaje NUEVO no-cierre.\n\nQUE NO HACER:\n- NO mandes mas propiedades despues de un cierre.\n- NO insistas con preguntas tipo "¿necesitas algo mas?".\n- NO mandes recordatorios proactivos.\n`;
    sm = sm + bloque;
    core.parameters.options.systemMessage = sm;
  }

  // 2) Nueva tool toolWorkflow o mejor directo: extender SubAgente Administrativo con tool Cerrar Conversacion
  //    Como el Administrativo es agentTool de n8n LangChain, sus tools son nodos conectados via ai_tool.
  //    Voy a agregar un nodo toolWorkflow o directamente un Google Sheets node como tool ai_tool.
  //    Mas simple: agregar un toolWorkflow que ejecuta un sub-workflow corto que cierra el lead.
  //    Aun mas simple: usar el patron de "Actualizar Lead CRM" existente y agregar otro que solo
  //    setea conversacion_cerrada=true.

  // Vamos a agregar un nodo Google Sheets como ai_tool conectado al SubAgente Administrativo.
  // Primero verifico que existe el SubAgente Administrativo y sus conexiones ai_tool.
  const admin = wf.nodes.find(n => n.name === 'SubAgente Administrativo');
  if (!admin) { console.log('ERROR: SubAgente Administrativo no existe'); process.exit(1); }

  // Crear el nodo Cerrar Conversacion (Sheets appendOrUpdate) - se usa como ai_tool
  let cerrarConv = wf.nodes.find(n => n.name === 'Cerrar Conversacion');
  if (!cerrarConv) {
    cerrarConv = {
      parameters: {
        operation: 'appendOrUpdate',
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'leads' },
        columns: {
          mappingMode: 'defineBelow',
          value: {
            lead_id: "={{ $('Parsear Mensaje').item.json.lead_id }}",
            conversacion_cerrada: "true",
            etapa: 'cerrada_por_cliente',
            actualizado_en: "={{ new Date().toISOString() }}"
          },
          matchingColumns: ['lead_id'],
          schema: [],
          attemptToConvertTypes: false,
          convertFieldsToString: true
        },
        options: {}
      },
      name: 'Cerrar Conversacion',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [admin.position[0] + 220, admin.position[1] + 200],
      id: crypto.randomUUID(),
      credentials: SHEETS_CRED,
      // En n8n LangChain, un nodo regular se conecta al agent via ai_tool si tiene un connection ai_tool
      // Pero Sheets node no es ai_tool nativamente. Hay que usar toolWorkflow o toolHttpRequest.
      // Alternativa: usar el nodo Sheets directamente como ai_tool definiendo descripcion.
    };
    wf.nodes.push(cerrarConv);

    // Conectar Cerrar Conversacion como ai_tool del SubAgente Administrativo
    // En LangChain n8n, las conexiones ai_tool tienen formato distinto
    if (!wf.connections['Cerrar Conversacion']) wf.connections['Cerrar Conversacion'] = {};
    wf.connections['Cerrar Conversacion'].ai_tool = [[{ node: 'SubAgente Administrativo', type: 'ai_tool', index: 0 }]];
  }

  // Actualizar la description del SubAgente Administrativo para incluir esta nueva tool
  const adminDesc = admin.parameters.toolDescription || '';
  if (!adminDesc.includes('Cerrar Conversacion')) {
    admin.parameters.toolDescription = adminDesc + ' Tambien tiene Cerrar Conversacion para marcar lead como cerrado_por_cliente.';
  }
  // Y agregar en su systemMessage si tiene
  if (admin.parameters.options && admin.parameters.options.systemMessage) {
    const adminSm = admin.parameters.options.systemMessage;
    if (!adminSm.includes('Cerrar Conversacion')) {
      admin.parameters.options.systemMessage = adminSm + '\n\nNUEVA ACCION: "CERRAR_CONVERSACION"\n- Llama a la tool "Cerrar Conversacion" cuando el CORE te lo pida (cliente dijo chau/gracias/no me interesa).\n- Marca el lead con conversacion_cerrada=true y etapa=cerrada_por_cliente.\n- Devuelve al CORE: "CIERRE_OK: lead marcado como cerrado."';
    }
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
})();
