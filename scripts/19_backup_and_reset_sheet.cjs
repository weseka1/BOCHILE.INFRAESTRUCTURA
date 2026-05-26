// ENTERPRISE Sheet Reset:
// 1. Backup completo de TODAS las pestañas a JSON local con timestamp
// 2. Limpia transaccional: leads, conversaciones, acciones_ia, visitas, matches_pendientes, contratos
// 3. NO toca: propiedades, empleados, feriados_args
// 4. Mantiene headers de cada pestaña
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const KEY_PATH = path.join(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

const TABS_TO_CLEAR = ['leads', 'conversaciones', 'acciones_ia', 'visitas', 'matches_pendientes', 'contratos'];
const TABS_TO_KEEP = ['propiedades', 'empleados', 'feriados_args'];

(async () => {
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1) Backup completo
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const all = meta.data.sheets.map(s => s.properties.title);
  console.log('Pestañas detectadas:', all.join(', '));

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '_sheet_backups', ts);
  fs.mkdirSync(backupDir, { recursive: true });

  for (const tab of all) {
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab });
    const data = r.data.values || [];
    fs.writeFileSync(path.join(backupDir, tab + '.json'), JSON.stringify(data, null, 2));
    console.log('  Backup:', tab, '|', data.length, 'rows');
  }
  console.log('Backup guardado en:', backupDir);

  // 2) Limpiar transaccional (manteniendo headers)
  for (const tab of TABS_TO_CLEAR) {
    if (!all.includes(tab)) { console.log('  SKIP (no existe):', tab); continue; }
    // Get header
    const r = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab + '!1:1' });
    const header = r.data.values?.[0] || [];
    // Clear all data BELOW header (A2:ZZ)
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: tab + '!A2:ZZ' });
    console.log('  CLEARED:', tab, '| header preservado (' + header.length + ' cols)');
  }

  console.log('\nReset completado. Backup en:', backupDir);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
