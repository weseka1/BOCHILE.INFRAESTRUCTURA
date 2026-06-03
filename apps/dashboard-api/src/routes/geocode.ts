/**
 * POST /api/geocode-barrio
 *
 * Endpoint publico (sin auth) usado por el workflow n8n para resolver
 * "calle + altura" -> barrio oficial de Bahia Blanca al 100% via:
 *
 * 1. Nominatim (OpenStreetMap) para geocodificar la direccion -> lat/lng
 * 2. Point-in-polygon contra los 145 poligonos oficiales del municipio
 *
 * Body: { direccion: "Alem 127" } o { direccion: "Alem 127, Bahia Blanca" }
 * Response: { barrio, lat, lng, confianza, source }
 */

import { Router, type Request, type Response } from 'express';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const router = Router();

interface BarrioPolygon {
  nombre: string;
  polygon: [number, number][];  // array de [lng, lat]
}

// Cargar barrios una sola vez al arrancar el servidor (~45 KB)
let BARRIOS: BarrioPolygon[] = [];
try {
  const dataPath = resolve(__dirname, '../data/barrios_polygons.json');
  BARRIOS = JSON.parse(readFileSync(dataPath, 'utf8'));
  console.log('[geocode] Cargados', BARRIOS.length, 'poligonos de barrios');
} catch (e) {
  console.error('[geocode] No pude cargar barrios_polygons.json:', (e as Error).message);
}

// Algoritmo Ray Casting para point-in-polygon
function pointInPolygon(lng: number, lat: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function findBarrio(lng: number, lat: number): string | null {
  for (const b of BARRIOS) {
    if (pointInPolygon(lng, lat, b.polygon)) return b.nombre;
  }
  return null;
}

async function geocodeNominatim(direccion: string): Promise<{ lat: number; lng: number } | null> {
  const query = direccion.toLowerCase().includes('bahia blanca')
    ? direccion
    : `${direccion}, Bahia Blanca, Buenos Aires, Argentina`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ar`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BochileInmobiliaria/1.0 (geocode endpoint)',
      },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}

router.post('/', async (req: Request, res: Response) => {
  const direccion = String(req.body?.direccion || '').trim();
  if (!direccion) {
    return res.status(400).json({ error: 'direccion requerida' });
  }
  if (BARRIOS.length === 0) {
    return res.status(500).json({ error: 'barrios_polygons no cargado' });
  }

  // 1. Geocodificar via Nominatim
  const geo = await geocodeNominatim(direccion);
  if (!geo) {
    return res.json({
      barrio: null,
      lat: null,
      lng: null,
      confianza: 'baja',
      source: 'nominatim_failed',
      notes: 'No pude geocodificar esa direccion. Pedile al cliente confirmacion del barrio.',
    });
  }

  // 2. Point-in-polygon
  const barrio = findBarrio(geo.lng, geo.lat);
  if (!barrio) {
    return res.json({
      barrio: null,
      lat: geo.lat,
      lng: geo.lng,
      confianza: 'baja',
      source: 'point_outside_all_polygons',
      notes: 'La coordenada no cae dentro de ningun barrio oficial de Bahia Blanca. Puede ser zona rural / fuera del partido.',
    });
  }

  return res.json({
    barrio,
    lat: geo.lat,
    lng: geo.lng,
    confianza: 'alta',
    source: 'nominatim+polygon_match',
  });
});

export default router;
