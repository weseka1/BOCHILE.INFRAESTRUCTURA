# Inmobiliaria Bochile · Implementación WESEKA.IA

**Cliente:** Inmobiliaria Bochile (Bahía Blanca, Argentina, 50+ años)
**Estado:** Sistema operativo en producción, listo para handoff
**Entrega producción:** lunes 18 may 2026
**Última actualización del repo:** 2026-05-16
**Owner WESEKA:** Juani (Juan Ignacio López)

---

## Por dónde empezar

- **Si recibís el ZIP por primera vez** → [`00_LEEME_PRIMERO.md`](00_LEEME_PRIMERO.md) (cheatsheet operativo)
- **Si sos Yamil (socio que solo revisa)** → [`00_PARA_YAMIL.md`](00_PARA_YAMIL.md) (1 página ejecutiva)
- **Si vas a operar el sistema** → carpeta [`08_HANDOFF/`](08_HANDOFF/) (6 manuales)
- **Si vas a debuggear** → [`08_HANDOFF/04_QUE_PASA_SI.md`](08_HANDOFF/04_QUE_PASA_SI.md)

---

## Estructura de la carpeta

```
Bochile/
├── 00_LEEME_PRIMERO.md            ← cheatsheet operativo (Juani)
├── 00_PARA_YAMIL.md               ← FYI ejecutivo socio (1 página)
├── INDEX.md                       ← este archivo
│
├── 00_RESUMEN/                    ← brief del cliente, vista general
├── 01_PROPUESTA_COMERCIAL/        ← propuesta html que firmamos
├── 02_DEMO_OPERATIVO/             ← demo navegable html
├── 03_ROADMAP_META/               ← estrategia META Ads (mes 2+)
├── 04_INFRAESTRUCTURA_TECNICA/    ← n8n + Sheet + Scraper (capa motor)
│   ├── Sistema_n8n/               ← workflows + tests + estado
│   ├── Excel_Maestro/             ← Apps Script bootstrap del Sheet
│   ├── Bochile_Scraper/           ← scraper Node de bochile.com (239 props)
│   └── Stack_Tecnologico.md
├── 05_DASHBOARD_WEB/              ← pantalla de control (Vite+React+Node)
├── 06_OPERACIONES/                ← config Meta, audiencias, KPIs
├── 07_REUNIONES/                  ← minutas de cada reunión con cliente
├── 08_HANDOFF/                    ← MANUALES para operar (7 archivos)
└── 99_ASSETS/                     ← imágenes, recursos varios
```

---

## Sistema vivo · resumen ejecutivo

### Las 4 capas operativas (con RAG sumado el 16 may)

```
WhatsApp del cliente
      ↓ (Twilio Sandbox, gratis durante piloto)
      ↓ ngrok tunnel
n8n local (Docker, localhost:5680)
   ├─ W1  Chatbot Multi-Agente CORE (Cami + 3 sub-agentes)     ACTIVE
   │      └─ Vendedor CORE (Cami la humana real, gpt-4o)
   │      └─ SubAgente Matcher → toolWorkflow → Bochile RAG Search
   │      └─ SubAgente Calificador
   │      └─ SubAgente Administrativo (incl. Leer Agenda Vendedor)
   ├─ W2  Recordatorios de Visitas (cron horario)               ACTIVE
   ├─ W3  Match Retroactivo (cron 15 min)                       ACTIVE
   ├─ W4  Cobranza Alquileres (cron diario 9am)                 ACTIVE
   ├─ W5  Backup Mensual + Reset (cron día 1, 03:00)            ACTIVE
   └─ (Windows Task Scheduler diario 6am)
      └─ Pipeline: Scraper → Enricher (LLM) → upload-Sheet → Qdrant embed
      ↓
RAG layer (NUEVO 16 may)                                        ACTIVE
   ├─ Qdrant vector DB (localhost:6333, compartido con WESEKA)
   │  └─ collection bochile_properties: 239 puntos enriquecidos
   ├─ Bochile RAG API (localhost:3003)
   │  └─ POST /api/search con filtros estrictos (precio, zona, ambientes)
   └─ Listo para migrar a Render (yaml + doc prontos)
      ↓
Google Sheet "Bochile · Sistema Operativo"  ← fuente de verdad del negocio
   ├─ leads               (12 reales)
   ├─ propiedades        (239 enriquecidas: 76% m², 60% amb, 87% direcciones)
   ├─ visitas
   ├─ contratos          (6 reales)
   ├─ empleados          (6, Camila Pomerich activa)
   ├─ matches_pendientes (3)
   ├─ conversaciones     (131 históricas)
   └─ acciones_ia
      ↓
Dashboard web (Vite+React+Tailwind / Node+Express)
   ├─ Backend  http://localhost:3002 (9 endpoints REST + cache 30s)
   └─ Frontend http://localhost:5176 (8 páginas)
```

