import { XMLParser } from 'fast-xml-parser';
import { fetchText } from './http.js';

const SITE_BASE = process.env.SITE_BASE_URL ?? 'https://www.bochile.com';

const LISTINGS_SITEMAP = `${SITE_BASE}/wp-sitemap-posts-listing-1.xml`;
const TAXONOMY_SITEMAP = (name: string) =>
  `${SITE_BASE}/wp-sitemap-taxonomies-${name}-1.xml`;
const LISTING_FEED = `${SITE_BASE}/listing/feed/`;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  trimValues: true,
});

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

interface RawSitemap {
  urlset?: {
    url?: Array<{ loc: string; lastmod?: string }> | { loc: string; lastmod?: string };
  };
}

interface RawFeed {
  rss?: {
    channel?: {
      item?: Array<{ link: string; pubDate?: string; 'dc:date'?: string }>
        | { link: string; pubDate?: string; 'dc:date'?: string };
    };
  };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

async function fetchSitemap(url: string): Promise<SitemapEntry[]> {
  const xml = await fetchText(url);
  const parsed = xmlParser.parse(xml) as RawSitemap;
  const urls = asArray(parsed.urlset?.url);
  return urls.map((u) => ({
    loc: decodeURIComponent(u.loc),
    lastmod: u.lastmod,
  }));
}

/**
 * Lista completa de URLs de listings desde el sitemap principal.
 * Bochile expone ~239 URLs en wp-sitemap-posts-listing-1.xml.
 */
export async function getListingUrls(): Promise<SitemapEntry[]> {
  return fetchSitemap(LISTINGS_SITEMAP);
}

/**
 * Devuelve las URLs de una taxonomia ("location" | "listing-type" | "feature").
 */
export async function getTaxonomyUrls(
  name: 'location' | 'listing-type' | 'feature',
): Promise<SitemapEntry[]> {
  return fetchSitemap(TAXONOMY_SITEMAP(name));
}

/**
 * RSS de las ultimas 10 propiedades publicadas/modificadas.
 * Util para modo --since incremental.
 */
export async function getRecentFromRSS(): Promise<
  Array<{ link: string; pubDate: string | null }>
> {
  const xml = await fetchText(LISTING_FEED);
  const parsed = xmlParser.parse(xml) as RawFeed;
  const items = asArray(parsed.rss?.channel?.item);
  return items.map((it) => ({
    link: decodeURIComponent(it.link),
    pubDate: it.pubDate ?? it['dc:date'] ?? null,
  }));
}
