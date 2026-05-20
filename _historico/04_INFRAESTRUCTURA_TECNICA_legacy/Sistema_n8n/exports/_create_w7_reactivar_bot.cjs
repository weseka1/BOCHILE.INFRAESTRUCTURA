// W7: Reactivar Bot Pausado
// Cron cada hora: lee leads con bot_pausado_hasta < ahora y limpia el campo.
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
  const wf = {
    name: 'W7 - Reactivar Bot Pausado',
    nodes: [
      {
        parameters: {
          rule: { interval: [{ field: 'hours' }] }
        },
        name: 'Cron cada hora',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [240, 300],
        id: crypto.randomUUID()
      },
      {
        parameters: {
          operation: 'read',
          documentId: { __rl: true, mode: 'id', value: SHEET_ID },
          sheetName: { __rl: true, mode: 'name', value: 'leads' },
          options: {}
        },
        name: 'Leer Leads',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4,
        position: [460, 300],
        id: crypto.randomUUID(),
        credentials: SHEETS_CRED,
        alwaysOutputData: true
      },
      {
        parameters: {
          jsCode: [
            '// Filtra leads con bot_pausado_hasta < ahora y devuelve uno por uno para update',
            'const rows = $input.all().map(i => i.json);',
            'const ahora = new Date();',
            'const expirados = rows.filter(r => {',
            '  const t = r.bot_pausado_hasta;',
            '  if (!t) return false;',
            '  const d = new Date(t);',
            '  return !isNaN(d.getTime()) && d <= ahora;',
            '});',
            'console.log("[w7] expirados:", expirados.length);',
            'return expirados.map(r => ({ json: { lead_id: r.lead_id, telefono: r.telefono } }));'
          ].join('\n')
        },
        name: 'Filtrar Expirados',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [680, 300],
        id: crypto.randomUUID(),
        alwaysOutputData: true
      },
      {
        parameters: {
          operation: 'appendOrUpdate',
          documentId: { __rl: true, mode: 'id', value: SHEET_ID },
          sheetName: { __rl: true, mode: 'name', value: 'leads' },
          columns: {
            mappingMode: 'defineBelow',
            value: {
              lead_id: '={{ $json.lead_id }}',
              bot_pausado_hasta: '',
              actualizado_en: '={{ new Date().toISOString() }}'
            },
            matchingColumns: ['lead_id'],
            schema: [],
            attemptToConvertTypes: false,
            convertFieldsToString: true
          },
          options: {}
        },
        name: 'Limpiar Pausa',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4,
        position: [900, 300],
        id: crypto.randomUUID(),
        credentials: SHEETS_CRED
      }
    ],
    connections: {
      'Cron cada hora': { main: [[{ node: 'Leer Leads', type: 'main', index: 0 }]] },
      'Leer Leads': { main: [[{ node: 'Filtrar Expirados', type: 'main', index: 0 }]] },
      'Filtrar Expirados': { main: [[{ node: 'Limpiar Pausa', type: 'main', index: 0 }]] }
    },
    settings: { executionOrder: 'v1' }
  };

  const cr = await req('POST', '/api/v1/workflows', wf);
  console.log('Create W7:', cr.status);
  if (cr.status !== 200 && cr.status !== 201) { console.log('Body:', cr.body.slice(0,800)); process.exit(1); }
  const created = JSON.parse(cr.body);
  console.log('W7 ID:', created.id);

  const act = await req('POST', '/api/v1/workflows/' + created.id + '/activate');
  console.log('Activate:', act.status);
})();
