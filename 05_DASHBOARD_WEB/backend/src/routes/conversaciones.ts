import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { Conversacion } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<Conversacion>('conversaciones');
    // Ordenar por timestamp desc para que las recientes esten primero
    data.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
