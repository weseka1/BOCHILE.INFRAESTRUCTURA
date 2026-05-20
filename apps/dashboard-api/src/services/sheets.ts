import { google, sheets_v4 } from 'googleapis';
import { config } from '../config';
import type { SheetTab } from '../types/domain';

/**
 * Cliente de Google Sheets API con autenticacion via Service Account.
 * Incluye cache en memoria por tab (TTL configurable) para no agotar la
 * cuota de Google (60 reads/min por user).
 */

let sheetsClient: sheets_v4.Sheets | null = null;

async function getClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    ...config.googleCreds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: client as any });
  return sheetsClient;
}

// Cache simple en memoria: { tab -> { data, expiresAt } }
const cache = new Map<SheetTab, { data: Record<string, unknown>[]; expiresAt: number }>();

/**
 * Lee una pestana completa del Sheet, parsea los headers de la fila 1
 * y devuelve un array de objetos tipados por columna.
 */
export async function readSheet<T extends Record<string, unknown>>(
  tab: SheetTab,
): Promise<T[]> {
  const now = Date.now();
  const cached = cache.get(tab);
  if (cached && cached.expiresAt > now) {
    return cached.data as T[];
  }

  const sheets = await getClient();
  const range = `${tab}!A:ZZ`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rows = res.data.values ?? [];
  if (rows.length === 0) return [];

  const [headers, ...dataRows] = rows;
  const data = dataRows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      obj[header as string] = parseValue(row[idx]);
    });
    return obj;
  });

  cache.set(tab, {
    data,
    expiresAt: now + config.cacheTtlSeconds * 1000,
  });
  return data as T[];
}

/**
 * Parser de valores: convierte strings "TRUE"/"FALSE" a boolean,
 * numeros guardados como strings a number, etc.
 */
function parseValue(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s.toLowerCase() === 'true') return true;
  if (s.toLowerCase() === 'false') return false;
  // No auto-convertir numeros: dejarlos como string para preservar IDs como "L-001"
  // Solo convertir si es claramente numerico y no empieza con letra
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
  }
  return s;
}

export function invalidateCache(tab?: SheetTab): void {
  if (tab) cache.delete(tab);
  else cache.clear();
}
