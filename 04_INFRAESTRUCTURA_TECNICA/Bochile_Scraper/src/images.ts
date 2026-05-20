import fs from 'node:fs/promises';
import path from 'node:path';
import { request } from 'undici';
import type { Property } from './schema.js';
import { concurrencyLimit } from './http.js';

/**
 * Descarga las imagenes de cada propiedad a output/images/{id}/.
 * Renombra a {indice}{ext}. Skipea si el archivo ya existe (idempotente).
 */
export async function downloadImages(
  properties: Property[],
  baseDir: string,
): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const prop of properties) {
    if (prop.images.length === 0) continue;
    const dir = path.join(baseDir, prop.id);
    tasks.push(downloadOneProperty(prop, dir));
  }
  await Promise.all(tasks);
  console.log(`[images] descargadas imagenes para ${properties.length} propiedades`);
}

async function downloadOneProperty(prop: Property, dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    prop.images.map((url, idx) =>
      concurrencyLimit(() => downloadOneImage(url, dir, idx)),
    ),
  );
}

async function downloadOneImage(url: string, dir: string, idx: number): Promise<void> {
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const dest = path.join(dir, `${String(idx).padStart(3, '0')}${ext}`);
  try {
    await fs.access(dest);
    return; // ya existe, skip
  } catch {
    // continuar
  }
  try {
    const res = await request(url);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      console.warn(`[images] fallo descarga ${url} (HTTP ${res.statusCode})`);
      return;
    }
    const buf = Buffer.from(await res.body.arrayBuffer());
    await fs.writeFile(dest, buf);
  } catch (err) {
    console.warn(`[images] error con ${url}: ${(err as Error).message}`);
  }
}
