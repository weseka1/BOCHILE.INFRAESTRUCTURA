// BLOQUE D: Calendario laboral real
// 1. Insertar nodo "Cargar Feriados" en el pipeline antes de Formatear Equipo y Agenda
// 2. Reescribir Formatear Equipo y Agenda con logica avanzada
// 3. Reforzar Crear Visita: validar contra feriados, vacaciones, max_visitas, gap 60min
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

const NEW_FORMATEAR_CODE = `// Calendario laboral REAL: feriados + vacaciones + horarios custom + capacity
const TZ = 'America/Argentina/Buenos_Aires';
const DIAS_MAP = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };
const DIAS_NOMBRE = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const nowARG = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
function fmtFecha(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function fmtFechaLarga(d) { return DIAS_NOMBRE[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
function fmtHora(d) { return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }

const hoy = nowARG;
const en7 = new Date(hoy); en7.setDate(hoy.getDate()+7);

// CONTEXTO TEMPORAL (igual que antes)
function proximoDia(diaSemana) {
  const d = new Date(hoy);
  const diff = (diaSemana - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
const contextoTemporal = "" +
  "HOY es: " + fmtFechaLarga(hoy) + " | ISO: " + fmtFecha(hoy) + "\\n" +
  "Hora actual Bahia Blanca: " + fmtHora(hoy) + " (Argentina, GMT-3)\\n" +
  "MANANA: " + fmtFechaLarga(proximoDia((hoy.getDay()+1)%7)) + "\\n" +
  "Lunes proximo: " + fmtFecha(proximoDia(1)) + " | Martes: " + fmtFecha(proximoDia(2)) +
  " | Miercoles: " + fmtFecha(proximoDia(3)) + " | Jueves: " + fmtFecha(proximoDia(4)) +
  " | Viernes: " + fmtFecha(proximoDia(5)) + " | Sabado: " + fmtFecha(proximoDia(6)) + "\\n\\n" +
  "REGLA: JAMAS uses fechas antes de " + fmtFecha(hoy) + ". JAMAS mas alla de 30 dias.";

// Cargar data
let empleados = [];
let visitas = [];
let feriados = [];
try { empleados = $("Cargar Empleados Activos").all().map(i => i.json); } catch(e) {}
try { visitas = $("Cargar Visitas Proximas").all().map(i => i.json); } catch(e) {}
try { feriados = $("Cargar Feriados").all().map(i => i.json); } catch(e) {}

const feriadosSet = new Set(feriados.map(f => String(f.fecha || '').trim()));

// Filtrar empleados activos no en vacaciones HOY
const activos = empleados.filter(e => {
  const isActivo = String(e.activo).toLowerCase() === 'true' || e.activo === true;
  if (!isActivo) return false;
  return true;
});

// Para cada activo, marcar si esta en vacaciones HOY
function enVacacionesEn(emp, fecha) {
  const vd = emp.vacacion_desde;
  const vh = emp.vacacion_hasta;
  if (!vd || !vh) return false;
  const f = fecha;
  return f >= String(vd).trim() && f <= String(vh).trim();
}

// Bloque EQUIPO con status
let equipoBlock;
if (activos.length === 0) {
  equipoBlock = '(sin vendedores activos)';
} else {
  equipoBlock = activos.map(e => {
    const enVac = enVacacionesEn(e, fmtFecha(hoy));
    const status = enVac ? ' [EN VACACIONES hasta ' + e.vacacion_hasta + ']' : '';
    return '  - ' + (e.nombre || '?') + ' (id=' + (e.empleado_id || '?') + ', tel=' + (e.telefono || '?') + ', zonas=' + (e.zona_especialidad || 'todas') + ', horario=' + (e.horario_inicio || '09:00') + '-' + (e.horario_fin || '19:00') + ')' + status;
  }).join('\\n');
}

// Visitas proximas 7 dias para calcular ocupacion
function parseFecha(f) {
  if (!f) return null;
  if (typeof f === 'number' || /^\\d+(\\.\\d+)?$/.test(String(f))) {
    const days = Number(f);
    if (days < 1000) return null;
    return new Date((days - 25569) * 86400 * 1000);
  }
  const d = new Date(String(f));
  return isNaN(d.getTime()) ? null : d;
}
const proximas = visitas.filter(v => {
  const fd = parseFecha(v.fecha);
  if (!fd) return false;
  return fd >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) && fd <= en7 && String(v.estado || '').toLowerCase() !== 'cancelada';
});

// AGENDA OCUPADA por vendedor
const ocupadasPorVendedor = {};
for (const v of proximas) {
  const vid = v.vendedor_id || v.vendedor_nombre || '?';
  if (!ocupadasPorVendedor[vid]) ocupadasPorVendedor[vid] = [];
  const fd = parseFecha(v.fecha);
  ocupadasPorVendedor[vid].push({ fecha: fmtFecha(fd), hora: v.hora || '?', cliente: v.cliente_nombre || '?', direccion: v.direccion || '?' });
}

let agendaOcupadaBlock = '(sin visitas agendadas)';
if (proximas.length > 0) {
  proximas.sort((a,b) => {
    const da = parseFecha(a.fecha) || new Date(0);
    const db = parseFecha(b.fecha) || new Date(0);
    return da - db;
  });
  agendaOcupadaBlock = proximas.map(v => {
    const fd = parseFecha(v.fecha);
    return '  - ' + fmtFecha(fd) + ' ' + (v.hora || '?') + ' | ' + (v.vendedor_nombre || '?') + ' visita a ' + (v.cliente_nombre || '?') + ' en ' + (v.direccion || '?');
  }).join('\\n');
}

// SLOTS DISPONIBLES por vendedor proximos 7 dias
// Genera horarios cada 1.5h dentro del horario laboral, excluye feriados, dias no laborales, vacaciones, y slots ocupados
function generarSlots(emp, fechaStr, fechaDate, ocupados) {
  const horaIni = String(emp.horario_inicio || '09:00');
  const horaFin = String(emp.horario_fin || '19:00');
  const [hi, mi] = horaIni.split(':').map(Number);
  const [hf, mf] = horaFin.split(':').map(Number);
  const slots = [];
  let h = hi, m = mi;
  while (h < hf || (h === hf && m === 0)) {
    if (h >= hi && (h < hf || (h === hf && m === 0))) {
      const slotHora = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
      const ocupadoEnEsteSlot = ocupados.some(o => o.fecha === fechaStr && o.hora === slotHora);
      if (!ocupadoEnEsteSlot) slots.push(slotHora);
    }
    m += 90;
    while (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

let disponibilidadBlock = '';
for (const emp of activos) {
  if (enVacacionesEn(emp, fmtFecha(hoy))) {
    disponibilidadBlock += '\\n' + (emp.nombre || '?') + ': EN VACACIONES hasta ' + emp.vacacion_hasta + ' (no agendar)';
    continue;
  }
  const diasLaborales = String(emp.dias_laborales || 'L,M,X,J,V,S').split(',').map(d => d.trim());
  const maxPorDia = parseInt(emp.max_visitas_dia || '4', 10);
  const empOcupados = ocupadasPorVendedor[emp.empleado_id] || [];

  const slotsPorDia = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(hoy); d.setDate(hoy.getDate() + i);
    const fechaStr = fmtFecha(d);
    if (feriadosSet.has(fechaStr)) continue;
    const diaCorto = DIAS_MAP[d.getDay()];
    if (!diasLaborales.includes(diaCorto)) continue;
    if (enVacacionesEn(emp, fechaStr)) continue;
    const ocupadosEnDia = empOcupados.filter(o => o.fecha === fechaStr).length;
    if (ocupadosEnDia >= maxPorDia) continue;
    const slots = generarSlots(emp, fechaStr, d, empOcupados).slice(0, maxPorDia - ocupadosEnDia);
    if (slots.length > 0) {
      slotsPorDia.push(fechaStr + ' (' + DIAS_NOMBRE[d.getDay()] + '): ' + slots.join(', '));
    }
  }
  if (slotsPorDia.length === 0) {
    disponibilidadBlock += '\\n' + (emp.nombre || '?') + ' (' + (emp.zona_especialidad || 'todas') + '): SIN SLOTS DISPONIBLES en los proximos 7 dias';
  } else {
    disponibilidadBlock += '\\n' + (emp.nombre || '?') + ' (' + (emp.zona_especialidad || 'todas') + '):\\n  ' + slotsPorDia.join('\\n  ');
  }
}

// FERIADOS proximos
const feriadosProx = feriados.filter(f => {
  const fd = String(f.fecha || '').trim();
  return fd >= fmtFecha(hoy) && fd <= fmtFecha(en7);
});
const feriadosBlock = feriadosProx.length === 0
  ? '(ningun feriado en los proximos 7 dias)'
  : feriadosProx.map(f => '  - ' + f.fecha + ' ' + (f.nombre || '')).join('\\n');

const equipoYAgenda = '## EQUIPO ACTIVO\\n' + equipoBlock +
  '\\n\\n## FERIADOS PROXIMOS 7 DIAS (no agendar)\\n' + feriadosBlock +
  '\\n\\n## AGENDA YA OCUPADA (no proponer estos slots)\\n' + agendaOcupadaBlock +
  '\\n\\n## SLOTS DISPONIBLES PROXIMOS 7 DIAS POR VENDEDOR\\n' + disponibilidadBlock +
  '\\n\\n## REGLAS\\n' +
  '- JAMAS propongas un slot que NO este en SLOTS DISPONIBLES arriba.\\n' +
  '- Si el cliente pide algo fuera de la lista, decile que no hay disponibilidad y ofrecele alternativas reales.\\n' +
  '- Asigna el vendedor segun zona de la propiedad (si zona coincide con zona_especialidad).';

const base = $input.first().json || {};
return [{ json: Object.assign({}, base, { contextoTemporal, equipoYAgenda }) }];`;

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);

  const cargarVisitas = wf.nodes.find(n => n.name === 'Cargar Visitas Proximas');
  const formatear = wf.nodes.find(n => n.name === 'Formatear Equipo y Agenda');

  // 1) Crear Cargar Feriados si no existe
  let cargarFeriados = wf.nodes.find(n => n.name === 'Cargar Feriados');
  if (!cargarFeriados) {
    cargarFeriados = {
      parameters: {
        operation: 'read',
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'feriados_args' },
        options: {}
      },
      name: 'Cargar Feriados',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [cargarVisitas.position[0] + 220, cargarVisitas.position[1]],
      id: crypto.randomUUID(),
      credentials: SHEETS_CRED,
      alwaysOutputData: true,
      onError: 'continueRegularOutput'
    };
    wf.nodes.push(cargarFeriados);
  }

  // 2) Reconectar Cargar Visitas Proximas -> Cargar Feriados -> Formatear Equipo y Agenda
  wf.connections['Cargar Visitas Proximas'] = { main: [[{ node: 'Cargar Feriados', type: 'main', index: 0 }]] };
  wf.connections['Cargar Feriados'] = { main: [[{ node: 'Formatear Equipo y Agenda', type: 'main', index: 0 }]] };

  // 3) Reescribir el codigo de Formatear Equipo y Agenda
  formatear.parameters.jsCode = NEW_FORMATEAR_CODE;

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
