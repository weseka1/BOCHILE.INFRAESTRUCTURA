/**
 * BOCHILE DASHBOARD MAESTRO · Apps Script bootstrap
 *
 * Crea las 17 hojas del workbook con headers, formato visual marca Bochile,
 * formulas analiticas y datos de ejemplo.
 *
 * USO:
 * 1. En el Spreadsheet, ir a Extensions -> Apps Script.
 * 2. Pegar este archivo entero (reemplazar Code.gs).
 * 3. Click en "Save" (Ctrl+S).
 * 4. Click en "Run" -> seleccionar funcion "setupBochileDashboard".
 * 5. Aprobar permisos cuando lo pida (es tu propia cuenta).
 * 6. Esperar 30 segundos. Listo.
 *
 * Idempotente: se puede correr varias veces sin romper nada (resetea las hojas).
 */

const BRAND = {
  bg: '#1A1A1A',
  bgSoft: '#222222',
  silver: '#C8C8C8',
  silverBright: '#EAEAEA',
  silverDeep: '#9A9A9A',
  white: '#F5F5F5',
  green: '#7DA984',
  red: '#C28078',
  blue: '#8AA8C0',
  border: '#3A3A3A'
};

const BASE_SHEETS = {
  leads: ['lead_id','nombre','telefono','email','canal','operacion','tipo_propiedad','zona_pref','ambientes','presupuesto_min','presupuesto_max','moneda','forma_pago','urgencia','score','etapa','vendedor_asignado','ultima_intencion','notas','creado_en','actualizado_en'],
  propiedades: ['prop_id','titulo','operacion','tipo','direccion','zona','ambientes','banos','superficie_cubierta','superficie_total','precio','moneda','expensas','estado','caracteristicas','tour_360_url','foto_principal','propietario','propietario_telefono','vendedor_a_cargo','publicada','fecha_alta'],
  visitas: ['visita_id','lead_id','prop_id','vendedor_id','vendedor_nombre','cliente_nombre','direccion','fecha','hora','estado','confirmada_cliente','notificada_vendedor','recordatorio_enviado','resultado','observaciones','creada_en'],
  contratos: ['contrato_id','prop_id','direccion','inquilino_nombre','inquilino_telefono','propietario','monto_actual','moneda','dia_vencimiento','frecuencia_ajuste','indice_ajuste','fecha_inicio','fecha_fin','estado','ultimo_pago','dias_atraso'],
  empleados: ['empleado_id','nombre','rol','telefono','email','zona_especialidad','calendar_id','activo','visitas_mes','cierres_mes','comisiones_mes'],
  matches_pendientes: ['match_id','lead_id','lead_nombre','lead_telefono','operacion','tipo','zona','ambientes_min','presupuesto_min','presupuesto_max','moneda','caracteristicas_must','activo','creado_en'],
  conversaciones: ['msg_id','lead_id','telefono','canal','direccion','mensaje','intencion_detectada','agente_que_respondio','requiere_humano','timestamp'],
  acciones_ia: ['accion_id','tipo','agente','lead_id','resumen','detalle','resultado','tiempo_ahorrado_min','timestamp']
};

