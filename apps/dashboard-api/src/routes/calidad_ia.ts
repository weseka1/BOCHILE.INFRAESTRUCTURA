import { Router } from 'express';
import { readSheet } from '../services/sheets';
import type { Conversacion } from '../types/domain';

const router = Router();

// ====================================================================
// Auditor de calidad de Cami: detecta fails en conversaciones reales
// ====================================================================

interface Issue {
  type: 'rule_zero_violation' | 'premature_pivot' | 'tech_leak' | 'weak_decline' | 'context_loss';
  severity: 'critical' | 'warning' | 'info';
  lead_id: string;
  nombre: string;
  telefono: string;
  timestamp: string;
  snippet: string;
  full_message?: string;
  context_before?: string;
  recomendacion: string;
}

interface Kpis {
  total_mensajes: number;
  total_leads: number;
  mensajes_in: number;
  mensajes_out: number;
  fails_totales: number;
  fails_criticos: number;
  fails_warning: number;
  fails_info: number;
  fail_rate_pct: number;
  tasa_humano_pct: number;
  ultima_actualizacion: string;
}

// Patrones de detección (regex precompilados)
const NEGATION_PATTERNS = [
  /no\s+tengo\s+(info|informaci|propied|datos|nada\s+(de|sobre))/i,
  /no\s+(manejo|trabajo|tenemos)\s+(propied|info\s+de|datos\s+de|en\s+)/i,
  /no\s+me\s+especializ/i,
  /(solo|s[óo]lo)\s+(trabajo|trabajamos|me\s+especializ).*bahia/i,
  /no\s+opero\s+en/i,
  /lamentablemente.*no\s+tengo/i,
];

const PIVOT_PATTERNS = [
  /en\s+qu[éeé]\s+zona\s+(te\s+)?gustar[íi]a/i,
  /en\s+qu[éeé]\s+(zona|localidad|barrio)/i,
  /qu[éeé]\s+est[áa]s\s+buscando/i,
  /(cont[áa]me|cuent[áa]me|dec[íi]me)\s+(qu[éeé]|m[áa]s|sobre)/i,
];

const TECH_LEAK_PATTERNS = [
  /RAG_TEMPORALMENTE_LENTO/i,
  /INSTRUCCION:/i,
  /ERROR_RAG/i,
  /SIN_STOCK/i,
  /\[IMAGEN RECIBIDA\]/i,
  /\[CONFIRMADO\]/i,
  /\[POSIBLES\]/i,
  /\[DEBIL\]/i,
  /system[_\s]*message/i,
  /undefined|null/i,
];

const WEAK_DECLINE_LOCALIDADES = ['Punta Alta', 'Pehu', 'Sierra', 'Villarino'];

// Detecta si un mensaje OUT del cliente menciona una prop especifica que el cliente trae
function clientReferencesPriorProp(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    /(esta|esa|esto|esa|la\s+que|la\s+de|por\s+qu[éeé]\s+dice|en\s+la\s+foto|tiene\s+\w+\?|cu[áa]ndo|cu[áa]nto\s+sale)/i.test(m) ||
    /\bN[°º]\s*\d+/.test(m) ||
    /calle\s+\d+/i.test(m)
  );
}

