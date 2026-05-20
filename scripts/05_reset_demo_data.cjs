// Limpia TODAS las tablas demo del Sheet, dejando solo:
// - propiedades (reales del scraper)
// - empleados (vendedores con config)
// - feriados_args (feriados ARG 2026)
const { google } = require('googleapis');
const path = require('node:path');

const SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const KEY_PATH = path.resolve('./credentials/service-account.json');

// Pestañas a borrar (mantener solo el header)
const TABS_TO_CLEAR = ['conversaciones', 'visitas', 'leads', 'acciones_ia', 'matches_pendientes', 'contratos'];

(async()=>{
  const auth = new google.auth.GoogleAuth({ keyFile: KEY_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });

  for (const tab of TABS_TO_CLEAR) {
    const sheetMeta = meta.data.sheets.find(s => s.properties.title === tab);
    if (!sheetMeta) { console.log('  [skip] ' + tab + ': no existe'); continue; }
    const sheetId = sheetMeta.properties.sheetId;

    // Leer cuantas filas hay
    const get = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab });
    const rows = get.data.values || [];
    if (rows.length <= 1) { console.log('  [ok] ' + tab + ': ya estaba limpia (' + rows.length + ' filas)'); continue; }

    // Borrar todas las filas excepto la 1 (header)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: rows.length }
          }
        }]
      }
    });
    console.log('  [clean] ' + tab + ': borradas ' + (rows.length - 1) + ' filas demo');
  }

  console.log('\nLISTO. Sistema arranca con:');
  console.log('  - propiedades: catalogo real (intacto)');
  console.log('  - empleados: vendedores con config (intacto)');
  console.log('  - feriados_args: feriados ARG 2026 (intacto)');
  console.log('  - leads/conversaciones/visitas/etc: VACIAS (listas para clientes reales)');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
