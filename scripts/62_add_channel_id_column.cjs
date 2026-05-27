// Agrega columna 'channel_id' al final de la pestana 'conversaciones'.
// Idempotente: si ya existe, no hace nada.
//
// Necesario para separar conversaciones por canal (Ventas 506217 vs Alquileres 508045).

const fs = require('node:fs');
const path = require('node:path');

const TAB = 'conversaciones';
const NEW_COLUMN = 'channel_id';

(async () => {
  const { google } = require(path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

  const credsPath = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');
  const envPath = path.resolve(__dirname, '..', 'apps', 'dashboard-api', '.env');

  let creds = null;
  let sheetId = null;

  if (fs.existsSync(credsPath)) creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const m = env.match(/^SHEET_ID=(.+)$/m);
    if (m) sheetId = m[1].trim().replace(/^["']|["']$/g, '');
    if (!creds) {
      const m2 = env.match(/^GOOGLE_SHEETS_CREDS_JSON=(.+)$/m);
      if (m2) try { creds = JSON.parse(m2[1].replace(/^["']|["']$/g, '')); } catch {}
    }
  }

  if (!creds || !sheetId) { console.error('Falta credentials o SHEET_ID'); process.exit(1); }

  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Headers actuales
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!1:1` });
  const headers = cur.data.values?.[0] || [];
  console.log(`Headers actuales (${headers.length}):`, headers.join(' | '));

  if (headers.includes(NEW_COLUMN)) {
    console.log(`\nℹ️  Columna "${NEW_COLUMN}" ya existe en posicion ${headers.indexOf(NEW_COLUMN) + 1}. Nada que hacer.`);
    return;
  }

  // 2. Agregar columna al final
  const newColPos = headers.length + 1; // 1-indexed
  const newColLetter = colNumToLetter(newColPos);
  const newHeaders = [...headers, NEW_COLUMN];

  console.log(`\nAgregando columna "${NEW_COLUMN}" en posicion ${newColPos} (${newColLetter})...`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${TAB}!${newColLetter}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[NEW_COLUMN]] },
  });

  console.log(`✅ Columna "${NEW_COLUMN}" agregada en ${TAB}!${newColLetter}1`);
  console.log('   Las filas existentes quedan con valor vacio (compatible con codigo viejo).');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

function colNumToLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
