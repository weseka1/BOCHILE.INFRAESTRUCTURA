/**
 * BOCHILE DASHBOARD MAESTRO · Apps Script v2 · Rediseno profesional
 *
 * Estetica inmobiliaria clasica: fondo blanco, navy corporativo, champagne como acento,
 * tipografia serif en titulos. Pensado para una inmobiliaria de 50+ anos de trayectoria.
 *
 * USO:
 * 1. Abrir https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4/edit
 * 2. Extensiones -> Apps Script.
 * 3. Borrar todo el codigo viejo. Pegar este archivo entero.
 * 4. Ctrl+S. Ejecutar -> setupBochileDashboard.
 * 5. Aprobar permisos. Esperar 30-40 segundos.
 *
 * Idempotente: se puede correr varias veces.
 */

const BRAND = {
  navy:        '#0F2A4A',   // Navy corporativo Bochile
  navyDark:    '#091C33',   // Hover/borders
  champagne:   '#B08D57',   // Oro champagne (acento, no abusar)
  champagneLt: '#E8DCC4',   // Fondos suaves de acento
  white:       '#FFFFFF',
  paper:       '#FAFAF7',   // Fondo papel premium
  ink:         '#1A1A1A',   // Texto principal
  inkSoft:     '#4A4A4A',   // Texto secundario
  inkLight:    '#8A8A8A',   // Texto deshabilitado
  line:        '#D7D2C4',   // Lineas/separadores
  lineSoft:    '#EFECE3',
  green:       '#1F6B3A',   // Positivo (serio, no verde flashy)
  greenSoft:   '#E6F0E8',
  red:         '#9B2C2C',   // Negativo (rojo borgoña)
  redSoft:     '#F4E3E3',
  amber:       '#8A5A0E',   // Warning (mostaza)
  amberSoft:   '#F4ECD4'
};

