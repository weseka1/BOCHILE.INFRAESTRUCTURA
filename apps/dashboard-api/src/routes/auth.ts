import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { getUserByEmail, verifyPassword } from '../auth/users';
import {
  requireAuth,
  JWT_SECRET,
  AUTH_COOKIE_NAME,
  type AuthPayload,
} from '../middleware/requireAuth';

const router = Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * POST /api/auth/login
 * body: { email, password }
 * - busca user en sheet "users"
 * - bcrypt.compare(password, password_hash)
 * - jwt.sign({email, nombre, rol}, JWT_SECRET, 7d)
 * - set cookie httpOnly secure sameSite=lax (none en cross-site prod)
 * - devuelve { user }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan email o password' });
    }
    const user = await getUserByEmail(String(email));
    if (!user) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const ok = await verifyPassword(String(password), String(user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }
    const payload: AuthPayload = {
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      // En prod cross-site (dashboard en render, api en render distinto host) requiere 'none' + secure
      sameSite: IS_PROD ? 'none' : 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return res.json({ user: payload });
  } catch (err) {
    console.error('[auth/login] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * POST /api/auth/logout
 * Limpia la cookie.
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
  });
  return res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * requireAuth -> devuelve el user del JWT.
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

export default router;
