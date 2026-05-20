import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { Propiedad } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<Propiedad>('propiedades');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
