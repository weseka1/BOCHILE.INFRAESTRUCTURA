// Backfill: completa channel_id = '506217' (Ventas) en TODAS las filas de
// 'conversaciones' que tienen channel_id vacio.
//
// Justificacion: el WA de Alquileres se creo despues. Todos los mensajes
// historicos vienen del WA Ventas. Cuando se agrego la columna channel_id,
// quedaron en blanco hasta que el lead vuelva a escribir.
//
// Idempotente: no toca filas que ya tienen channel_id.

const fs = require('node:fs');
const path = require('node:path');

const TAB = 'conversaciones';
const VENTAS_ID = '506217';

(async () => {
  const { google } = require(path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

  const credsPath = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');
  const envPath = path.resolve(__dirname, '..', 'apps', 'dashboard-api', '.env');

  let creds = null, sheetId = null;
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

  // 1. Leer toda la pestana
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A:ZZ` });
  const rows = res.data.values || [];
  if (rows.length === 0) { console.log('Pestana vacia'); return; }

  const headers = rows[0];
  const channelIdx = headers.indexOf('channel_id');
  if (channelIdx === -1) {
    console.error('Columna channel_id no existe. Corre scripts/62 primero.');
    process.exit(1);
  }

  // 2. Identificar filas que necesitan backfill
  const toUpdate = []; // { rowIdx1, currentChannel }
  for (let i = 1; i < rows.length; i++) {
    const cur = String(rows[i]?.[channelIdx] ?? '').trim();
    if (!cur) toUpdate.push({ rowIdx1: i + 1, currentChannel: cur });
  }

  console.log(`Total filas: ${rows.length - 1}`);
  console.log(`Sin channel_id: ${toUpdate.length}`);
  console.log(`Con channel_id ya: ${rows.length - 1 - toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log('\n✅ Nada que backfillear. Todas las filas tienen channel_id.');
    return;
  }

  // 3. Hacer batch update: poner '506217' en cada fila identificada, columna channel_id
  // colLetter para channel_id
  const colLetter = colNumToLetter(channelIdx + 1);
  const dataUpdates = toUpdate.map(({ rowIdx1 }) => ({
    range: `${TAB}!${colLetter}${rowIdx1}`,
    values: [[VENTAS_ID]],
  }));

  console.log(`\nBackfilling ${dataUpdates.length} celdas con channel_id="${VENTAS_ID}" (Ventas)...`);

  // batchUpdate en grupos de 100 (limites de la API)
  const BATCH = 100;
  for (let i = 0; i < dataUpdates.length; i += BATCH) {
    const chunk = dataUpdates.slice(i, i + BATCH);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: chunk,
      },
    });
    console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${chunk.length} celdas actualizadas`);
  }

  console.log(`\n✅ Backfill completado: ${toUpdate.length} mensajes ahora son Ventas (506217).`);
  console.log('   El tab "Ventas" del dashboard ahora muestra el historial completo.');
  console.log('   El tab "Sin clasificar" debe quedar en 0.');
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
