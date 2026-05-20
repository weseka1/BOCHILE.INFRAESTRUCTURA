/**
 * BOCHILE · SISTEMA OPERATIVO · Apps Script v3
 *
 * Diseno profesional inmobiliario premium. Inspiracion: Sotheby's,
 * Engel & Volkers, paginas financieras (FT). Jerarquia tipografica
 * estricta, contraste WCAG AAA, grid matematica, KPIs como cards
 * reales (no concatenacion de texto). Paleta semantica.
 *
 * USO:
 * 1. Abrir spreadsheet maestro.
 * 2. Extensions -> Apps Script.
 * 3. Ctrl+A en el editor -> Delete. Pegar este archivo entero.
 * 4. Ctrl+S. Run -> setupBochileDashboard. Aprobar permisos.
 * 5. Esperar 40-60 seg. Refrescar la pestana del spreadsheet (F5).
 */

// =====================================================================
// SISTEMA DE DISENO
// =====================================================================

const C = {
  // STRUCTURE
  bg:          '#FFFFFF',
  bgPaper:     '#F8F7F4',
  bgPaperAlt:  '#F3F1EB',

  // BRAND CORE
  navy:        '#0A1F44',
  navyMid:     '#14315B',
  navyLight:   '#28477A',

  // TEXT (contraste alto sobre blanco)
  textMain:    '#0A0A0A',
  textSoft:    '#3D3D3D',
  textMuted:   '#6B6B6B',
  textOnDark:  '#FFFFFF',

  // GOLD (acento real, no champagne lavado)
  gold:        '#B8862F',
  goldDeep:    '#8B6420',
  goldSoft:    '#F4ECD6',
  goldLine:    '#D4B675',

  // SEMANTIC
  success:     '#1A5731',
  successBg:   '#E8F0EA',
  warning:     '#8B4513',
  warningBg:   '#FAEFD9',
  danger:      '#8B1E1E',
  dangerBg:    '#F5E1E1',

  // LINES
  lineStrong:  '#C9C4B5',
  lineSoft:    '#E8E4D8',
  lineHair:    '#EDEAE1'
};

const F = {
  title:  'Playfair Display',
  body:   'Roboto',
  mono:   'Roboto Mono'
};

// =====================================================================
// MODELO
// =====================================================================

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

