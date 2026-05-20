# Configuración Meta Ads · Bochile

## Setup inicial

### Cuentas necesarias

- [ ] Cuenta personal Facebook (de Carlos Bochile)
- [ ] Página Facebook "Inmobiliaria Bochile"
- [ ] Cuenta Instagram "@inmobiliariabochile" verificada
- [ ] Business Manager (Meta Business Suite)
- [ ] Ad Account dentro del Business Manager
- [ ] Pixel de Meta instalado en web Bochile
- [ ] Conversions API (CAPI) configurada server-side
- [ ] WhatsApp Business API conectada al Business Manager
- [ ] Catálogo de propiedades sincronizado (opcional pero recomendado)
- [ ] Forma de pago en USD (tarjeta crédito Carlos)

### Permisos en Business Manager

| Persona | Rol |
|---|---|
| Carlos Bochile | Admin total |
| Yamil (WESEKA) | Admin total |
| Vendedores | Acceso página + WhatsApp (no ads) |

---

## Estructura de campañas (Tier inicial USD 400)

```
CAMPAÑA · CONVERSACIONES_BOCHILE_BB
│
├── AD SET 1 · A1_FAMILIAS [USD 160 / mes · USD 5.30 / día]
│   ├── Audiencia: A1 Familias compradoras BB + 30km
│   ├── Optimización: Mensajes (Click-to-WhatsApp)
│   ├── Placements: Reels + Feed + Stories (auto)
│   └── Ads: rotación de 4-6 piezas activas (pilares 1, 2, 3)
│
├── AD SET 2 · A2_JOVENES [USD 100 / mes · USD 3.30 / día]
│   ├── Audiencia: A2 Inquilinos jóvenes BB
│   ├── Optimización: Mensajes
│   ├── Placements: Reels + Stories priorizados
│   └── Ads: rotación 4-6 piezas (pilares 2, 3 educación, 5)
│
├── AD SET 3 · A3_PROPIETARIOS [USD 100 / mes · USD 3.30 / día]
│   ├── Audiencia: A3 Propietarios/inversores
│   ├── Optimización: Mensajes
│   ├── Placements: Feed + Stories (Reels secundario)
│   └── Ads: rotación 4-6 piezas (pilares 4 datos, 5 casos)
│
└── AD SET 4 · BOOSTING_RAPIDO [USD 40 / mes · variable]
    └── Para piezas orgánicas que pegan: boost de $5-10 por 2-3 días
```

---

## Configuración de campaña paso a paso

### En Ads Manager

1. **Crear campaña**
   - Objetivo: **Engagement → Mensajes**
   - Tipo de mensaje: **WhatsApp**
   - Nombre: `2026Q2 · BB · CONV_BOCHILE`
   - Optimización CBO: ❌ NO usar (mejor manejo manual por ad set)
   - Nivel campaña sin presupuesto

2. **Crear ad set por audiencia (×3)**
   - Performance goal: **Maximize number of conversations**
   - Presupuesto: diario
   - Schedule: continuo (sin fecha fin)
   - Optimization location: WhatsApp number (el Business)
   - Audience: como definido en Audiencias_BB.md
   - Placements: **Advantage+ placements** (que Meta optimice)
   - Manual placement override solo si: queremos solo Reels para A2

3. **Crear ads (×4-6 por ad set)**
   - Format: según pieza (Single video / Carousel / etc)
   - Primary text: copy del ad
   - Headline: el hook
   - CTA button: **Send Message**
   - WhatsApp number: el Business
   - Tracking: UTM `?utm_source=meta&utm_campaign={pilar}&utm_content={ad_id}`
   - Pixel events: configurar evento custom `whatsapp_message_initiated`

---

## Configuración WhatsApp Business

### Mensaje de bienvenida automático (Camila IA)

> "¡Hola! Soy Camila, asistente de Inmobiliaria Bochile 👋
> Te leo en menos de 30 segundos. Para encontrar lo que buscás, contame:
>  · ¿Qué te interesa? (Comprar / Alquilar / Vender)
>  · ¿Algún barrio en particular?
>  · ¿Para vivir o como inversión?"

### Etiquetas WhatsApp Business

- 🟢 Lead nuevo
- 🟡 Calificando
- 🔵 Visita agendada
- 🟣 En negociación
- ⭐ Cliente cerrado
- 🚫 No interesado / fuera de presupuesto

### Respuestas rápidas pre-cargadas (para vendedor humano)

- `/visita` — Confirmación de visita con dirección y horario
- `/contraoferta` — Mensaje contraoferta + plazo decisión
- `/papeles` — Lista de papeles necesarios para reserva
- `/credito` — Link a simulador hipotecario

---

## Tracking y atribución

### Eventos a trackear

| Evento | Dónde | Fuente |
|---|---|---|
| `ad_click` | Meta automático | — |
| `whatsapp_message_initiated` | Custom event Pixel | Cuando se abre WhatsApp |
| `whatsapp_message_sent` | Webhook WhatsApp Business | Lead realmente escribió |
| `lead_qualified` | CRM custom event | IA marcó score > 70 |
| `visit_scheduled` | CRM custom event | Visita en calendar |
| `deal_closed` | CRM custom event | Op firmada |

### URLs de seguimiento

Todas las campañas usan UTMs:

```
?utm_source=meta
&utm_medium={paid_social}
&utm_campaign={pilar_NN}    # ej: tour360_01
&utm_content={ad_id}
&utm_term={audiencia}        # A1 / A2 / A3
```

---

## Costos esperados

| Métrica | Tier 1 (USD 400) | Tier 2 (USD 1.000) | Tier 3 (USD 2.500) |
|---|---|---|---|
| CPC | < $ 0.15 | < $ 0.13 | < $ 0.12 |
| CPM | < $ 4 | < $ 5 | < $ 6 |
| CR a conversación | > 25% | > 28% | > 30% |
| Cost per conversation | < $ 1.60 | < $ 1.40 | < $ 1.30 |
| Conversaciones / mes | 250-350 | 700-1.000 | 2.000-2.800 |

---

## Reglas automáticas en Ads Manager

> Configurar estas rules para que el sistema actúe solo:

1. **Auto-pause si CPC > $0.30 por 4 días**
   - Condición: `Average CPC > 0.30 USD` AND `Time period last 4 days`
   - Acción: Pausar ad

2. **Auto-pause por fatiga**
   - Condición: `Frequency > 5.0`
   - Acción: Pausar ad

3. **Notificación si CTR < 1%**
   - Condición: `CTR < 1.0%` AND `Impressions > 5000`
   - Acción: Email a WESEKA

---

## Frecuencia de revisión

| Frecuencia | Quién | Qué |
|---|---|---|
| Diario · 5 min | WESEKA | CPC + conversaciones del día |
| Semanal · 30 min | WESEKA | Pausar/mantener creativos + audiencias |
| Quincenal · 60 min | WESEKA + Bochile | Revisar performance + decisiones |
| Mensual · 90 min | WESEKA + Bochile | Reporte ejecutivo + escalar tier |

---

*Última actualización: 29 abr 2026 · Activar al firmar Bochile*
