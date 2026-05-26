// Mejora el contextoTemporal: calendario EXPLICITO con cada dia (fecha + dia semana + si es feriado)
// Asi Cami NO tiene que calcular dias de semana.
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
function req(m,p,body){return new Promise(r=>{const d=body?JSON.stringify(body):null;const h={'X-N8N-API-KEY':KEY};if(d){h['Content-Type']='application/json';h['Content-Length']=Buffer.byteLength(d);}let buf=[];const x=https.request({host:'weseka.onrender.com',port:443,path:p,method:m,headers:h,timeout:30000},rsp=>{rsp.on('data',c=>buf.push(c));rsp.on('end',()=>r({s:rsp.statusCode,b:Buffer.concat(buf).toString('utf8')}))});x.on('timeout',()=>{x.destroy();r({s:0,b:'TIMEOUT'})});x.on('error',e=>r({s:0,b:e.message}));if(d)x.write(d);x.end();});}

(async () => {
  const w1 = JSON.parse((await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp')).b);
  const f = w1.nodes.find(n => n.name === 'Formatear Equipo y Agenda');
  const oldCode = f.parameters.jsCode;

  // Reemplazar SOLO el bloque contextoTemporal por uno con calendario explicito.
  const NEW_CALENDAR_BLOCK = `// CONTEXTO TEMPORAL: calendario explicito 14 dias (Cami NO calcula, lee)
const _feriadosSet = new Set((function(){try{return $("Cargar Feriados").all().map(i=>String(i.json.fecha||'').trim())}catch(e){return []}})());
function _fmtFechaLargaCal(d) { return DIAS_NOMBRE[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }
let _calendario = '';
for (let i = 0; i < 14; i++) {
  const d = new Date(hoy); d.setDate(hoy.getDate() + i);
  const iso = fmtFecha(d);
  const labelHoy = (i === 0) ? ' <- HOY' : (i === 1 ? ' <- MANANA' : '');
  const esDomingo = d.getDay() === 0;
  const esSabado = d.getDay() === 6;
  const esFeriado = _feriadosSet.has(iso);
  const tags = [];
  if (esFeriado) tags.push('FERIADO');
  if (esDomingo) tags.push('domingo - NO laboral');
  if (esSabado) tags.push('sabado - parcial');
  const tagStr = tags.length ? ' [' + tags.join(' | ') + ']' : '';
  _calendario += '  ' + iso + ' (' + _fmtFechaLargaCal(d) + ')' + labelHoy + tagStr + '\\n';
}

const contextoTemporal = "" +
  "HOY: " + fmtFechaLarga(hoy) + " | ISO: " + fmtFecha(hoy) + "\\n" +
  "Hora actual Bahia Blanca: " + fmtHora(hoy) + " (GMT-3)\\n\\n" +
  "CALENDARIO PROXIMOS 14 DIAS (consulta esto SIEMPRE antes de proponer fechas):\\n" +
  _calendario + "\\n" +
  "REGLAS CRITICAS:\\n" +
  "- JAMAS uses fechas antes de " + fmtFecha(hoy) + ".\\n" +
  "- JAMAS mas alla de 30 dias.\\n" +
  "- JAMAS propongas dia DOMINGO (no laboral).\\n" +
  "- JAMAS propongas un dia marcado FERIADO.\\n" +
  "- Antes de decir 'el lunes 24', VERIFICA en el calendario de arriba que efectivamente sea lunes.\\n" +
  "- Si el cliente dice 'el lunes que viene', mira el calendario y usa la fecha exacta del proximo lunes habil.";`;

  // Reemplazar el contextoTemporal viejo
  const startIdx = oldCode.indexOf('// CONTEXTO TEMPORAL');
  const endIdx = oldCode.indexOf('// Cargar data');
  if (startIdx < 0 || endIdx < 0) {
    console.error('No encontre marcadores en el codigo');
    process.exit(1);
  }
  const newCode = oldCode.slice(0, startIdx) + NEW_CALENDAR_BLOCK + '\n\n' + oldCode.slice(endIdx);
  f.parameters.jsCode = newCode;
  console.log('Formatear Equipo y Agenda actualizado |', newCode.length, 'chars');
  console.log('Nuevo bloque calendario: 14 dias explicitos con feriados marcados');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w1.settings) for (const k of A) if (w1.settings[k] !== undefined) s[k] = w1.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w1.name, nodes: w1.nodes, connections: w1.connections, settings: s });
  await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('PUT:', upd.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