const SEED_DATA = {
  empleados: [
    ['E-1','Carlos Bochile','vendedor','5492914401120','carlos@bochile.com.ar','Palihue,Villa Belgrano,Country','',true,18,3,22400000],
    ['E-2','Julieta Mendez','vendedor','5492914402230','julieta@bochile.com.ar','Centro,Universitario','',true,14,3,15800000],
    ['E-3','Valentin Soto','vendedor','5492914403341','valentin@bochile.com.ar','Villa Mitre,Villa Don Bosco,Patagonia','',true,11,2,10500000],
    ['E-4','Maria Lopez','admin','5492914404452','maria@bochile.com.ar','','',true,0,0,0]
  ],
  propiedades: [
    ['P-001','Departamento 2 amb a estrenar con balcon','venta','departamento','O\'Higgins 234 7B','Centro',2,1,52,52,142000,'USD',18000,'publicada','balcon,sum,cochera,a_estrenar','https://bochile.com.ar/tour/P-001','','Familia Ortiz','5492914512200','E-2',true,'2026-03-15'],
    ['P-002','Casa 4 ambientes con quincho y jardin','venta','casa','Brown 1842','Palihue',4,3,240,450,285000,'USD',0,'publicada','pileta,quincho,jardin,cochera,suite','https://bochile.com.ar/tour/P-002','','Familia Schiavi','5492914523310','E-1',true,'2026-02-10'],
    ['P-003','Monoambiente moderno en torre nueva','alquiler','departamento','Alem 1456 4D','Universitario',1,1,38,38,680000,'ARS',42000,'publicada','amoblado,gimnasio,seguridad','https://bochile.com.ar/tour/P-003','','Pablo Iribarne','5492914534421','E-2',true,'2026-04-01'],
    ['P-004','PH 3 ambientes con patio propio','venta','ph','Sarmiento 542','Villa Mitre',3,1,78,120,98000,'USD',0,'publicada','patio,reciclado,sin_expensas','https://bochile.com.ar/tour/P-004','','Marcos Pellegrini','5492914545532','E-3',true,'2026-01-22'],
    ['P-005','Casa de diseno con pileta y parque','venta','casa','Ruta 33 km 7 Country','Villa Belgrano',5,4,320,900,320000,'USD',85000,'publicada','pileta,parque,country,seguridad_24h,diseno','https://bochile.com.ar/tour/P-005','','Familia Cabrera','5492914556643','E-1',true,'2026-02-28'],
    ['P-006','Lote 12x30 apto duplex en zona consolidada','venta','lote','Castelli 3210','Patagonia',0,0,0,360,42000,'USD',0,'publicada','esquina,fot_1.2,servicios','https://bochile.com.ar/tour/P-006','','Roberto Genovese','5492914567754','E-3',true,'2026-03-05']
  ],
  contratos: [
    ['C-001','P-001','O\'Higgins 234 7B','Romina Calandri','+5492914421180','Familia Ortiz',680000,'ARS',5,'cuatrimestral','IPC','2024-05-01','2026-05-01','activo','2026-04-05',0],
    ['C-002','P-003','Alem 1456 4D','Florencia Bertola','+5492914462210','Pablo Iribarne',580000,'ARS',1,'cuatrimestral','IPC','2024-08-01','2026-08-01','activo','2026-04-01',3],
    ['C-003','P-008','Donado 1245','Gaston Iribarne','+5492914517822','Diego Albarracin',920000,'ARS',10,'trimestral','ICL','2025-06-10','2026-06-10','activo','2026-04-10',0],
    ['C-004','P-004','Sarmiento 542','Mariano Pellegrini','+5492914552209','Familia Schiavi',740000,'ARS',3,'cuatrimestral','IPC','2024-09-03','2026-09-03','activo','2026-04-03',0]
  ],
  leads: [
    ['L-2914423398','Lucas Fernandez','+5492914423398','','whatsapp','venta','casa','Palihue',4,250000,300000,'USD','mixto','alta',88,'Visita agendada','E-1','Quiere casa familiar Palihue','Pareja con 2 hijos. Vende dpto Centro. Cash + credito.','2026-04-28T10:42:00Z','2026-04-30T15:30:00Z'],
    ['L-2914456712','Marcos Genovese','+5492914456712','marcos@gmail.com','referido','venta','casa','Villa Belgrano',5,280000,360000,'USD','cash','alta',88,'Nuevo','','Country Belgrano','Referido por Familia Cabrera. Paga cash.','2026-04-30T09:15:00Z','2026-04-30T09:15:00Z'],
    ['L-2914467823','Veronica Rial','+5492914467823','','zonaprop','venta','departamento','Universitario',2,120000,140000,'USD','mixto','media',82,'Calificado IA','E-2','Dpto 2 amb cerca UNS','Cash parcial + credito. Decision en 30 dias.','2026-04-29T14:00:00Z','2026-04-30T11:00:00Z'],
    ['L-2914478934','Pablo Schiavi','+5492914478934','','web','venta','casa','Palihue',4,300000,380000,'USD','vende_otra','alta',91,'Calificado IA','E-1','Casa familiar Palihue','Vende su departamento. Familia 4 personas.','2026-04-28T16:20:00Z','2026-04-29T09:30:00Z'],
    ['L-2914490156','Sofia Martinez','+5492914490156','','web','alquiler','departamento','Centro',2,500000,700000,'ARS','credito','baja',42,'En espera de stock','','Alquiler dpto 2 amb','Sin urgencia. Esta mirando.','2026-04-30T11:15:00Z','2026-04-30T11:20:00Z'],
    ['L-2914501267','Andrea Coria','+5492914501267','','zonaprop','venta','departamento','Centro',2,140000,170000,'USD','credito','media',73,'Visita agendada','E-2','Visita O\'Higgins manana 10h','Visita 1 mayo 10:00','2026-04-29T10:00:00Z','2026-04-30T17:00:00Z'],
    ['L-2914512378','Familia Beltran','+5492914512378','','whatsapp','venta','casa','Palihue',4,260000,320000,'USD','mixto','alta',85,'Visita agendada','E-1','2da visita Brown 1842 hoy 16:30','Ya visitaron una vez. Cerrando.','2026-04-25T14:00:00Z','2026-04-30T13:00:00Z'],
    ['L-2914523489','Pareja Ortiz','+5492914523489','','meta_ads','venta','casa','Palihue',4,250000,300000,'USD','mixto','alta',87,'Negociación','E-1','Contraoferta 270k','Hicieron oferta. Esperando respuesta del vendedor.','2026-04-20T09:00:00Z','2026-04-30T16:30:00Z']
  ],
  visitas: [
    ['V-001','L-2914512378','P-002','E-1','Carlos Bochile','Familia Beltran','Brown 1842, Palihue','2026-05-12','16:30','agendada',true,true,false,'','Segunda visita. Estan muy interesados.','2026-04-30T11:00:00Z'],
    ['V-002','L-2914501267','P-001','E-2','Julieta Mendez','Andrea Coria','O\'Higgins 234 7B, Centro','2026-05-13','10:00','agendada',true,true,false,'','Primera visita.','2026-04-30T15:00:00Z'],
    ['V-003','L-2914423398','P-002','E-1','Carlos Bochile','Lucas Fernandez','Brown 1842, Palihue','2026-05-14','10:30','agendada',true,true,false,'','Pareja con 2 chicos. Vende dpto Centro.','2026-04-30T17:00:00Z']
  ],
  matches_pendientes: [
    ['MP-001','L-2914490156','Sofia Martinez','+5492914490156','alquiler','departamento','Centro',2,500000,700000,'ARS','amoblado',true,'2026-04-30T11:20:00Z'],
    ['MP-002','L-2914456712','Marcos Genovese','+5492914456712','venta','casa','Villa Belgrano',5,280000,360000,'USD','pileta,parque,seguridad_24h',true,'2026-04-30T09:30:00Z']
  ],
  acciones_ia: [
    ['A-001','conversacion_atendida','Vendedor CORE','L-2914423398','Atendio consulta inicial','Lead Lucas consulta casa Palihue. Score 88.','ok',4,'2026-04-30T10:42:30Z'],
    ['A-002','lead_calificado','SubAgente Calificador','L-2914423398','Score 88 caliente','Pareja 2 hijos. Presupuesto USD 250-300k. Pago mixto.','ok',3,'2026-04-30T10:44:30Z'],
    ['A-003','visita_agendada','SubAgente Admin','L-2914423398','Visita sabado 10:30','Brown 1842 con Carlos. Vendedor notificado.','ok',8,'2026-04-30T10:47:00Z'],
    ['A-004','cobranza_alquiler','Cron Cobranza','','Cobro Romina Calandri','$680000 ARS via Mercado Pago. Recibo enviado.','enviado',5,'2026-04-30T09:12:00Z'],
    ['A-005','match_pendiente_guardado','SubAgente Admin','L-2914490156','Match pendiente Sofia','Alquiler dpto Centro 2 amb amoblado ARS 500-700k. Sin stock.','ok',5,'2026-04-30T11:22:00Z'],
    ['A-006','recordatorio_visita','Cron Recordatorios','L-2914512378','Recordatorio 24h','Familia Beltran visita hoy 16:30 Brown 1842.','enviado',3,'2026-05-11T16:30:00Z']
  ]
};

function setupBochileDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4');

  Logger.log('1/4 Creando hojas base...');
  for (const name of Object.keys(BASE_SHEETS)) {
    createOrResetBaseSheet(ss, name, BASE_SHEETS[name], SEED_DATA[name] || []);
  }

  Logger.log('2/4 Creando hojas analiticas...');
  buildDashboard(ss);
  buildAgendaHoy(ss);
  buildPipelineCRM(ss);
  buildEmbudo(ss);
  buildRankingVendedores(ss);
  buildDemandaBarrio(ss);
  buildAlquileresEstado(ss);
  buildFeedIA(ss);
  buildConfig(ss);

  Logger.log('3/4 Limpiando hoja default...');
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1');
  if (def) ss.deleteSheet(def);

  Logger.log('4/4 Reordenando pestanas...');
  reorderTabs(ss, [
    'DASHBOARD','AGENDA_HOY','PIPELINE_CRM','EMBUDO_CONVERSION',
    'RANKING_VENDEDORES','DEMANDA_X_BARRIO','ALQUILERES_ESTADO','FEED_IA',
    'leads','propiedades','visitas','contratos','empleados',
    'matches_pendientes','conversaciones','acciones_ia','CONFIG'
  ]);

  ss.setActiveSheet(ss.getSheetByName('DASHBOARD'));
  SpreadsheetApp.flush();
  Logger.log('OK. Workbook listo.');
}

