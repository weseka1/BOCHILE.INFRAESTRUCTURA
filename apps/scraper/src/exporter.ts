import fs from 'node:fs/promises';
import path from 'node:path';
import { request } from 'undici';
import type { Property } from './schema.js';
import { sleep } from './http.js';

export async function exportJson(properties: Property[], outPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  // Orden estable por id para que el output sea idempotente
  const sorted = [...properties].sort((a, b) => a.id.localeCompare(b.id));
  await fs.writeFile(outPath, JSON.stringify(sorted, null, 2), 'utf-8');
  console.log(`[exporter] JSON escrito: ${outPath} (${sorted.length} props)`);
}

const CSV_COLUMNS: Array<keyof Property | 'location_name' | 'location_url'> = [
  'id',
  'url',
  'slug',
  'title',
  'operation',
  'property_type',
  'price',
  'price_currency',
  'price_text',
  'location_name',
  'location_url',
  'address',
  'image_main',
  'published_at',
  'modified_at',
  'scraped_at',
];

export async function exportCsv(properties: Property[], outPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const lines: string[] = [];
  lines.push([...CSV_COLUMNS, 'attributes_json', 'features_json', 'images_json'].join(','));

  const sorted = [...properties].sort((a, b) => a.id.localeCompare(b.id));
  for (const p of sorted) {
    const row: string[] = [];
    for (const col of CSV_COLUMNS) {
      let v: unknown;
      if (col === 'location_name') v = p.location.name;
      else if (col === 'location_url') v = p.location.url;
      else v = (p as unknown as Record<string, unknown>)[col];
      row.push(csvEscape(v));
    }
    row.push(csvEscape(JSON.stringify(p.attributes)));
    row.push(csvEscape(JSON.stringify(p.features)));
    row.push(csvEscape(JSON.stringify(p.images)));
    lines.push(row.join(','));
  }

  await fs.writeFile(outPath, lines.join('\n'), 'utf-8');
  console.log(`[exporter] CSV escrito: ${outPath} (${sorted.length} props)`);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * POST batched al webhook. Cada batch hace un array de propiedades.
 * Reintenta el batch hasta 3 veces ante fallos transientes.
 */
export async function postWebhook(
  webhookUrl: string,
  properties: Property[],
  batchSize = 20,
): Promise<void> {
  const sorted = [...properties].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < sorted.length; i += batchSize) {
    const batch = sorted.slice(i, i + batchSize);
    let attempts = 0;
    while (attempts < 3) {
      try {
        const res = await request(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ properties: batch }),
        });
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(
            `[exporter] webhook batch ${i / batchSize + 1} OK (${batch.length} props, status ${res.statusCode})`,
          );
          break;
        }
        throw new Error(`Webhook HTTP ${res.statusCode}`);
      } catch (err) {
        attempts++;
        if (attempts >= 3) throw err;
        await sleep(1000 * attempts);
      }
    }
  }
}
