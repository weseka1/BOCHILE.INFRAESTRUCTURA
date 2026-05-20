import type { RawProperty } from './scraper.js';
import { PropertySchema, type Property } from './schema.js';

/**
 * Mapeo de claves comunes (en espanol) -> campo tipado del schema.
 * Bochile usa nombres variables segun el listing; tratamos de cubrir las mas frecuentes.
 */
const AREA_KEYS = [
  'superficie',
  'superficie cubierta',
  'sup. cubierta',
  'sup cubierta',
  'metros cuadrados',
  'm2',
  'm²',
];
const LOT_SIZE_KEYS = [
  'superficie total',
  'sup. total',
  'sup total',
  'terreno',
  'lote',
  'superficie terreno',
];
const BEDROOMS_KEYS = ['dormitorios', 'ambientes', 'habitaciones', 'cuartos'];
const BATHROOMS_KEYS = ['banos', 'baños', 'banios'];
const YEAR_KEYS = ['ano construccion', 'año construccion', 'antiguedad', 'año'];

export function normalize(raw: RawProperty): Property {
  const price = parsePrice(raw.price_attr, raw.price_text);
  // Solo inferir moneda si efectivamente hay un precio numerico, caso contrario
  // queda null (no inventamos "USD" para listings con "Consulte precio")
  const price_currency =
    raw.price_currency_attr ?? (price !== null ? inferCurrency(raw.price_text) : null);
  const operation = inferOperation(raw);
  const property_type = inferPropertyType(raw);

  const lowerDetails = lowercaseKeys(raw.raw_details);

  const attributes = {
    area_m2: extractMetric(lowerDetails, AREA_KEYS),
    lot_size_m2: extractMetric(lowerDetails, LOT_SIZE_KEYS),
    bedrooms: extractInt(lowerDetails, BEDROOMS_KEYS),
    bathrooms: extractInt(lowerDetails, BATHROOMS_KEYS),
    year_built: extractInt(lowerDetails, YEAR_KEYS),
  };

  const location = inferLocation(raw);

  const property: Property = {
    id: raw.id,
    url: raw.url,
    slug: raw.slug,
    title: raw.title,
    operation,
    property_type,
    price,
    price_currency,
    price_text: raw.price_text,
    description: raw.description_full || raw.description_short,
    location,
    address: raw.address,
    attributes,
    raw_details: raw.raw_details,
    features: raw.features,
    images: raw.images,
    image_main: raw.image_main,
    taxonomies: raw.taxonomies,
    published_at: raw.published_at,
    modified_at: raw.modified_at,
    scraped_at: new Date().toISOString(),
  };

  return PropertySchema.parse(property);
}

function lowercaseKeys(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // sin acentos
    .replace(/[:.]/g, '')
    .trim();
}

