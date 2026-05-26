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
    // Lectura + escritura (necesario para appendRow). Si solo lee, sigue funcionando.
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
      obj[header as string] = parseValue(row[idx], header as string);
    });
    return obj;
  });

  cache.set(tab, {
    data,
    expiresAt: now + config.cacheTtlSeconds * 1000,
  });
  return data as T[];
}

// Campos que SIEMPRE deben quedar como string, aunque luzcan numericos.
// Sino: telefono "5492915512515" se convierte a int -> .includes()/.replace()/.toLowerCase()
// crashean en el frontend = "pantalla azul".
const ALWAYS_STRING_FIELDS = new Set([
  'prop_id', 'lead_id', 'empleado_id', 'visita_id', 'contrato_id',
  'match_id', 'msg_id', 'accion_id', 'tarea_id',
  'telefono', 'tel', 'phone', 'whatsapp',
  'cmid', 'channelMessageId',
  'codigo_postal', 'cp',
]);

/**
 * Parser de valores: convierte strings "TRUE"/"FALSE" a boolean,
 * numeros guardados como strings a number, etc.
 * IDs y telefonos siempre quedan como string (ver ALWAYS_STRING_FIELDS).
 */
function parseValue(v: unknown, header?: string): unknown {
  if (v === undefined || v === null || v === '') return '';
  // ID-like / telefono / etc: forzar string siempre
  if (header && ALWAYS_STRING_FIELDS.has(header)) {
    return String(v);
  }
  // Heuristica: cualquier header que termine en _id -> string
  if (header && /_id$/.test(header)) {
    return String(v);
  }
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

/**
 * Devuelve los headers (fila 1) de una pestana, respetando el orden exacto.
 */
async function getHeaders(tab: SheetTab): Promise<string[]> {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${tab}!1:1`,
  });
  const row = (res.data.values && res.data.values[0]) || [];
  return row.map((v) => String(v));
}

/**
 * Agrega una fila al final de una pestana. Recibe un objeto y lo mapea
 * a las columnas usando los headers reales del Sheet (cualquier campo
 * que no exista en los headers se ignora). Invalida el cache de esa tab.
 */
export async function appendRow(
  tab: SheetTab,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const headers = await getHeaders(tab);
  if (headers.length === 0) {
    throw new Error(`Pestana "${tab}" no tiene headers en la fila 1`);
  }
  const row = headers.map((h) => {
    const v = payload[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return v;
  });
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.sheetId,
    range: `${tab}!A:ZZ`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  invalidateCache(tab);
  // devolver el objeto normalizado
  const saved: Record<string, unknown> = {};
  headers.forEach((h, i) => { saved[h] = row[i]; });
  return saved;
}
