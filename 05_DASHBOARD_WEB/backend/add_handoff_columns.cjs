// Agrega columnas necesarias para human handoff + conversation close al Sheet leads.
//   - bot_pausado_hasta (timestamp ISO)
//   - ultimo_humano_respondio (timestamp ISO)
//   - conversacion_cerrada (bool string "true"/"false")
const { google } = require('googleapis');
const path = require('node:path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const TAB = 'leads';
const NEW_COLS = ['bot_pausado_hasta', 'ultimo_humano_respondio', 'conversacion_cerrada'];
const KEY_PATH = path.resolve('./credentials/service-account.json');

(async()=>{
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const get = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: TAB + '!1:1' });
  const header = get.data.values?.[0] || [];
  console.log('Header actual leads:', header);

  const toAdd = NEW_COLS.filter(c => !header.includes(c));
  if (toAdd.length === 0) { console.log('Ya estan todas las columnas'); return; }

  console.log('Agregando:', toAdd);
  const newHeader = header.concat(toAdd);

  // Update first row con header nuevo
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: TAB + '!1:1',
    valueInputOption: 'RAW',
    resource: { values: [newHeader] }
  });

  console.log('Header actualizado. Nuevas columnas en posicion:');
  for (const c of toAdd) console.log('  ' + c + ' -> col index ' + newHeader.indexOf(c));
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
