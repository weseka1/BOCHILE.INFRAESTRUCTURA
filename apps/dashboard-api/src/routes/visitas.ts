import { Router } from 'express';
import { readSheet, appendRow, updateRow } from '../services/sheets';
import type { Visita } from '../types/domain';

const router = Router();

// GET /api/visitas?estado=pendiente|confirmada|cancelada|agendada
// Sin filtro: devuelve todas.
router.get('/', async (req, res, next) => {
  try {
    const data = await readSheet<Visita>('visitas');
    const estado = String(req.query.estado || '').toLowerCase();
    if (!estado) return res.json(data);
    const filtered = data.filter(v => String(v.estado || '').toLowerCase() === estado);
    res.json(filtered);
  } catch (e) {
    next(e);
  }
});

// POST /api/visitas
// Crea una visita. Si llega con fecha+hora -> estado por defecto "confirmada".
// Si solo trae interes (sin fecha/hora) -> estado por defecto "pendiente".
// El detector automatico del n8n usa esto.
router.post('/', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Partial<Visita> & { origen?: string };
    if (!b.cliente_nombre && !b.lead_id) {
      return res.status(400).json({ error: 'cliente_nombre o lead_id es requerido' });
    }

    const hasFechaHora = b.fecha && b.hora;
    const defaultEstado = hasFechaHora ? 'confirmada' : 'pendiente';
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
      fecha: String(b.fecha || ''),
      hora: String(b.hora || ''),
      estado: String(b.estado || defaultEstado),
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

// PATCH /api/visitas/:visita_id
// Permite a Camila confirmar (con fecha+hora+vendedor), cancelar, editar.
router.patch('/:visita_id', async (req, res, next) => {
  try {
    const visita_id = String(req.params.visita_id || '').trim();
    if (!visita_id) return res.status(400).json({ error: 'visita_id requerido' });

    const b = (req.body ?? {}) as Partial<Visita>;
    const allowed: (keyof Visita)[] = [
      'lead_id', 'prop_id', 'vendedor_id', 'vendedor_nombre', 'cliente_nombre',
      'direccion', 'fecha', 'hora', 'estado',
      'confirmada_cliente', 'notificada_vendedor', 'recordatorio_enviado',
      'resultado', 'observaciones',
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in b) update[k] = (b as Record<string, unknown>)[k];
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'no hay campos para actualizar' });
    }

    const saved = await updateRow('visitas', 'visita_id', visita_id, update);
    if (!saved) return res.status(404).json({ error: 'visita no encontrada' });
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

export default router;
