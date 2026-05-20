import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { MatchPendiente } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<MatchPendiente>('matches_pendientes');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
