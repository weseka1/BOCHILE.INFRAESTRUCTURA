import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { Lead } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<Lead>('leads');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
