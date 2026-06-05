/**
 * Marca a "Maximiliano Bochile" (E-1) como activo=FALSE en el sheet de
 * empleados. NO ELIMINA LA FILA - solo actualiza la columna `activo`.
 * El dashboard ya filtra empleados con activo=false, asi que dejara de
 * verse en leaderboards y selects sin perder el registro historico.
 *
 * Si Camila quiere reactivarlo despues, basta con poner activo=TRUE.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');
const TARGET_ID = 'E-1';
const TARGET_NOMBRE = 'Maximiliano Bochile';

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // 1. Leer empleados para ubicar fila y columna activo
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'empleados!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = r.data.values || [];
  const headers = rows[0].map(h => String(h).trim());
  const colActivo = headers.indexOf('activo');
  const colId = headers.indexOf('empleado_id');
  const colNombre = headers.indexOf('nombre');
  if (colActivo < 0 || colId < 0) { throw new Error('No encuentro col activo o empleado_id'); }

  let targetRow = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][colId]).trim() === TARGET_ID && String(rows[i][colNombre]).trim() === TARGET_NOMBRE) {
      targetRow = i + 1; // sheets es 1-indexed
      break;
    }
  }
  if (targetRow < 0) {
    console.log('No encontre la fila objetivo. Aborto sin tocar nada.');
    process.exit(0);
  }

  // Verificar estado actual
  const currentActivo = rows[targetRow - 1][colActivo];
  console.log(`Fila objetivo: ${targetRow}`);
  console.log(`  empleado_id: ${rows[targetRow - 1][colId]}`);
  console.log(`  nombre: ${rows[targetRow - 1][colNombre]}`);
  console.log(`  activo (antes): ${currentActivo}`);

  if (currentActivo === false || currentActivo === 'false' || currentActivo === 'FALSE') {
    console.log('Ya estaba inactivo. No hago nada.');
    process.exit(0);
  }

  // 2. Calcular notacion A1 de la celda
  const colLetra = String.fromCharCode('A'.charCodeAt(0) + colActivo);
  const cellRange = `empleados!${colLetra}${targetRow}`;
  console.log(`  Actualizando celda: ${cellRange}`);

  // 3. Update con valor false (boolean)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: cellRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['FALSE']] },
  });

  console.log('\nOK - empleado demo marcado como inactivo.');
  console.log('El dashboard dejara de mostrarlo en leaderboards.');
  console.log('La fila NO se elimino - si necesitas reactivarlo, poner activo=TRUE.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
