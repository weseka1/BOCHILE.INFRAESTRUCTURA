import { Router } from 'express';
import { readSheet, appendRow } from '../services/sheets';
import type { Conversacion } from '../types/domain';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// GET es solo para humanos autenticados (Camila desde el dashboard)
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const data = await readSheet<Conversacion>('conversaciones');
    // Ordenar por timestamp desc para que las recientes esten primero
    data.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
    res.json(data);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/conversaciones - Append un mensaje al Sheet (usado por n8n para
 * loguear mensajes de canales pasivos como Alquileres, donde Cami NO procesa
 * pero los dueños quieren ver la conversacion).
 *
 * Body: campos de Conversacion. Si falta timestamp/msg_id, se autogeneran.
 */
router.post('/', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Partial<Conversacion>;
    if (!b.telefono && !b.lead_id) {
      return res.status(400).json({ error: 'telefono o lead_id es requerido' });
    }
    const ahora = new Date().toISOString();
    const payload: Conversacion = {
      msg_id: b.msg_id?.toString().trim() || `M-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lead_id: String(b.lead_id || ''),
      telefono: String(b.telefono || ''),
      nombre: String(b.nombre || ''),
      canal: String(b.canal || 'whatsapp'),
      direccion: (b.direccion === 'out' ? 'out' : 'in'),
      mensaje: String(b.mensaje || ''),
      msg_type: String(b.msg_type || 'text'),
      media_url: String(b.media_url || ''),
      intencion_detectada: String(b.intencion_detectada || ''),
      agente_que_respondio: String(b.agente_que_respondio || ''),
      requiere_humano: Boolean(b.requiere_humano),
      timestamp: String(b.timestamp || ahora),
      channel_id: String(b.channel_id || ''),
    };
    const saved = await appendRow('conversaciones', payload as unknown as Record<string, unknown>);
    res.status(201).json(saved);
  } catch (e) {
    next(e);
  }
});

export default router;
