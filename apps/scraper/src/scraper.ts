import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { fetchText } from './http.js';
import type { TaxonomyTerm } from './schema.js';

const SITE_BASE = process.env.SITE_BASE_URL ?? 'https://www.bochile.com';

/**
 * Estructura intermedia (pre-normalize). Mantiene strings crudos para que
 * normalizer.ts les pegue a los parsers especificos (precio numerico, etc).
 */
export interface RawProperty {
  id: string;
  url: string;
  slug: string;
  title: string;
  price_attr: string | null;
  price_currency_attr: string | null;
  price_text: string;
  offer_type_text: string | null;
  description_short: string;
  description_full: string;
  raw_details: Record<string, string>;
  features: string[];
  taxonomies: {
    location: TaxonomyTerm[];
    listing_type: TaxonomyTerm[];
    feature: TaxonomyTerm[];
  };
  images: string[];
  image_main: string | null;
  address: string | null;
  published_at: string | null;
  modified_at: string | null;
  jsonld: unknown[];
}

export async function scrapeListing(url: string): Promise<RawProperty> {
  const html = await fetchText(url);
  return parseListing(html, url);
}

export function parseListing(html: string, url: string): RawProperty {
  const $ = cheerio.load(html);

  const id = extractId($, url);
  const slug = extractSlug(url);
  const title = extractTitle($);

  const price_attr = $('[itemprop="price"]').first().attr('content') ?? null;
  const price_currency_attr =
    $('[itemprop="priceCurrency"]').first().attr('content') ?? null;
  const price_text =
    $('.listing-price-value').first().text().trim() ||
    $('.wpsight-listing-price').first().text().trim() ||
    $('.listing-price').first().text().trim() ||
    'Consultar';

  const offer_type_text = extractOfferType($);

  const description_short =
    $('meta[property="og:description"]').attr('content')?.trim() ?? '';
  const description_full =
    $('[itemprop="description"]').first().text().trim() ||
    $('.wpsight-listing-description').first().text().trim() ||
    $('.entry-content').first().text().trim() ||
    '';

  const raw_details = extractDetails($);
  const features = extractFeatures($);
  const taxonomies = extractTaxonomies($);
  const { images, image_main } = extractImages($);
  const address = $('[itemprop="address"]').first().text().trim() || null;

  const published_at =
    $('meta[property="article:published_time"]').attr('content')?.trim() ??
    $('time[datetime]').first().attr('datetime')?.trim() ??
    null;
  const modified_at =
    $('meta[property="article:modified_time"]').attr('content')?.trim() ?? null;

  const jsonld = extractJsonLd($);

  return {
    id,
    url: decodeURIComponent(url),
    slug,
    title,
    price_attr,
    price_currency_attr,
    price_text,
    offer_type_text,
    description_short,
    description_full,
    raw_details,
    features,
    taxonomies,
    images,
    image_main,
    address,
    published_at,
    modified_at,
    jsonld,
  };
}

function textOr($: CheerioAPI, selector: string, fallback: string): string {
  const t = $(selector).first().text().trim();
  return t || fallback.trim();
}

/**
 * El title de la ficha puede venir de varios lugares (WPCasa Oslo theme):
 *  1. <meta itemprop="name" content="..."> (caso mas comun en Bochile)
 *  2. <h1 itemprop="name">
 *  3. <h1.entry-title> o <h1.listing-title>
 *  4. <title> tag (con sufijo del sitio que sacamos)
 */
function extractTitle($: CheerioAPI): string {
  const metaName = $('meta[itemprop="name"]').first().attr('content');
  if (metaName?.trim()) return metaName.trim();
  const h1Item = $('h1[itemprop="name"]').first().text().trim();
  if (h1Item) return h1Item;
  const h1 = $('h1').first().text().trim();
  if (h1) return h1;
  const pageTitle = $('title').first().text().trim();
  return pageTitle.replace(/\s*[\|–-]\s*Bochile.*$/i, '').trim();
}

/**
 * El ID del listing puede aparecer:
 *  - como texto "ID-XXXXX" dentro de .wpsight-listing-info
 *  - como clase del body: postid-XXXXX
 *  - como ultimo recurso, derivado del slug
 */
function extractId($: CheerioAPI, url: string): string {
  const infoText = $('.wpsight-listing-info').first().text();
  const m1 = infoText.match(/ID-(\d+)/i);
  if (m1?.[1]) return m1[1];

  const bodyClass = $('body').attr('class') ?? '';
  const m2 = bodyClass.match(/postid-(\d+)/i);
  if (m2?.[1]) return m2[1];

  // Fallback: slug
  return extractSlug(url);
}

