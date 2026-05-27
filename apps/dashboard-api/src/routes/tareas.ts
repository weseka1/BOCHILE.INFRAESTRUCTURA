import { Router } from 'express';
import { readSheet, appendRow, updateRow, deleteRow } from '../services/sheets';
import type { Tarea } from '../types/domain';

const router = Router();

// ============================================================
// Helper: convertir fecha "Sheets serial number" a ISO string.
// Google Sheets auto-convierte strings tipo "2026-05-30" a numero
// serial (dias desde 1899-12-30). Cuando lo leemos con UNFORMATTED_VALUE,
// volvemos a recibir el numero. JS sin convertir lo interpreta como ms
// desde epoch -> aparece como 31 dic 1969. Bug "fecha cualquiera + VENCIDA".
// ============================================================
function sheetDateToISO(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  // Si ya es ISO string (ej "2026-05-30T..." o "2026-05-30"), devolver tal cual
  if (typeof v === 'string') return v;
  if (typeof v !== 'number') return String(v);
  // Numero pequeño (< 100000) y positivo: es un Sheets serial day count.
  // 25569 = 1970-01-01 en Sheets. Antes de eso son fechas pre-Unix.
  if (v < 1 || v > 100000) return String(v);
  const ms = (v - 25569) * 86400000;
  return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

function normalizeTarea(t: Tarea): Tarea {
  return {
    ...t,
    vencimiento: sheetDateToISO(t.vencimiento),
    creada_en: typeof t.creada_en === 'number' ? sheetDateToISO(t.creada_en) : String(t.creada_en || ''),
    completada_en: typeof t.completada_en === 'number' ? sheetDateToISO(t.completada_en) : String(t.completada_en || ''),
  };
}

// GET /api/tareas - lista todas, ordenadas por creada_en desc
router.get('/', async (_req, res, next) => {
  try {
    const raw = await readSheet<Tarea>('tareas');
    const data = raw.map(normalizeTarea);
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
    res.status(201).json(normalizeTarea(saved as unknown as Tarea));
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
    res.json(normalizeTarea(updated as unknown as Tarea));
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
