import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { AccionIA } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<AccionIA>('acciones_ia');
    data.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