const FONT_TITLE = 'Playfair Display';
const FONT_BODY  = 'Roboto';

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
    ['E-1','Carlos Bochile','vendedor','5492914401120','carlos@bochile.com.ar','Palihue, Villa Belgrano, Country','',true,18,3,22400000],
    ['E-2','Julieta Mendez','vendedor','5492914402230','julieta@bochile.com.ar','Centro, Universitario','',true,14,3,15800000],
    ['E-3','Valentin Soto','vendedor','5492914403341','valentin@bochile.com.ar','Villa Mitre, Villa Don Bosco, Patagonia','',true,11,2,10500000],
    ['E-4','Maria Lopez','admin','5492914404452','maria@bochile.com.ar','','',true,0,0,0]
  ],
  propiedades: [
    ['P-001','Departamento 2 ambientes a estrenar con balcon','venta','departamento','O\'Higgins 234 7B','Centro',2,1,52,52,142000,'USD',18000,'publicada','balcon, sum, cochera, a_estrenar','https://bochile.com.ar/tour/P-001','','Familia Ortiz','5492914512200','E-2',true,'2026-03-15'],
    ['P-002','Casa 4 ambientes con quincho y jardin','venta','casa','Brown 1842','Palihue',4,3,240,450,285000,'USD',0,'publicada','pileta, quincho, jardin, cochera, suite','https://bochile.com.ar/tour/P-002','','Familia Schiavi','5492914523310','E-1',true,'2026-02-10'],
    ['P-003','Monoambiente moderno en torre nueva','alquiler','departamento','Alem 1456 4D','Universitario',1,1,38,38,680000,'ARS',42000,'publicada','amoblado, gimnasio, seguridad','https://bochile.com.ar/tour/P-003','','Pablo Iribarne','5492914534421','E-2',true,'2026-04-01'],
    ['P-004','PH 3 ambientes con patio propio','venta','ph','Sarmiento 542','Villa Mitre',3,1,78,120,98000,'USD',0,'publicada','patio, reciclado, sin_expensas','https://bochile.com.ar/tour/P-004','','Marcos Pellegrini','5492914545532','E-3',true,'2026-01-22'],
    ['P-005','Casa de diseno con pileta y parque','venta','casa','Ruta 33 km 7 Country','Villa Belgrano',5,4,320,900,320000,'USD',85000,'publicada','pileta, parque, country, seguridad_24h, diseno','https://bochile.com.ar/tour/P-005','','Familia Cabrera','5492914556643','E-1',true,'2026-02-28'],
    ['P-006','Lote 12x30 apto duplex en zona consolidada','venta','lote','Castelli 3210','Patagonia',0,0,0,360,42000,'USD',0,'publicada','esquina, fot_1.2, servicios','https://bochile.com.ar/tour/P-006','','Roberto Genovese','5492914567754','E-3',true,'2026-03-05']
  ],
  contratos: [
    ['C-001','P-001','O\'Higgins 234 7B','Romina Calandri','+5492914421180','Familia Ortiz',680000,'ARS',5,'cuatrimestral','IPC','2024-05-01','2026-05-01','activo','2026-04-05',0],
    ['C-002','P-003','Alem 1456 4D','Florencia Bertola','+5492914462210','Pablo Iribarne',580000,'ARS',1,'cuatrimestral','IPC','2024-08-01','2026-08-01','activo','2026-04-01',3],
    ['C-003','P-008','Donado 1245','Gaston Iribarne','+5492914517822','Diego Albarracin',920000,'ARS',10,'trimestral','ICL','2025-06-10','2026-06-10','activo','2026-04-10',0],
    ['C-004','P-004','Sarmiento 542','Mariano Pellegrini','+5492914552209','Familia Schiavi',740000,'ARS',3,'cuatrimestral','IPC','2024-09-03','2026-09-03','activo','2026-04-03',0]
  ],
  leads: [
    ['L-2914423398','Lucas Fernandez','+5492914423398','','whatsapp','venta','casa','Palihue',4,250000,300000,'USD','mixto','alta',88,'Visita agendada','E-1','Casa familiar Palihue','Pareja con 2 hijos. Vende dpto Centro. Cash + credito.','2026-04-28T10:42:00Z','2026-04-30T15:30:00Z'],
    ['L-2914456712','Marcos Genovese','+5492914456712','marcos@gmail.com','referido','venta','casa','Villa Belgrano',5,280000,360000,'USD','cash','alta',88,'Nuevo','','Country Belgrano','Referido por Familia Cabrera. Paga cash.','2026-04-30T09:15:00Z','2026-04-30T09:15:00Z'],
    ['L-2914467823','Veronica Rial','+5492914467823','','zonaprop','venta','departamento','Universitario',2,120000,140000,'USD','mixto','media',82,'Calificado IA','E-2','Dpto 2 amb cerca UNS','Cash parcial + credito. Decision en 30 dias.','2026-04-29T14:00:00Z','2026-04-30T11:00:00Z'],
    ['L-2914478934','Pablo Schiavi','+5492914478934','','web','venta','casa','Palihue',4,300000,380000,'USD','vende_otra','alta',91,'Calificado IA','E-1','Casa familiar Palihue','Vende su departamento. Familia 4 personas.','2026-04-28T16:20:00Z','2026-04-29T09:30:00Z'],
    ['L-2914490156','Sofia Martinez','+5492914490156','','web','alquiler','departamento','Centro',2,500000,700000,'ARS','credito','baja',42,'En espera de stock','','Alquiler dpto 2 amb','Sin urgencia. Esta mirando.','2026-04-30T11:15:00Z','2026-04-30T11:20:00Z'],
    ['L-2914501267','Andrea Coria','+5492914501267','','zonaprop','venta','departamento','Centro',2,140000,170000,'USD','credito','media',73,'Visita agendada','E-2','Visita O\'Higgins manana 10h','Visita 1 mayo 10:00','2026-04-29T10:00:00Z','2026-04-30T17:00:00Z'],
    ['L-2914512378','Familia Beltran','+5492914512378','','whatsapp','venta','casa','Palihue',4,260000,320000,'USD','mixto','alta',85,'Visita agendada','E-1','2da visita Brown 1842','Ya visitaron una vez. Cerrando.','2026-04-25T14:00:00Z','2026-04-30T13:00:00Z'],
    ['L-2914523489','Pareja Ortiz','+5492914523489','','meta_ads','venta','casa','Palihue',4,250000,300000,'USD','mixto','alta',87,'Negociación','E-1','Contraoferta 270k','Hicieron oferta. Esperando respuesta del vendedor.','2026-04-20T09:00:00Z','2026-04-30T16:30:00Z']
  ],
  visitas: [
    ['V-001','L-2914512378','P-002','E-1','Carlos Bochile','Familia Beltran','Brown 1842, Palihue','2026-05-12','16:30','agendada',true,true,false,'','Segunda visita. Estan muy interesados.','2026-04-30T11:00:00Z'],
    ['V-002','L-2914501267','P-001','E-2','Julieta Mendez','Andrea Coria','O\'Higgins 234 7B, Centro','2026-05-13','10:00','agendada',true,true,false,'','Primera visita.','2026-04-30T15:00:00Z'],
    ['V-003','L-2914423398','P-002','E-1','Carlos Bochile','Lucas Fernandez','Brown 1842, Palihue','2026-05-14','10:30','agendada',true,true,false,'','Pareja con 2 chicos. Vende dpto Centro.','2026-04-30T17:00:00Z']
  ],
  matches_pendientes: [
    ['MP-001','L-2914490156','Sofia Martinez','+5492914490156','alquiler','departamento','Centro',2,500000,700000,'ARS','amoblado',true,'2026-04-30T11:20:00Z'],
    ['MP-002','L-2914456712','Marcos Genovese','+5492914456712','venta','casa','Villa Belgrano',5,280000,360000,'USD','pileta, parque, seguridad_24h',true,'2026-04-30T09:30:00Z']
  ],
  acciones_ia: [
    ['A-001','conversacion_atendida','Vendedor CORE','L-2914423398','Atendio consulta inicial','Lead Lucas consulta casa Palihue. Score 88.','ok',4,'2026-04-30T10:42:30Z'],
    ['A-002','lead_calificado','SubAgente Calificador','L-2914423398','Score 88 - caliente','Pareja 2 hijos. Presupuesto USD 250-300k. Pago mixto.','ok',3,'2026-04-30T10:44:30Z'],
    ['A-003','visita_agendada','SubAgente Admin','L-2914423398','Visita sabado 10:30','Brown 1842 con Carlos. Vendedor notificado.','ok',8,'2026-04-30T10:47:00Z'],
    ['A-004','cobranza_alquiler','Cron Cobranza','','Cobro Romina Calandri','$680.000 ARS via Mercado Pago. Recibo enviado.','enviado',5,'2026-04-30T09:12:00Z'],
    ['A-005','match_pendiente_guardado','SubAgente Admin','L-2914490156','Match pendiente Sofia','Alquiler dpto Centro 2 amb amoblado.','ok',5,'2026-04-30T11:22:00Z'],
    ['A-006','recordatorio_visita','Cron Recordatorios','L-2914512378','Recordatorio 24h','Familia Beltran visita hoy 16:30 Brown 1842.','enviado',3,'2026-05-11T16:30:00Z']
  ]
};

