import { request } from 'undici';
import pLimit from 'p-limit';
import 'dotenv/config';

const USER_AGENT =
  process.env.USER_AGENT ??
  'Mozilla/5.0 (compatible; BochileScraper/1.0; +https://weseka.app)';
const TIMEOUT_MS = parseInt(process.env.HTTP_TIMEOUT_MS ?? '20000', 10);
const RETRIES = parseInt(process.env.HTTP_RETRIES ?? '3', 10);
const MAX_RPS = parseInt(process.env.MAX_RPS ?? '4', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? '5', 10);

/**
 * Limiter de concurrencia (cuantos requests pueden estar en vuelo a la vez).
 */
export const concurrencyLimit = pLimit(CONCURRENCY);

/**
 * Throttle simple por RPS. Como queremos respetar MAX_RPS al servidor de Bochile,
 * espaciamos cada request al menos 1000/MAX_RPS ms desde el ultimo.
 */
let lastRequestTs = 0;
const minIntervalMs = Math.ceil(1000 / MAX_RPS);

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTs;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
  lastRequestTs = Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * fetch con UA realista, timeout, retry exponencial y respeto a Retry-After.
 * Devuelve el body como string (asume text/html o text/xml).
 */
export async function fetchText(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    await throttle();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await request(url, {
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'es-AR,es;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // 429 / 503 - respetar Retry-After
      if (res.statusCode === 429 || res.statusCode === 503) {
        const retryAfter = parseRetryAfter(res.headers['retry-after']);
        const waitMs = retryAfter ?? backoffMs(attempt);
        console.warn(
          `[http] ${res.statusCode} en ${url}, esperando ${waitMs}ms antes de reintentar`,
        );
        await sleep(waitMs);
        continue;
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new HttpError(`HTTP ${res.statusCode}`, res.statusCode, url);
      }

      return await res.body.text();
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < RETRIES - 1) {
        const waitMs = backoffMs(attempt);
        console.warn(
          `[http] error en ${url} (intento ${attempt + 1}/${RETRIES}): ${(err as Error).message}. Retry en ${waitMs}ms`,
        );
        await sleep(waitMs);
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`Fetch failed after ${RETRIES} attempts: ${url}`);
}

function backoffMs(attempt: number): number {
  return Math.min(30_000, 500 * Math.pow(2, attempt));
}

function parseRetryAfter(header: string | string[] | undefined): number | null {
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}
