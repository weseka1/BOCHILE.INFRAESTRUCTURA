import { Router } from 'express';
import { readSheet, appendRow, updateRow, deleteRow } from '../services/sheets';
import type { Tarea } from '../types/domain';

const router = Router();

// GET /api/tareas - lista todas, ordenadas por creada_en desc
router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<Tarea>('tareas');
    data.sort((a, b) => (b.creada_en ?? '').localeCompare(a.creada_en ?? ''));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// POST /api/tareas - crear nueva
router.post('/', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Partial<Tarea>;
    if (!b.titulo || !String(b.titulo).trim()) {
      return res.status(400).json({ error: 'titulo es requerido' });
    }
    const ahora = new Date().toISOString();
    const tarea_id = b.tarea_id?.toString().trim() || `T-${Date.now()}`;
    const payload: Tarea = {
      tarea_id,
      titulo: String(b.titulo).trim(),
      descripcion: String(b.descripcion || ''),
      prioridad: String(b.prioridad || 'media'),
      estado: String(b.estado || 'pendiente'),
      asignado_a: String(b.asignado_a || ''),
      vencimiento: String(b.vencimiento || ''),
      creada_en: String(b.creada_en || ahora),
      completada_en: String(b.completada_en || ''),
    };
    const saved = await appendRow('tareas', payload as unknown as Record<string, unknown>);
    res.status(201).json(saved);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/tareas/:id - actualizar parcial
router.patch('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const patch = (req.body ?? {}) as Partial<Tarea>;

    // Si estado pasa a "completada" y no viene completada_en, lo seteamos
    if (patch.estado === 'completada' && !patch.completada_en) {
      patch.completada_en = new Date().toISOString();
    }
    // Si estado vuelve atras (uncompleting), limpiar completada_en
    if (patch.estado && patch.estado !== 'completada') {
      patch.completada_en = '';
    }

    const updated = await updateRow('tareas', 'tarea_id', id, patch as Record<string, unknown>);
    if (!updated) return res.status(404).json({ error: 'tarea no encontrada' });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/tareas/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const ok = await deleteRow('tareas', 'tarea_id', id);
    if (!ok) return res.status(404).json({ error: 'tarea no encontrada' });
    res.json({ deleted: id });
  } catch (e) {
    next(e);
  }
});

export default router;
