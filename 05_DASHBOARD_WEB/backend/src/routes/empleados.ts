import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { Empleado } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<Empleado>('empleados');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
