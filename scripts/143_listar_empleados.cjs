/**
 * Lista todos los empleados del sheet con un flag heuristico de "demo".
 * Marca como demo: apellido = "Bochile" (nombre empresa), nombre que contenga
 * "test", "demo", "prueba", o si comisiones_mes === 0 y visitas_mes === 0 y
 * cierres_mes === 0 (sin actividad).
 *
 * NO MODIFICA NADA. Solo lee.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'empleados!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = r.data.values || [];
  if (rows.length === 0) { console.log('(sin filas)'); return; }
  const headers = rows[0].map(h => String(h).trim());
  const records = rows.slice(1).map((row, idx) => {
    const o = { _rowIndex: idx + 2 }; // numero de fila real (1-indexed + header)
    headers.forEach((h, i) => { o[h] = row[i]; });
    return o;
  });

  console.log(`\n=== EMPLEADOS EN SHEET (${records.length} filas) ===\n`);
  console.log('row | empleado_id            | nombre                       | rol           | visitas | cierres | comis | activo | DEMO?');
  console.log('----+------------------------+------------------------------+---------------+---------+---------+-------+--------+-------');
  for (const e of records) {
    const nombre = String(e.nombre || '');
    const apellidoEsEmpresa = /\bbochile\b/i.test(nombre);
    const palabraTest = /\b(test|demo|prueba|ejemplo|sample|dummy)\b/i.test(nombre) || /\b(test|demo|prueba|ejemplo|sample|dummy)\b/i.test(String(e.empleado_id || ''));
    const sinActividad = !Number(e.visitas_mes) && !Number(e.cierres_mes) && !Number(e.comisiones_mes);
    const esDemo = apellidoEsEmpresa || palabraTest;
    const flags = [];
    if (apellidoEsEmpresa) flags.push('apellido=empresa');
    if (palabraTest) flags.push('keyword');
    if (sinActividad) flags.push('sin_actividad');
    console.log(
      String(e._rowIndex).padStart(3) + ' | ' +
      String(e.empleado_id || '').padEnd(22) + ' | ' +
      nombre.padEnd(28) + ' | ' +
      String(e.rol || '').padEnd(13) + ' | ' +
      String(e.visitas_mes || 0).padStart(7) + ' | ' +
      String(e.cierres_mes || 0).padStart(7) + ' | ' +
      String(e.comisiones_mes || 0).padStart(5) + ' | ' +
      String(e.activo === false ? 'false' : 'true').padEnd(6) + ' | ' +
      (esDemo ? `DEMO (${flags.join(',')})` : (sinActividad ? `dudoso (${flags.join(',')})` : '-')),
    );
  }
  console.log('\n');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
