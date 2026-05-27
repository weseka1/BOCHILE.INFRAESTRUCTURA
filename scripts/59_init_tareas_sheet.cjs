// Crea la pestana "tareas" en el Google Sheet de Bochile + headers en fila 1.
// Idempotente: si la pestana ya existe, no falla.
//
// USO: node scripts/59_init_tareas_sheet.cjs

const fs = require('node:fs');
const path = require('node:path');

const HEADERS = [
  'tarea_id',
  'titulo',
  'descripcion',
  'prioridad',
  'estado',
  'asignado_a',
  'vencimiento',
  'creada_en',
  'completada_en',
];

(async () => {
  const { google } = require(path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

  // Cargar service account JSON desde apps/dashboard-api
  const credsPath = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');
  const envPath = path.resolve(__dirname, '..', 'apps', 'dashboard-api', '.env');

  let creds = null;
  let sheetId = null;

  if (fs.existsSync(credsPath)) {
    creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  }
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    const m1 = env.match(/^SHEET_ID=(.+)$/m);
    if (m1) sheetId = m1[1].trim().replace(/^["']|["']$/g, '');
    if (!creds) {
      const m2 = env.match(/^GOOGLE_SHEETS_CREDS_JSON=(.+)$/m);
      if (m2) {
        try { creds = JSON.parse(m2[1].replace(/^["']|["']$/g, '')); } catch {}
      }
    }
  }

  if (!creds) { console.error('No encuentro credenciales (apps/dashboard-api/credentials/service-account.json o GOOGLE_SHEETS_CREDS_JSON en .env)'); process.exit(1); }
  if (!sheetId) { console.error('No encuentro SHEET_ID en apps/dashboard-api/.env'); process.exit(1); }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Ver si la pestana ya existe
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const exists = (meta.data.sheets || []).some(s => s.properties && s.properties.title === 'tareas');

  if (!exists) {
    console.log('Creando pestana "tareas"...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'tareas', gridProperties: { rowCount: 1000, columnCount: HEADERS.length } } } }],
      },
    });
    console.log('  Pestana creada');
  } else {
    console.log('Pestana "tareas" ya existe');
  }

  // 2. Verificar headers en fila 1 (si esta vacia los escribimos)
  const cur = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'tareas!1:1',
  });
  const curRow = cur.data.values?.[0] || [];

  if (curRow.length === 0) {
    console.log('Escribiendo headers en fila 1...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'tareas!A1:I1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
    console.log('  Headers escritos:', HEADERS.join(' | '));
  } else {
    console.log('Headers ya presentes:', curRow.join(' | '));
    // Verificar que esten todos los que necesitamos
    const missing = HEADERS.filter(h => !curRow.includes(h));
    if (missing.length > 0) {
      console.log('  WARNING: faltan columnas:', missing.join(', '));
      console.log('  Tenes que agregarlas manualmente al final.');
    }
  }

  console.log('\nLISTO. Probar:');
  console.log('  curl http://localhost:3002/api/tareas');
  console.log('  curl -X POST http://localhost:3002/api/tareas -H "Content-Type: application/json" -d \'{"titulo":"Prueba","prioridad":"alta"}\'');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
