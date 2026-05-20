// Borra TODAS las conversaciones y visitas del telefono de Juani (5492915512515)
// para arrancar limpio sin contexto viejo confuso.
const { google } = require('googleapis');
const path = require('node:path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const TELEFONO = '5492915512515';
const KEY_PATH = path.resolve('./credentials/service-account.json');

async function deleteRowsWhere(sheets, tab, columnIndex, valueMatchFn) {
  const get = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab });
  const rows = get.data.values || [];
  if (rows.length <= 1) { console.log('  ' + tab + ': sin filas');return 0; }
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheetMeta = meta.data.sheets.find(s => s.properties.title === tab);
  const sheetId = sheetMeta.properties.sheetId;

  // Recorrer al reves para no romper indices al borrar
  const requests = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    if (valueMatchFn(String(rows[i][columnIndex] || ''))) {
      requests.push({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 }
        }
      });
    }
  }
  if (requests.length === 0) { console.log('  ' + tab + ': nada que borrar'); return 0; }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, resource: { requests } });
  console.log('  ' + tab + ': ' + requests.length + ' filas borradas');
  return requests.length;
}

(async()=>{
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // CONVERSACIONES: borrar por telefono
  console.log('Borrando conversaciones de', TELEFONO);
  const get1 = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'conversaciones!1:1' });
  const header1 = get1.data.values[0];
  const telColIdx = header1.indexOf('telefono');
  await deleteRowsWhere(sheets, 'conversaciones', telColIdx, v => v === TELEFONO || v === '+' + TELEFONO);

  // VISITAS: borrar todas (estan corruptas)
  console.log('Borrando TODAS las visitas (estaban corruptas)');
  const get2 = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'visitas!1:1' });
  const header2 = get2.data.values[0];
  await deleteRowsWhere(sheets, 'visitas', 0, v => v.length > 0);

  // LEADS: borrar el lead L-2915512515 (Juani) para que arranque desde cero
  console.log('Borrando lead L-2915512515 (Juani)');
  const get3 = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'leads!1:1' });
  const header3 = get3.data.values[0];
  const leadIdCol = header3.indexOf('lead_id');
  await deleteRowsWhere(sheets, 'leads', leadIdCol, v => v === 'L-2915512515');

  // ACCIONES_IA: borrar las del telefono
  console.log('Borrando acciones IA viejas');
  try {
    const get4 = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'acciones_ia!1:1' });
    const header4 = get4.data.values[0];
    const leadCol = header4.indexOf('lead_id');
    if (leadCol >= 0) await deleteRowsWhere(sheets, 'acciones_ia', leadCol, v => v === 'L-2915512515');
  } catch(e) { console.log('  acciones_ia: ' + e.message); }

  // MATCHES_PENDIENTES
  console.log('Borrando matches pendientes');
  try {
    const get5 = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'matches_pendientes!1:1' });
    const header5 = get5.data.values[0];
    const leadCol5 = header5.indexOf('lead_id');
    if (leadCol5 >= 0) await deleteRowsWhere(sheets, 'matches_pendientes', leadCol5, v => v === 'L-2915512515');
  } catch(e) { console.log('  matches_pendientes: ' + e.message); }

  console.log('LISTO. Sheet limpio para arrancar.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
