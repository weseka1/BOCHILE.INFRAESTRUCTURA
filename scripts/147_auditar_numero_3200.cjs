/**
 * Audita TODAS las tabs del sheet buscando cualquier rastro de
 * numeros que terminen en 3200 (numero personal de Yamil).
 * Reporta donde aparece pero NO BORRA NADA.
 *
 * Tabs auditadas: conversaciones, leads, visitas, contratos, acciones,
 * matches, tareas.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

const TABS = ['conversaciones', 'leads', 'visitas', 'contratos', 'acciones', 'matches', 'tareas'];

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  console.log('\n=== AUDITORIA NUMERO ...3200 ===\n');

  let totalHits = 0;
  for (const tab of TABS) {
    try {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tab}!A:Z`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const rows = r.data.values || [];
      if (rows.length === 0) { console.log(`[${tab}] vacio`); continue; }
      const headers = rows[0].map(h => String(h).trim());

      const hits = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Busca 3200 en CUALQUIER celda, comparando como string
        for (let c = 0; c < row.length; c++) {
          const v = String(row[c] || '');
          if (/3200(?!\d)/.test(v)) { // 3200 que no sea parte de un numero mayor
            hits.push({ row: i + 1, col: headers[c] || `col${c}`, value: v.slice(0, 80) });
            break;
          }
        }
      }

      if (hits.length === 0) {
        console.log(`[${tab}] LIMPIO - 0 hits en ${rows.length - 1} filas`);
      } else {
        console.log(`[${tab}] ${hits.length} HITS:`);
        for (const h of hits.slice(0, 10)) {
          console.log(`  row ${h.row} (${h.col}): "${h.value}"`);
        }
        if (hits.length > 10) console.log(`  ... (${hits.length - 10} mas)`);
        totalHits += hits.length;
      }
    } catch (e) {
      console.log(`[${tab}] error: ${e.message}`);
    }
  }

  console.log(`\n=== TOTAL: ${totalHits} filas con rastro de ...3200 ===`);
  if (totalHits === 0) {
    console.log('OK - el numero personal esta 100% fuera del sheet.\n');
  } else {
    console.log('Hay residuo. Avisame y armo el script de eliminacion.\n');
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
