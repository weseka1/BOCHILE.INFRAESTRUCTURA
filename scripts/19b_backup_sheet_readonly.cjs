// READ-ONLY backup del estado actual del Sheet
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const KEY_PATH = path.join(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const all = meta.data.sheets.map(s => s.properties.title);

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '_sheet_backups', ts);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log('Estado actual del Sheet:');
  for (const tab of all) {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab });
    const data = r.data.values || [];
    fs.writeFileSync(path.join(backupDir, tab + '.json'), JSON.stringify(data, null, 2));
    const rows = Math.max(0, data.length - 1);
    console.log('  ' + tab.padEnd(22) + ' | ' + String(rows).padStart(4) + ' filas (sin contar header)');
  }
  console.log('\nBackup guardado en:', backupDir);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