function createOrResetBaseSheet(ss, name, headers, seedRows) {
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  s.clear();
  s.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(s, headers.length);
  s.setFrozenRows(1);
  if (seedRows && seedRows.length > 0) {
    s.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
  }
  s.autoResizeColumns(1, Math.min(headers.length, 10));
  return s;
}

function styleHeader(sheet, ncols) {
  const r = sheet.getRange(1, 1, 1, ncols);
  r.setBackground(BRAND.bg);
  r.setFontColor(BRAND.silverBright);
  r.setFontWeight('bold');
  r.setFontFamily('Inter');
  r.setHorizontalAlignment('left');
  r.setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);
}

function buildDashboard(ss) {
  const name = 'DASHBOARD';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.setHiddenGridlines(true);

  s.getRange('A1').setValue('BOCHILE · DASHBOARD OPERATIVO').setFontFamily('Cormorant Garamond').setFontSize(28).setFontColor(BRAND.silverBright).setFontWeight('bold');
  s.getRange('A2').setFormula('="Actualizado: "&TEXT(NOW(),"dddd d \'de\' mmmm · HH:mm")').setFontColor(BRAND.silverDeep).setFontSize(10);

  const kpis = [
    ['Leads esta semana', '=COUNTIFS(leads!T:T,">="&(TODAY()-7))'],
    ['Leads totales', '=COUNTA(leads!A2:A)'],
    ['Visitas agendadas', '=COUNTIF(visitas!J:J,"agendada")'],
    ['Visitas hoy', '=COUNTIFS(visitas!H:H,TEXT(TODAY(),"yyyy-mm-dd"),visitas!J:J,"agendada")'],
    ['Conversion lead -> visita', '=IFERROR(COUNTA(visitas!A2:A)/COUNTA(leads!A2:A),0)'],
    ['Comisiones del mes', '=SUM(empleados!K2:K)'],
    ['Cierres del mes', '=SUM(empleados!J2:J)'],
    ['Contratos activos', '=COUNTIF(contratos!N:N,"activo")'],
    ['Cobranza atrasada', '=COUNTIF(contratos!P:P,">0")'],
    ['Matches en espera', '=COUNTIF(matches_pendientes!M:M,TRUE)'],
    ['Acciones IA hoy', '=COUNTIFS(acciones_ia!I:I,">="&TEXT(TODAY(),"yyyy-mm-dd"))'],
    ['Horas ahorradas (mes)', '=ROUND(SUMIFS(acciones_ia!H:H,acciones_ia!I:I,">="&EOMONTH(TODAY(),-1)+1)/60,1)']
  ];

  const startRow = 4;
  for (let i = 0; i < kpis.length; i++) {
    const row = startRow + Math.floor(i/3)*3;
    const col = 1 + (i % 3)*2;
    s.getRange(row, col).setValue(kpis[i][0]).setFontColor(BRAND.silverDeep).setFontSize(10).setFontWeight('bold').setFontFamily('Inter');
    const c = s.getRange(row+1, col).setFormula(kpis[i][1]);
    c.setFontFamily('Cormorant Garamond').setFontSize(28).setFontColor(BRAND.silverBright).setFontWeight('bold');
    s.getRange(row, col, 2, 2).setBackground(BRAND.bgSoft).setBorder(true, true, true, true, false, false, BRAND.border, SpreadsheetApp.BorderStyle.SOLID);
  }
  if (kpis[4]) s.getRange(startRow+1+Math.floor(4/3)*3 - 1, 1 + (4%3)*2).setNumberFormat('0%');

  const linksRow = startRow + Math.ceil(kpis.length/3)*3 + 2;
  s.getRange(linksRow, 1).setValue('ACCESOS RAPIDOS').setFontColor(BRAND.silverDeep).setFontSize(11).setFontWeight('bold').setFontFamily('Inter');
  const accesos = [
    ['▸ Agenda de hoy y mañana', 'AGENDA_HOY'],
    ['▸ Pipeline del CRM', 'PIPELINE_CRM'],
    ['▸ Embudo de conversión', 'EMBUDO_CONVERSION'],
    ['▸ Ranking vendedores', 'RANKING_VENDEDORES'],
    ['▸ Demanda por barrio', 'DEMANDA_X_BARRIO'],
    ['▸ Alquileres · cobranza', 'ALQUILERES_ESTADO'],
    ['▸ Feed de la IA (acciones)', 'FEED_IA']
  ];
  for (let i = 0; i < accesos.length; i++) {
    const sheet = ss.getSheetByName(accesos[i][1]);
    const url = sheet ? '#gid=' + sheet.getSheetId() : '';
    const cell = s.getRange(linksRow + 1 + i, 1);
    cell.setFormula('=HYPERLINK("' + url + '","' + accesos[i][0] + '")');
    cell.setFontColor(BRAND.silverBright).setFontSize(13).setFontFamily('Inter');
  }

  s.setColumnWidth(1, 220); s.setColumnWidth(2, 180); s.setColumnWidth(3, 220); s.setColumnWidth(4, 180); s.setColumnWidth(5, 220); s.setColumnWidth(6, 180);
  s.hideRow(s.getRange('A:A'));
  s.showRows(1, s.getMaxRows());
}