// =====================================================================
// MAIN
// =====================================================================

function setupBochileDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4');
  ss.rename('Bochile · Sistema Operativo');

  Logger.log('1/4 Creando hojas base...');
  for (const name of Object.keys(BASE_SHEETS)) {
    createBaseSheet(ss, name, BASE_SHEETS[name], SEED_DATA[name] || []);
  }

  Logger.log('2/4 Creando hojas analiticas...');
  buildPortada(ss);
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
  if (def) { try { ss.deleteSheet(def); } catch(e){} }

  Logger.log('4/4 Reordenando pestanas...');
  reorderTabs(ss, [
    'Portada',
    'Agenda de hoy',
    'Pipeline CRM',
    'Embudo de conversion',
    'Ranking vendedores',
    'Demanda por barrio',
    'Alquileres',
    'Feed de actividad',
    'leads','propiedades','visitas','contratos','empleados',
    'matches_pendientes','conversaciones','acciones_ia','CONFIG'
  ]);

  ss.setActiveSheet(ss.getSheetByName('Portada'));
  SpreadsheetApp.flush();
  Logger.log('OK. Workbook listo.');
}

// =====================================================================
// HOJAS BASE
// =====================================================================

function createBaseSheet(ss, name, headers, seedRows) {
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  s.clear();
  s.clearConditionalFormatRules();

  s.getRange(1, 1, 1, headers.length).setValues([headers]);
  const hdr = s.getRange(1, 1, 1, headers.length);
  hdr.setBackground(BRAND.navy)
     .setFontColor(BRAND.white)
     .setFontWeight('bold')
     .setFontFamily(FONT_BODY)
     .setFontSize(10)
     .setHorizontalAlignment('left')
     .setVerticalAlignment('middle')
     .setBorder(true, true, true, true, false, false, BRAND.navyDark, SpreadsheetApp.BorderStyle.SOLID);
  s.setRowHeight(1, 36);
  s.setFrozenRows(1);

  if (seedRows && seedRows.length > 0) {
    s.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    const dataR = s.getRange(2, 1, seedRows.length, headers.length);
    dataR.setFontFamily(FONT_BODY).setFontSize(10).setFontColor(BRAND.ink);
  }

  s.setTabColor(BRAND.inkLight);
  s.autoResizeColumns(1, Math.min(headers.length, 12));
  s.setHiddenGridlines(false);
  return s;
}

