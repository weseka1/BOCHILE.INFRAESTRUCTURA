/**
 * Sube el catalogo enriquecido (properties-enriched.json del enricher) al
 * Google Sheet maestro de Bochile, reemplazando la pestania `propiedades`.
 *
 * Diferencias vs el sheets-uploader del scraper:
 *  - Usa los campos enriquecidos (barrio_extracted, resumen, address LLM)
 *  - Suma columnas: barrio_enriched (separado del barrio por slug), resumen
 *  - Mismo SA que el dashboard
 *
 * Uso:
 *   npx tsx src/upload-enriched-to-sheet.ts                  # full upload
 *   npx tsx src/upload-enriched-to-sheet.ts --dry-run        # preview
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { config } from './config.js';

const DRY_RUN = process.argv.includes('--dry-run');

const SHEET_ID = process.env.BOCHILE_SHEET_ID ?? '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const TAB = process.env.BOCHILE_SHEET_TAB ?? 'propiedades';
// El SA del dashboard ya tiene Viewer/Editor del Sheet
const CREDENTIALS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  '../../05_DASHBOARD_WEB/backend/credentials/service-account.json';

type Property = {
  id: string;
  url: string;
  slug: string;
  title: string;
  operation: 'sale' | 'rent' | 'other' | null;
  property_type: string | null;
  price: number | null;
  price_currency: string | null;
  price_text: string;
  description: string;
  location: { name: string | null; url: string | null };
  address: string | null;
  attributes: {
    area_m2?: number | null;
    lot_size_m2?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    year_built?: number | null;
  };
  features: string[];
  images: string[];
  image_main: string | null;
  modified_at: string | null;
  scraped_at: string;
  enriched_at?: string;
  barrio_extracted?: string | null;
  resumen?: string | null;
};

const HEADERS = [
  'prop_id',
  'titulo',
  'url',
  'operacion',
  'tipo',
  'zona',
  'barrio',
  'direccion',
  'precio',
  'moneda',
  'precio_texto',
  'ambientes',
  'banos',
  'superficie_cubierta',
  'superficie_total',
  'foto_principal',
  'imagenes_total',
  'descripcion',
  'resumen',
  'features',
  'publicada',
  'enriched_at',
  'fecha_alta',
  'fecha_modificacion',
  'scraped_at',
];

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

async function main() {
  const scraperJsonPath = path.resolve(config.scraperOutputJson);
  const enrichedPath = path.join(path.dirname(scraperJsonPath), 'properties-enriched.json');

  console.log(`[upload-enriched] leyendo ${enrichedPath}`);
  const props: Property[] = JSON.parse(await fs.readFile(enrichedPath, 'utf-8'));
  const sorted = [...props].sort((a, b) => a.id.localeCompare(b.id));
  console.log(`[upload-enriched] ${sorted.length} propiedades`);

  const rows: (string | number)[][] = [HEADERS];
  for (const p of sorted) {
    rows.push([
      p.id,
      p.title,
      p.url,
      p.operation ?? '',
      p.property_type ?? '',
      p.location.name ?? '',
      p.barrio_extracted ?? '',
      p.address ?? '',
      p.price ?? '',
      p.price_currency ?? '',
      p.price_text,
      p.attributes.bedrooms ?? '',
      p.attributes.bathrooms ?? '',
      p.attributes.area_m2 ?? '',
      p.attributes.lot_size_m2 ?? '',
      p.image_main ?? '',
      p.images.length,
      truncate(p.description, 4000),
      truncate(p.resumen ?? '', 500),
      p.features.join(' | '),
      'TRUE',
      p.enriched_at ?? '',
      '',
      p.modified_at ?? '',
      p.scraped_at,
    ]);
  }

  if (DRY_RUN) {
    console.log('[upload-enriched] DRY RUN — no se escribe');
    console.log(`  filas a escribir: ${rows.length} (1 header + ${rows.length - 1} props)`);
    console.log('  ejemplo de la primera prop:');
    console.log(`  ${HEADERS.slice(0, 8).join(' | ')}`);
    console.log(`  ${rows[1]!.slice(0, 8).join(' | ')}`);
    return;
  }

  const credentialsPath = path.resolve(CREDENTIALS_PATH);
  console.log(`[upload-enriched] auth via ${credentialsPath}`);

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client as never });

  // 1) Clear pestania
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:ZZ`,
  });
  // 2) Write headers + data
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  console.log(
    `[upload-enriched] OK: ${rows.length - 1} propiedades enriquecidas volcadas a "${TAB}" del sheet ${SHEET_ID}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
