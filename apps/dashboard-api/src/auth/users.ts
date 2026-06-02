import bcrypt from 'bcryptjs';
import { readSheet, appendRow, invalidateCache } from '../services/sheets';
import type { User } from '../types/domain';

/**
 * Buscar un usuario por email en la pestana "users" del Sheet.
 * Devuelve null si no existe o si el usuario esta inactivo.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  if (!email) return null;
  const emailLower = String(email).trim().toLowerCase();
  // No usar cache para auth — siempre pedir fresh
  invalidateCache('users');
  const users = await readSheet<User>('users');
  const match = users.find(
    (u) => String(u.email || '').trim().toLowerCase() === emailLower,
  );
  if (!match) return null;
  // activo viene como boolean (parseado por sheets.ts). Si es false explicitamente, rechazar.
  if (match.activo === false) return null;
  return match;
}

/**
 * Crea un usuario nuevo. Hashea la password con bcrypt (10 rounds).
 * No verifica duplicados — el caller debe chequear con getUserByEmail antes.
 */
export async function createUser(
  email: string,
  password: string,
  nombre: string,
  rol: string,
): Promise<User> {
  const password_hash = await bcrypt.hash(password, 10);
  const row: User = {
    email: String(email).trim().toLowerCase(),
    password_hash,
    nombre: String(nombre || ''),
    rol: String(rol || 'admin'),
    creado_en: new Date().toISOString(),
    activo: true,
  };
  await appendRow('users', row as unknown as Record<string, unknown>);
  return row;
}

/**
 * Verifica una password contra el hash almacenado en el Sheet.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
