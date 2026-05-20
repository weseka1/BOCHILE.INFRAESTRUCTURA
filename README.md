# Bochile · Sistema Cami

> **Cami** es la asesora inmobiliaria digital de Bochile (Bahía Blanca, AR).
> Atiende WhatsApp 24/7 con tono humano argentino. Califica leads, agenda visitas,
> reconoce propiedades por foto, escala a vendedor humano cuando hace falta.

---

## Por dónde empezar

| Si sos... | Andá a... |
|---|---|
| **Operativo (Yamil)** — quiero usarlo día a día | [`OPERAR.md`](OPERAR.md) |
| **Devops** — quiero subirlo a Render desde cero | [`DEPLOY.md`](DEPLOY.md) |
| **Arquitecto** — quiero entender cómo funciona por dentro | [`ARQUITECTURA.md`](ARQUITECTURA.md) |
| **Soporte** — algo se rompió | [`docs/04_QUE_PASA_SI.md`](docs/04_QUE_PASA_SI.md) |

---

## Estructura del repo

```
Bochile/
├── README.md                     ← este archivo (punto de entrada)
├── DEPLOY.md                     ← cómo subir todo a Render
├── OPERAR.md                     ← uso diario para Yamil
├── ARQUITECTURA.md               ← diagrama + decisiones técnicas
├── render.yaml                   ← Blueprint Render (deploy con 1 click)
├── n8n.Dockerfile                ← imagen n8n custom para Render
│
├── apps/                         ← código de los servicios
│   ├── rag/                      ← RAG + CLIP visual (Render Web Service)
│   ├── dashboard-api/            ← API REST del dashboard (Render Web Service)
│   ├── dashboard-ui/             ← Frontend dashboard (Render Static Site)
│   └── scraper/                  ← Cron diario que scrapea propiedades de bochile.com
│
├── workflows/                    ← JSON de los 7 workflows n8n (para importar a Render)
│   ├── 01_SUB_Bochile_RAG_Search.json
│   ├── 02_W1_CORE_Multi_Agente.json    ← el principal (Cami)
│   ├── 03_W2_Recordatorios_Visitas.json
│   ├── 04_W3_Match_Retroactivo.json
│   ├── 05_W4_Cobranza_Alquileres.json
│   ├── 06_W5_Backup_Mensual.json
│   └── 07_W7_Reactivar_Bot_Pausado.json
│
├── scripts/                      ← utilidades de mantenimiento
│   ├── 01_backup_workflow.cjs    ← backup del W1 a JSON
│   ├── 02_restore_workflow.cjs   ← restore si la UI lo pisó
│   ├── 03_export_all_workflows.cjs
│   ├── 04_e2e_test.cjs           ← test end-to-end simulado
│   ├── 05_reset_demo_data.cjs    ← limpia leads/conversaciones del Sheet
│   ├── 06_setup_calendar_labor.cjs ← crea feriados + columnas empleados
│   └── 07_setup_handoff_columns.cjs ← crea columnas bot_pausado_hasta, etc.
│
├── docs/                         ← manuales operativos criollos
│   ├── 01_QUE_ES_ESTO.md
│   ├── 02_COMO_PRENDE.md
│   ├── 03_COMO_SE_OPERA.md
│   ├── 04_QUE_PASA_SI.md
│   ├── 05_ARQUITECTURA_DETALLE.md
│   └── 06_CONTACTOS_Y_CUENTAS.md
│
├── infra/                        ← infraestructura local (opcional)
│   └── docker-compose.local.yml  ← n8n + qdrant para desarrollo
│
└── _historico/                   ← TODO lo viejo (no se toca, archivo de referencia)
```

---

## Stack en una línea

WhatsApp Business (respond.io) → **n8n** (CORE+sub-agentes) → **RAG** (CLIP+text) + **Sheets** (DB) → **Dashboard** (Vite+Express)

---

## Costos estimados (todo en Render full cloud)

| Servicio | Mensual USD |
|---|---|
| Render n8n (Standard) | 25 |
| Render RAG (Starter) | 7 |
| Render Dashboard API (Starter) | 7 |
| Render Dashboard UI (Static) | 0 |
| Qdrant Cloud (Free Tier 1 GB) | 0 |
| OpenAI (GPT-4o + embeddings) | 10-25 según volumen |
| respond.io (1k contactos) | desde 79 |
| **Total** | **~130-150** |

---

## Soporte

- Repo: https://github.com/weseka1/BOCHILE.INFRAESTRUCTURA
- Sheet maestro: https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4
- WhatsApp: respond.io workspace WESEKA
