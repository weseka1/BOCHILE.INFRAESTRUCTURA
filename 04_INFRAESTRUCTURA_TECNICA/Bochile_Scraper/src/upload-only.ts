/**
 * Upload del output/properties.json existente al Sheet, sin re-scrapear.
 * Util para iterar el shape del Sheet sin pegarle de nuevo a bochile.com.
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uploadToSheet } from './sheets-uploader.js';
import type { Property } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const jsonPath = path.join(PROJECT_ROOT, 'output', 'properties.json');
const raw = await fs.readFile(jsonPath, 'utf-8');
const properties = JSON.parse(raw) as Property[];

console.log(`[upload-only] ${properties.length} propiedades desde ${jsonPath}`);

const credentialsPath = path.resolve(
  PROJECT_ROOT,
  '../../05_DASHBOARD_WEB/backend/credentials/service-account.json',
);
const sheetId =
  process.env.BOCHILE_SHEET_ID ?? '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const tab = process.env.BOCHILE_SHEET_TAB ?? 'propiedades';

await uploadToSheet({
  credentialsPath,
  sheetId,
  tab,
  properties,
});