function extractSlug(url: string): string {
  const u = decodeURIComponent(url).replace(/\/$/, '');
  const parts = u.split('/');
  return parts[parts.length - 1] ?? '';
}

function extractOfferType($: CheerioAPI): string | null {
  // Selector principal: el label coloreado al lado del ID
  // <span class="label label-sale">En Venta</span> / label-rent
  const labelSale = $('.label-sale').first();
  if (labelSale.length > 0) return labelSale.text().trim() || 'En Venta';
  const labelRent = $('.label-rent').first();
  if (labelRent.length > 0) return labelRent.text().trim() || 'En Alquiler';
  // Fallback: texto del bloque info
  const info = $('.wpsight-listing-info').first().text();
  if (/venta/i.test(info)) return 'En Venta';
  if (/alquiler/i.test(info)) return 'En Alquiler';
  return null;
}

/**
 * Detalles del listing. WPCasa Oslo los renderiza como:
 *   <div class="wpsight-listing-details">
 *     <span class="listing-details-detail" title="Clave">
 *       <span class="listing-details-label">Clave</span>
 *       <span class="listing-details-value">Valor</span>
 *     </span>
 *   </div>
 *
 * Soportamos tambien los formatos del widget panel (dl/tr/li) como fallback.
 */
function extractDetails($: CheerioAPI): Record<string, string> {
  const details: Record<string, string> = {};

  // Formato principal Oslo: spans con label/value
  $('.wpsight-listing-details .listing-details-detail').each((_, span) => {
    const labelNode = $(span).find('.listing-details-label').first();
    const valueNode = $(span).find('.listing-details-value').first();
    const key = labelNode.text().trim() || ($(span).attr('title') ?? '').trim();
    // Usar text con limpieza de m² (HTML entity ya viene decodificado)
    const val = valueNode.text().trim();
    if (key && val) details[key] = val;
  });

  // Fallback: widget_listing_details con dl/tr/li
  const widget = $('.widget_listing_details');
  if (widget.length > 0) {
    widget.find('dt').each((_, dt) => {
      const key = $(dt).text().trim();
      const val = $(dt).next('dd').text().trim();
      if (key && val && !(key in details)) details[key] = val;
    });
    widget.find('tr').each((_, tr) => {
      const tds = $(tr).find('td, th');
      if (tds.length === 2) {
        const key = $(tds[0]!).text().trim();
        const val = $(tds[1]!).text().trim();
        if (key && val && !(key in details)) details[key] = val;
      }
    });
    widget.find('li').each((_, li) => {
      const txt = $(li).text().trim();
      const idx = txt.indexOf(':');
      if (idx > 0 && idx < txt.length - 1) {
        const key = txt.slice(0, idx).trim();
        const val = txt.slice(idx + 1).trim();
        if (key && val && !(key in details)) details[key] = val;
      }
    });
  }

  return details;
}

/**
 * Features del listing. WPCasa Oslo las renderiza como:
 *   <div class="wpsight-listing-features">
 *     <span class="listing-term-wrap">
 *       <a class="listing-term" href="/feature/garage-pasante/">Garage pasante</a>
 *     </span>
 *   </div>
 */
function extractFeatures($: CheerioAPI): string[] {
  const set = new Set<string>();

  // Selector principal: anchors dentro del bloque de features
  $('.wpsight-listing-features .listing-term, .wpsight-listing-features a[href*="/feature/"]').each(
    (_, a) => {
      const txt = $(a).text().trim();
      if (txt) set.add(txt);
    },
  );

  // Fallback: cualquier link a /feature/ en la pagina (puede capturar tags fuera del bloque)
  if (set.size === 0) {
    $('a[href*="/feature/"]').each((_, a) => {
      const txt = $(a).text().trim();
      if (txt) set.add(txt);
    });
  }

  // Fallback al widget panel (ul/li)
  $('.widget_listing_features li').each((_, li) => {
    const txt = $(li).text().trim();
    if (txt) set.add(txt);
  });

  return Array.from(set);
}

/**
 * Taxonomies REALES del listing (no las del menu de navegacion).
 *
 * Estrategia:
 *  - location: buscar menu items con clase `current-listing-ancestor` o
 *    `current-listing-parent` (WPCasa marca asi el location actual del listing).
 *  - listing_type: las del bloque de features del listing apuntan a /feature/,
 *    los <span class="listing-term-wrap"> tienen los tags reales. Pero el
 *    listing-type no aparece en el HTML del listing salvo en el title; lo
 *    inferimos de la URL de la categoria principal si esta disponible, sino
 *    cae al inferPropertyType.
 *  - feature: el bloque .wpsight-listing-features tiene los tags reales.
 */