// =====================================================================
// PORTADA · La pantalla principal que ven todos
// =====================================================================

function buildPortada(ss) {
  const name = 'Portada';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  // Header marca
  s.getRange('B2:H2').merge()
   .setValue('BOCHILE INMOBILIARIA')
   .setFontFamily(FONT_TITLE).setFontSize(36).setFontWeight('bold').setFontColor(BRAND.navy)
   .setHorizontalAlignment('left').setVerticalAlignment('bottom');
  s.setRowHeight(2, 52);

  s.getRange('B3:H3').merge()
   .setValue('SISTEMA OPERATIVO · BAHIA BLANCA · DESDE 1970')
   .setFontFamily(FONT_BODY).setFontSize(10).setFontWeight('bold').setFontColor(BRAND.navy)
   .setHorizontalAlignment('left');
  s.setRowHeight(3, 22);

  // Linea decorativa
  s.getRange('B4:H4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);
  s.setRowHeight(4, 16);

  s.getRange('B5').setFormula('="Actualizado al " & TEXT(NOW(), "d \'de\' mmmm \'de\' yyyy · HH:mm")')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.ink);
  s.setRowHeight(5, 22);

  // === FILA 1 DE KPIs ===
  drawKPI(s, 'B7', 'D9', 'Leads esta semana', '=COUNTIFS(leads!T:T,">="&(TODAY()-7))', BRAND.navy);
  drawKPI(s, 'E7', 'G9', 'Visitas agendadas', '=COUNTIF(visitas!J:J,"agendada")', BRAND.navy);
  drawKPI(s, 'H7', 'J9', 'Conversion lead a visita', '=IFERROR(COUNTA(visitas!A2:A)/COUNTA(leads!A2:A),0)', BRAND.navy, '0%');

  // === FILA 2 DE KPIs ===
  drawKPI(s, 'B11', 'D13', 'Comisiones del mes', '=SUM(empleados!K2:K)', BRAND.champagne, '"$ "#,##0');
  drawKPI(s, 'E11', 'G13', 'Cierres del mes', '=SUM(empleados!J2:J)', BRAND.champagne);
  drawKPI(s, 'H11', 'J13', 'Operaciones en negociacion', '=COUNTIF(leads!P:P,"Negociación")', BRAND.champagne);

  // === FILA 3 DE KPIs (alquileres) ===
  drawKPI(s, 'B15', 'D17', 'Contratos activos', '=COUNTIF(contratos!N:N,"activo")', BRAND.green);
  drawKPI(s, 'E15', 'G17', 'Alquileres atrasados', '=COUNTIF(contratos!P:P,">0")', BRAND.red);
  drawKPI(s, 'H15', 'J17', 'Matches en espera', '=COUNTIF(matches_pendientes!M:M,TRUE)', BRAND.amber);

  // === SECCION ACCESOS RAPIDOS ===
  s.getRange('B19:J19').merge()
   .setValue('ACCESOS RAPIDOS')
   .setFontFamily(FONT_BODY).setFontSize(9).setFontWeight('bold').setFontColor(BRAND.inkSoft)
   .setHorizontalAlignment('left');
  s.setRowHeight(19, 24);
  s.getRange('B20:J20').setBorder(true, null, null, null, false, false, BRAND.line, SpreadsheetApp.BorderStyle.SOLID);

  const accesos = [
    ['Agenda de hoy y manana',  'Agenda de hoy',          'Lo que tiene que hacer el equipo'],
    ['Pipeline del CRM',        'Pipeline CRM',           'Estado de cada lead por etapa'],
    ['Embudo de conversion',    'Embudo de conversion',   'Cuanto se filtra en cada paso'],
    ['Ranking vendedores',      'Ranking vendedores',     'Performance del equipo este mes'],
    ['Demanda por barrio',      'Demanda por barrio',     'Donde estan buscando los clientes'],
    ['Alquileres y cobranza',   'Alquileres',             'Contratos al dia, atrasados y morosos'],
    ['Feed de actividad IA',    'Feed de actividad',      'Que esta haciendo la IA en tiempo real']
  ];

  for (let i = 0; i < accesos.length; i++) {
    const row = 21 + i;
    const target = ss.getSheetByName(accesos[i][1]);
    const url = target ? '#gid=' + target.getSheetId() : '';
    s.getRange(row, 2, 1, 4).merge()
     .setFormula('=HYPERLINK("' + url + '","' + accesos[i][0] + '")')
     .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.navy).setFontWeight('bold');
    s.getRange(row, 6, 1, 5).merge()
     .setValue(accesos[i][2])
     .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.ink);
    s.setRowHeight(row, 26);
    s.getRange(row, 2, 1, 9).setBorder(null, null, true, null, false, false, BRAND.lineSoft, SpreadsheetApp.BorderStyle.SOLID);
  }

  // === FOOTER ===
  const footRow = 21 + accesos.length + 2;
  s.getRange(footRow, 2, 1, 9).merge()
   .setValue('Sistema integrado con n8n · IA conversacional Camila · Sincronizado cada 5 minutos')
   .setFontFamily(FONT_BODY).setFontSize(10).setFontColor(BRAND.inkSoft)
   .setHorizontalAlignment('left');

  // Anchos / fondo paper
  s.getRange('A:A').setBackground(BRAND.paper);
  s.setColumnWidth(1, 28);
  for (let c = 2; c <= 10; c++) s.setColumnWidth(c, 130);
  s.setColumnWidth(11, 28);
  s.getRange('K:K').setBackground(BRAND.paper);
  s.getRange(1, 1, footRow + 2, 11).setBackground(BRAND.paper);

  // Pintar las celdas de KPI / accesos / titulo de blanco
  s.getRange('B2:J5').setBackground(BRAND.white);
  s.getRange('B7:J17').setBackground(BRAND.white);
  s.getRange('B19:J' + (21 + accesos.length - 1)).setBackground(BRAND.white);
}

