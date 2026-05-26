import { Router } from 'express';
import { readSheet, appendRow } from '../services/sheets';
import type { Visita } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await readSheet<Visita>('visitas');
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Partial<Visita>;
    if (!b.fecha || !b.hora || !b.cliente_nombre) {
      return res.status(400).json({ error: 'fecha, hora y cliente_nombre son requeridos' });
    }

    const visita_id = b.visita_id?.toString().trim() || `V-${Date.now()}`;
    const ahora = new Date().toISOString();

    const payload: Visita = {
      visita_id,
      lead_id: String(b.lead_id || ''),
      prop_id: String(b.prop_id || ''),
      vendedor_id: String(b.vendedor_id || ''),
      vendedor_nombre: String(b.vendedor_nombre || ''),
      cliente_nombre: String(b.cliente_nombre || ''),
      direccion: String(b.direccion || ''),
      fecha: String(b.fecha),
      hora: String(b.hora),
      estado: String(b.estado || 'agendada'),
      confirmada_cliente: Boolean(b.confirmada_cliente),
      notificada_vendedor: Boolean(b.notificada_vendedor),
      recordatorio_enviado: Boolean(b.recordatorio_enviado),
      resultado: String(b.resultado || ''),
      observaciones: String(b.observaciones || ''),
      creada_en: String(b.creada_en || ahora),
    };

    const saved = await appendRow('visitas', payload as unknown as Record<string, unknown>);
    res.status(201).json(saved);
  } catch (e) {
    next(e);
  }
});

export default router;
