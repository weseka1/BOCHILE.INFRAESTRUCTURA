// Fix 3-en-1:
//   1) Crear Visita: regex de fecha bien escrita (\\d en vez de d), valida pasado + 30d max
//   2) systemMessage CORE: inyectar fecha actual ARG + regla NO inventar fechas
//   3) systemMessage CORE: regla MODO CIERRE preguntar antes de proponer
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

  // ============================
  // 1) Crear Visita - regex con \\d, validar futuro entre hoy+1 y hoy+30
  // ============================
  const cv = wf.nodes.find(n => n.name === 'Crear Visita en CRM');
  cv.parameters.columns.value.fecha = "={{ (function(){ const f = String($fromAI('fecha', 'YYYY-MM-DD obligatorio dentro de los proximos 30 dias', 'string')||''); const now = $now.setZone('America/Argentina/Buenos_Aires'); if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(f)) return now.plus({days:1}).toFormat('yyyy-LL-dd'); const fd = DateTime.fromISO(f, {zone:'America/Argentina/Buenos_Aires'}); if(fd < now.startOf('day')) return now.plus({days:1}).toFormat('yyyy-LL-dd'); if(fd > now.plus({days:30})) return now.plus({days:1}).toFormat('yyyy-LL-dd'); return f; })() }}";
  cv.parameters.columns.value.hora = "={{ (function(){ const h = String($fromAI('hora', 'HH:MM 24h obligatorio entre 09:00 y 19:00', 'string')||''); if(!/^\\d{2}:\\d{2}$/.test(h)) return '11:00'; const hh = parseInt(h.slice(0,2),10); if(hh < 9 || hh > 19) return '11:00'; return h; })() }}";

  // ============================
  // 2 + 3) CORE systemMessage: inyectar fecha actual + regla cierre
  // ============================
  const core = wf.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = core.parameters.options.systemMessage;

  const MARK_FECHA = '================================================================\nCONTEXTO TEMPORAL (HOY)\n================================================================';
  const BLOQUE_FECHA = `\n\n${MARK_FECHA}\nHOY es: {{ DateTime.now().setZone('America/Argentina/Buenos_Aires').toFormat('yyyy-LL-dd, cccc') }} (ARG)\nHora actual: {{ DateTime.now().setZone('America/Argentina/Buenos_Aires').toFormat('HH:mm') }} ARG\n\nREGLA ABSOLUTA SOBRE FECHAS:\n- JAMAS inventes fechas. Toda fecha debe partir de HOY arriba.\n- Si el cliente dice "este sabado", calcula cual es el proximo sabado partiendo de HOY.\n- Si el cliente dice "manana" o "el lunes", calcula la fecha real.\n- NUNCA uses fechas del pasado. NUNCA uses fechas a mas de 30 dias.\n- Formato siempre YYYY-MM-DD al pasar al sub-agente Administrativo.\n`;

  const MARK_CIERRE = '================================================================\nMODO CIERRE - REGLAS ACTUALIZADAS (CRITICO)\n================================================================';
  const BLOQUE_CIERRE = `\n\n${MARK_CIERRE}\nCuando el lead muestra interes concreto en una propiedad (te dice "me gusta", "quiero verla", "me interesa"), NO PROPONGAS dia ni hora vos.\n\nPATRON OBLIGATORIO:\n1. PRIMERO preguntale: "Buenisimo, me alegra. ¿Que dia y en que horario te quedaria comodo verla?"\n2. ESPERA su respuesta concreta ("el sabado al mediodia", "manana a las 6", etc.)\n3. CALCULA la fecha real basandote en HOY (mira el bloque CONTEXTO TEMPORAL arriba).\n4. Confirma con el cliente: "Perfecto, te agendo para el [fecha real] a las [hora]. ¿Va?"\n5. SOLO cuando el cliente confirma, llama al sub-agente Administrativo con la fecha YA acordada.\n\nPROHIBIDO:\n- Decir "te paso a verla este sabado a las 11" sin que el cliente te haya dicho cuando le queda comodo.\n- Inventar nombre de vendedora antes de que el Administrativo te lo asigne.\n- Usar fechas del pasado o de hace meses.\n`;

  if (!sm.includes(MARK_FECHA)) sm = sm + BLOQUE_FECHA;
  if (!sm.includes(MARK_CIERRE)) sm = sm + BLOQUE_CIERRE;
  core.parameters.options.systemMessage = sm;

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
  const cv2 = wf2.nodes.find(n => n.name === 'Crear Visita en CRM');
  const core2 = wf2.nodes.find(n => n.name === 'Vendedor CORE');
  console.log('\n[verificacion]');
  console.log('  fecha tiene \\\\d:', cv2.parameters.columns.value.fecha.includes('\\\\d'));
  console.log('  fecha tiene max 30d:', cv2.parameters.columns.value.fecha.includes('plus({days:30})'));
  console.log('  systemMessage tiene CONTEXTO TEMPORAL:', core2.parameters.options.systemMessage.includes('CONTEXTO TEMPORAL'));
  console.log('  systemMessage tiene MODO CIERRE - REGLAS:', core2.parameters.options.systemMessage.includes('MODO CIERRE - REGLAS'));
})();
