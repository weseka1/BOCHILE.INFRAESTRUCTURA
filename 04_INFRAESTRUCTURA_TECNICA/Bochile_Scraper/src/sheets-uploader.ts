import { google } from 'googleapis';
import type { Property } from './schema.js';
import { inferBarrio } from './normalizer.js';

/**
 * Upload del catalogo al Google Sheet vivo de Bochile.
 * Usa el mismo Service Account JSON que el Dashboard
 * (apuntado por GOOGLE_APPLICATION_CREDENTIALS en .env).
 *
 * Estrategia: REPLACE de la pestania completa. Mas simple que upsert por id
 * porque el Sheet ya tiene una columna prop_id pero cambia de orden, y la
 * fuente de verdad del catalogo es la web (scraping).
 *
 * Headers escritos en la fila 1, datos a partir de la fila 2.
 */

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
  'features',
  'publicada',
  'fecha_alta',
  'fecha_modificacion',
  'scraped_at',
];

export async function uploadToSheet(opts: {
  credentialsPath: string;
  sheetId: string;
  tab: string;
  properties: Property[];
}): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    keyFile: opts.credentialsPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client as never });

  const sorted = [...opts.properties].sort((a, b) => a.id.localeCompare(b.id));
  const rows: (string | number)[][] = [HEADERS];

  for (const p of sorted) {
    const barrio = inferBarrio({ slug: p.slug, title: p.title }) ?? '';
    rows.push([
      p.id,
      p.title,
      p.url,
      p.operation ?? '',
      p.property_type ?? '',
      p.location.name ?? '',
      barrio,
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
      p.features.join(' | '),
      'TRUE',
      p.published_at ?? '',
      p.modified_at ?? '',
      p.scraped_at,
    ]);
  }

  // 1) Limpiar la pestania
  await sheets.spreadsheets.values.clear({
    spreadsheetId: opts.sheetId,
    range: `${opts.tab}!A:ZZ`,
  });

  // 2) Escribir headers + rows
  await sheets.spreadsheets.values.update({
    spreadsheetId: opts.sheetId,
    range: `${opts.tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  console.log(
    `[sheets] ${rows.length - 1} propiedades volcadas a ${opts.tab} (sheet ${opts.sheetId})`,
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
