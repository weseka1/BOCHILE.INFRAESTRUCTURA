// Re-fix Formatear Match CLIP: preserva los campos del Parser para que Merge Caminos
// reciba telefono, lead_id, etc.
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

const NEW_CODE = `// Recibe output de Buscar Por Imagen. Preserva campos del Parser para que
// Merge Caminos reciba telefono, lead_id, etc.
const inp = $input.first().json || {};
const items = Array.isArray(inp.items) ? inp.items : [];
const top = items[0] || null;

let visionDesc = "";
try { visionDesc = $("Imagen - Vision").first().json.content || $("Imagen - Vision").first().json.text || ""; } catch(e) {}

const parserData = $("Parsear Mensaje").first().json || {};
const caption = parserData.mensaje_original || "";

let clipBlock = "[SIN_MATCH_VISUAL] No hay similitud visual con catalogo. Pedi direccion.";
if (top) {
  const sc = Number(top.score || 0);
  if (sc >= 0.95) {
    clipBlock = "[CONFIRMADO_VISUAL] Esta foto corresponde a: " + top.title + " (" + top.url + "). Score CLIP=" + sc.toFixed(3) + ". Es segura, podes confirmar sin pedir direccion.";
  } else if (sc >= 0.88) {
    clipBlock = "[POSIBLE_MATCH] Top candidato: " + top.title + " (" + top.url + ") score=" + sc.toFixed(3) + ". Pedile al cliente que confirme la direccion antes de avanzar.";
  } else if (items.length > 0) {
    const tops = items.slice(0, 3).map(function(it, i) {
      return (i+1) + ") " + it.title + " score=" + Number(it.score || 0).toFixed(3);
    }).join(" | ");
    clipBlock = "[MATCH_DEBIL] Top 3 candidatos: " + tops + ". PEDI direccion al cliente.";
  }
}

const captionBlock = caption ? ("\\n\\n[CAPTION] " + caption) : "";
const mensaje = "[IMAGEN RECIBIDA - VISION] " + (visionDesc || "sin descripcion") + "\\n\\n" + clipBlock + captionBlock;

// PRESERVAR TODOS LOS CAMPOS DEL PARSER + agregar mensaje
return [{ json: Object.assign({}, parserData, { mensaje: mensaje }) }];`;

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  const fmt = wf.nodes.find(n => n.name === 'Formatear Match CLIP');
  if (!fmt) { console.log('ERROR: Formatear Match CLIP no existe'); process.exit(1); }
  fmt.parameters.jsCode = NEW_CODE;

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  // Verificar
  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  const fmt2 = wf2.nodes.find(n => n.name === 'Formatear Match CLIP');
  console.log('\n[verificacion] tiene Parsear Mensaje:', fmt2.parameters.jsCode.includes('Parsear Mensaje'));
  console.log('[verificacion] tiene Object.assign:', fmt2.parameters.jsCode.includes('Object.assign'));
  console.log('[verificacion] tiene Imagen - Vision:', fmt2.parameters.jsCode.includes('Imagen - Vision'));
})();
