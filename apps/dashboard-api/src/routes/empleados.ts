import { Router } from 'express';
import { readSheet, updateRow, appendRow } from '../services/sheets';
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

// POST /api/empleados — crea un nuevo empleado.
// Genera empleado_id auto (E-N siguiente al maximo existente).
router.post('/', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Partial<Empleado>;
    if (!b.nombre || !String(b.nombre).trim()) {
      return res.status(400).json({ error: 'nombre requerido' });
    }

    // Calcular siguiente E-N
    const existentes = await readSheet<Empleado>('empleados');
    let maxN = 0;
    for (const e of existentes) {
      const m = String(e.empleado_id || '').match(/^E-(\d+)$/);
      if (m) maxN = Math.max(maxN, Number(m[1]));
    }
    const empleado_id = `E-${maxN + 1}`;

    const nuevo: Partial<Empleado> & { empleado_id: string; activo: boolean; disponibilidad: string } = {
      empleado_id,
      nombre: String(b.nombre).trim(),
      rol: String(b.rol || 'vendedor').trim(),
      telefono: String(b.telefono || '').trim(),
      email: String(b.email || '').trim(),
      zona_especialidad: String(b.zona_especialidad || '').trim(),
      calendar_id: String(b.calendar_id || '').trim(),
      activo: b.activo !== false,
      visitas_mes: Number(b.visitas_mes || 0),
      cierres_mes: Number(b.cierres_mes || 0),
      comisiones_mes: Number(b.comisiones_mes || 0),
      disponibilidad: String((b as any).disponibilidad || 'libre').trim(),
    };

    const saved = await appendRow('empleados', nuevo);
    res.status(201).json(saved);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/empleados/:empleado_id
router.patch('/:empleado_id', async (req, res, next) => {
  try {
    const empleado_id = String(req.params.empleado_id || '').trim();
    if (!empleado_id) return res.status(400).json({ error: 'empleado_id requerido' });

    const b = (req.body ?? {}) as Partial<Empleado> & { disponibilidad?: string };
    const allowed = [
      'nombre', 'rol', 'telefono', 'email', 'zona_especialidad', 'calendar_id',
      'activo', 'visitas_mes', 'cierres_mes', 'comisiones_mes', 'disponibilidad',
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