function buildAgendaHoy(ss) {
  const name = 'AGENDA_HOY';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setFormula('="Visitas para hoy ("&TEXT(TODAY(),"dddd d \'de\' mmmm")&") y mañana"').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');
  s.getRange('A3').setFormula('=IFERROR(QUERY(visitas!A:O,"select B,F,E,G,H,I,J,M where H >= date \'"&TEXT(TODAY(),"yyyy-mm-dd")&"\' and H <= date \'"&TEXT(TODAY()+1,"yyyy-mm-dd")&"\' order by H asc, I asc label B \'Lead ID\', F \'Cliente\', E \'Vendedor\', G \'Direccion\', H \'Fecha\', I \'Hora\', J \'Estado\', M \'Observaciones\'",1),"Sin visitas agendadas hoy y mañana.")');
  styleHeaderRow(s, 3, 8);
  s.setFrozenRows(3);
  s.setColumnWidth(1, 110); s.setColumnWidth(2, 180); s.setColumnWidth(3, 140); s.setColumnWidth(4, 240); s.setColumnWidth(5, 100); s.setColumnWidth(6, 80); s.setColumnWidth(7, 120); s.setColumnWidth(8, 280);
}

function buildPipelineCRM(ss) {
  const name = 'PIPELINE_CRM';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('PIPELINE CRM · Kanban').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');

  const etapas = ['Nuevo','Calificado IA','Visita agendada','Negociación','Cierre','Post-venta'];
  for (let i = 0; i < etapas.length; i++) {
    const col = i + 1;
    const cell = s.getRange(3, col);
    cell.setValue(etapas[i]).setBackground(BRAND.bg).setFontColor(BRAND.silverBright).setFontWeight('bold').setFontFamily('Inter').setHorizontalAlignment('center');
    s.setColumnWidth(col, 220);
    s.getRange(4, col).setFormula('=IFERROR(QUERY(leads!A:V,"select B, O, C where P = \'' + etapas[i] + '\' order by O desc",0),"")');
  }

  const range = s.getRange(4, 1, 100, 6);
  const rules = s.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(71).setBackground('#1F2D22').setFontColor(BRAND.green).setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(41,70).setBackground('#2A2A1F').setFontColor(BRAND.silverBright).setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThanOrEqualTo(40).setBackground('#2D1F1F').setFontColor(BRAND.red).setRanges([range]).build());
  s.setConditionalFormatRules(rules);

  s.setFrozenRows(3);
}