const SEED = {
  empleados: [
    ['E-1','Carlos Bochile','vendedor','5492914401120','carlos@bochile.com.ar','Palihue, Villa Belgrano','',true,18,3,22400000],
    ['E-2','Julieta Mendez','vendedor','5492914402230','julieta@bochile.com.ar','Centro, Universitario','',true,14,3,15800000],
    ['E-3','Valentin Soto','vendedor','5492914403341','valentin@bochile.com.ar','Villa Mitre, Patagonia','',true,11,2,10500000],
    ['E-4','Maria Lopez','admin','5492914404452','maria@bochile.com.ar','','',true,0,0,0]
  ],
  propiedades: [
    ['P-001','Departamento 2 ambientes a estrenar','venta','departamento','O\'Higgins 234 7B','Centro',2,1,52,52,142000,'USD',18000,'publicada','balcon, sum, cochera','https://bochile.com.ar/tour/P-001','','Familia Ortiz','5492914512200','E-2',true,'2026-03-15'],
    ['P-002','Casa 4 ambientes con quincho','venta','casa','Brown 1842','Palihue',4,3,240,450,285000,'USD',0,'publicada','pileta, quincho, jardin','https://bochile.com.ar/tour/P-002','','Familia Schiavi','5492914523310','E-1',true,'2026-02-10'],
    ['P-003','Monoambiente torre nueva','alquiler','departamento','Alem 1456 4D','Universitario',1,1,38,38,680000,'ARS',42000,'publicada','amoblado, gimnasio','https://bochile.com.ar/tour/P-003','','Pablo Iribarne','5492914534421','E-2',true,'2026-04-01'],
    ['P-004','PH 3 ambientes con patio','venta','ph','Sarmiento 542','Villa Mitre',3,1,78,120,98000,'USD',0,'publicada','patio, reciclado','https://bochile.com.ar/tour/P-004','','Marcos Pellegrini','5492914545532','E-3',true,'2026-01-22'],
    ['P-005','Casa de diseno con pileta','venta','casa','Ruta 33 km 7','Villa Belgrano',5,4,320,900,320000,'USD',85000,'publicada','pileta, parque, country','https://bochile.com.ar/tour/P-005','','Familia Cabrera','5492914556643','E-1',true,'2026-02-28'],
    ['P-006','Lote 12x30 apto duplex','venta','lote','Castelli 3210','Patagonia',0,0,0,360,42000,'USD',0,'publicada','esquina, servicios','https://bochile.com.ar/tour/P-006','','Roberto Genovese','5492914567754','E-3',true,'2026-03-05']
  ],
  contratos: [
    ['C-001','P-001','O\'Higgins 234 7B','Romina Calandri','+5492914421180','Familia Ortiz',680000,'ARS',5,'cuatrimestral','IPC','2024-05-01','2026-05-01','activo','2026-04-05',0],
    ['C-002','P-003','Alem 1456 4D','Florencia Bertola','+5492914462210','Pablo Iribarne',580000,'ARS',1,'cuatrimestral','IPC','2024-08-01','2026-08-01','activo','2026-04-01',3],
    ['C-003','P-008','Donado 1245','Gaston Iribarne','+5492914517822','Diego Albarracin',920000,'ARS',10,'trimestral','ICL','2025-06-10','2026-06-10','activo','2026-04-10',0],
    ['C-004','P-004','Sarmiento 542','Mariano Pellegrini','+5492914552209','Familia Schiavi',740000,'ARS',3,'cuatrimestral','IPC','2024-09-03','2026-09-03','activo','2026-04-03',0]
  ],
  leads: [
    ['L-2914423398','Lucas Fernandez','+5492914423398','','whatsapp','venta','casa','Palihue',4,250000,300000,'USD','mixto','alta',88,'Visita agendada','E-1','Casa familiar Palihue','Pareja 2 hijos. Vende dpto Centro.','2026-04-28T10:42:00Z','2026-04-30T15:30:00Z'],
    ['L-2914456712','Marcos Genovese','+5492914456712','marcos@gmail.com','referido','venta','casa','Villa Belgrano',5,280000,360000,'USD','cash','alta',88,'Nuevo','','Country Belgrano','Referido. Cash.','2026-04-30T09:15:00Z','2026-04-30T09:15:00Z'],
    ['L-2914467823','Veronica Rial','+5492914467823','','zonaprop','venta','departamento','Universitario',2,120000,140000,'USD','mixto','media',82,'Calificado IA','E-2','Dpto cerca UNS','Decision 30 dias.','2026-04-29T14:00:00Z','2026-04-30T11:00:00Z'],
    ['L-2914478934','Pablo Schiavi','+5492914478934','','web','venta','casa','Palihue',4,300000,380000,'USD','vende_otra','alta',91,'Calificado IA','E-1','Casa familiar Palihue','Vende dpto. Familia 4.','2026-04-28T16:20:00Z','2026-04-29T09:30:00Z'],
    ['L-2914490156','Sofia Martinez','+5492914490156','','web','alquiler','departamento','Centro',2,500000,700000,'ARS','credito','baja',42,'En espera de stock','','Alquiler 2 amb','Sin urgencia.','2026-04-30T11:15:00Z','2026-04-30T11:20:00Z'],
    ['L-2914501267','Andrea Coria','+5492914501267','','zonaprop','venta','departamento','Centro',2,140000,170000,'USD','credito','media',73,'Visita agendada','E-2','Visita O\'Higgins','Visita 13 mayo 10:00','2026-04-29T10:00:00Z','2026-04-30T17:00:00Z'],
    ['L-2914512378','Familia Beltran','+5492914512378','','whatsapp','venta','casa','Palihue',4,260000,320000,'USD','mixto','alta',85,'Visita agendada','E-1','2da visita Brown 1842','Cerrando.','2026-04-25T14:00:00Z','2026-04-30T13:00:00Z'],
    ['L-2914523489','Pareja Ortiz','+5492914523489','','meta_ads','venta','casa','Palihue',4,250000,300000,'USD','mixto','alta',87,'Negociación','E-1','Contraoferta 270k','Esperando respuesta.','2026-04-20T09:00:00Z','2026-04-30T16:30:00Z']
  ],
  visitas: [
    ['V-001','L-2914512378','P-002','E-1','Carlos Bochile','Familia Beltran','Brown 1842, Palihue','2026-05-12','16:30','agendada',true,true,false,'','Segunda visita. Muy interesados.','2026-04-30T11:00:00Z'],
    ['V-002','L-2914501267','P-001','E-2','Julieta Mendez','Andrea Coria','O\'Higgins 234 7B, Centro','2026-05-13','10:00','agendada',true,true,false,'','Primera visita.','2026-04-30T15:00:00Z'],
    ['V-003','L-2914423398','P-002','E-1','Carlos Bochile','Lucas Fernandez','Brown 1842, Palihue','2026-05-14','10:30','agendada',true,true,false,'','Pareja 2 chicos.','2026-04-30T17:00:00Z']
  ],
  matches_pendientes: [
    ['MP-001','L-2914490156','Sofia Martinez','+5492914490156','alquiler','departamento','Centro',2,500000,700000,'ARS','amoblado',true,'2026-04-30T11:20:00Z'],
    ['MP-002','L-2914456712','Marcos Genovese','+5492914456712','venta','casa','Villa Belgrano',5,280000,360000,'USD','pileta, parque',true,'2026-04-30T09:30:00Z']
  ],
  acciones_ia: [
    ['A-001','conversacion_atendida','Vendedor CORE','L-2914423398','Atendio consulta inicial','Lucas consulta casa Palihue. Score 88.','ok',4,'2026-04-30T10:42:30Z'],
    ['A-002','lead_calificado','SubAgente Calificador','L-2914423398','Score 88 caliente','Pareja 2 hijos. USD 250-300k.','ok',3,'2026-04-30T10:44:30Z'],
    ['A-003','visita_agendada','SubAgente Admin','L-2914423398','Visita sabado 10:30','Brown 1842 con Carlos.','ok',8,'2026-04-30T10:47:00Z'],
    ['A-004','cobranza_alquiler','Cron Cobranza','','Cobro Romina Calandri','$680.000 ARS via Mercado Pago.','enviado',5,'2026-04-30T09:12:00Z'],
    ['A-005','match_pendiente_guardado','SubAgente Admin','L-2914490156','Match pendiente Sofia','Alquiler dpto Centro 2 amb.','ok',5,'2026-04-30T11:22:00Z'],
    ['A-006','recordatorio_visita','Cron Recordatorios','L-2914512378','Recordatorio 24h','Familia Beltran 16:30 Brown 1842.','enviado',3,'2026-05-11T16:30:00Z']
  ]
};

// =====================================================================
// MAIN
// =====================================================================

function setupBochileDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4');
  try { ss.rename('Bochile · Sistema Operativo'); } catch(e){}

  Logger.log('Construyendo hojas base...');
  Object.keys(BASE_SHEETS).forEach(function(name){
    buildBaseSheet(ss, name, BASE_SHEETS[name], SEED[name] || []);
  });

  Logger.log('Construyendo hojas analiticas...');
  buildPortada(ss);
  buildAgenda(ss);
  buildPipeline(ss);
  buildEmbudo(ss);
  buildRanking(ss);
  buildDemanda(ss);
  buildAlquileres(ss);
  buildFeed(ss);
  buildConfig(ss);

  Logger.log('Limpiando...');
  ['Sheet1','Hoja 1','Hoja1'].forEach(function(n){
    const x = ss.getSheetByName(n);
    if (x) try { ss.deleteSheet(x); } catch(e){}
  });

  reorderTabs(ss, [
    'Portada','Agenda de hoy','Pipeline CRM','Embudo de conversion',
    'Ranking vendedores','Demanda por barrio','Alquileres','Feed de actividad',
    'leads','propiedades','visitas','contratos','empleados',
    'matches_pendientes','conversaciones','acciones_ia','CONFIG'
  ]);

  ss.setActiveSheet(ss.getSheetByName('Portada'));
  SpreadsheetApp.flush();
  Logger.log('Listo.');
}

// =====================================================================
// PRIMITIVAS DE DISENO
// =====================================================================

function clearSheet(s) {
  s.clear();
  try { s.clearConditionalFormatRules(); } catch(e){}
  try { s.clearNotes(); } catch(e){}
  // Reset row heights
  const maxRows = s.getMaxRows();
  s.setRowHeights(1, Math.min(maxRows, 200), 21);
}

function paintCanvas(s, lastCol, lastRow) {
  // Background paper en toda la zona visible
  s.getRange(1, 1, lastRow, lastCol).setBackground(C.bgPaper);
  s.setHiddenGridlines(true);
}

function placeTitle(s, row, col, span, title, subtitle) {
  // Title
  s.getRange(row, col, 1, span).merge()
   .setValue(title)
   .setFontFamily(F.title).setFontSize(28).setFontWeight('bold').setFontColor(C.navy)
   .setHorizontalAlignment('left').setVerticalAlignment('bottom')
   .setBackground(C.bgPaper);
  s.setRowHeight(row, 48);

  if (subtitle) {
    s.getRange(row + 1, col, 1, span).merge()
     .setValue(subtitle.toUpperCase())
     .setFontFamily(F.body).setFontSize(9).setFontWeight('bold').setFontColor(C.gold)
     .setHorizontalAlignment('left').setVerticalAlignment('top')
     .setBackground(C.bgPaper);
    s.setRowHeight(row + 1, 18);
  }

  // Linea decorativa dorada
  const lineRow = subtitle ? row + 2 : row + 1;
  s.getRange(lineRow, col, 1, span).merge()
   .setBackground(C.gold);
  s.setRowHeight(lineRow, 3);

  return lineRow + 1;
}

function placeDateLabel(s, row, col, span) {
  s.getRange(row, col, 1, span).merge()
   .setFormula('="Actualizado al " & TEXT(NOW(), "dddd d \'de\' mmmm \'de\' yyyy · HH:mm")')
   .setFontFamily(F.body).setFontSize(10).setFontColor(C.textSoft)
   .setFontStyle('italic')
   .setHorizontalAlignment('left').setVerticalAlignment('middle')
   .setBackground(C.bgPaper);
  s.setRowHeight(row, 24);
}

/**
 * Card KPI con 3 filas (label / value / accent line)
 * @param startRow {number}
 * @param startCol {number}
 * @param span {number} columnas
 * @param label {string}
 * @param formula {string}
 * @param format {string?}
 * @param accent {string} color de la barra inferior
 */
function placeKPI(s, startRow, startCol, span, label, formula, format, accent) {
  // 1. Outer card background y border
  const cardR = s.getRange(startRow, startCol, 3, span);
  cardR.setBackground(C.bg);
  cardR.setBorder(true, true, true, true, false, false, C.lineStrong, SpreadsheetApp.BorderStyle.SOLID);

  // 2. Label row (top)
  const labelR = s.getRange(startRow, startCol, 1, span);
  labelR.merge();
  labelR.setValue(label.toUpperCase());
  labelR.setFontFamily(F.body).setFontSize(9).setFontWeight('bold').setFontColor(C.textSoft);
  labelR.setHorizontalAlignment('left').setVerticalAlignment('middle');
  labelR.setBackground(C.bg);
  // Padding interno simulado via row height
  s.setRowHeight(startRow, 28);

  // 3. Value row (large number)
  const valueR = s.getRange(startRow + 1, startCol, 1, span);
  valueR.merge();
  valueR.setFormula(formula);
  if (format) valueR.setNumberFormat(format);
  valueR.setFontFamily(F.title).setFontSize(34).setFontWeight('bold').setFontColor(C.navy);
  valueR.setHorizontalAlignment('left').setVerticalAlignment('middle');
  valueR.setBackground(C.bg);
  s.setRowHeight(startRow + 1, 60);

  // 4. Accent line row (bottom)
  const accentR = s.getRange(startRow + 2, startCol, 1, span);
  accentR.merge();
  accentR.setBackground(accent || C.gold);
  s.setRowHeight(startRow + 2, 4);
}

function placeTableHeader(s, row, startCol, headers) {
  const r = s.getRange(row, startCol, 1, headers.length);
  r.setValues([headers.map(function(h){ return h.toUpperCase(); })]);
  r.setBackground(C.navy).setFontColor(C.textOnDark)
   .setFontFamily(F.body).setFontSize(10).setFontWeight('bold')
   .setHorizontalAlignment('left').setVerticalAlignment('middle');
  s.setRowHeight(row, 34);
}