### Lo nuevo del 16 may 2026

1. **Cami la humana real** — prompt rediseñado: argentino, cordial, NO insistente, storytelling
2. **RAG con Qdrant + embeddings** — Cami consulta el catálogo con filtros estrictos, **zero divagación**
3. **Catálogo enriquecido** — LLM (gpt-4o-mini) extrajo del texto libre: 76% m², 60% ambientes, 87% direcciones, 98% resúmenes ejecutivos
4. **Agenda real** — Cami consulta visitas ya agendadas del vendedor antes de proponer horario
5. **Pipeline diario automatizado** — scrape + enrich + upload-sheet + embed corre solo a las 6 AM

### Vendedora digital

**Camila Pomerich** (empleado `E-1B`, tel `+5492914413200`). La IA del bot ES Camila — atiende WhatsApp 24/7 en primera persona, califica, agenda visitas, escala a humano cuando hace falta. Los 3 vendedores históricos están `activo=false`.

### Catálogo

239 propiedades reales (98% con fotos, 100% con location, 48% con precio numérico, resto "Consulte precio"). Sincronizado desde [bochile.com](https://www.bochile.com) cada día a las 6 AM vía scraping (la web no tiene API REST). Detalle del scraper: [`04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper/README.md`](04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper/README.md) y manual operativo en [`08_HANDOFF/07_SCRAPER.md`](08_HANDOFF/07_SCRAPER.md).

---

## Entregables del proyecto

| # | Entregable | Ruta | Estado |
|---|---|---|---|
| 1 | Propuesta comercial | [`01_PROPUESTA_COMERCIAL/Propuesta_Comercial_Bochile.html`](01_PROPUESTA_COMERCIAL/Propuesta_Comercial_Bochile.html) | ✓ Entregada |
| 2 | Demo operativo navegable | [`02_DEMO_OPERATIVO/Bochile-Demo.html`](02_DEMO_OPERATIVO/Bochile-Demo.html) | ✓ Entregada 12 may |
| 3 | Roadmap META Ads | [`03_ROADMAP_META/Bochile-Roadmap-META.pdf`](03_ROADMAP_META/Bochile-Roadmap-META.pdf) | ✓ Lista |
| 4 | Brief del cliente | [`00_RESUMEN/Brief_Cliente.md`](00_RESUMEN/Brief_Cliente.md) | ✓ Vivo |
| 5 | Sistema n8n (5 workflows) | [`04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/ESTADO_FINAL.md`](04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/ESTADO_FINAL.md) | ✓ Producción |
| 6 | Sheet maestro enriquecido | https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4/edit | ✓ 239 props con datos LLM-extracted |
| 7 | Scraper del catálogo web | [`04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper/`](04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper/) | ✓ 239 props · cron diario |
| 8 | **RAG (Qdrant + embeddings)** | [`04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/`](04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/) | ✓ Zero divagación en producción |
| 9 | Dashboard web | [`05_DASHBOARD_WEB/`](05_DASHBOARD_WEB/) | ✓ Backend + Frontend listos |
| 10 | Tests E2E | [`04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/tests/`](04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/tests/) | ✓ Script + procedure Twilio |
| 11 | Doc operativa para Yamil | [`08_HANDOFF/`](08_HANDOFF/) (9 manuales) | ✓ Completos |
| 12 | Render deploy ready | [`04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/render.yaml`](04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/render.yaml) | ✓ Blueprint + doc |

---

## Decisiones técnicas clave

| Decisión | Por qué | Trade-off |
|---|---|---|
| **Sheet como base de datos** | Cliente edita a mano, cero dependencia técnica | Rate limit 60r/min Google (mitigado con cache 30s en backend) |
| **Multi-cerebro (1 CORE + 3 sub-agentes)** | Prompts cortos, especializados, sumar es fácil | Más llamadas a OpenAI vs agente único |
| **Twilio Sandbox para piloto** | Setup en 5 min vs 3 días de aprobación Meta | Solo atiende números "joined" |
| **Scraping HTML vs API** | Bochile.com es WordPress sin API REST | Frágil si cambia el theme, monitoreo necesario |
| **n8n local + ngrok** | Cero costo de hosting durante piloto | Depende de PC encendida; fase 2 migra a Render |
| **Modelos GPT-4o + 4o-mini** | Mejor precio/calidad para el caso | Si OpenAI tiene outage, sistema no responde |

Detalle de cada decisión con trade-offs en [`08_HANDOFF/05_ARQUITECTURA.md`](08_HANDOFF/05_ARQUITECTURA.md).

---

## Costos operativos

| Servicio | Piloto (hoy) | Producción (fase 2) |
|---|---|---|
| OpenAI | USD 10–25 | USD 20–50 |
| Twilio | USD 0 (sandbox) | USD 15 + USD 0.005/msg |
| Hosting | USD 0 (localhost) | USD 7–15 (Render Hobby) |
| Google | USD 0 | USD 0 |
| ngrok | USD 0 | USD 0 (reemplazado por dominio propio) |
| **Total** | **USD 10–25 / mes** | **USD 50–80 / mes** |

---

## Línea de tiempo del proyecto

- **2026-04-29** — Reunión inicial. Presentación demo + roadmap META.
- **2026-05-12** — Sistema n8n completo construido y validado (5 workflows, sheet-as-DB).
- **2026-05-12** — Demo entregada al cliente, awaiting firma.
- **2026-05-15** — Dashboard web verificado end-to-end con datos reales del Sheet.
- **2026-05-16** — Scraper del catálogo entregado (239 propiedades + 2697 imágenes); Sheet deduplicado; tests E2E armados.
- **2026-05-17** (domingo) — Pulido + ensayo demo + armado ZIP final.
- **2026-05-18** (lunes) — **ENTREGA PRODUCCIÓN** + handoff a Yamil/Bochile.

Ver detalle de cada reunión en [`07_REUNIONES/`](07_REUNIONES/).

---

## Roadmap post-firma (fase 2)

Documentado en [`08_HANDOFF/05_ARQUITECTURA.md`](08_HANDOFF/05_ARQUITECTURA.md) sección "Roadmap fase 2":

1. **WhatsApp Business pago** (sale del sandbox Twilio, ~USD 15/mes + aprobación Meta).
2. **Migrar n8n a Render** (24/7 sin depender de la PC).
3. **Dashboard hosteado** (Vercel + Render free tiers).
4. **Reemplazar scraper por API limpia** cuando se rehaga la web de Bochile.
5. **Capacitación al equipo Bochile** (1h Zoom).
6. **Auth en el dashboard** (JWT/Clerk).
7. **Notificaciones en vivo** (WebSocket).
8. **Ajustar prompt Camila** para sugerir barrios alternativos cuando no hay match exacto (el catálogo real NO tiene stock en "Palihue" — el prompt actual lo menciona como zona estrella).

---

*Carpeta gestionada por WESEKA.IA. Mantenida y actualizada por Juani.*
