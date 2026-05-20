#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getListingUrls, getRecentFromRSS } from './sitemap.js';
import { scrapeListing } from './scraper.js';
import { normalize } from './normalizer.js';
import { exportJson, exportCsv, postWebhook } from './exporter.js';
import { downloadImages } from './images.js';
import { uploadToSheet } from './sheets-uploader.js';
import { concurrencyLimit } from './http.js';
import type { Property } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');

const program = new Command();

program
  .name('bochile-scraper')
  .description(
    'Scraper del catalogo de propiedades de bochile.com. Output JSON/CSV, webhook o Google Sheet.',
  )
  .version('1.0.0');

program
  .command('run')
  .description('Ejecuta un scrape completo del catalogo')
  .option('--limit <n>', 'Limita el numero de URLs a procesar (smoke test)', parseInt)
  .option('--since <iso>', 'Solo propiedades modificadas despues de esta fecha ISO')
  .option('--webhook <url>', 'POST cada batch al webhook indicado')
  .option('--out <format>', 'Formato de salida: json (default) | csv | both | none', 'json')
  .option('--download-images', 'Descarga imagenes a output/images/{id}/')
  .option('--to-sheet', 'Sube el catalogo al Google Sheet (requiere GOOGLE_APPLICATION_CREDENTIALS y BOCHILE_SHEET_ID)')
  .action(async (opts) => {
    const t0 = Date.now();

    // 1) Construir lista de URLs
    let urls = await pickUrls(opts);
    if (opts.limit) urls = urls.slice(0, opts.limit);
    console.log(`[run] ${urls.length} URLs a scrapear`);

    // 2) Scrape concurrente
    const properties: Property[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    const tasks = urls.map((url) =>
      concurrencyLimit(async () => {
        try {
          const raw = await scrapeListing(url);
          const prop = normalize(raw);
          properties.push(prop);
          process.stdout.write('.');
        } catch (err) {
          errors.push({ url, error: (err as Error).message });
          process.stdout.write('x');
        }
      }),
    );
    await Promise.all(tasks);
    process.stdout.write('\n');

    console.log(
      `[run] scrape terminado: ${properties.length} ok, ${errors.length} errores`,
    );
    if (errors.length > 0) {
      console.log('[run] primeros 5 errores:');
      for (const e of errors.slice(0, 5)) console.log(`  - ${e.url}: ${e.error}`);
    }

    // 3) Exportar
    const out = String(opts.out);
    if (out === 'json' || out === 'both') {
      await exportJson(properties, path.join(OUTPUT_DIR, 'properties.json'));
    }
    if (out === 'csv' || out === 'both') {
      await exportCsv(properties, path.join(OUTPUT_DIR, 'properties.csv'));
    }
    if (opts.webhook) {
      await postWebhook(String(opts.webhook), properties);
    }
    if (opts.downloadImages) {
      await downloadImages(properties, path.join(OUTPUT_DIR, 'images'));
    }
    if (opts.toSheet) {
      const credentialsPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ??
        path.resolve(
          PROJECT_ROOT,
          '../../05_DASHBOARD_WEB/backend/credentials/service-account.json',
        );
      const sheetId =
        process.env.BOCHILE_SHEET_ID ?? '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
      const tab = process.env.BOCHILE_SHEET_TAB ?? 'propiedades';
      await uploadToSheet({
        credentialsPath: path.resolve(PROJECT_ROOT, credentialsPath),
        sheetId,
        tab,
        properties,
      });
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[run] listo en ${elapsed}s`);
  });

program
  .command('sitemap')
  .description('Imprime la lista de URLs del sitemap de listings')
  .option('--limit <n>', 'Limita el output', parseInt)
  .action(async (opts) => {
    const entries = await getListingUrls();
    const slice = opts.limit ? entries.slice(0, opts.limit) : entries;
    for (const e of slice) {
      console.log(e.lastmod ? `${e.loc}\t${e.lastmod}` : e.loc);
    }
    console.log(`\n[sitemap] total ${entries.length} URLs (mostradas ${slice.length})`);
  });

program
  .command('test-one <url>')
  .description('Scrapea una sola URL y muestra el output normalizado por stdout')
  .action(async (url: string) => {
    const raw = await scrapeListing(url);
    const prop = normalize(raw);
    console.log(JSON.stringify(prop, null, 2));
  });

async function pickUrls(opts: { since?: string }): Promise<string[]> {
  if (opts.since) {
    // Modo incremental: union de RSS + sitemap filtrado por lastmod >= since
    const sinceDate = new Date(opts.since);
    const [rss, sitemap] = await Promise.all([getRecentFromRSS(), getListingUrls()]);
    const fromRss = rss.map((r) => r.link);
    const fromSitemap = sitemap
      .filter((e) => e.lastmod && new Date(e.lastmod) >= sinceDate)
      .map((e) => e.loc);
    return Array.from(new Set([...fromRss, ...fromSitemap]));
  }
  const all = await getListingUrls();
  return all.map((e) => e.loc);
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