function placeSectionLabel(s, row, col, span, text) {
  s.getRange(row, col, 1, span).merge()
   .setValue(text.toUpperCase())
   .setFontFamily(F.body).setFontSize(9).setFontWeight('bold').setFontColor(C.gold)
   .setHorizontalAlignment('left').setVerticalAlignment('middle')
   .setBackground(C.bgPaper);
  s.setRowHeight(row, 24);
  // Linea fina abajo
  s.getRange(row, col, 1, span).setBorder(null, null, true, null, false, false, C.lineStrong, SpreadsheetApp.BorderStyle.SOLID);
}

function placeSpacer(s, row, height) {
  s.setRowHeight(row, height || 16);
}

// =====================================================================
// HOJAS BASE (data en bruto)
// =====================================================================

function buildBaseSheet(ss, name, headers, seedRows) {
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  clearSheet(s);

  // Header
  s.getRange(1, 1, 1, headers.length).setValues([headers]);
  const hdr = s.getRange(1, 1, 1, headers.length);
  hdr.setBackground(C.navy).setFontColor(C.textOnDark).setFontWeight('bold')
     .setFontFamily(F.body).setFontSize(10)
     .setHorizontalAlignment('left').setVerticalAlignment('middle');
  s.setRowHeight(1, 32);
  s.setFrozenRows(1);

  // Data
  if (seedRows && seedRows.length > 0) {
    s.getRange(2, 1, seedRows.length, headers.length).setValues(seedRows);
    const dataR = s.getRange(2, 1, seedRows.length, headers.length);
    dataR.setFontFamily(F.body).setFontSize(10).setFontColor(C.textMain)
         .setVerticalAlignment('middle');
    for (let i = 0; i < seedRows.length; i++) s.setRowHeight(2 + i, 26);
  }

  s.setTabColor(C.textMuted);
  s.autoResizeColumns(1, Math.min(headers.length, 12));
  return s;
}

// =====================================================================
// PORTADA
// =====================================================================

function buildPortada(ss) {
  let s = ss.getSheetByName('Portada'); if (!s) s = ss.insertSheet('Portada');
  clearSheet(s);
  s.setTabColor(C.gold);

  // Grid de columnas: A=gutter, B-D=KPI1, E=gutter, F-H=KPI2, I=gutter, J-L=KPI3, M=gutter
  s.setColumnWidth(1, 32);
  [2,3,4].forEach(function(c){ s.setColumnWidth(c, 96); });
  s.setColumnWidth(5, 18);
  [6,7,8].forEach(function(c){ s.setColumnWidth(c, 96); });
  s.setColumnWidth(9, 18);
  [10,11,12].forEach(function(c){ s.setColumnWidth(c, 96); });
  s.setColumnWidth(13, 32);

  paintCanvas(s, 14, 60);

  // Gutter top
  placeSpacer(s, 1, 24);

  // Header marca
  let cursor = placeTitle(s, 2, 2, 11,
    'BOCHILE INMOBILIARIA',
    'Bahia Blanca · Desde 1970 · Sistema Operativo'
  );

  placeSpacer(s, cursor, 12);
  cursor += 1;

  placeDateLabel(s, cursor, 2, 11);
  cursor += 1;

  placeSpacer(s, cursor, 28);
  cursor += 1;

  // === FILA 1 DE KPIs ===
  placeSectionLabel(s, cursor, 2, 11, 'Indicadores comerciales');
  cursor += 1;
  placeSpacer(s, cursor, 8);
  cursor += 1;

  placeKPI(s, cursor, 2, 3,  'Leads esta semana',       '=COUNTIFS(leads!T:T,">="&(TODAY()-7))',                                                                  '#,##0', C.navy);
  placeKPI(s, cursor, 6, 3,  'Visitas agendadas',       '=COUNTIF(visitas!J:J,"agendada")',                                                                       '#,##0', C.navy);
  placeKPI(s, cursor, 10, 3, 'Conversion lead a visita','=IFERROR(COUNTA(visitas!A2:A)/COUNTA(leads!A2:A),0)',                                                    '0.0%',  C.navy);
  cursor += 3;

  placeSpacer(s, cursor, 14);
  cursor += 1;

  placeKPI(s, cursor, 2, 3,  'Comisiones del mes',  '=SUM(empleados!K2:K)',                  '"USD "#,##0', C.gold);
  placeKPI(s, cursor, 6, 3,  'Cierres del mes',     '=SUM(empleados!J2:J)',                  '#,##0',       C.gold);
  placeKPI(s, cursor, 10, 3, 'En negociacion',      '=COUNTIF(leads!P:P,"Negociación")',     '#,##0',       C.gold);
  cursor += 3;

  placeSpacer(s, cursor, 24);
  cursor += 1;

  // === FILA 2 SECCION ALQUILERES ===
  placeSectionLabel(s, cursor, 2, 11, 'Alquileres y servicio');
  cursor += 1;
  placeSpacer(s, cursor, 8);
  cursor += 1;

  placeKPI(s, cursor, 2, 3,  'Contratos activos',   '=COUNTIF(contratos!N:N,"activo")',          '#,##0', C.success);
  placeKPI(s, cursor, 6, 3,  'Alquileres con atraso','=COUNTIF(contratos!P:P,">0")',             '#,##0', C.warning);
  placeKPI(s, cursor, 10, 3, 'Matches en espera',   '=COUNTIF(matches_pendientes!M:M,TRUE)',     '#,##0', C.gold);
  cursor += 3;

  placeSpacer(s, cursor, 28);
  cursor += 1;

  // === ACCESOS RAPIDOS ===
  placeSectionLabel(s, cursor, 2, 11, 'Accesos rapidos');
  cursor += 1;
  placeSpacer(s, cursor, 6);
  cursor += 1;

  const accesos = [
    ['Agenda de hoy',           'Visitas confirmadas para hoy y manana'],
    ['Pipeline CRM',            'Estado de cada lead por etapa del embudo'],
    ['Embudo de conversion',    'Cuanto se filtra en cada paso del proceso'],
    ['Ranking vendedores',      'Performance del equipo este mes'],
    ['Demanda por barrio',      'Donde estan buscando los clientes'],
    ['Alquileres',              'Contratos al dia, atrasados y morosos'],
    ['Feed de actividad',       'Que esta haciendo la IA en tiempo real']
  ];

  for (let i = 0; i < accesos.length; i++) {
    const row = cursor;
    const target = ss.getSheetByName(accesos[i][0]);
    const url = target ? '#gid=' + target.getSheetId() : '';

    // Card background
    s.getRange(row, 2, 1, 11).setBackground(C.bg)
     .setBorder(null, null, true, null, false, false, C.lineSoft, SpreadsheetApp.BorderStyle.SOLID);

    // Link cell (col 2-5)
    s.getRange(row, 2, 1, 4).merge()
     .setFormula('=HYPERLINK("' + url + '","' + accesos[i][0] + '")')
     .setFontFamily(F.body).setFontSize(11).setFontWeight('bold').setFontColor(C.navy)
     .setHorizontalAlignment('left').setVerticalAlignment('middle')
     .setBackground(C.bg);

    // Description (col 6-12)
    s.getRange(row, 6, 1, 7).merge()
     .setValue(accesos[i][1])
     .setFontFamily(F.body).setFontSize(10).setFontColor(C.textSoft)
     .setHorizontalAlignment('left').setVerticalAlignment('middle')
     .setBackground(C.bg);

    s.setRowHeight(row, 30);
    cursor += 1;
  }

  placeSpacer(s, cursor, 24);
  cursor += 1;

  // Footer
  s.getRange(cursor, 2, 1, 11).merge()
   .setValue('Sistema integrado con n8n · Camila IA conversacional · Sincronizacion automatica cada 5 minutos')
   .setFontFamily(F.body).setFontSize(9).setFontColor(C.textMuted)
   .setFontStyle('italic')
   .setHorizontalAlignment('left').setVerticalAlignment('middle')
   .setBackground(C.bgPaper);
  s.setRowHeight(cursor, 24);

  // Mantener gutter abajo paper
  for (let r = cursor + 1; r < cursor + 6; r++) {
    s.getRange(r, 1, 1, 13).setBackground(C.bgPaper);
    s.setRowHeight(r, 18);
  }
}