function drawKPI(s, rangeStart, rangeEnd, label, formula, accentColor, format) {
  const range = s.getRange(rangeStart + ':' + rangeEnd);
  range.merge();
  range.setBackground(BRAND.white);
  range.setBorder(true, true, true, true, false, false, BRAND.line, SpreadsheetApp.BorderStyle.SOLID);

  // Coordenadas en mismas filas/cols
  const a1 = rangeStart.match(/([A-Z]+)(\d+)/);
  const startCol = a1[1];
  const startRow = parseInt(a1[2]);

  // Label
  s.getRange(startCol + startRow + ':' + rangeEnd.match(/([A-Z]+)/)[1] + startRow).merge().breakApart && null;
  // Workaround: usamos setValue + setFormula en las primeras celdas via offset
  // Simplificado: el merge ya esta hecho, escribimos label y valor con saltos via setRichText
  const labelCell = s.getRange(rangeStart);
  // Para que se vea label arriba y numero abajo, usamos texto multiline
  const formulaStr = '="' + label.toUpperCase() + '" & CHAR(10) & TEXT(' + formula.substring(1) + ',"' + (format || '#,##0') + '")';
  labelCell.setFormula(formulaStr);
  labelCell.setHorizontalAlignment('left').setVerticalAlignment('middle')
           .setFontFamily(FONT_TITLE).setFontSize(26).setFontWeight('bold').setFontColor(BRAND.navy)
           .setWrap(true);

  // Linea de acento abajo
  s.getRange(rangeEnd.match(/([A-Z]+)/)[1] + (parseInt(rangeEnd.match(/(\d+)/)[1])) + '')
   .setBorder(null, null, true, null, false, false, accentColor, SpreadsheetApp.BorderStyle.SOLID_THICK);
}

// =====================================================================
// AGENDA DE HOY
// =====================================================================