function buildEmbudo(ss) {
  const name = 'EMBUDO_CONVERSION';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('EMBUDO DE CONVERSION · Ultimos 30 dias').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');

  const rows = [
    ['Leads totales','=COUNTA(leads!A2:A)'],
    ['Calificados (score >= 41)','=COUNTIF(leads!O:O,">=41")'],
    ['Visitas agendadas','=COUNTA(visitas!A2:A)'],
    ['Negociaciones abiertas','=COUNTIF(leads!P:P,"Negociación")'],
    ['Cierres del mes','=COUNTIFS(leads!P:P,"Cierre",leads!U:U,">="&EOMONTH(TODAY(),-1)+1)']
  ];

  s.getRange(3, 1, 1, 3).setValues([['Etapa','Cantidad','Tasa vs anterior']]);
  styleHeaderRow(s, 3, 3);
  for (let i = 0; i < rows.length; i++) {
    s.getRange(4 + i, 1).setValue(rows[i][0]).setFontFamily('Inter').setFontSize(12);
    s.getRange(4 + i, 2).setFormula(rows[i][1]).setFontFamily('Cormorant Garamond').setFontSize(20).setFontColor(BRAND.silverBright).setFontWeight('bold');
    if (i > 0) {
      s.getRange(4 + i, 3).setFormula('=IFERROR(B' + (4+i) + '/B' + (3+i) + ',0)').setNumberFormat('0%').setFontFamily('Inter').setFontColor(BRAND.silverBright);
    }
  }
  s.setColumnWidth(1, 280); s.setColumnWidth(2, 140); s.setColumnWidth(3, 180);
  s.setFrozenRows(3);
}

function buildRankingVendedores(ss) {
  const name = 'RANKING_VENDEDORES';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('RANKING VENDEDORES · Mes actual').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');
  s.getRange('A3').setFormula('=QUERY(empleados!A:K,"select B, J, K, I where C = \'vendedor\' and H = TRUE order by K desc label B \'Vendedor\', J \'Cierres\', K \'Comisiones\', I \'Visitas\'",1)');
  styleHeaderRow(s, 3, 4);
  s.setColumnWidth(1, 220); s.setColumnWidth(2, 120); s.setColumnWidth(3, 180); s.setColumnWidth(4, 120);
  s.setFrozenRows(3);
}

function buildDemandaBarrio(ss) {
  const name = 'DEMANDA_X_BARRIO';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('DEMANDA POR BARRIO · Heatmap').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');
  s.getRange('A3').setFormula('=QUERY(leads!A:V,"select H, count(A) where H is not null group by H order by count(A) desc label H \'Barrio\', count(A) \'Consultas\'",1)');
  styleHeaderRow(s, 3, 2);
  s.setColumnWidth(1, 220); s.setColumnWidth(2, 160);
  s.setFrozenRows(3);

  const range = s.getRange(4, 2, 50, 1);
  const rules = s.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule().setGradientMaxpointWithValue('#EAEAEA', SpreadsheetApp.InterpolationType.NUMBER, '50').setGradientMidpointWithValue('#9A9A9A', SpreadsheetApp.InterpolationType.NUMBER, '20').setGradientMinpointWithValue('#3A3A3A', SpreadsheetApp.InterpolationType.NUMBER, '1').setRanges([range]).build());
  s.setConditionalFormatRules(rules);
}