function extractTaxonomies(
  $: CheerioAPI,
): {
  location: TaxonomyTerm[];
  listing_type: TaxonomyTerm[];
  feature: TaxonomyTerm[];
} {
  const dedupe = (terms: TaxonomyTerm[]) => {
    const seen = new Set<string>();
    const out: TaxonomyTerm[] = [];
    for (const t of terms) {
      if (!seen.has(t.url)) {
        seen.add(t.url);
        out.push(t);
      }
    }
    return out;
  };

  // Location del listing: WPCasa marca el menu item con estas clases
  const locationTerms: TaxonomyTerm[] = [];
  $('li.current-listing-ancestor a[href*="/location/"], li.current-listing-parent a[href*="/location/"], li.current-listing-item a[href*="/location/"]').each(
    (_, a) => {
      const href = $(a).attr('href');
      const name = $(a).text().trim();
      if (href && name) locationTerms.push({ name, url: absolutize(href) });
    },
  );

  // Feature: los tags reales del bloque de features del listing
  const featureTerms: TaxonomyTerm[] = [];
  $('.wpsight-listing-features a[href*="/feature/"]').each((_, a) => {
    const href = $(a).attr('href');
    const name = $(a).text().trim();
    if (href && name) featureTerms.push({ name, url: absolutize(href) });
  });

  // Listing type: tomamos los marcados como current en el menu (si los hay).
  // Como fallback dejamos vacio (el campo property_type se infiere por separado del titulo).
  const typeTerms: TaxonomyTerm[] = [];
  $('li.current-listing-ancestor a[href*="/type/"], li.current-listing-parent a[href*="/type/"], li.current-listing-item a[href*="/type/"]').each(
    (_, a) => {
      const href = $(a).attr('href');
      const name = $(a).text().trim();
      if (href && name) typeTerms.push({ name, url: absolutize(href) });
    },
  );

  return {
    location: dedupe(locationTerms),
    listing_type: dedupe(typeTerms),
    feature: dedupe(featureTerms),
  };
}

/**
 * Imagenes del listing. WPCasa Oslo monta la galeria como:
 *   <div class="wpsight-gallery" itemtype=".../ImageGallery">
 *     <figure class="wpsight-gallery-item">
 *       <a href="https://.../CUYO-1-scaled.jpg" itemprop="contentUrl">
 *         <img src="https://.../CUYO-1-540x405.jpg" itemprop="thumbnail" />
 *       </a>
 *     </figure>
 *   </div>
 *
 * El <a itemprop="contentUrl"> ya apunta al full-size, asi que es el selector ideal.
 * Como fallback intentamos los <img> dentro de la galeria y filtramos logos/iconos.
 */
function extractImages($: CheerioAPI): { images: string[]; image_main: string | null } {
  const set = new Set<string>();

  // Selector principal: links full-size de la galeria
  $('.wpsight-gallery a[itemprop="contentUrl"]').each((_, a) => {
    const href = $(a).attr('href');
    if (href && href.startsWith('http')) set.add(href);
  });

  // Fallback: <img> dentro de la galeria, normalizando -WxH a full-size
  if (set.size === 0) {
    $('.wpsight-gallery img').each((_, img) => {
      const src = $(img).attr('src') ?? $(img).attr('data-src') ?? '';
      if (!src.includes('/wp-content/uploads/')) return;
      const full = src.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|gif)$)/i, '');
      set.add(full);
    });
  }

  // Ultimo fallback: cualquier <img> de uploads dentro del bloque de la propiedad
  if (set.size === 0) {
    $('.wpsight-listing img, .entry-content img').each((_, img) => {
      const src = $(img).attr('src') ?? $(img).attr('data-src') ?? '';
      if (!src.includes('/wp-content/uploads/')) return;
      if (/iso-bochile|gravatar|avatar|favicon|logo/i.test(src)) return;
      const full = src.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|gif)$)/i, '');
      set.add(full);
    });
  }

  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() ?? null;
  const images = Array.from(set);
  const image_main =
    images[0] ??
    (ogImage && ogImage.startsWith('http')
      ? ogImage.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|gif)$)/i, '')
      : null);

  return { images, image_main };
}

function extractJsonLd($: CheerioAPI): unknown[] {
  const out: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    const raw = $(s).contents().text().trim();
    if (!raw) return;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // ignorar JSON-LD invalido
    }
  });
  return out;
}

function absolutize(href: string): string {
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `${SITE_BASE}${href}`;
  return `${SITE_BASE}/${href}`;
}
