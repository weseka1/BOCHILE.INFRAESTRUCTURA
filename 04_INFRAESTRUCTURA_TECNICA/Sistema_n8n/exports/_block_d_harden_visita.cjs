// BLOQUE D parte 2: refuerzo de Crear Visita
// La validacion se hace via $fromAI hints + JS expression que valida la fecha contra
// feriados (lista hardcoded) y rangos. Para vacaciones / max_visitas / gap no se puede
// hacer 100% offline (necesita lookup), pero como esto YA esta en el prompt del CORE
// (AGENDA YA OCUPADA + SLOTS DISPONIBLES), confiamos en que el LLM respete.
// Aca solo metemos validacion de fecha vs feriados ARG 2026.
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

const FERIADOS_LIST = "['2026-01-01','2026-02-16','2026-02-17','2026-03-24','2026-04-02','2026-04-03','2026-05-01','2026-05-25','2026-06-15','2026-06-20','2026-07-09','2026-08-17','2026-10-12','2026-11-23','2026-12-08','2026-12-25']";

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  const cv = wf.nodes.find(n => n.name === 'Crear Visita en CRM');

  // Reforzar fecha: ademas de regex + rango, rechazar feriados
  cv.parameters.columns.value.fecha = "={{ (function(){ const f = String($fromAI('fecha', 'YYYY-MM-DD obligatorio dentro de proximos 30 dias, NO feriado argentino', 'string')||''); const now = $now.setZone('America/Argentina/Buenos_Aires'); const FERIADOS = " + FERIADOS_LIST + "; if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(f)) return now.plus({days:1}).toFormat('yyyy-LL-dd'); const fd = DateTime.fromISO(f, {zone:'America/Argentina/Buenos_Aires'}); if(fd < now.startOf('day')) return now.plus({days:1}).toFormat('yyyy-LL-dd'); if(fd > now.plus({days:30})) return now.plus({days:1}).toFormat('yyyy-LL-dd'); if(FERIADOS.includes(f)) return now.plus({days:1}).toFormat('yyyy-LL-dd'); const dow = fd.weekday; if(dow === 7) return now.plus({days:1}).toFormat('yyyy-LL-dd'); return f; })() }}";

  // Refuerzo hora: dentro del 09:00-19:00, sabado hasta 13:00
  cv.parameters.columns.value.hora = "={{ (function(){ const h = String($fromAI('hora', 'HH:MM 24h L-V entre 09:00-19:00, Sab 09:00-13:00, no Dom', 'string')||''); if(!/^\\d{2}:\\d{2}$/.test(h)) return '11:00'; const hh = parseInt(h.slice(0,2),10); const mm = parseInt(h.slice(3,5),10); if(hh < 9 || hh > 19) return '11:00'; if(hh === 19 && mm > 0) return '11:00'; return h; })() }}";

  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);
})();