function buildAlquileresEstado(ss) {
  const name = 'ALQUILERES_ESTADO';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('ALQUILERES · Estado actual').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');

  const stats = [
    ['Contratos activos','=COUNTIF(contratos!N:N,"activo")'],
    ['Atrasados','=COUNTIF(contratos!P:P,">0")'],
    ['Morosos','=COUNTIF(contratos!N:N,"moroso")']
  ];
  for (let i = 0; i < stats.length; i++) {
    s.getRange(3, 1 + i*2).setValue(stats[i][0]).setFontColor(BRAND.silverDeep).setFontWeight('bold').setFontSize(10);
    s.getRange(4, 1 + i*2).setFormula(stats[i][1]).setFontFamily('Cormorant Garamond').setFontSize(24).setFontColor(BRAND.silverBright).setFontWeight('bold');
  }

  s.getRange('A7').setFormula('=QUERY(contratos!A:P,"select B,D,F,G,H,I,P,N order by P desc, I asc label B \'ID\', D \'Direccion\', F \'Inquilino\', G \'Monto\', H \'Moneda\', I \'Dia venc\', P \'Atraso\', N \'Estado\'",1)');
  styleHeaderRow(s, 7, 8);
  s.setFrozenRows(7);

  const range = s.getRange(8, 7, 200, 1);
  const rules = s.getConditionalFormatRules();
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(1,2).setBackground('#2A2A1F').setFontColor(BRAND.silverBright).setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(3).setBackground('#2D1F1F').setFontColor(BRAND.red).setRanges([range]).build());
  s.setConditionalFormatRules(rules);
}

function buildFeedIA(ss) {
  const name = 'FEED_IA';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('FEED IA · Ultimas 100 acciones').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');
  s.getRange('A3').setFormula('=QUERY(acciones_ia!A:I,"select I, C, B, F, G, H order by I desc limit 100 label I \'Cuando\', C \'Agente\', B \'Tipo\', F \'Resumen\', G \'Resultado\', H \'Min ahorrados\'",1)');
  styleHeaderRow(s, 3, 6);
  s.setColumnWidth(1, 180); s.setColumnWidth(2, 180); s.setColumnWidth(3, 180); s.setColumnWidth(4, 360); s.setColumnWidth(5, 120); s.setColumnWidth(6, 130);
  s.setFrozenRows(3);
}

function buildConfig(ss) {
  const name = 'CONFIG';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear();
  s.getRange('A1').setValue('CONFIGURACION · Parametros editables').setFontFamily('Cormorant Garamond').setFontSize(22).setFontColor(BRAND.silverBright).setFontWeight('bold');

  const headers = ['Zonas','Etapas CRM','Tipos propiedad','Operaciones'];
  s.getRange(3, 1, 1, 4).setValues([headers]); styleHeaderRow(s, 3, 4);
  const datos = [
    ['Palihue','Nuevo','casa','venta'],
    ['Centro','Calificado IA','departamento','alquiler'],
    ['Universitario','Visita agendada','ph','alquiler_temporario'],
    ['Villa Mitre','Negociación','lote',''],
    ['Villa Belgrano','Cierre','local',''],
    ['Patagonia','Post-venta','oficina',''],
    ['Tiro Federal','En espera de stock','',''],
    ['Villa Don Bosco','Descartado','',''],
    ['Almafuerte','','','']
  ];
  s.getRange(4, 1, datos.length, 4).setValues(datos);

  s.getRange('F3').setValue('Parametros operativos').setFontWeight('bold').setFontColor(BRAND.silverBright);
  const params = [
    ['Tour base URL','https://bochile.com.ar/tour/'],
    ['Pago base URL','https://bochile.com.ar/pagar/'],
    ['Telefono Carlos','5492914401120'],
    ['Horas humanas mes (base)',200],
    ['Score umbral visita',70],
    ['Score umbral curioso',40]
  ];
  s.getRange(4, 6, params.length, 2).setValues(params);
}

function styleHeaderRow(sheet, row, ncols) {
  const r = sheet.getRange(row, 1, 1, ncols);
  r.setBackground(BRAND.bg).setFontColor(BRAND.silverBright).setFontWeight('bold').setFontFamily('Inter');
  sheet.setRowHeight(row, 28);
}

function reorderTabs(ss, ordered) {
  for (let i = 0; i < ordered.length; i++) {
    const s = ss.getSheetByName(ordered[i]);
    if (s) ss.setActiveSheet(s), ss.moveActiveSheet(i + 1);
  }
}
