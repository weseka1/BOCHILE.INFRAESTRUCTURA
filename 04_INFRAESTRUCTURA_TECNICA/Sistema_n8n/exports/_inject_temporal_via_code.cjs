// Fix DEFINITIVO contexto temporal: lo armamos en JS dentro del nodo Code
// "Formatear Equipo y Agenda" y lo referenciamos desde el systemMessage del CORE.
// Las refs a otros nodos SI se evaluan en el systemMessage del agent.
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

const NEW_FORMATEAR_CODE = `// Arma contexto temporal + equipo + agenda en JS puro (garantia de evaluacion).
const TZ = 'America/Argentina/Buenos_Aires';

// CONTEXTO TEMPORAL ARG
const nowARG = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
const diasSemana = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function fmtFecha(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fmtFechaLarga(d) {
  return diasSemana[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
}
function fmtHora(d) {
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

const hoy = nowARG;
const manana = new Date(hoy); manana.setDate(hoy.getDate()+1);
const en7 = new Date(hoy); en7.setDate(hoy.getDate()+7);

// Calcular proximos dias de la semana para que Cami pueda decir "este viernes" bien
function proximoDia(diaSemana /* 0=dom 6=sab */) {
  const d = new Date(hoy);
  const diff = (diaSemana - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
const proxLunes = proximoDia(1);
const proxMartes = proximoDia(2);
const proxMiercoles = proximoDia(3);
const proxJueves = proximoDia(4);
const proxViernes = proximoDia(5);
const proxSabado = proximoDia(6);

const contextoTemporal = "" +
  "HOY es: " + fmtFechaLarga(hoy) + " | formato ISO: " + fmtFecha(hoy) + "\\n" +
  "Hora actual en Bahia Blanca: " + fmtHora(hoy) + " (Argentina, GMT-3)\\n" +
  "MANANA: " + fmtFechaLarga(manana) + " | ISO: " + fmtFecha(manana) + "\\n\\n" +
  "Si el cliente dice 'el lunes' = " + fmtFecha(proxLunes) + "\\n" +
  "Si el cliente dice 'el martes' = " + fmtFecha(proxMartes) + "\\n" +
  "Si el cliente dice 'el miercoles' = " + fmtFecha(proxMiercoles) + "\\n" +
  "Si el cliente dice 'el jueves' = " + fmtFecha(proxJueves) + "\\n" +
  "Si el cliente dice 'el viernes' = " + fmtFecha(proxViernes) + "\\n" +
  "Si el cliente dice 'el sabado' = " + fmtFecha(proxSabado) + "\\n\\n" +
  "REGLAS DE FECHA (ABSOLUTAS):\\n" +
  "- JAMAS uses fechas anteriores a " + fmtFecha(hoy) + ".\\n" +
  "- JAMAS uses fechas posteriores a " + fmtFecha(en7) + " salvo casos excepcionales (max 30 dias).\\n" +
  "- Cuando confirmes una visita, mencionale al cliente la fecha completa (ej: '" + fmtFechaLarga(proxJueves) + "') para que no haya dudas.\\n" +
  "- Cuando pases la fecha al sub-agente Administrativo, usa SIEMPRE formato " + fmtFecha(hoy).split('-').slice(0,1).join('') + "-MM-DD.";

// EQUIPO
let empleadosRows = [];
let visitasRows = [];
try { empleadosRows = $("Cargar Empleados Activos").all().map(i => i.json); } catch(e) {}
try { visitasRows = $("Cargar Visitas Proximas").all().map(i => i.json); } catch(e) {}

const activos = empleadosRows.filter(e => String(e.activo).toLowerCase() === "true" || e.activo === true);
let equipoBlock = "(sin vendedores activos cargados)";
if (activos.length > 0) {
  equipoBlock = activos.map(e => {
    return "  - " + (e.nombre || "?") + " (id=" + (e.empleado_id || "?") + ", tel=" + (e.telefono || "?") + ", zonas=" + (e.zona_especialidad || "todas") + ")";
  }).join("\\n");
}

// AGENDA proximas
function parseFecha(f) {
  if (!f) return null;
  if (typeof f === "number" || /^\\d+(\\.\\d+)?$/.test(String(f))) {
    const days = Number(f);
    if (days < 1000) return null;
    return new Date((days - 25569) * 86400 * 1000);
  }
  const d = new Date(String(f));
  return isNaN(d.getTime()) ? null : d;
}
const proximas = visitasRows.filter(v => {
  const fd = parseFecha(v.fecha);
  if (!fd) return false;
  return fd >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) && fd <= en7 && String(v.estado || "").toLowerCase() !== "cancelada";
});
let agendaBlock = "(sin visitas agendadas en los proximos 7 dias)";
if (proximas.length > 0) {
  proximas.sort((a,b) => {
    const da = parseFecha(a.fecha) || new Date(0);
    const db = parseFecha(b.fecha) || new Date(0);
    return da - db;
  });
  agendaBlock = proximas.map(v => {
    const fd = parseFecha(v.fecha);
    const fStr = fd ? fmtFecha(fd) : String(v.fecha);
    return "  - " + fStr + " " + (v.hora || "?") + " | " + (v.vendedor_nombre || "?") + " visita a " + (v.cliente_nombre || "?") + " en " + (v.direccion || "?");
  }).join("\\n");
}

const equipoYAgenda = "## EQUIPO ACTIVO\\n" + equipoBlock + "\\n\\n## AGENDA PROXIMOS 7 DIAS (no proponer slots que choquen)\\n" + agendaBlock;

const base = $input.first().json || {};
return [{ json: Object.assign({}, base, { contextoTemporal: contextoTemporal, equipoYAgenda: equipoYAgenda }) }];`;

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);

  // 1) Actualizar Formatear Equipo y Agenda con el nuevo codigo
  const fmt = wf.nodes.find(n => n.name === 'Formatear Equipo y Agenda');
  if (!fmt) { console.log('ERROR: Formatear Equipo y Agenda no existe'); process.exit(1); }
  fmt.parameters.jsCode = NEW_FORMATEAR_CODE;

  // 2) Reemplazar el bloque CONTEXTO TEMPORAL del systemMessage del CORE
  //    por una referencia a {{ $('Formatear Equipo y Agenda').item.json.contextoTemporal }}
  const core = wf.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = core.parameters.options.systemMessage;

  // Quitar el bloque actual de CONTEXTO TEMPORAL si existe (entre marcadores ====)
  const startMark = '================================================================\\nCONTEXTO TEMPORAL';
  const idxStart = sm.indexOf('CONTEXTO TEMPORAL (HOY)');
  if (idxStart >= 0) {
    // Buscar el comienzo real del bloque (linea con ===)
    let realStart = sm.lastIndexOf('================================================================', idxStart);
    if (realStart === -1) realStart = idxStart;
    // Buscar el siguiente bloque con ===
    let realEnd = sm.indexOf('================================================================', idxStart + 100);
    if (realEnd === -1) realEnd = sm.length;
    sm = sm.slice(0, realStart) + sm.slice(realEnd);
  }
  // Limpiar tambien restos de "DateTime.now()" o "HOY es: {{" que hayan quedado
  // (idempotente)

  // Insertar nuevo bloque CONTEXTO TEMPORAL referenciando al Code node
  const bloqueNuevo = "================================================================\nCONTEXTO TEMPORAL (lectura JS, garantizado)\n================================================================\n{{ $('Formatear Equipo y Agenda').item.json.contextoTemporal }}\n\n";
  sm = bloqueNuevo + sm;

  core.parameters.options.systemMessage = sm;

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log(upd.body); process.exit(1); }
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  console.log('\\nContexto temporal generado dinamicamente desde JS (no depende de $now en el agent).');
})();
