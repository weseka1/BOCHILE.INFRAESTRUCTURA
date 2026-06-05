/**
 * RECUPERACION URGENTE: las tareas que estaban en "Administrar todas las
 * tareas" estaban duplicadas y Yamil eliminó las 2 instancias.
 * Recreo las 7 tareas que vi en el screenshot, todas con
 * asignado_a = 'marketing_wsk' para que aparezcan en el panel WESEKA.IA.
 * Si alguna era realmente de Bochile, se devuelve desde el panel WESEKA
 * con el boton "Devolver" (cambia asignado_a a vacio).
 *
 * Datos perdidos: descripciones originales, IDs, fechas exactas de creacion.
 * Lo que se conserva: titulo, estado, prioridad inferida, vencimiento inferido.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

// Tareas a recrear (basadas en el screenshot del usuario)
const TAREAS = [
  { titulo: 'ir a casamonte la semana q viene',           estado: 'en_curso',   prioridad: 'media' },
  { titulo: 'aumentar los me gustas en redes (pedido de kars)', estado: 'en_curso',   prioridad: 'media' },
  { titulo: 'asdasdasdasd',                                estado: 'en_curso',   prioridad: 'media', vencimiento: '2026-06-05' },
  { titulo: 'pautar paihuen',                              estado: 'en_curso',   prioridad: 'media' },
  { titulo: 'bot de ventas listo para el finde',           estado: 'completada', prioridad: 'media' },
  { titulo: 'pautar alsina 690 ya subi el reel al ig',     estado: 'completada', prioridad: 'media' },
  { titulo: 'Pautar alsina 690',                           estado: 'completada', prioridad: 'media' },
];

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // Leer headers para mapear correctamente
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'tareas!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = r.data.values || [];
  if (rows.length === 0) {
    console.log('Sheet tareas vacia (sin headers)!');
    process.exit(1);
  }
  const headers = rows[0].map(h => String(h).trim());
  console.log('Headers tareas:', headers.join(' | '));
  console.log(`Filas actuales: ${rows.length - 1}`);

  // Chequeo de duplicados antes de insertar
  const existentes = new Set();
  for (let i = 1; i < rows.length; i++) {
    const idxTit = headers.indexOf('titulo');
    if (idxTit >= 0 && rows[i][idxTit]) existentes.add(String(rows[i][idxTit]).trim().toLowerCase());
  }

  const ahora = new Date().toISOString();
  const filas = [];
  let saltadas = 0;
  for (let i = 0; i < TAREAS.length; i++) {
    const t = TAREAS[i];
    if (existentes.has(t.titulo.trim().toLowerCase())) {
      console.log(`  skip (ya existe): "${t.titulo}"`);
      saltadas++;
      continue;
    }
    const tarea_id = `T-${Date.now()}-${i}`;
    const completada_en = t.estado === 'completada' ? ahora : '';
    const obj = {
      tarea_id,
      titulo: t.titulo,
      descripcion: '',
      prioridad: t.prioridad,
      estado: t.estado,
      asignado_a: 'marketing_wsk',
      vencimiento: t.vencimiento || '',
      creada_en: ahora,
      completada_en,
    };
    // Mapear segun headers
    const row = headers.map(h => {
      const v = obj[h];
      if (v === undefined || v === null) return '';
      return v;
    });
    filas.push(row);
  }

  if (filas.length === 0) {
    console.log(`\nNo hay nada para insertar (todas ya existen). saltadas=${saltadas}`);
    process.exit(0);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'tareas!A:Z',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: filas },
  });

  console.log(`\nOK - recuperadas ${filas.length} tareas en WESEKA.IA (asignado_a=marketing_wsk)`);
  console.log(`Saltadas (ya existian): ${saltadas}`);
  console.log('Revisa /marketing en el dashboard.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