function buildAgendaHoy(ss) {
  const name = 'Agenda de hoy';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  // Header
  s.getRange('B2').setValue('Agenda de visitas')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);

  s.getRange('B3').setFormula('="Hoy " & TEXT(TODAY(),"dddd d \'de\' mmmm") & " y manana"')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.setRowHeight(3, 20);

  s.getRange('B4:I4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  // QUERY
  s.getRange('B6').setFormula(
    '=IFERROR(QUERY(visitas!A:O,' +
    '"select I, F, E, G, J, M ' +
    'where H >= date \'"&TEXT(TODAY(),"yyyy-mm-dd")&"\' ' +
    'and H <= date \'"&TEXT(TODAY()+1,"yyyy-mm-dd")&"\' ' +
    'order by H asc, I asc ' +
    'label I \'Hora\', F \'Cliente\', E \'Vendedor\', G \'Direccion\', J \'Estado\', M \'Observaciones\'",1),' +
    '"No hay visitas agendadas para hoy y manana.")'
  );

  // Style headers de la query
  s.getRange(6, 2, 1, 6).setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(6, 32);
  s.setFrozenRows(6);

  // Columnas
  s.setColumnWidth(1, 28);
  s.setColumnWidth(2, 80);   // Hora
  s.setColumnWidth(3, 200);  // Cliente
  s.setColumnWidth(4, 160);  // Vendedor
  s.setColumnWidth(5, 260);  // Direccion
  s.setColumnWidth(6, 130);  // Estado
  s.setColumnWidth(7, 320);  // Observaciones

  // Fondo paper
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:I100').setBackground(BRAND.white);
  s.getRange('A1:A100').setBackground(BRAND.paper);

  // Formato condicional al Estado
  const stateRange = s.getRange(7, 6, 200, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('agendada').setBackground(BRAND.amberSoft).setFontColor(BRAND.amber).setRanges([stateRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('confirmada').setBackground(BRAND.greenSoft).setFontColor(BRAND.green).setRanges([stateRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('cancelada').setBackground(BRAND.redSoft).setFontColor(BRAND.red).setRanges([stateRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// PIPELINE CRM
// =====================================================================

function buildPipelineCRM(ss) {
  const name = 'Pipeline CRM';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  s.getRange('B2').setValue('Pipeline comercial · Kanban')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);

  s.getRange('B3').setValue('Cada lead en su etapa actual. Score 0-100 a la derecha del nombre.')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.setRowHeight(3, 20);

  s.getRange('B4:G4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  const etapas = ['Nuevo','Calificado IA','Visita agendada','Negociación','Cierre','Post-venta'];
  for (let i = 0; i < etapas.length; i++) {
    const col = 2 + i;
    s.getRange(6, col)
     .setValue(etapas[i].toUpperCase())
     .setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold')
     .setFontFamily(FONT_BODY).setFontSize(9)
     .setHorizontalAlignment('center').setVerticalAlignment('middle');
    s.setColumnWidth(col, 220);
    s.getRange(7, col).setFormula(
      '=IFERROR(QUERY(leads!A:V,"select B, O where P = \'' + etapas[i] + '\' order by O desc",0),"")'
    ).setFontFamily(FONT_BODY).setFontSize(10);
  }
  s.setRowHeight(6, 34);
  s.setFrozenRows(6);

  s.setColumnWidth(1, 28);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:G200').setBackground(BRAND.white);

  // Formato condicional al score
  const scoreRange = s.getRange(7, 2, 200, 6);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(71).setBackground(BRAND.greenSoft).setFontColor(BRAND.green).setRanges([scoreRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(41,70).setBackground(BRAND.amberSoft).setFontColor(BRAND.amber).setRanges([scoreRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThanOrEqualTo(40).setBackground(BRAND.redSoft).setFontColor(BRAND.red).setRanges([scoreRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// EMBUDO DE CONVERSION
// =====================================================================

function buildEmbudo(ss) {
  const name = 'Embudo de conversion';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  s.getRange('B2').setValue('Embudo de conversion')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);

  s.getRange('B3').setValue('Ultimos 30 dias · cuanto se filtra en cada paso')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.setRowHeight(3, 20);
  s.getRange('B4:E4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  // Headers de tabla
  s.getRange(6, 2, 1, 3).setValues([['Etapa','Cantidad','% del paso anterior']]);
  s.getRange(6, 2, 1, 3).setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(6, 32);

  const rows = [
    ['Leads totales','=COUNTA(leads!A2:A)'],
    ['Calificados (score >= 41)','=COUNTIF(leads!O:O,">=41")'],
    ['Visitas agendadas','=COUNTA(visitas!A2:A)'],
    ['Negociaciones abiertas','=COUNTIF(leads!P:P,"Negociación")'],
    ['Cierres del mes','=COUNTIFS(leads!P:P,"Cierre",leads!U:U,">="&EOMONTH(TODAY(),-1)+1)']
  ];

  for (let i = 0; i < rows.length; i++) {
    const r = 7 + i;
    s.getRange(r, 2).setValue(rows[i][0]).setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.ink);
    s.getRange(r, 3).setFormula(rows[i][1]).setFontFamily(FONT_TITLE).setFontSize(18).setFontWeight('bold').setFontColor(BRAND.navy);
    if (i > 0) {
      s.getRange(r, 4).setFormula('=IFERROR(C' + r + '/C' + (r-1) + ',0)').setNumberFormat('0%').setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
    } else {
      s.getRange(r, 4).setValue('—').setFontColor(BRAND.inkLight).setHorizontalAlignment('center');
    }
    s.setRowHeight(r, 36);
    s.getRange(r, 2, 1, 3).setBorder(null, null, true, null, false, false, BRAND.lineSoft, SpreadsheetApp.BorderStyle.SOLID);
  }

  s.setColumnWidth(1, 28);
  s.setColumnWidth(2, 280);
  s.setColumnWidth(3, 140);
  s.setColumnWidth(4, 180);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:E100').setBackground(BRAND.white);
}

// =====================================================================
// RANKING VENDEDORES
// =====================================================================

function buildRankingVendedores(ss) {
  const name = 'Ranking vendedores';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  s.getRange('B2').setValue('Ranking de vendedores')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);
  s.getRange('B3').setValue('Mes actual · ordenado por comisiones generadas')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.getRange('B4:F4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  s.getRange('B6').setFormula(
    '=QUERY(empleados!A:K,' +
    '"select B, I, J, K ' +
    'where C = \'vendedor\' and H = TRUE ' +
    'order by K desc ' +
    'label B \'Vendedor\', I \'Visitas mes\', J \'Cierres\', K \'Comisiones\'",1)'
  );
  s.getRange(6, 2, 1, 4).setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(6, 32);
  s.setFrozenRows(6);

  s.getRange('E7:E20').setNumberFormat('"$ "#,##0');

  s.setColumnWidth(1, 28);
  s.setColumnWidth(2, 240);
  s.setColumnWidth(3, 130);
  s.setColumnWidth(4, 110);
  s.setColumnWidth(5, 180);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:F100').setBackground(BRAND.white);
}

// =====================================================================
// DEMANDA POR BARRIO
// =====================================================================

function buildDemandaBarrio(ss) {
  const name = 'Demanda por barrio';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  s.getRange('B2').setValue('Demanda por barrio')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);
  s.getRange('B3').setValue('Donde estan buscando los clientes · ranking de consultas')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.getRange('B4:D4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  s.getRange('B6').setFormula(
    '=QUERY(leads!A:V,' +
    '"select H, count(A) ' +
    'where H is not null and H != \'\' ' +
    'group by H ' +
    'order by count(A) desc ' +
    'label H \'Barrio\', count(A) \'Consultas\'",1)'
  );
  s.getRange(6, 2, 1, 2).setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(6, 32);
  s.setFrozenRows(6);

  s.setColumnWidth(1, 28);
  s.setColumnWidth(2, 240);
  s.setColumnWidth(3, 180);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:D100').setBackground(BRAND.white);

  // Gradient color en consultas
  const dataRange = s.getRange(7, 3, 50, 1);
  const rules = [];
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue(BRAND.lineSoft, SpreadsheetApp.InterpolationType.NUMBER, '1')
      .setGradientMaxpointWithValue(BRAND.champagne, SpreadsheetApp.InterpolationType.NUMBER, '50')
      .setRanges([dataRange])
      .build()
  );
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// ALQUILERES
// =====================================================================

function buildAlquileresEstado(ss) {
  const name = 'Alquileres';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  s.getRange('B2').setValue('Alquileres · cobranza y estado')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);
  s.getRange('B3').setValue('Contratos activos, vencimientos y atrasos')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.getRange('B4:I4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  // Stats
  drawKPI(s, 'B6', 'D8', 'Contratos activos', '=COUNTIF(contratos!N:N,"activo")', BRAND.green);
  drawKPI(s, 'E6', 'G8', 'Con atraso', '=COUNTIF(contratos!P:P,">0")', BRAND.amber);
  drawKPI(s, 'H6', 'J8', 'Morosos', '=COUNTIF(contratos!N:N,"moroso")', BRAND.red);

  // Tabla
  s.getRange('B11').setFormula(
    '=QUERY(contratos!A:P,' +
    '"select B, D, F, G, H, I, P, N ' +
    'order by P desc, I asc ' +
    'label B \'ID\', D \'Direccion\', F \'Inquilino\', G \'Monto\', H \'Moneda\', I \'Vence dia\', P \'Atraso (dias)\', N \'Estado\'",1)'
  );
  s.getRange(11, 2, 1, 8).setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(11, 32);
  s.setFrozenRows(11);

  s.setColumnWidth(1, 28);
  s.setColumnWidth(2, 90);
  s.setColumnWidth(3, 220);
  s.setColumnWidth(4, 180);
  s.setColumnWidth(5, 130);
  s.setColumnWidth(6, 80);
  s.setColumnWidth(7, 100);
  s.setColumnWidth(8, 120);
  s.setColumnWidth(9, 120);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:J100').setBackground(BRAND.white);

  // Formato condicional atraso
  const atrasoRange = s.getRange(12, 8, 200, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(1,2).setBackground(BRAND.amberSoft).setFontColor(BRAND.amber).setRanges([atrasoRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(3).setBackground(BRAND.redSoft).setFontColor(BRAND.red).setFontWeight('bold').setRanges([atrasoRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// FEED DE ACTIVIDAD
// =====================================================================

function buildFeedIA(ss) {
  const name = 'Feed de actividad';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.champagne);

  s.getRange('B2').setValue('Feed de actividad de la IA')
   .setFontFamily(FONT_TITLE).setFontSize(24).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 38);
  s.getRange('B3').setValue('Lo que la IA hizo · mas reciente arriba · ultimas 100 acciones')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);
  s.getRange('B4:G4').setBorder(null, null, true, null, false, false, BRAND.champagne, SpreadsheetApp.BorderStyle.SOLID_THICK);

  s.getRange('B6').setFormula(
    '=QUERY(acciones_ia!A:I,' +
    '"select I, C, B, F, G, H ' +
    'where I is not null ' +
    'order by I desc ' +
    'limit 100 ' +
    'label I \'Fecha-hora\', C \'Agente\', B \'Tipo\', F \'Resumen\', G \'Resultado\', H \'Min ahorrados\'",1)'
  );
  s.getRange(6, 2, 1, 6).setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(6, 32);
  s.setFrozenRows(6);

  s.setColumnWidth(1, 28);
  s.setColumnWidth(2, 180);
  s.setColumnWidth(3, 180);
  s.setColumnWidth(4, 200);
  s.setColumnWidth(5, 380);
  s.setColumnWidth(6, 130);
  s.setColumnWidth(7, 130);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:H300').setBackground(BRAND.white);

  // Formato condicional al resultado
  const resRange = s.getRange(7, 6, 200, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ok').setBackground(BRAND.greenSoft).setFontColor(BRAND.green).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('enviado').setBackground(BRAND.greenSoft).setFontColor(BRAND.green).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('escalado').setBackground(BRAND.amberSoft).setFontColor(BRAND.amber).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('error').setBackground(BRAND.redSoft).setFontColor(BRAND.red).setRanges([resRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// CONFIG
// =====================================================================

function buildConfig(ss) {
  const name = 'CONFIG';
  let s = ss.getSheetByName(name); if (!s) s = ss.insertSheet(name); s.clear(); s.clearConditionalFormatRules();
  s.setHiddenGridlines(true);
  s.setTabColor(BRAND.inkLight);

  s.getRange('B2').setValue('Parametros del sistema')
   .setFontFamily(FONT_TITLE).setFontSize(20).setFontWeight('bold').setFontColor(BRAND.navy);
  s.setRowHeight(2, 36);
  s.getRange('B3').setValue('Editables manualmente · validacion de las otras hojas lee de aqui')
   .setFontFamily(FONT_BODY).setFontSize(11).setFontColor(BRAND.inkSoft);

  const headers = ['Zonas','Etapas CRM','Tipos propiedad','Operaciones'];
  s.getRange(5, 2, 1, 4).setValues([headers])
   .setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.setRowHeight(5, 30);

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
  s.getRange(6, 2, datos.length, 4).setValues(datos)
   .setFontFamily(FONT_BODY).setFontSize(10).setFontColor(BRAND.ink);

  // Parametros operativos
  s.getRange('G5').setValue('Parametros operativos')
   .setBackground(BRAND.navy).setFontColor(BRAND.white).setFontWeight('bold').setFontFamily(FONT_BODY).setFontSize(10);
  s.getRange('H5').setBackground(BRAND.navy);

  const params = [
    ['Tour base URL','https://bochile.com.ar/tour/'],
    ['Pago base URL','https://bochile.com.ar/pagar/'],
    ['Telefono Carlos','5492914401120'],
    ['Horas humanas mes (base)',200],
    ['Score umbral visita',70],
    ['Score umbral curioso',40]
  ];
  s.getRange(6, 7, params.length, 2).setValues(params)
   .setFontFamily(FONT_BODY).setFontSize(10).setFontColor(BRAND.ink);

  s.setColumnWidth(1, 28);
  for (let c = 2; c <= 8; c++) s.setColumnWidth(c, 170);
  s.getRange('A:A').setBackground(BRAND.paper);
  s.getRange('B1:I60').setBackground(BRAND.white);
}

// =====================================================================
// HELPERS
// =====================================================================

function reorderTabs(ss, ordered) {
  for (let i = 0; i < ordered.length; i++) {
    const s = ss.getSheetByName(ordered[i]);
    if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(i + 1); }
  }
}
