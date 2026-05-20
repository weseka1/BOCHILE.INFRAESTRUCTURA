# Sistema Bochile · Infraestructura WESEKA.IA

**Único sistema, end-to-end, listo para producción.**
La IA captura, califica, matchea, agenda, notifica al vendedor, cobra alquileres y carga el dashboard. El equipo Bochile solo abre el dashboard y va a las visitas.

---

## La arquitectura en una frase

> **Un webhook único** recibe TODO (WhatsApp, web, ZonaProp). **Un Vendedor CORE** habla. Internamente delega a 3 sub-cerebros: **Calificador**, **Matcher** y **Administrativo**. Todo lo que pasa se guarda en 8 **Data Tables** y se vuelca cada 5 min a un **Google Sheets maestro** que alimenta el dashboard web.

---

## Diagrama del sistema

```
                          ╔═══════════════════════════════════╗
                          ║   CANALES DE ENTRADA              ║
                          ║   WhatsApp · Web · ZonaProp       ║
                          ╚════════════════╤══════════════════╝
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │  Webhook único           │
                              │  /bochile-chat (n8n)     │
                              └────────────┬─────────────┘
                                           │
                                           ▼
                          ┌─────────────────────────────────┐
                          │   VENDEDOR CORE (Camila)        │
                          │   gpt-5 · temp 0.4              │
                          │   Memoria por teléfono          │
                          │   Habla con el cliente          │
                          └────────┬────────────────────────┘
                                   │ delega internamente
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
  ┌───────────┐             ┌───────────┐             ┌──────────────┐
  │ CALIFICA  │             │  MATCHER  │             │   ADMIN      │
  │ Score     │             │ Catálogo  │             │ Agenda +     │
  │ 0-100     │             │ → 3 props │             │ Notifica +   │
  │ + datos   │             │ por lead  │             │ Match pend.  │
  │           │             │           │             │ + CRM upsert │
  │ gpt-5-mini│             │ gpt-5-mini│             │ gpt-5-mini   │
  └───────────┘             └─────┬─────┘             └──────┬───────┘
                                  │                          │
                                  ▼                          ▼
                          ┌─────────────────────────────────────┐
                          │  8 DATA TABLES (memoria persistente)│
                          │  leads · propiedades · visitas      │
                          │  conversaciones · empleados         │
                          │  contratos · matches_pendientes     │
                          │  acciones_ia                        │
                          └─────────────────┬───────────────────┘
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  ▼                         ▼                         ▼
        ┌───────────────────┐     ┌───────────────────┐     ┌──────────────────┐
        │ CRON Recordatorios│     │ CRON Match Retro  │     │ CRON Cobranza    │
        │ Cada hora         │     │ Cada 15 min       │     │ Diario 9am       │
        │ → 24h y 1h        │     │ → prop nueva avisa│     │ → recordatorio,  │
        │ → cliente +       │     │   a leads en      │     │   aviso, atraso, │
        │   vendedor        │     │   espera          │     │   escalamiento   │
        └───────────────────┘     └───────────────────┘     └──────────────────┘
                                            │
                                            ▼
                              ┌───────────────────────────┐
                              │ CRON Sync Dashboard       │
                              │ Cada 5 min                │
                              │ DataTables → Google Sheets│
                              └───────────────┬───────────┘
                                              │
                                              ▼
                            ┌────────────────────────────────┐
                            │  Bochile_Dashboard_Maestro     │
                            │  (Google Sheets · 17 hojas)    │
                            │  ────────────────────────────  │
                            │  · 8 hojas base (las tablas)   │
                            │  · 8 hojas analíticas (KPIs,   │
                            │    pipeline, ranking, heatmap, │
                            │    embudo, alquileres, feed)   │
                            │  · 1 hoja CONFIG               │
                            └───────────────┬────────────────┘
                                            │ lee
                                            ▼
                                ┌──────────────────────┐
                                │  Dashboard Web       │
                                │  (estilo demo HTML)  │
                                │  El equipo abre y ve │
                                │  visitas agendadas   │
                                └──────────────────────┘
```

---

## Los 5 workflows en n8n

