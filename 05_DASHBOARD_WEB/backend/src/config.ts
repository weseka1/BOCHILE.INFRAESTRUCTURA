import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  sheetId: required('SHEET_ID'),
  googleCredentialsPath: required('GOOGLE_APPLICATION_CREDENTIALS'),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '30', 10),
  allowOrigin: process.env.ALLOW_ORIGIN ?? 'http://localhost:5173',
};
