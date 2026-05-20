/**
 * Dedupe utility para el Sheet maestro de Bochile.
 *
 * Detecta duplicados por ID natural en cada pestania (empleado_id, contrato_id,
 * msg_id, accion_id, lead_id, prop_id, visita_id, match_id) y reescribe la
 * pestania conservando solo la PRIMERA aparicion de cada ID.
 *
 * Uso:
 *   npx tsx src/tools/dedupe-sheet.ts --dry-run    # solo reporta, no toca
 *   npx tsx src/tools/dedupe-sheet.ts               # aplica limpieza
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS y SHEET_ID seteados en .env.
 */
import 'dotenv/config';
import { google } from 'googleapis';
import { config } from '../config.js';

type TabConfig = { tab: string; idColumn: string };

const TABS: TabConfig[] = [
  { tab: 'leads', idColumn: 'lead_id' },
  { tab: 'propiedades', idColumn: 'prop_id' },
  { tab: 'visitas', idColumn: 'visita_id' },
  { tab: 'contratos', idColumn: 'contrato_id' },
  { tab: 'empleados', idColumn: 'empleado_id' },
  { tab: 'matches_pendientes', idColumn: 'match_id' },
  { tab: 'conversaciones', idColumn: 'msg_id' },
  { tab: 'acciones_ia', idColumn: 'accion_id' },
];

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const auth = new google.auth.GoogleAuth({
    ...config.googleCreds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client as never });

  console.log(`[dedupe] modo: ${DRY_RUN ? 'DRY-RUN (no se escribe)' : 'APPLY (se reescribe)'}`);
  console.log(`[dedupe] sheet: ${config.sheetId}`);
  console.log('');

  for (const { tab, idColumn } of TABS) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `${tab}!A:ZZ`,
      });
      const rows = res.data.values ?? [];
      if (rows.length === 0) {
        console.log(`[${tab}] vacio, skip`);
        continue;
      }
      const [headers, ...data] = rows;
      const idIdx = headers!.indexOf(idColumn);
      if (idIdx === -1) {
        console.log(`[${tab}] columna ${idColumn} no encontrada en headers, skip`);
        continue;
      }
      const seen = new Set<string>();
      const dedup: string[][] = [];
      let emptyId = 0;
      for (const row of data) {
        const id = String(row[idIdx] ?? '').trim();
        if (!id) {
          emptyId++;
          continue;
        }
        if (seen.has(id)) continue;
        seen.add(id);
        dedup.push(row);
      }
      const removed = data.length - dedup.length;
      console.log(
        `[${tab}] ${data.length} filas → ${dedup.length} unicas | ${removed} eliminadas (${emptyId} sin id)`,
      );

      if (!DRY_RUN && removed > 0) {
        // 1. Limpiar la pestania
        await sheets.spreadsheets.values.clear({
          spreadsheetId: config.sheetId,
          range: `${tab}!A:ZZ`,
        });
        // 2. Reescribir headers + dedup
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.sheetId,
          range: `${tab}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers!, ...dedup] },
        });
        console.log(`  → reescrito (${dedup.length + 1} filas incl. headers)`);
      }
    } catch (err) {
      console.error(`[${tab}] error: ${(err as Error).message}`);
    }
  }

  console.log('');
  console.log('[dedupe] listo');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
