import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * JWT secret. Leer de env; si no esta, usar default (Yamil debe setearlo en Render).
 */
export const JWT_SECRET: string =
  process.env.JWT_SECRET || 'bochile-default-jwt-secret-change-me-in-render';

export const AUTH_COOKIE_NAME = 'bochile_auth';

export interface AuthPayload {
  email: string;
  nombre: string;
  rol: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}

/**
 * Middleware: lee la cookie "bochile_auth", verifica el JWT y adjunta
 * el payload a req.user. Si falla, devuelve 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // cookie-parser pone las cookies en req.cookies
  const token =
    (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = {
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
}
