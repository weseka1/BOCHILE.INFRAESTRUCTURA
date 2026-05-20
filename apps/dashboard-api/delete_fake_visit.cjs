// Borra la visita fake V-1779119646492 del Sheet pestania 'visitas'.
const { google } = require('googleapis');
const path = require('node:path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const TAB = 'visitas';
const FAKE_VISITA_ID = 'V-1779119646492';
const KEY_PATH = path.resolve('./credentials/service-account.json');

(async()=>{
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1) Leer todas las filas de visitas
  const get = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: TAB });
  const rows = get.data.values || [];
  console.log('Filas en visitas:', rows.length);
  if (rows.length === 0) { console.log('Sin filas, nada que borrar'); return; }
  const header = rows[0];
  const visitaIdCol = header.indexOf('visita_id');
  console.log('Columna visita_id:', visitaIdCol);

  // 2) Encontrar la fila fake (rowIndex es 0-based pero sheets es 1-based, header en 1)
  let rowToDelete = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][visitaIdCol] || '') === FAKE_VISITA_ID) {
      rowToDelete = i + 1; // 1-based + offset por header
      console.log('Encontrada fake en fila Sheets:', rowToDelete);
      break;
    }
  }

  if (rowToDelete === -1) {
    console.log('No se encontro la visita fake. Posiblemente ya fue borrada.');
    return;
  }

  // 3) Obtener sheetId numerico de la pestania
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tab = meta.data.sheets.find(s => s.properties.title === TAB);
  const sheetId = tab.properties.sheetId;
  console.log('SheetId numerico de visitas:', sheetId);

  // 4) DeleteDimension request
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowToDelete - 1, // 0-based
              endIndex: rowToDelete
            }
          }
        }
      ]
    }
  });
  console.log('Fila borrada exitosamente');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
