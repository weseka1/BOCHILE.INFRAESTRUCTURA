/**
 * Telefonos del equipo Bochile que NO deben figurar en el dashboard.
 * Incluye: operadora (Camila), duenos (Lucas/Karina), vendedor (Maxi),
 * numero generico de Alquileres, y cualquier otro empleado interno.
 *
 * Se filtran de Conversaciones, Clientes/Leads, Visitas, Inicio y leaderboard
 * para que la operadora no se vea a si misma ni a su equipo como "leads".
 *
 * NOTA: este filtro es solo UI. La regla de skip=TRUE en el sheet leads
 * controla si el BOT les responde (es una decision aparte). Camila 0521
 * NO tiene skip porque es la operadora — pero igual no debe figurar en
 * el dashboard como lead/cliente.
 *
 * Para agregar mas: anota el sufijo de 4 digitos. El match es por suffix
 * para tolerar variaciones de prefijo (54/549/+54/etc).
 */
export const INTERNAL_PHONE_SUFFIXES: string[] = [
  // Sufijos de los telefonos del equipo Bochile (Camila + duenos + vendedor + alquileres).
  // El mapeo nombre <-> sufijo lo gestiona Juani offline; aqui solo importa el filtro.
  // Agregar/quitar: editar este array. El cambio aplica a TODA la UI.
  '0521',
  '7816',
  '2077',
  '3609',
  '4095',
];

/**
 * Normaliza un telefono a digitos solo (sin +, espacios, guiones).
 */
function normalizePhone(phone: string | number | null | undefined): string {
  if (phone === null || phone === undefined) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Devuelve true si el telefono es interno del equipo Bochile.
 * Match por suffix de 4 digitos (mas robusto que match exacto porque
 * tolera prefijos 54/549/+54).
 */
export function isInternalPhone(phone: string | number | null | undefined): boolean {
  const norm = normalizePhone(phone);
  if (!norm) return false;
  return INTERNAL_PHONE_SUFFIXES.some(suf => norm.endsWith(suf));
}

/**
 * Filtra una lista excluyendo los telefonos internos.
 * `getPhone` extrae el telefono de cada item.
 */
export function filterInternal<T>(items: T[], getPhone: (item: T) => string | number | null | undefined): T[] {
  return items.filter(it => !isInternalPhone(getPhone(it)));
}