router.get('/audit', async (_req, res, next) => {
  try {
    const msgs = await readSheet<Conversacion>('conversaciones');
    msgs.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));

    // Agrupar por lead para tener contexto del turno previo
    const byLead = new Map<string, Conversacion[]>();
    for (const m of msgs) {
      const k = String(m.lead_id || '');
      if (!byLead.has(k)) byLead.set(k, []);
      byLead.get(k)!.push(m);
    }

    const issues: Issue[] = [];

    // Iterar por lead, mirando pares de mensajes (cliente -> cami)
    for (const [leadId, conv] of byLead.entries()) {
      for (let i = 0; i < conv.length; i++) {
        const m = conv[i]!;
        const isOutFromCami = m.direccion === 'out' && m.agente_que_respondio === 'Vendedor CORE';
        if (!isOutFromCami) continue;

        const msgText = String(m.mensaje || '');
        const prev = conv[i - 1];
        const prevText = prev ? String(prev.mensaje || '') : '';

        // ============= REGLA #0: negaciones sin Matcher =============
        for (const re of NEGATION_PATTERNS) {
          if (re.test(msgText)) {
            issues.push({
              type: 'rule_zero_violation',
              severity: 'critical',
              lead_id: leadId,
              nombre: String(m.nombre || ''),
              telefono: String(m.telefono || ''),
              timestamp: String(m.timestamp || ''),
              snippet: msgText.slice(0, 200).replace(/\n/g, ' '),
              full_message: msgText,
              context_before: prevText.slice(0, 200),
              recomendacion: 'Cami debio llamar al Matcher antes de decir "no tengo". Verificar prompt regla #0.',
            });
            break;
          }
        }

        // ============= TECH LEAKS al cliente =============
        for (const re of TECH_LEAK_PATTERNS) {
          if (re.test(msgText)) {
            issues.push({
              type: 'tech_leak',
              severity: 'critical',
              lead_id: leadId,
              nombre: String(m.nombre || ''),
              telefono: String(m.telefono || ''),
              timestamp: String(m.timestamp || ''),
              snippet: msgText.slice(0, 200).replace(/\n/g, ' '),
              full_message: msgText,
              recomendacion: 'Texto tecnico/error filtrado al cliente. Sanitizar prompt o filtro de output.',
            });
            break;
          }
        }

        // ============= PREMATURE PIVOT: cliente habla de prop especifica, Cami pivotea a busqueda =============
        if (prev && prev.direccion === 'in') {
          const prevHasContext = prev.msg_type === 'image' || clientReferencesPriorProp(prevText);
          if (prevHasContext) {
            for (const re of PIVOT_PATTERNS) {
              if (re.test(msgText)) {
                issues.push({
                  type: 'premature_pivot',
                  severity: 'warning',
                  lead_id: leadId,
                  nombre: String(m.nombre || ''),
                  telefono: String(m.telefono || ''),
                  timestamp: String(m.timestamp || ''),
                  snippet: msgText.slice(0, 200).replace(/\n/g, ' '),
                  full_message: msgText,
                  context_before: prevText.slice(0, 200),
                  recomendacion: 'Cliente preguntaba sobre prop especifica - Cami pivoteo a busqueda generica. Ver regla persistencia contexto v2.7.',
                });
                break;
              }
            }
          }
        }

        // ============= WEAK DECLINE: declina zona pero no lista las 6 localidades =============
        if (/(no\s+operamos|no\s+manejamos|no\s+trabajamos|no\s+tenemos\s+propied).*(la\s+plata|mar\s+del\s+plata|cordoba|mendoza|capital|gba|rosario)/i.test(msgText)) {
          const localidadesMencionadas = WEAK_DECLINE_LOCALIDADES.filter(l => msgText.includes(l)).length;
          if (localidadesMencionadas < 2) {
            issues.push({
              type: 'weak_decline',
              severity: 'warning',
              lead_id: leadId,
              nombre: String(m.nombre || ''),
              telefono: String(m.telefono || ''),
              timestamp: String(m.timestamp || ''),
              snippet: msgText.slice(0, 200).replace(/\n/g, ' '),
              full_message: msgText,
              recomendacion: `Decline incompleto: solo menciona ${localidadesMencionadas}/4 localidades secundarias. Aplicar regla 3 pasos (PA, Pehuen Co, Sierras, Villarino).`,
            });
          }
        }
      }
    }

    // Sort issues: critical first, recientes primero
    const sevOrder = { critical: 0, warning: 1, info: 2 };
    issues.sort((a, b) => {
      const s = sevOrder[a.severity] - sevOrder[b.severity];
      if (s !== 0) return s;
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    // KPIs
    const mIn = msgs.filter(m => m.direccion === 'in').length;
    const mOut = msgs.filter(m => m.direccion === 'out').length;
    const humanReq = msgs.filter(m => m.requiere_humano === true || String(m.requiere_humano).toUpperCase() === 'TRUE').length;
    const kpis: Kpis = {
      total_mensajes: msgs.length,
      total_leads: byLead.size,
      mensajes_in: mIn,
      mensajes_out: mOut,
      fails_totales: issues.length,
      fails_criticos: issues.filter(i => i.severity === 'critical').length,
      fails_warning: issues.filter(i => i.severity === 'warning').length,
      fails_info: issues.filter(i => i.severity === 'info').length,
      fail_rate_pct: mOut > 0 ? Number(((issues.length / mOut) * 100).toFixed(2)) : 0,
      tasa_humano_pct: msgs.length > 0 ? Number(((humanReq / msgs.length) * 100).toFixed(2)) : 0,
      ultima_actualizacion: new Date().toISOString(),
    };

    // Top issues por tipo (para dashboard de patrones)
    const byType: Record<string, number> = {};
    for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;

    res.json({
      kpis,
      issues_by_type: byType,
      issues: issues.slice(0, 100), // cap a top 100 para no saturar UI
      total_issues: issues.length,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
