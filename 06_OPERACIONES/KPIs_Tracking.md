# KPIs y Tracking · Bochile

## Los 6 KPIs core

| # | KPI | Objetivo | Estado |
|---|---|---|---|
| 1 | CPC | < $ 0.15 USD | ⏳ no medido |
| 2 | CR a conversación | > 25% | ⏳ no medido |
| 3 | Cost per conversación | < $ 1.60 USD | ⏳ no medido |
| 4 | Conversaciones / mes | 250 - 350 | ⏳ no medido |
| 5 | Conv → Visita | > 18% | ⏳ no medido |
| 6 | ROAS mes 3 | > 4x | ⏳ no medido |

> Actualizar este tracker cada lunes con los datos de la semana anterior.

---

## Dashboard semanal

### Semana del [DD/MM] al [DD/MM]

| KPI | Resultado | vs target | Tendencia | Acción |
|---|---|---|---|---|
| CPC | — | — | — | — |
| CR | — | — | — | — |
| Cost/conv | — | — | — | — |
| Conversaciones | — | — | — | — |

> Duplicar este bloque cada semana.

---

## KPIs secundarios (para diagnóstico)

### De creatividad
- CTR por ad
- Tiempo promedio de visualización (Reels)
- Engagement rate (likes + comments + shares)
- Frequency

### De audiencia
- CPC por ad set (A1 vs A2 vs A3)
- Cost per conversación por audiencia
- Lead quality score promedio por audiencia (de Camila)

### De funnel
- % conversaciones → visita
- % visitas → reserva
- % reservas → cierre
- Tiempo promedio lead → cierre (días)
- LTV por audiencia

---

## ROI esperado y cómo se calcula

### Asunciones

- Comisión promedio Bochile por venta: 4% del precio
- Ticket promedio venta: USD 180.000
- Comisión por venta: ~ USD 7.200
- Tasa de cierre lead → venta: ~ 2% (industry standard real estate)

### Math

```
Mes 1 · Tier USD 400
- Conversaciones: 280 (mid-range esperado)
- Conversiones a venta: 280 × 2% = 5.6 ventas
- Comisiones generadas: 5.6 × USD 7.200 = USD 40.300
- ROAS: USD 40.300 / USD 400 = 100x

Esto es teórico. En la práctica, con ciclo de cierre real estate de 30-90 días,
el ROAS real del mes 1 puede ser 0 (todavía no cerraron) y el del mes 3 ser muy alto.
Por eso medimos ROAS al mes 3.
```

### Ajuste con realidad

- Mes 1: 0-1 cierres atribuibles (los leads están en pipeline)
- Mes 2: 2-3 cierres
- Mes 3: 4-6 cierres → ROAS real ~ 8-15x (ya bajó pero sigue siendo grande)

---

## Sistema de tracking

### Stack

- **Meta Ads Manager** — métricas de campaña
- **Pixel + CAPI** — eventos de la web
- **WhatsApp Business webhook** — apertura de mensajes
- **CRM Bochile** — pipeline + cierre de operaciones
- **Google Sheet maestra** — consolidación semanal
- **Looker Studio (gratis)** — dashboard ejecutivo Bochile

### Flujo de datos

```
Meta Ad → Click → WhatsApp opened (Pixel event)
                ↓
          Mensaje enviado (Webhook WA)
                ↓
          Lead creado en CRM con utm_*
                ↓
          IA califica → Score (CRM event)
                ↓
          Visita agendada (CRM event)
                ↓
          Operación cerrada (CRM event)
                ↓
          Sync diario a Google Sheets
                ↓
          Looker Studio dashboard refrescado
```

### Eventos custom que mandamos a Pixel

```javascript
fbq('trackCustom', 'WhatsAppMessageInitiated', {
  campaign_id: '...',
  ad_id: '...',
  audience: 'A1',
  pillar: 'tour360'
});

fbq('trackCustom', 'LeadQualified', {
  lead_id: '...',
  score: 85,
  audience: 'A1',
  cost_to_qualify: 1.40
});

fbq('trackCustom', 'DealClosed', {
  deal_id: '...',
  value: 7200,
  currency: 'USD',
  cycle_days: 42
});
```

---

## Reportes

### Reporte semanal (interno WESEKA)

Cada lunes a las 9:00 hs. WESEKA actualiza este documento + manda email a Bochile con:
- 6 KPIs core
- 3 wins de la semana
- 2 cosas que ajustar
- Forecast próxima semana

### Reporte mensual (a Bochile)

Cada primer lunes del mes nuevo. Reunión + PDF de 4-6 páginas con:
- Resumen del mes (KPIs vs target)
- ROI calculado (con ciclo de cierre)
- Top 3 ads ganadores
- Top 3 ads pausados (y por qué)
- Plan del mes siguiente

### Reporte trimestral (a Bochile)

Cada 90 días. Decisión de escalado tier.

---

## Alertas críticas

> Configurar email + WhatsApp a Yamil cuando:

🚨 **CPC > $0.30 sostenido 3 días** → Probable fatiga, intervenir
🚨 **0 conversaciones en 24h** → Algo está roto, debug urgente
🚨 **CR < 15%** → Hooks débiles, rotar creatividades
🚨 **Frequency > 5.0** → Audiencia saturada, expandir o cambiar
🚨 **Pixel events caídos** → Tracking roto, perdiendo datos

---

*Última actualización: 29 abr 2026 · Activar al lanzar campañas*