// =====================================================================
// AGENDA DE HOY
// =====================================================================

function buildAgenda(ss) {
  let s = ss.getSheetByName('Agenda de hoy'); if (!s) s = ss.insertSheet('Agenda de hoy');
  clearSheet(s);
  s.setTabColor(C.gold);

  // Grid
  s.setColumnWidth(1, 32);
  s.setColumnWidth(2, 80);   // Hora
  s.setColumnWidth(3, 200);  // Cliente
  s.setColumnWidth(4, 160);  // Vendedor
  s.setColumnWidth(5, 280);  // Direccion
  s.setColumnWidth(6, 140);  // Estado
  s.setColumnWidth(7, 320);  // Observaciones
  s.setColumnWidth(8, 32);

  paintCanvas(s, 8, 100);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 6, 'Agenda de visitas', 'Hoy y manana · todas las confirmadas');
  placeSpacer(s, cursor, 16); cursor += 1;

  // Headers
  placeTableHeader(s, cursor, 2, ['Hora','Cliente','Vendedor','Direccion','Estado','Observaciones']);
  const headerRow = cursor;
  cursor += 1;

  // Query
  s.getRange(cursor, 2).setFormula(
    '=IFERROR(QUERY(visitas!A:O,' +
    '"select I, F, E, G, J, M ' +
    'where H >= date \'"&TEXT(TODAY(),"yyyy-mm-dd")&"\' ' +
    'and H <= date \'"&TEXT(TODAY()+7,"yyyy-mm-dd")&"\' ' +
    'order by H asc, I asc",0),' +
    '"")'
  );

  // Style data
  s.getRange(cursor, 2, 50, 6)
   .setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain)
   .setVerticalAlignment('middle').setBackground(C.bg);
  for (let r = cursor; r < cursor + 50; r++) s.setRowHeight(r, 34);

  s.setFrozenRows(headerRow);

  // Borders entre filas
  for (let r = cursor; r < cursor + 50; r++) {
    s.getRange(r, 2, 1, 6).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
  }

  // Conditional format al estado
  const stateRange = s.getRange(cursor, 6, 50, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('agendada').setBackground(C.warningBg).setFontColor(C.warning).setBold(true).setRanges([stateRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('confirmada').setBackground(C.successBg).setFontColor(C.success).setBold(true).setRanges([stateRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('cancelada').setBackground(C.dangerBg).setFontColor(C.danger).setBold(true).setRanges([stateRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// PIPELINE KANBAN
// =====================================================================

function buildPipeline(ss) {
  let s = ss.getSheetByName('Pipeline CRM'); if (!s) s = ss.insertSheet('Pipeline CRM');
  clearSheet(s);
  s.setTabColor(C.gold);

  const etapas = ['Nuevo','Calificado IA','Visita agendada','Negociación','Cierre','Post-venta'];

  s.setColumnWidth(1, 32);
  for (let i = 0; i < etapas.length; i++) s.setColumnWidth(2 + i, 200);
  s.setColumnWidth(8, 32);

  paintCanvas(s, 8, 200);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 6, 'Pipeline comercial', 'Kanban por etapa · score 0-100 a la derecha del nombre');
  placeSpacer(s, cursor, 16); cursor += 1;

  // Column headers
  for (let i = 0; i < etapas.length; i++) {
    s.getRange(cursor, 2 + i)
     .setValue(etapas[i].toUpperCase())
     .setBackground(C.navy).setFontColor(C.textOnDark).setFontWeight('bold')
     .setFontFamily(F.body).setFontSize(9)
     .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
  s.setRowHeight(cursor, 32);
  // Count
  const countRow = cursor + 1;
  for (let i = 0; i < etapas.length; i++) {
    s.getRange(countRow, 2 + i).setFormula('="(" & COUNTIF(leads!P:P,"' + etapas[i] + '") & " leads)"')
     .setFontFamily(F.body).setFontSize(9).setFontColor(C.textMuted)
     .setHorizontalAlignment('center').setBackground(C.bgPaperAlt);
  }
  s.setRowHeight(countRow, 22);
  s.setFrozenRows(countRow);

  cursor = countRow + 1;
  placeSpacer(s, cursor, 6); cursor += 1;

  // Queries por etapa
  for (let i = 0; i < etapas.length; i++) {
    s.getRange(cursor, 2 + i).setFormula(
      '=IFERROR(QUERY(leads!A:V,"select B, O where P = \'' + etapas[i] + '\' order by O desc",0),"")'
    ).setFontFamily(F.body).setFontSize(10).setVerticalAlignment('middle');
  }

  // Estilo de los datos
  s.getRange(cursor, 2, 100, etapas.length)
   .setBackground(C.bg)
   .setFontColor(C.textMain);
  for (let r = cursor; r < cursor + 100; r++) s.setRowHeight(r, 28);

  // Score color
  const scoreRange = s.getRange(cursor, 2, 100, etapas.length);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(71).setBackground(C.successBg).setFontColor(C.success).setRanges([scoreRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(41,70).setBackground(C.warningBg).setFontColor(C.warning).setRanges([scoreRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThanOrEqualTo(40).setBackground(C.dangerBg).setFontColor(C.danger).setRanges([scoreRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// EMBUDO
// =====================================================================

function buildEmbudo(ss) {
  let s = ss.getSheetByName('Embudo de conversion'); if (!s) s = ss.insertSheet('Embudo de conversion');
  clearSheet(s);
  s.setTabColor(C.gold);

  s.setColumnWidth(1, 32);
  s.setColumnWidth(2, 280);
  s.setColumnWidth(3, 140);
  s.setColumnWidth(4, 180);
  s.setColumnWidth(5, 220);
  s.setColumnWidth(6, 32);

  paintCanvas(s, 6, 60);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 4, 'Embudo de conversion', 'Ultimos 30 dias · cuanto se filtra en cada paso');
  placeSpacer(s, cursor, 20); cursor += 1;

  placeTableHeader(s, cursor, 2, ['Etapa','Cantidad','vs paso anterior','Volumen relativo']);
  cursor += 1;

  const rows = [
    ['Leads totales',                '=COUNTA(leads!A2:A)'],
    ['Calificados (score ≥ 41)',    '=COUNTIF(leads!O:O,">=41")'],
    ['Visitas agendadas',            '=COUNTA(visitas!A2:A)'],
    ['En negociacion',               '=COUNTIF(leads!P:P,"Negociación")'],
    ['Cierres del mes',              '=COUNTIFS(leads!P:P,"Cierre",leads!U:U,">="&EOMONTH(TODAY(),-1)+1)']
  ];

  for (let i = 0; i < rows.length; i++) {
    const r = cursor + i;
    s.getRange(r, 2).setValue(rows[i][0]).setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain).setVerticalAlignment('middle');
    s.getRange(r, 3).setFormula(rows[i][1]).setFontFamily(F.title).setFontSize(20).setFontWeight('bold').setFontColor(C.navy).setHorizontalAlignment('left').setVerticalAlignment('middle');
    if (i > 0) {
      s.getRange(r, 4).setFormula('=IFERROR(C' + r + '/C' + (r - 1) + ',0)').setNumberFormat('0.0%').setFontFamily(F.body).setFontSize(11).setFontColor(C.gold).setFontWeight('bold').setVerticalAlignment('middle');
    } else {
      s.getRange(r, 4).setValue('—').setFontColor(C.textMuted).setHorizontalAlignment('center').setVerticalAlignment('middle');
    }
    // Barra horizontal
    s.getRange(r, 5).setFormula('=REPT(CHAR(9608),ROUND(C' + r + '/MAX($C$' + cursor + ':$C$' + (cursor + rows.length - 1) + ')*20,0))')
     .setFontFamily(F.mono).setFontColor(C.gold).setFontSize(10).setVerticalAlignment('middle');

    s.getRange(r, 2, 1, 4).setBackground(C.bg);
    s.getRange(r, 5).setBackground(C.bg);
    s.getRange(r, 2, 1, 4).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(r, 42);
  }
}

// =====================================================================
// RANKING VENDEDORES
// =====================================================================

function buildRanking(ss) {
  let s = ss.getSheetByName('Ranking vendedores'); if (!s) s = ss.insertSheet('Ranking vendedores');
  clearSheet(s);
  s.setTabColor(C.gold);

  s.setColumnWidth(1, 32);
  s.setColumnWidth(2, 50);   // posicion
  s.setColumnWidth(3, 240);  // nombre
  s.setColumnWidth(4, 130);  // visitas
  s.setColumnWidth(5, 110);  // cierres
  s.setColumnWidth(6, 180);  // comisiones
  s.setColumnWidth(7, 32);

  paintCanvas(s, 7, 60);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 5, 'Ranking de vendedores', 'Mes actual · ordenado por comisiones generadas');
  placeSpacer(s, cursor, 20); cursor += 1;

  placeTableHeader(s, cursor, 2, ['#','Vendedor','Visitas','Cierres','Comisiones']);
  cursor += 1;

  // Query
  s.getRange(cursor, 3).setFormula(
    '=QUERY(empleados!A:K,"select B, I, J, K where C = \'vendedor\' and H = TRUE order by K desc",0)'
  );

  // Posicion manual
  for (let i = 0; i < 10; i++) {
    const r = cursor + i;
    s.getRange(r, 2).setFormula('=IF(C' + r + '<>"", ROW()-' + (cursor - 1) + ',"")')
     .setFontFamily(F.title).setFontSize(18).setFontWeight('bold').setFontColor(C.gold)
     .setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 3, 1, 4).setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain).setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 6).setNumberFormat('"USD "#,##0').setFontWeight('bold').setFontColor(C.navy);
    s.getRange(r, 2, 1, 5).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(r, 40);
  }
}

// =====================================================================
// DEMANDA POR BARRIO
// =====================================================================

function buildDemanda(ss) {
  let s = ss.getSheetByName('Demanda por barrio'); if (!s) s = ss.insertSheet('Demanda por barrio');
  clearSheet(s);
  s.setTabColor(C.gold);

  s.setColumnWidth(1, 32);
  s.setColumnWidth(2, 240);  // barrio
  s.setColumnWidth(3, 130);  // consultas
  s.setColumnWidth(4, 280);  // barra
  s.setColumnWidth(5, 32);

  paintCanvas(s, 5, 60);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 3, 'Demanda por barrio', 'Donde estan buscando los clientes · ranking de consultas');
  placeSpacer(s, cursor, 20); cursor += 1;

  placeTableHeader(s, cursor, 2, ['Barrio','Consultas','Volumen relativo']);
  cursor += 1;

  s.getRange(cursor, 2).setFormula(
    '=QUERY(leads!A:V,"select H, count(A) where H is not null and H != \'\' group by H order by count(A) desc",0)'
  );

  for (let i = 0; i < 20; i++) {
    const r = cursor + i;
    s.getRange(r, 2).setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain).setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 3).setFontFamily(F.title).setFontSize(18).setFontWeight('bold').setFontColor(C.navy).setHorizontalAlignment('left').setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 4).setFormula('=IF(C' + r + '<>"",REPT(CHAR(9608),ROUND(C' + r + '/MAX($C$' + cursor + ':$C$' + (cursor + 19) + ')*25,0)),"")')
     .setFontFamily(F.mono).setFontColor(C.gold).setFontSize(11).setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 2, 1, 3).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(r, 36);
  }
}

// =====================================================================
// ALQUILERES
// =====================================================================

function buildAlquileres(ss) {
  let s = ss.getSheetByName('Alquileres'); if (!s) s = ss.insertSheet('Alquileres');
  clearSheet(s);
  s.setTabColor(C.gold);

  // Grid
  s.setColumnWidth(1, 32);
  [2,3,4].forEach(function(c){ s.setColumnWidth(c, 90); });
  s.setColumnWidth(5, 18);
  [6,7,8].forEach(function(c){ s.setColumnWidth(c, 90); });
  s.setColumnWidth(9, 18);
  [10,11,12].forEach(function(c){ s.setColumnWidth(c, 90); });
  s.setColumnWidth(13, 32);

  paintCanvas(s, 14, 80);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 11, 'Alquileres y cobranza', 'Contratos activos, vencimientos y atrasos · 86 contratos');
  placeSpacer(s, cursor, 20); cursor += 1;

  // KPIs
  placeKPI(s, cursor, 2, 3,  'Contratos activos',  '=COUNTIF(contratos!N:N,"activo")', '#,##0', C.success);
  placeKPI(s, cursor, 6, 3,  'Con atraso',         '=COUNTIF(contratos!P:P,">0")',     '#,##0', C.warning);
  placeKPI(s, cursor, 10, 3, 'Morosos',            '=COUNTIF(contratos!N:N,"moroso")', '#,##0', C.danger);
  cursor += 3;

  placeSpacer(s, cursor, 24); cursor += 1;

  placeSectionLabel(s, cursor, 2, 11, 'Detalle por contrato');
  cursor += 1;
  placeSpacer(s, cursor, 10); cursor += 1;

  // Tabla: ajustar columnas para que la tabla quede bien
  s.setColumnWidth(2, 80);   // ID
  s.setColumnWidth(3, 200);  // Direccion
  s.setColumnWidth(4, 180);  // Inquilino
  s.setColumnWidth(5, 110);  // Monto
  s.setColumnWidth(6, 80);   // Moneda
  s.setColumnWidth(7, 100);  // Vence
  s.setColumnWidth(8, 100);  // Atraso
  s.setColumnWidth(9, 130);  // Estado

  placeTableHeader(s, cursor, 2, ['ID','Direccion','Inquilino','Monto','Moneda','Vence dia','Atraso','Estado']);
  cursor += 1;

  s.getRange(cursor, 2).setFormula(
    '=QUERY(contratos!A:P,"select B, D, F, G, H, I, P, N order by P desc, I asc",0)'
  );

  for (let i = 0; i < 30; i++) {
    const r = cursor + i;
    s.getRange(r, 2, 1, 8)
     .setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain)
     .setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 5).setNumberFormat('#,##0').setFontWeight('bold');
    s.getRange(r, 2, 1, 8).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(r, 30);
  }
  s.setFrozenRows(cursor - 1);

  const atrasoRange = s.getRange(cursor, 8, 30, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(1,2).setBackground(C.warningBg).setFontColor(C.warning).setBold(true).setRanges([atrasoRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(3).setBackground(C.dangerBg).setFontColor(C.danger).setBold(true).setRanges([atrasoRange]).build());

  const estadoRange = s.getRange(cursor, 9, 30, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('activo').setBackground(C.successBg).setFontColor(C.success).setBold(true).setRanges([estadoRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('moroso').setBackground(C.dangerBg).setFontColor(C.danger).setBold(true).setRanges([estadoRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// FEED ACTIVIDAD
// =====================================================================

function buildFeed(ss) {
  let s = ss.getSheetByName('Feed de actividad'); if (!s) s = ss.insertSheet('Feed de actividad');
  clearSheet(s);
  s.setTabColor(C.gold);

  s.setColumnWidth(1, 32);
  s.setColumnWidth(2, 160);  // Fecha-hora
  s.setColumnWidth(3, 180);  // Agente
  s.setColumnWidth(4, 200);  // Tipo
  s.setColumnWidth(5, 380);  // Resumen
  s.setColumnWidth(6, 130);  // Resultado
  s.setColumnWidth(7, 130);  // Min ahorrados
  s.setColumnWidth(8, 32);

  paintCanvas(s, 8, 200);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 6, 'Feed de actividad', 'Lo que la IA hizo · mas reciente arriba · ultimas 100 acciones');
  placeSpacer(s, cursor, 20); cursor += 1;

  placeTableHeader(s, cursor, 2, ['Fecha y hora','Agente','Tipo','Resumen','Resultado','Min ahorrados']);
  cursor += 1;

  s.getRange(cursor, 2).setFormula(
    '=QUERY(acciones_ia!A:I,"select I, C, B, F, G, H where I is not null order by I desc limit 100",0)'
  );

  for (let i = 0; i < 100; i++) {
    const r = cursor + i;
    s.getRange(r, 2, 1, 6)
     .setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain)
     .setVerticalAlignment('middle').setBackground(C.bg);
    s.getRange(r, 2, 1, 6).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(r, 30);
  }
  s.setFrozenRows(cursor - 1);

  const resRange = s.getRange(cursor, 6, 100, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ok').setBackground(C.successBg).setFontColor(C.success).setBold(true).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('enviado').setBackground(C.successBg).setFontColor(C.success).setBold(true).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('escalado').setBackground(C.warningBg).setFontColor(C.warning).setBold(true).setRanges([resRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('error').setBackground(C.dangerBg).setFontColor(C.danger).setBold(true).setRanges([resRange]).build());
  s.setConditionalFormatRules(rules);
}

// =====================================================================
// CONFIG
// =====================================================================

function buildConfig(ss) {
  let s = ss.getSheetByName('CONFIG'); if (!s) s = ss.insertSheet('CONFIG');
  clearSheet(s);
  s.setTabColor(C.textMuted);

  s.setColumnWidth(1, 32);
  [2,3,4,5].forEach(function(c){ s.setColumnWidth(c, 180); });
  s.setColumnWidth(6, 18);
  s.setColumnWidth(7, 200);
  s.setColumnWidth(8, 240);
  s.setColumnWidth(9, 32);

  paintCanvas(s, 10, 50);

  placeSpacer(s, 1, 24);
  let cursor = placeTitle(s, 2, 2, 7, 'Configuracion', 'Parametros editables manualmente · validaciones del sistema');
  placeSpacer(s, cursor, 20); cursor += 1;

  // Tabla 1: listas
  placeTableHeader(s, cursor, 2, ['Zonas','Etapas CRM','Tipos propiedad','Operaciones']);
  cursor += 1;

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
  s.getRange(cursor, 2, datos.length, 4).setValues(datos)
   .setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain)
   .setVerticalAlignment('middle').setBackground(C.bg);
  for (let i = 0; i < datos.length; i++) {
    s.getRange(cursor + i, 2, 1, 4).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(cursor + i, 26);
  }

  // Tabla 2: parametros
  placeTableHeader(s, cursor - 1, 7, ['Parametro','Valor']);
  const params = [
    ['Tour base URL','https://bochile.com.ar/tour/'],
    ['Pago base URL','https://bochile.com.ar/pagar/'],
    ['Telefono Carlos','5492914401120'],
    ['Horas humanas mes (base)',200],
    ['Score umbral visita',70],
    ['Score umbral curioso',40]
  ];
  s.getRange(cursor, 7, params.length, 2).setValues(params)
   .setFontFamily(F.body).setFontSize(11).setFontColor(C.textMain)
   .setVerticalAlignment('middle').setBackground(C.bg);
  for (let i = 0; i < params.length; i++) {
    s.getRange(cursor + i, 7, 1, 2).setBorder(null, null, true, null, false, false, C.lineHair, SpreadsheetApp.BorderStyle.SOLID);
    s.setRowHeight(cursor + i, 26);
  }
}

// =====================================================================
// HELPERS
// =====================================================================

function reorderTabs(ss, ordered) {
  for (let i = 0; i < ordered.length; i++) {
    const x = ss.getSheetByName(ordered[i]);
    if (x) { ss.setActiveSheet(x); ss.moveActiveSheet(i + 1); }
  }
}
