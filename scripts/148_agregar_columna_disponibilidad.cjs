/**
 * Agrega la columna `disponibilidad` al sheet `empleados` si no existe.
 * Setea a todos los empleados existentes con valor default 'libre'.
 *
 * Valores soportados: 'libre' | 'ocupado' | 'fuera'
 * - libre   = disponible para tomar visita o llamado
 * - ocupado = en visita / con cliente
 * - fuera   = fuera del horario / no disponible
 *
 * Idempotente: si la columna ya existe, no hace nada.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

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
  if (rows.length === 0) { console.log('(empleados vacio)'); return; }
  const headers = rows[0].map(h => String(h).trim());
  console.log('Headers actuales:', headers.join(' | '));

  let colIdx = headers.indexOf('disponibilidad');
  let needAddHeader = false;
  if (colIdx < 0) {
    colIdx = headers.length;
    needAddHeader = true;
    console.log(`Columna "disponibilidad" NO existe. Sera col ${colToLetter(colIdx)}.`);
  } else {
    console.log(`Columna "disponibilidad" ya existe en col ${colToLetter(colIdx)}.`);
  }

  const colLetter = colToLetter(colIdx);

  // 1. Si no hay header, ponerlo
  const updates = [];
  if (needAddHeader) {
    updates.push({
      range: `empleados!${colLetter}1`,
      values: [['disponibilidad']],
    });
  }
  // 2. Para cada fila de empleado, si esta vacia setear 'libre'
  for (let i = 1; i < rows.length; i++) {
    const current = rows[i][colIdx];
    if (current == null || current === '') {
      updates.push({
        range: `empleados!${colLetter}${i + 1}`,
        values: [['libre']],
      });
    }
  }

  if (updates.length === 0) {
    console.log('Nada que actualizar - ya estaba todo seteado.');
    return;
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates,
    },
  });
  console.log(`OK - ${updates.length} celdas escritas (header + defaults 'libre' donde corresponda).`);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
