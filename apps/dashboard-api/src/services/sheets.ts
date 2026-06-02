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
export async function readSheet<T>(
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

/**
 * Busca la fila (1-indexed, header + 1) donde el campo {key} == value.
 * Devuelve null si no se encuentra.
 */
async function findRowIndex(tab: SheetTab, key: string, value: string): Promise<number | null> {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${tab}!A:ZZ`,
  });
  const rows = res.data.values ?? [];
  if (rows.length === 0) return null;
  const headers = rows[0] as string[];
  const colIdx = headers.indexOf(key);
  if (colIdx === -1) return null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[colIdx] ?? '') === value) {
      return i + 1; // 1-indexed para Sheets
    }
  }
  return null;
}

/**
 * Devuelve el sheetId (gid) numerico de la pestana (necesario para batchUpdate de filas).
 */
async function getSheetId(tab: SheetTab): Promise<number> {
  const sheets = await getClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: config.sheetId });
  const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === tab);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
    throw new Error(`No se encontro sheetId para tab "${tab}"`);
  }
  return sheet.properties.sheetId;
}

/**
 * Actualiza una fila en la pestana donde `whereKey == whereValue`.
 * Solo escribe los campos que vienen en payload (no toca el resto).
 */
export async function updateRow(
  tab: SheetTab,
  whereKey: string,
  whereValue: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const sheets = await getClient();
  const all = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${tab}!A:ZZ`,
  });
  const rows = all.data.values ?? [];
  if (rows.length === 0) return null;
  const headers = rows[0] as string[];
  const colIdx = headers.indexOf(whereKey);
  if (colIdx === -1) throw new Error(`Header "${whereKey}" no existe en "${tab}"`);

  let rowIdx1 = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[colIdx] ?? '') === whereValue) { rowIdx1 = i + 1; break; }
  }
  if (rowIdx1 === -1) return null;

  // Construir row nuevo: tomar el existente y mergear con payload
  const existing = rows[rowIdx1 - 1] as unknown[];
  const newRow = headers.map((h, i) => {
    if (h in payload) {
      const v = payload[h];
      if (v === undefined || v === null) return '';
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      return v;
    }
    return existing[i] ?? '';
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.sheetId,
    range: `${tab}!A${rowIdx1}:ZZ${rowIdx1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [newRow] },
  });
  invalidateCache(tab);

  const saved: Record<string, unknown> = {};
  headers.forEach((h, i) => { saved[h] = newRow[i]; });
  return saved;
}

/**
 * Elimina una fila de la pestana donde `whereKey == whereValue`.
 * Devuelve true si elimino algo, false si no encontro la fila.
 */
export async function deleteRow(
  tab: SheetTab,
  whereKey: string,
  whereValue: string,
): Promise<boolean> {
  const rowIdx1 = await findRowIndex(tab, whereKey, whereValue);
  if (rowIdx1 === null) return false;

  const sheets = await getClient();
  const sheetId = await getSheetId(tab);
  // batchUpdate con deleteDimension - indices son 0-based
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.sheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIdx1 - 1, // 0-based
            endIndex: rowIdx1,        // exclusive
          },
        },
      }],
    },
  });
  invalidateCache(tab);
  return true;
}

/**
 * Elimina TODAS las filas de una pestana donde `whereKey == whereValue`.
 * Procesa los indices en orden descendente para no invalidar offsets.
 * Util para reset de un lead (borrar todas sus conversaciones, visitas, etc).
 */
export async function deleteRows(
  tab: SheetTab,
  whereKey: string,
  whereValue: string,
): Promise<number> {
  const sheets = await getClient();
  const all = await sheets.spreadsheets.values.get({
    spreadsheetId: config.sheetId,
    range: `${tab}!A:ZZ`,
  });
  const rows = all.data.values ?? [];
  if (rows.length === 0) return 0;
  const headers = rows[0] as string[];
  const colIdx = headers.indexOf(whereKey);
  if (colIdx === -1) return 0;

  // Recolectar indices (1-based, fila 1 = headers)
  const toDelete: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[colIdx] ?? '') === whereValue) {
      toDelete.push(i + 1);
    }
  }
  if (toDelete.length === 0) return 0;

  const sheetId = await getSheetId(tab);
  // Procesar en orden descendente para no romper offsets
  toDelete.sort((a, b) => b - a);
  const requests = toDelete.map(rowIdx1 => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: rowIdx1 - 1,
        endIndex: rowIdx1,
      },
    },
  }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.sheetId,
    requestBody: { requests },
  });
  invalidateCache(tab);
  return toDelete.length;
}
