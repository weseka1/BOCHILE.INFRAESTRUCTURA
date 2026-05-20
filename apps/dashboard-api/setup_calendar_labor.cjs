// BLOQUE D Setup:
// 1. Agregar columnas a empleados: vacacion_desde, vacacion_hasta, max_visitas_dia, horario_inicio, horario_fin, dias_laborales
// 2. Crear pestaña feriados_args con feriados ARG 2026
const { google } = require('googleapis');
const path = require('node:path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const KEY_PATH = path.resolve('./credentials/service-account.json');

const FERIADOS_2026 = [
  ['2026-01-01', 'Año Nuevo'],
  ['2026-02-16', 'Carnaval'],
  ['2026-02-17', 'Carnaval'],
  ['2026-03-24', 'Día de la Memoria'],
  ['2026-04-02', 'Día del Veterano'],
  ['2026-04-03', 'Viernes Santo'],
  ['2026-05-01', 'Día del Trabajador'],
  ['2026-05-25', 'Día de la Revolución de Mayo'],
  ['2026-06-15', 'Paso a la Inmortalidad Güemes (trasladado)'],
  ['2026-06-20', 'Día de la Bandera'],
  ['2026-07-09', 'Día de la Independencia'],
  ['2026-08-17', 'Paso a la Inmortalidad San Martín'],
  ['2026-10-12', 'Día del Respeto a la Diversidad Cultural'],
  ['2026-11-23', 'Día de la Soberanía Nacional (trasladado)'],
  ['2026-12-08', 'Día de la Inmaculada Concepción'],
  ['2026-12-25', 'Navidad'],
];

(async()=>{
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1) Columnas empleados
  const NEW_COLS = ['vacacion_desde', 'vacacion_hasta', 'max_visitas_dia', 'horario_inicio', 'horario_fin', 'dias_laborales'];
  const get = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'empleados!1:1' });
  const header = get.data.values?.[0] || [];
  console.log('Header empleados actual:', header.length, 'cols');
  const toAdd = NEW_COLS.filter(c => !header.includes(c));
  if (toAdd.length > 0) {
    const newHeader = header.concat(toAdd);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'empleados!1:1',
      valueInputOption: 'RAW',
      resource: { values: [newHeader] }
    });
    console.log('Agregadas columnas empleados:', toAdd);
  } else {
    console.log('Columnas empleados ya estaban');
  }

  // 2) Verificar/crear pestaña feriados_args
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.find(s => s.properties.title === 'feriados_args');
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { requests: [{ addSheet: { properties: { title: 'feriados_args' } } }] }
    });
    console.log('Pestaña feriados_args creada');
  } else {
    console.log('Pestaña feriados_args ya existia');
  }

  // 3) Escribir header + feriados (sobrescribe)
  const rows = [['fecha', 'nombre'], ...FERIADOS_2026];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'feriados_args!A1',
    valueInputOption: 'RAW',
    resource: { values: rows }
  });
  console.log('Feriados 2026 cargados:', FERIADOS_2026.length);

  // 4) Defaults para empleados existentes (rellenar horarios y dias_laborales)
  const empGet = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'empleados' });
  const empRows = empGet.data.values || [];
  if (empRows.length > 1) {
    const newHeader = empRows[0];
    const idxHorIni = newHeader.indexOf('horario_inicio');
    const idxHorFin = newHeader.indexOf('horario_fin');
    const idxDias = newHeader.indexOf('dias_laborales');
    const idxMax = newHeader.indexOf('max_visitas_dia');

    for (let i = 1; i < empRows.length; i++) {
      const row = empRows[i];
      // Extend row hasta el tamaño del header
      while (row.length < newHeader.length) row.push('');
      // Aplicar defaults si están vacíos
      if (!row[idxHorIni]) row[idxHorIni] = '09:00';
      if (!row[idxHorFin]) row[idxHorFin] = '19:00';
      if (!row[idxDias]) row[idxDias] = 'L,M,X,J,V,S';
      if (!row[idxMax]) row[idxMax] = '4';
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'empleados!A1',
      valueInputOption: 'RAW',
      resource: { values: empRows }
    });
    console.log('Defaults aplicados a', empRows.length - 1, 'empleados');
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