function parsePrice(attr: string | null, text: string): number | null {
  // Prioridad 1: atributo content del schema.org price
  if (attr) {
    const n = Number(attr.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  // Prioridad 2: texto visible
  if (!text || /consultar/i.test(text)) return null;
  // Numero puede venir tipo "USD 285,000" o "U$S 285.000"
  // Estrategia: quitar todo lo que no sea digito o separador, despues
  // remover separador de miles (asumimos sin decimales para precios inmobiliarios).
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // Quitar separadores de miles (puntos o comas que no sean los ultimos 3 digitos)
  const onlyDigits = cleaned.replace(/[.,]/g, '');
  const n = Number(onlyDigits);
  return Number.isNaN(n) || n === 0 ? null : n;
}

function inferCurrency(text: string): string | null {
  if (/U?\$?S|USD|d[oó]lar/i.test(text)) return 'USD';
  if (/AR\$|\bARS\b|peso/i.test(text)) return 'ARS';
  return null;
}

function inferOperation(raw: RawProperty): Property['operation'] {
  // El slug del listing suele tener "en-venta" o "en-alquiler" — fuente muy confiable
  const sources = [
    raw.offer_type_text ?? '',
    raw.title,
    raw.slug,
    raw.description_short,
    ...raw.taxonomies.listing_type.map((t) => t.name),
  ]
    .join(' ')
    .toLowerCase();
  if (/\bventa\b|\bvende\b|en-venta/.test(sources)) return 'sale';
  if (/\balquiler\b|\balquila\b|\brenta\b|en-alquiler/.test(sources)) return 'rent';
  return null;
}

const PROPERTY_TYPE_HINTS: Array<[RegExp, string]> = [
  [/\bcasa\b|chalet|residencia/i, 'casa'],
  [/depto|departamento|apartament/i, 'departamento'],
  [/\bph\b/i, 'ph'],
  [/d[uú]plex|duplex/i, 'duplex'],
  [/galp[oó]n|dep[oó]sito|industrial/i, 'galpon'],
  [/campo|estancia|chacra|hect[aá]reas?/i, 'campo'],
  [/lote|terreno|parcela|fracci[oó]n|tierras?|predio/i, 'lote'],
  [/local|comercio|negocio/i, 'local'],
  [/oficina/i, 'oficina'],
  [/cochera|\bgarage\b/i, 'cochera'],
];

function inferPropertyType(raw: RawProperty): string | null {
  const sources = [
    raw.title,
    ...raw.taxonomies.listing_type.map((t) => t.name),
    raw.description_short,
  ].join(' ');
  for (const [pattern, label] of PROPERTY_TYPE_HINTS) {
    if (pattern.test(sources)) return label;
  }
  return null;
}

/**
 * Busca el primer detail cuya clave matchee con alguno de los keys conocidos
 * y devuelve el valor como numero (parseando metros cuadrados o ambientes).
 */
function extractMetric(
  details: Record<string, string>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const val = details[key];
    if (val) {
      const n = Number(val.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function extractInt(details: Record<string, string>, keys: string[]): number | null {
  const v = extractMetric(details, keys);
  return v !== null ? Math.round(v) : null;
}

/**
 * Location del listing. 214 de 239 listings no tienen la taxonomy completada
 * en WordPress, asi que hacemos fallback en cascada:
 *  1. taxonomy real (current-listing-ancestor en el menu)
 *  2. keywords en slug/title (monte-hermoso, pehuen, etc.)
 *  3. default "Bahia Blanca" (Bochile es inmobiliaria de Bahia Blanca)
 *
 * Tambien intenta inferir un barrio interno (Palihue, Villa Mitre, Patagonia,
 * Universitario, etc.) buscando esos nombres en el slug o titulo.
 */
const LOCATION_KEYWORDS: Array<[RegExp, { name: string; url: string }]> = [
  [
    /monte[- ]?hermoso/i,
    { name: 'Monte Hermoso', url: 'https://www.bochile.com/location/monte-hermoso/' },
  ],
  [
    /pehuen[- ]?co?/i,
    { name: 'Pehuen Co', url: 'https://www.bochile.com/location/pehuen/' },
  ],
  [
    /centro[- ]?(de[- ]?)?bah[ií]a/i,
    {
      name: 'Centro de Bahía Blanca',
      url: 'https://www.bochile.com/location/centro-bahia/',
    },
  ],
  [
    /sierra[- ]?(de[- ]?la[- ]?)?ventana/i,
    { name: 'Sierra de la Ventana', url: 'https://www.bochile.com/location/otros/' },
  ],
  [
    /coronel[- ]?(rosales|dorrego|pringles|su[áa]rez)/i,
    { name: 'Otros', url: 'https://www.bochile.com/location/otros/' },
  ],
];

const BAHIA_DEFAULT = {
  name: 'Bahía Blanca',
  url: 'https://www.bochile.com/location/bahia-blanca/',
};

function inferLocation(raw: RawProperty): { name: string | null; url: string | null } {
  // 1. Taxonomy explicita (mejor caso)
  const tax = raw.taxonomies.location[0];
  if (tax) return { name: tax.name, url: tax.url };

  // 2. Keywords en slug/title/url
  const haystack = `${raw.slug} ${raw.title} ${raw.url}`.toLowerCase();
  for (const [pattern, loc] of LOCATION_KEYWORDS) {
    if (pattern.test(haystack)) return loc;
  }

  // 3. Default: Bahia Blanca (donde opera Bochile)
  return BAHIA_DEFAULT;
}

/**
 * Barrio interno de Bahia Blanca. Sirve como filtro fino cuando location=Bahia Blanca.
 * Los barrios estan tomados del seed de Camila (zonas reales que maneja la inmobiliaria).
 */
const BARRIOS_BB = [
  'Palihue',
  'Centro',
  'Universitario',
  'Villa Mitre',
  'Villa Belgrano',
  'Patagonia',
  'Tiro Federal',
  'Villa Don Bosco',
  'Almafuerte',
  'Aldea Romana',
  'Paseo de la Mujer',
];

export function inferBarrio(raw: { slug: string; title: string }): string | null {
  const haystack = `${raw.slug} ${raw.title}`.toLowerCase();
  for (const barrio of BARRIOS_BB) {
    const pattern = new RegExp(
      barrio
        .toLowerCase()
        .replace(/\s+/g, '[- ]?')
        .replace(/[áéíóú]/g, (c) => '[aeiouáéíóú]'),
      'i',
    );
    if (pattern.test(haystack)) return barrio;
  }
  return null;
}
