import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

/**
 * Credenciales Google Sheets — soporta 2 modos:
 *   LOCAL: GOOGLE_APPLICATION_CREDENTIALS=./credentials/service-account.json
 *   RENDER: GOOGLE_SHEETS_CREDS_JSON='{"type":"service_account",...}' (JSON entero)
 */
function resolveGoogleCreds(): { keyFile?: string; credentials?: object } {
  const jsonInline = process.env.GOOGLE_SHEETS_CREDS_JSON;
  if (jsonInline) {
    try {
      return { credentials: JSON.parse(jsonInline) };
    } catch (e) {
      throw new Error('GOOGLE_SHEETS_CREDS_JSON no es JSON valido: ' + (e as Error).message);
    }
  }
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) return { keyFile: filePath };
  throw new Error('Falta GOOGLE_SHEETS_CREDS_JSON o GOOGLE_APPLICATION_CREDENTIALS');
}

export const config = {
  port: parseInt(process.env.PORT ?? '3002', 10),
  sheetId: required('SHEET_ID'),
  googleCreds: resolveGoogleCreds(),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '30', 10),
  allowOrigin: process.env.ALLOW_ORIGIN ?? 'http://localhost:5175',
};
