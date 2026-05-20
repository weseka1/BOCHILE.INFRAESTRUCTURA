// Make Cargar Historial tolerant: si falla, no rompe el flow.
// Tambien refactorizo a operation 'readAllItems' que es mas confiable.
const http = require('node:http');
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
  const ch = wf.nodes.find(n => n.name === 'Cargar Historial Conversaciones');

  // Use readAllItems + filter on telefono. Mas robusto que lookup con filtersUI.
  ch.parameters = {
    operation: 'read',
    documentId: { __rl: true, mode: 'id', value: '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4' },
    sheetName: { __rl: true, mode: 'name', value: 'conversaciones' },
    options: {}
  };
  // Continue On Fail - critico para que el flow no rompa
  ch.onError = 'continueRegularOutput';

  // Formatear Historial: filtrar manualmente por telefono y soportar 0 rows / errores
  const fh = wf.nodes.find(n => n.name === 'Formatear Historial');
  fh.parameters.jsCode = [
    '// Filtra conversaciones de este cliente y formatea historial.',
    '// Es tolerante: si no hay datos, devuelve placeholder limpio.',
    'let telefono = "";',
    'try { telefono = String($("Merge Caminos").first().json.telefono || ""); } catch(e) {}',
    '',
    'let allRows = [];',
    'try { allRows = $input.all().map(i => i.json); } catch(e) {}',
    '',
    'const rows = allRows.filter(r => String(r.telefono || "") === telefono);',
    '',
    'if (rows.length === 0) {',
    '  return [{ json: { historial: "(sin historial previo, este es el primer contacto)" } }];',
    '}',
    '',
    'rows.sort((a,b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));',
    'const recientes = rows.slice(-20);',
    '',
    'const lineas = recientes.map(f => {',
    '  const who = String(f.direccion || "in") === "in" ? "Cliente" : "Cami";',
    '  const msg = String(f.mensaje || "").replace(/\\n/g, " ").slice(0, 300);',
    '  const ts = String(f.timestamp || "").slice(0, 19).replace("T", " ");',
    '  return "[" + ts + "] " + who + ": " + msg;',
    '});',
    '',
    'return [{ json: { historial: lineas.join("\\n") } }];'
  ].join('\n');

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
