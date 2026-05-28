import { Router } from 'express';
import { readSheet, updateRow, deleteRow, deleteRows } from '../services/sheets';
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

// PATCH /api/leads/:lead_id
// Permite actualizar campos del lead — usado para despausar el bot
// (bot_pausado_hasta vacio), cambiar etapa, asignar vendedor, etc.
router.patch('/:lead_id', async (req, res, next) => {
  try {
    const lead_id = String(req.params.lead_id || '').trim();
    if (!lead_id) return res.status(400).json({ error: 'lead_id requerido' });

    const b = (req.body ?? {}) as Partial<Lead> & { bot_pausado_hasta?: string };
    const allowed = [
      'nombre', 'telefono', 'email', 'operacion', 'tipo_propiedad', 'zona_pref',
      'ambientes', 'presupuesto_min', 'presupuesto_max', 'moneda', 'forma_pago',
      'urgencia', 'score', 'etapa', 'vendedor_asignado', 'ultima_intencion', 'notas',
      'bot_pausado_hasta', 'actualizado_en',
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in b) update[k] = (b as Record<string, unknown>)[k];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'no hay campos para actualizar' });
    }
    if (!('actualizado_en' in update)) update.actualizado_en = new Date().toISOString();

    const saved = await updateRow('leads', 'lead_id', lead_id, update);
    if (!saved) return res.status(404).json({ error: 'lead no encontrado' });
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

// POST /api/leads/:lead_id/unpause
// Atajo para reactivar el bot en un lead (limpia bot_pausado_hasta).
router.post('/:lead_id/unpause', async (req, res, next) => {
  try {
    const lead_id = String(req.params.lead_id || '').trim();
    if (!lead_id) return res.status(400).json({ error: 'lead_id requerido' });

    const saved = await updateRow('leads', 'lead_id', lead_id, {
      bot_pausado_hasta: '',
      actualizado_en: new Date().toISOString(),
    });
    if (!saved) return res.status(404).json({ error: 'lead no encontrado' });
    res.json({ ok: true, lead_id, message: 'bot reactivado para este lead' });
  } catch (e) {
    next(e);
  }
});

// POST /api/leads/:lead_id/reset
// Resetea TODO el estado del lead: borra el lead, sus conversaciones, sus
// visitas pendientes y sus acciones IA. Pensado para testing — al proximo
// mensaje del cliente, el bot lo trata como totalmente nuevo (sin historia,
// sin contexto, sin pausa).
router.post('/:lead_id/reset', async (req, res, next) => {
  try {
    const lead_id = String(req.params.lead_id || '').trim();
    if (!lead_id) return res.status(400).json({ error: 'lead_id requerido' });

    const counts = {
      conversaciones: await deleteRows('conversaciones', 'lead_id', lead_id),
      visitas: await deleteRows('visitas', 'lead_id', lead_id),
      acciones_ia: await deleteRows('acciones_ia', 'lead_id', lead_id).catch(() => 0),
      matches: await deleteRows('matches_pendientes', 'lead_id', lead_id).catch(() => 0),
      lead: (await deleteRow('leads', 'lead_id', lead_id)) ? 1 : 0,
    };
    res.json({ ok: true, lead_id, deleted: counts, message: 'lead reseteado, proximo mensaje arranca de cero' });
  } catch (e) {
    next(e);
  }
});

export default router;
