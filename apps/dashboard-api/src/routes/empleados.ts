import { Router } from 'express';
import { readSheet, updateRow } from '../services/sheets';
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

// PATCH /api/empleados/:empleado_id
// Permite actualizar campos del empleado: visitas_mes, cierres_mes,
// comisiones_mes, activo, rol, telefono, email, zona_especialidad, etc.
router.patch('/:empleado_id', async (req, res, next) => {
  try {
    const empleado_id = String(req.params.empleado_id || '').trim();
    if (!empleado_id) return res.status(400).json({ error: 'empleado_id requerido' });

    const b = (req.body ?? {}) as Partial<Empleado>;
    const allowed = [
      'nombre', 'rol', 'telefono', 'email', 'zona_especialidad', 'calendar_id',
      'activo', 'visitas_mes', 'cierres_mes', 'comisiones_mes',
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in b) update[k] = (b as Record<string, unknown>)[k];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'no hay campos para actualizar' });
    }

    const saved = await updateRow('empleados', 'empleado_id', empleado_id, update);
    if (!saved) return res.status(404).json({ error: 'empleado no encontrado' });
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

export default router;
