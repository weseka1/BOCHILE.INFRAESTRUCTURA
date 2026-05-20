// Inyecta al CORE contexto completo cada turno:
//   - Fecha/hora ARG actual (ya estaba, reforzado)
//   - Vendedores activos + zonas + telefono
//   - Visitas agendadas proximos 7 dias (para no entrepisar)
// Pipeline nuevo: Formatear Historial -> Cargar Empleados -> Cargar Visitas Proximas -> Formatear Equipo y Agenda -> Vendedor CORE
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

  const formatearHist = wf.nodes.find(n => n.name === 'Formatear Historial');
  const core = wf.nodes.find(n => n.name === 'Vendedor CORE');

  // Crear nodos si no existen
  if (!wf.nodes.find(n => n.name === 'Cargar Empleados Activos')) {
    wf.nodes.push({
      parameters: {
        operation: 'read',
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'empleados' },
        options: {}
      },
      name: 'Cargar Empleados Activos',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [formatearHist.position[0] + 220, formatearHist.position[1]],
      id: crypto.randomUUID(),
      credentials: SHEETS_CRED,
      onError: 'continueRegularOutput'
    });
  }

  if (!wf.nodes.find(n => n.name === 'Cargar Visitas Proximas')) {
    wf.nodes.push({
      parameters: {
        operation: 'read',
        documentId: { __rl: true, mode: 'id', value: SHEET_ID },
        sheetName: { __rl: true, mode: 'name', value: 'visitas' },
        options: {}
      },
      name: 'Cargar Visitas Proximas',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [formatearHist.position[0] + 440, formatearHist.position[1]],
      id: crypto.randomUUID(),
      credentials: SHEETS_CRED,
      onError: 'continueRegularOutput'
    });
  }

  if (!wf.nodes.find(n => n.name === 'Formatear Equipo y Agenda')) {
    wf.nodes.push({
      parameters: {
        jsCode: [
          '// Formatea bloque de equipo + agenda para inyectar al systemMessage del CORE.',
          'let empleadosRows = [];',
          'let visitasRows = [];',
          'try { empleadosRows = $("Cargar Empleados Activos").all().map(i => i.json); } catch(e) {}',
          'try { visitasRows = $("Cargar Visitas Proximas").all().map(i => i.json); } catch(e) {}',
          '',
          '// EQUIPO',
          'const activos = empleadosRows.filter(e => String(e.activo).toLowerCase() === "true" || e.activo === true);',
          'let equipoBlock = "(sin vendedores activos cargados)";',
          'if (activos.length > 0) {',
          '  equipoBlock = activos.map(e => {',
          '    return "  - " + (e.nombre || "?") + " (id=" + (e.empleado_id || "?") + ", tel=" + (e.telefono || "?") + ", zonas=" + (e.zona_especialidad || "todas") + ")";',
          '  }).join("\\n");',
          '}',
          '',
          '// AGENDA (proximos 7 dias)',
          'const ahora = new Date();',
          'const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);',
          'function parseFecha(f) {',
          '  if (!f) return null;',
          '  // Si es numero (Sheets serial date) convertir',
          '  if (typeof f === "number" || /^\\d+(\\.\\d+)?$/.test(String(f))) {',
          '    const days = Number(f);',
          '    if (days < 1000) return null;',
          '    return new Date((days - 25569) * 86400 * 1000);',
          '  }',
          '  const d = new Date(String(f));',
          '  return isNaN(d.getTime()) ? null : d;',
          '}',
          'const proximas = visitasRows.filter(v => {',
          '  const fd = parseFecha(v.fecha);',
          '  if (!fd) return false;',
          '  return fd >= new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()) && fd <= en7Dias && String(v.estado || "").toLowerCase() !== "cancelada";',
          '});',
          'let agendaBlock = "(sin visitas agendadas en los proximos 7 dias)";',
          'if (proximas.length > 0) {',
          '  proximas.sort((a,b) => {',
          '    const da = parseFecha(a.fecha) || new Date(0);',
          '    const db = parseFecha(b.fecha) || new Date(0);',
          '    return da - db;',
          '  });',
          '  agendaBlock = proximas.map(v => {',
          '    const fd = parseFecha(v.fecha);',
          '    const fStr = fd ? fd.toISOString().slice(0,10) : String(v.fecha);',
          '    return "  - " + fStr + " " + (v.hora || "?") + " | " + (v.vendedor_nombre || "?") + " visita a " + (v.cliente_nombre || "?") + " en " + (v.direccion || "?");',
          '  }).join("\\n");',
          '}',
          '',
          'const equipoYAgenda = "## EQUIPO ACTIVO\\n" + equipoBlock + "\\n\\n## AGENDA PROXIMOS 7 DIAS (no proponer slots que choquen)\\n" + agendaBlock;',
          '',
          '// Propagar campos del item original (telefono, etc)',
          'const base = $input.first().json || {};',
          'return [{ json: Object.assign({}, base, { equipoYAgenda: equipoYAgenda }) }];'
        ].join('\n')
      },
      name: 'Formatear Equipo y Agenda',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [formatearHist.position[0] + 660, formatearHist.position[1]],
      id: crypto.randomUUID()
    });
  }

  // Reconectar pipeline
  wf.connections['Formatear Historial'] = {
    main: [[{ node: 'Cargar Empleados Activos', type: 'main', index: 0 }]]
  };
  wf.connections['Cargar Empleados Activos'] = {
    main: [[{ node: 'Cargar Visitas Proximas', type: 'main', index: 0 }]]
  };
  wf.connections['Cargar Visitas Proximas'] = {
    main: [[{ node: 'Formatear Equipo y Agenda', type: 'main', index: 0 }]]
  };
  wf.connections['Formatear Equipo y Agenda'] = {
    main: [[{ node: 'Vendedor CORE', type: 'main', index: 0 }]]
  };

  // Inyectar al systemMessage del CORE
  const MARK_EQUIPO = '================================================================\nEQUIPO Y AGENDA EN VIVO (lectura del CRM cada turno)\n================================================================';
  let sm = core.parameters.options.systemMessage;

  if (!sm.includes(MARK_EQUIPO)) {
    const bloqueEquipo = `\n\n${MARK_EQUIPO}\n{{ $('Formatear Equipo y Agenda').item.json.equipoYAgenda }}\n\nREGLAS DE AGENDAMIENTO:\n- JAMAS propongas un dia/hora donde un vendedor ya tenga visita (mira la AGENDA arriba).\n- Respeta MINIMO 1 hora entre visitas del mismo vendedor (traslado).\n- Asigna el vendedor cuya zona_especialidad coincida con la zona de la propiedad. Si no coincide ninguno, elegi al mas libre.\n- Horario laboral: Lunes a Viernes 09:00-19:00, Sabado 09:00-13:00, Domingo cerrado.\n- TODA fecha que propongas o confirmes DEBE ser >= HOY (mira CONTEXTO TEMPORAL arriba) y <= 30 dias.\n- Argentina, Bahia Blanca (GMT-3). Si el cliente dice "manana", "el sabado", "la semana que viene", calcula desde HOY siempre.\n`;
    sm = sm + bloqueEquipo;
    core.parameters.options.systemMessage = sm;
  }

  // Refrescar CONTEXTO TEMPORAL (reescribir para asegurar formato correcto)
  const MARK_TEMP = '================================================================\nCONTEXTO TEMPORAL (HOY)';
  const idxTemp = sm.indexOf(MARK_TEMP);
  if (idxTemp >= 0) {
    // remover bloque viejo
    const idxNext = sm.indexOf('================================================================', idxTemp + MARK_TEMP.length);
    sm = sm.slice(0, idxTemp) + (idxNext >= 0 ? sm.slice(idxNext) : '');
  }
  // re-inyectar fresh
  const bloqueTemp = `${MARK_TEMP}\n================================================================\nHOY es: {{ DateTime.now().setZone('America/Argentina/Buenos_Aires').toFormat('yyyy-LL-dd, cccc') }} (ARG, Bahia Blanca, GMT-3)\nHora actual: {{ DateTime.now().setZone('America/Argentina/Buenos_Aires').toFormat('HH:mm') }} ARG\nManana es: {{ DateTime.now().setZone('America/Argentina/Buenos_Aires').plus({days:1}).toFormat('yyyy-LL-dd, cccc') }}\n\nREGLA ABSOLUTA SOBRE FECHAS:\n- JAMAS inventes fechas. Toda fecha debe partir de HOY arriba.\n- "Este sabado" / "el lunes" / "manana" calculalo desde HOY arriba.\n- NUNCA uses fechas del pasado. NUNCA uses fechas a mas de 30 dias.\n- Formato siempre YYYY-MM-DD cuando pasas al Administrativo.\n\n`;
  // re-insertar despues del primer "================" o al final
  if (!sm.includes(MARK_TEMP)) {
    sm = sm + '\n\n' + bloqueTemp;
  }
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

  const r2 = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf2 = JSON.parse(r2.body);
  console.log('Nodos creados:');
  console.log('  Cargar Empleados Activos:', !!wf2.nodes.find(n => n.name === 'Cargar Empleados Activos'));
  console.log('  Cargar Visitas Proximas:', !!wf2.nodes.find(n => n.name === 'Cargar Visitas Proximas'));
  console.log('  Formatear Equipo y Agenda:', !!wf2.nodes.find(n => n.name === 'Formatear Equipo y Agenda'));
  const c2 = wf2.nodes.find(n => n.name === 'Vendedor CORE');
  console.log('  systemMessage tiene EQUIPO Y AGENDA:', c2.parameters.options.systemMessage.includes('EQUIPO Y AGENDA EN VIVO'));
  console.log('  systemMessage tiene CONTEXTO TEMPORAL:', c2.parameters.options.systemMessage.includes('CONTEXTO TEMPORAL'));
})();
