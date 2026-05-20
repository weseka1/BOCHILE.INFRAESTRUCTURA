import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { Lead, Propiedad, Visita, MatchPendiente, AccionIA, Conversacion, Metrics } from '../types/domain';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const [leads, props, visitas, matches, acciones, convs] = await Promise.all([
      readSheet<Lead>('leads'),
      readSheet<Propiedad>('propiedades'),
      readSheet<Visita>('visitas'),
      readSheet<MatchPendiente>('matches_pendientes'),
      readSheet<AccionIA>('acciones_ia'),
      readSheet<Conversacion>('conversaciones'),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Filtramos agentes "tecnicos" (crons de sync, backups, etc) que inflan el log
    // pero no aportan al KPI de tiempo ahorrado por la IA real (CORE + sub-agentes).
    const AGENTES_TECNICOS = new Set([
      'Cron Sync Sheets',
      'Cron Backup',
      'Cron Cleanup',
      'System',
    ]);
    const accionesReales = acciones.filter(
      (a) => !AGENTES_TECNICOS.has(String(a.agente ?? '')),
    );

    const kpis = {
      leadsTotal: leads.length,
      leadsHoy: leads.filter((l) => (l.creado_en ?? '').startsWith(hoy)).length,
      leadsCalificados: leads.filter((l) => (l.score ?? 0) >= 70).length,
      visitasAgendadas: visitas.filter((v) => v.estado === 'agendada').length,
      propiedadesActivas: props.filter((p) => p.publicada === true).length,
      matchesPendientes: matches.filter((m) => m.estado === 'activo').length,
      accionesIaUltimaSemana: accionesReales.filter(
        (a) => (a.timestamp ?? '') >= haceUnaSemana,
      ).length,
      tiempoAhorradoTotalMin: accionesReales.reduce(
        (acc, a) => acc + (Number(a.tiempo_ahorrado_min) || 0),
        0,
      ),
    };

    const groupCount = <T,>(arr: T[], key: (x: T) => string) => {
      const map = new Map<string, number>();
      arr.forEach((x) => {
        const k = (key(x) || 'Sin definir').toString();
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      return Array.from(map.entries()).map(([k, count]) => ({ key: k, count }));
    };

    const leadsPorEtapa = groupCount(leads, (l) => l.etapa).map((x) => ({ etapa: x.key, count: x.count }));
    const leadsPorZona = groupCount(leads, (l) => l.zona_pref).map((x) => ({ zona: x.key, count: x.count }));
    const accionesPorAgente = groupCount(accionesReales, (a) => a.agente).map((x) => ({
      agente: x.key,
      count: x.count,
    }));

    // Mensajes por dia (ultimos 14 dias)
    const dailyMap = new Map<string, number>();
    convs.forEach((c) => {
      const day = (c.timestamp ?? '').slice(0, 10);
      if (day) dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
    });
    const mensajesPorDia = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([fecha, count]) => ({ fecha, count }));

    const out: Metrics = {
      kpis,
      charts: { leadsPorEtapa, leadsPorZona, accionesPorAgente, mensajesPorDia },
    };
    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
