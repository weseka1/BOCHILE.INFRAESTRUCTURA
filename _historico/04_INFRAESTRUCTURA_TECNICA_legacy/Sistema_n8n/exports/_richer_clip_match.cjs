// Mejora Formatear Match CLIP:
//   - Bajar thresholds (0.85 confirma, 0.70 posible) — mas tolerante
//   - Incluir TODOS los detalles de la propiedad para que Cami charle al detalle
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

const NEW_CODE = `// Formatea match CLIP con detalles RICOS para que Cami pueda charlar al detalle.
// Thresholds bajos: 0.85 confirma, 0.70 posible.
const inp = $input.first().json || {};
const items = Array.isArray(inp.items) ? inp.items : [];
const top = items[0] || null;

let visionDesc = "";
try { visionDesc = $("Imagen - Vision").first().json.content || $("Imagen - Vision").first().json.text || ""; } catch(e) {}

const parserData = $("Parsear Mensaje").first().json || {};
const caption = parserData.mensaje_original || "";

function detallesProp(p) {
  if (!p) return "";
  const parts = [];
  if (p.title) parts.push("Titulo: " + p.title);
  if (p.address || p.barrio || p.zona) parts.push("Ubicacion: " + [p.address, p.barrio, p.zona].filter(Boolean).join(", "));
  if (p.operation) parts.push("Operacion: " + (p.operation === "sale" ? "venta" : p.operation === "rent" ? "alquiler" : p.operation));
  if (p.property_type) parts.push("Tipo: " + p.property_type);
  if (p.bedrooms !== null && p.bedrooms !== undefined) parts.push("Ambientes: " + p.bedrooms);
  if (p.bathrooms !== null && p.bathrooms !== undefined) parts.push("Banos: " + p.bathrooms);
  if (p.area_m2) parts.push("Superficie: " + p.area_m2 + " m2");
  if (p.price) parts.push("Precio: " + p.price + " " + (p.price_currency || ""));
  else if (p.price_text) parts.push("Precio: " + p.price_text);
  if (p.features && p.features.length) parts.push("Caracteristicas: " + p.features.join(", "));
  if (p.url) parts.push("URL: " + p.url);
  return parts.join(" | ");
}

let clipBlock = "[SIN_MATCH_VISUAL] No hay similitud visual clara con propiedades del catalogo. Pedi al cliente que confirme la direccion o ID de la propiedad.";

if (top) {
  const sc = Number(top.score || 0);
  if (sc >= 0.85) {
    clipBlock = "[CONFIRMADO_VISUAL] score=" + sc.toFixed(3) + "\\n" +
      "Identifique con alta confianza esta propiedad:\\n" + detallesProp(top) + "\\n\\n" +
      "INSTRUCCION: Habla de ESTA propiedad con confianza. NO le pidas la direccion al cliente. Usa todos los detalles de arriba (ambientes, m2, precio, ubicacion, caracteristicas) para charlar a fondo y ofrecer agendar visita.";
  } else if (sc >= 0.70) {
    let alts = items.slice(1, 3).map((p, i) => "  " + (i+2) + ") " + (p.title || "?") + " score=" + Number(p.score || 0).toFixed(3) + " | " + (p.address || p.barrio || "?")).join("\\n");
    clipBlock = "[POSIBLE_MATCH] score=" + sc.toFixed(3) + "\\n" +
      "Candidato mas probable:\\n" + detallesProp(top) + "\\n" +
      (alts ? "Otras posibles:\\n" + alts + "\\n" : "") +
      "\\nINSTRUCCION: Mencionale al cliente que esta foto parece ser de [propiedad de arriba] y preguntale si es correcta. Si confirma, hablar a detalle con los datos. Si no, pedir direccion.";
  } else if (items.length > 0) {
    const tops = items.slice(0, 3).map((p, i) => (i+1) + ") " + (p.title || "?") + " score=" + Number(p.score || 0).toFixed(3) + " | " + (p.address || p.barrio || p.zona || "?")).join(" || ");
    clipBlock = "[MATCH_DEBIL] Ningun candidato con alta confianza. Top 3 mas parecidos:\\n" + tops + "\\n\\nINSTRUCCION: Pedile al cliente que confirme la direccion o el ID de la propiedad.";
  }
}

const captionBlock = caption ? ("\\n\\n[CAPTION DEL CLIENTE] " + caption) : "";
const mensaje = "[IMAGEN RECIBIDA]\\n[VISION DESC] " + (visionDesc || "sin descripcion") + "\\n\\n" + clipBlock + captionBlock;

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
})();
