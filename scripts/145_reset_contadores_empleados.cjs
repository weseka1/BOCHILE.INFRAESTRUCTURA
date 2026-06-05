/**
 * Pone en 0 los campos visitas_mes, cierres_mes y comisiones_mes para
 * los empleados E-1 (Maximiliano Bochile, demo) y E-2 (Camila Pomerich).
 *
 * Los numeros que mostraba el dashboard venian de datos seed/demo del
 * sheet. Yamil quiere que arranquen en 0 y los empleados los carguen
 * a medida que ocurran visitas y cierres reales.
 *
 * NO ELIMINA filas - solo updates de columnas.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');
const TARGETS = ['E-1', 'E-2'];
const CAMPOS_RESET = ['visitas_mes', 'cierres_mes', 'comisiones_mes'];

function colToLetter(n) {
  let s = '';
  while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'empleados!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = r.data.values || [];
  const headers = rows[0].map(h => String(h).trim());

  const colId = headers.indexOf('empleado_id');
  const colIdxs = {};
  for (const k of CAMPOS_RESET) {
    const c = headers.indexOf(k);
    if (c < 0) throw new Error(`No encuentro columna ${k}`);
    colIdxs[k] = c;
  }

  const updates = [];
  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][colId]).trim();
    if (!TARGETS.includes(id)) continue;
    const rowNum = i + 1;
    for (const k of CAMPOS_RESET) {
      const before = rows[i][colIdxs[k]];
      updates.push({
        range: `empleados!${colToLetter(colIdxs[k])}${rowNum}`,
        values: [[0]],
        debug: `${id} ${k} (era: ${before})`,
      });
    }
  }

  if (updates.length === 0) {
    console.log('No encontre empleados objetivo. No hago nada.');
    process.exit(0);
  }

  console.log('Voy a setear a 0:');
  for (const u of updates) console.log(`  ${u.range}  <- 0   [${u.debug}]`);
  console.log('');

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map(u => ({ range: u.range, values: u.values })),
    },
  });

  console.log(`OK - ${updates.length} celdas reseteadas a 0`);
  console.log('Camila puede cargar los valores reales desde /empleados (drawer del empleado)');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