| # | Nombre | Tipo | Frecuencia | Workflow ID |
|---|---|---|---|---|
| W1 | [Bochile · Chatbot Multi-Agente (CORE)](https://weseka.app.n8n.cloud/workflow/j0Mh8IkFfv4q5pB7) | Webhook | bajo demanda | `j0Mh8IkFfv4q5pB7` |
| W2 | [Bochile · Recordatorios de Visitas (cron)](https://weseka.app.n8n.cloud/workflow/KgNZYq4R6MhCGvt1) | Cron | cada hora | `KgNZYq4R6MhCGvt1` |
| W3 | [Bochile · Match Retroactivo (cron)](https://weseka.app.n8n.cloud/workflow/EYmiN3Uy3u5PUuQa) | Cron | cada 15 min | `EYmiN3Uy3u5PUuQa` |
| W4 | [Bochile · Cobranza Alquileres (cron diario)](https://weseka.app.n8n.cloud/workflow/zKPoASiEv8KbovaY) | Cron | diario 9am | `zKPoASiEv8KbovaY` |
| W5 | [Bochile · Sync Dashboard a Google Sheets](https://weseka.app.n8n.cloud/workflow/6VmlquxKOf2EtKEV) | Cron | cada 5 min | `6VmlquxKOf2EtKEV` |

Detalle por workflow: ver [`Workflows_Detalle.md`](Workflows_Detalle.md).

---

## Las 8 Data Tables (memoria del sistema)

| Tabla | ID | Para qué sirve |
|---|---|---|
| `bochile_leads` | `xElrL4mctuof84We` | CRM Kanban: todo lead + su score, etapa, presupuesto, zona |
| `bochile_propiedades` | `CjCGRQC1lEcHnTgW` | Catálogo: cada propiedad con tour 360, vendedor a cargo, estado |
| `bochile_visitas` | `c2WJgyO4zdb5GKCj` | Agenda: cada visita con cliente, vendedor, hora, dirección |
| `bochile_conversaciones` | `o1YlacRRq4UHLloF` | Log de cada mensaje in/out (audit y memoria conversacional) |
| `bochile_empleados` | `uyFS9uEbdCQQXiJn` | Vendedores y staff: zona de especialidad, calendar, KPIs |
| `bochile_contratos` | `k3CNXwMircXckck0` | Alquileres activos: monto, día vencimiento, días de atraso |
| `bochile_matches_pendientes` | `T8b4ZTN8469TcrPR` | Lo que busca cada lead cuando NO hay stock disponible |
| `bochile_acciones_ia` | `SYVdPtTV2zHwiDX0` | Feed: TODO lo que la IA hace (alimenta el dashboard) |

Esquema completo (columnas + tipos): ver [`Data_Tables_Schema.md`](Data_Tables_Schema.md).

---

## Setup de producción

Ver [`Setup_Produccion.md`](Setup_Produccion.md). Resumen:

1. Cargar credenciales en n8n: **OpenAI Bochile**, **Bochile WhatsApp Cloud**, **Bochile Google Sheets**.
2. Crear el spreadsheet **Bochile_Dashboard_Maestro** con 8 pestañas (ver [`../Excel_Maestro/`](../Excel_Maestro/)).
3. Setear variables de entorno en n8n:
   - `BOCHILE_WA_PHONE_ID` — Phone Number ID de WhatsApp Business Cloud.
   - `BOCHILE_GSHEET_ID` — ID del Google Sheets maestro.
   - `BOCHILE_CARLOS_TEL` — teléfono de Carlos Bochile (escalamientos de morosos).
4. Sembrar `bochile_empleados` con los 3 vendedores (Carlos Bochile, Julieta Méndez, Valentín Soto) + zona de especialidad.
5. Sembrar `bochile_propiedades` con el catálogo inicial (importar desde el CSV template).
6. Sembrar `bochile_contratos` con los 86 contratos activos.
7. Activar los 5 workflows.
8. Configurar el webhook de WhatsApp Cloud para que apunte a `/bochile-chat`.
9. Probar punta a punta con un mensaje de prueba al número Bochile.

---

## Cómo cumple cada requerimiento del cliente

| Lo que pidió Bochile | Cómo lo resuelve este sistema |
|---|---|
| Website público con catálogo y tours 360 | El catálogo vive en `bochile_propiedades` y se publica vía la web. El campo `tour_360_url` apunta al tour. |
| CRM conectado sin que se escape ninguna conexión | Todo mensaje entra al webhook → upsert en `bochile_leads` → log en `bochile_conversaciones`. Nada se pierde. |
| IA atendiendo como humano y filtrando curiosos | Sub-agente Calificador da score 0-100. Si <40, el CORE corta cortes. Si 70+, sigue y agenda. |
| Guardar lo que busca cada cliente para ofrecer cuando aparezca | `bochile_matches_pendientes` guarda criterios. W3 cruza cada 15 min con propiedades nuevas. |
| Multicerebros para que no se sature | 4 modelos LLM separados: CORE + 3 sub-agentes. Cada uno con su temperatura y propósito. |
| Chatbot administrativo (CRM y visitas) | Sub-agente Administrativo: agenda visitas, notifica vendedor con el formato exacto "VISITA AGENDADA PARA LAS 10:30 CON…", actualiza CRM. |
| Sub-agentes vendedores con un CORE que arma la respuesta | CORE es la única voz al cliente. Calificador, Matcher y Admin son sub-agentes que devuelven datos al CORE. |
| Dashboard hecho en Excel y hosteado en app web con gráficos | `Bochile_Dashboard_Maestro` (Google Sheets) con 8 hojas base + 8 analíticas + 1 config. La app web lee el Sheets y renderiza con el estilo del demo HTML. |
| Empleados solo abren el dashboard y ven visitas agendadas | Hoja `AGENDA_VISITAS_HOY` lista visitas del día con vendedor, hora, dirección. Más recordatorios automáticos por WhatsApp. |
| Bestia de ventas, 80% del trabajo ahorrado | Tabla `bochile_acciones_ia` registra `tiempo_ahorrado_min` por cada acción. El dashboard suma este campo para mostrar horas ahorradas. |

---

## Estructura de archivos en esta carpeta

```
04_INFRAESTRUCTURA_TECNICA/
├── Stack_Tecnologico.md                 ← (ya existía)
├── Sistema_n8n/
│   ├── 00_README_SISTEMA.md             ← este archivo
│   ├── Workflows_Detalle.md             ← detalle de cada workflow + nodos
│   ├── Data_Tables_Schema.md            ← esquema completo
│   ├── Setup_Produccion.md              ← go-live paso a paso
│   ├── Arquitectura_Multi_Agente.md     ← cómo trabajan los 4 cerebros
│   └── Mensajes_Y_Prompts.md            ← prompts maestros de cada agente
└── Excel_Maestro/
    ├── README.md                        ← diseño del workbook
    ├── Hojas_Y_Columnas.md              ← spec de cada hoja
    ├── Formulas_Dashboard.md            ← fórmulas que arman los KPIs
    └── templates_csv/
        ├── leads.csv
        ├── propiedades.csv
        ├── visitas.csv
        ├── contratos.csv
        ├── empleados.csv
        ├── matches_pendientes.csv
        ├── conversaciones.csv
        └── acciones_ia.csv
```

---

*Sistema diseñado por WESEKA.IA · 2026-05-11 · Implementación lista para producción.*
