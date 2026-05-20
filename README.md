# Bochile · Infraestructura WESEKA.IA

> Sistema completo de Cami — vendedora digital inmobiliaria para Bochile (Bahía Blanca, AR).
> Atiende WhatsApp 24/7, califica leads, agenda visitas, escala a humano en momentos clave.

## Arquitectura (3 capas)

```
                  ┌─────────────────────────────────────────┐
                  │   WhatsApp Business API (respond.io)    │
                  └────────────────┬────────────────────────┘
                                   │ webhook (HMAC firmado)
                  ┌────────────────▼────────────────────────┐
                  │              n8n (W1)                    │
                  │  Parser → Wait 7s → Switch → CORE Agent  │
                  │  + Calificador + Matcher + Admin         │
                  │  + Human Handoff (24h pause)             │
                  │  + Cierre conversación detección         │
                  └──────┬──────────────────┬───────────────┘
                         │                  │
              ┌──────────▼─────────┐   ┌────▼─────────────────┐
              │  Google Sheets     │   │  RAG Server (Node)   │
              │  (Sheet-as-DB)     │   │  + Qdrant Cloud      │
              │  leads, visitas,   │   │  - text RAG props    │
              │  empleados, etc.   │   │  - CLIP visual hybrid│
              └────────────────────┘   └──────────────────────┘
                         │
              ┌──────────▼─────────┐
              │  Dashboard Web     │
              │  Backend (Express) │
              │  Frontend (Vite)   │
              └────────────────────┘
```

## Componentes

| Servicio | Path | Stack | Puerto local |
|---|---|---|---|
| n8n | (Docker) | n8n self-hosted | 5680 |
| RAG server | `04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/` | Node + Express + OpenAI + CLIP | 3003 |
| Qdrant | (Docker / Qdrant Cloud) | Vector DB | 6333 |
| Dashboard Backend | `05_DASHBOARD_WEB/backend/` | Node + Express + googleapis | 3002 |
| Dashboard Frontend | `05_DASHBOARD_WEB/frontend/` | Vite + React + TS + Tailwind | 5175 |
| Scraper (local cron) | `04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper/` | Node + Cheerio | — |

## Deploy a Render (Blueprint)

Este repo incluye `render.yaml` con los 3 servicios web (RAG, Dashboard API, Dashboard UI) listos para deploy automático.

**Servicios externos requeridos**:
- **n8n**: hostearlo aparte (sugerido: Render Web Service con imagen `docker.n8n.io/n8nio/n8n`, USD ~7-15/mes)
- **Qdrant**: Qdrant Cloud Free Tier (https://cloud.qdrant.io)
- **OpenAI API key**: configurar como secret en Render
- **Google Sheets service account**: configurar como secret JSON en Render
- **respond.io webhook**: actualizar URL al deploy de n8n una vez online

## Secrets (NUNCA committear)

| Variable | Dónde se usa | Cómo obtener |
|---|---|---|
| `OPENAI_API_KEY` | RAG server | platform.openai.com |
| `QDRANT_URL` | RAG server | cloud.qdrant.io (URL del cluster) |
| `QDRANT_API_KEY` | RAG server | cloud.qdrant.io (API key) |
| `RESPONDIO_WEBHOOK_SECRET` | n8n Parser | respond.io → webhook → Clave de firma |
| `GOOGLE_SHEETS_CREDS_JSON` | Dashboard backend, n8n | Google Cloud Console (service account) |
| `SHEET_ID` | Dashboard backend, n8n | URL del Google Sheet |

## Setup local (desde cero)

```bash
# 1) Levantar n8n + Qdrant
cd 04_INFRAESTRUCTURA_TECNICA/../00_SISTEMA_INTERNO/n8n-infra
docker compose up -d

# 2) RAG server
cd 04_INFRAESTRUCTURA_TECNICA/Bochile_RAG
cp .env.example .env  # rellenar OPENAI_API_KEY + QDRANT_URL
npm install
npm run dev  # localhost:3003

# 3) Embed catálogo inicial (una vez)
npm run embed              # texto (~10 min)
npm run embed:clip:reset   # visual CLIP con clasificación (~30 min, ~USD 2)

# 4) Dashboard backend
cd 05_DASHBOARD_WEB/backend
cp .env.example .env  # rellenar SHEET_ID + GOOGLE_APPLICATION_CREDENTIALS
# Poner service-account.json en credentials/
npm install
npm run dev  # localhost:3002

# 5) Dashboard frontend
cd 05_DASHBOARD_WEB/frontend
npm install
npm run dev  # localhost:5175

# 6) Tunnel público (para webhook respond.io)
cloudflared tunnel --url http://localhost:5680
# pega la URL en respond.io → webhook → Punto final
```

## Operación diaria (post-deploy)

Ver `08_HANDOFF/` para los 6 manuales criollos:
- `01_QUE_ES_ESTO.md` — narrativa del sistema
- `02_COMO_PRENDE.md` — secuencia de arranque
- `03_COMO_SE_OPERA.md` — uso diario para no-técnicos
- `04_QUE_PASA_SI.md` — FAQ + troubleshooting
- `05_ARQUITECTURA.md` — diagramas + decisiones técnicas
- `06_CONTACTOS_Y_CUENTAS.md` — URLs + costos + accesos

## Backup / Restore del workflow n8n

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports
node _backup_w1.cjs     # guarda W1_LATEST.json + uno con timestamp
node _restore_w1.cjs    # restaura desde W1_LATEST.json si la UI lo pisa
```

## Costos mensuales (post-Render)

| Servicio | Costo |
|---|---|
| n8n on Render (Standard) | USD 7-25 |
| RAG server on Render (Starter) | USD 7 |
| Qdrant Cloud Free | USD 0 |
| Dashboard backend on Render (Starter) | USD 7 |
| Dashboard frontend on Render (Static) | USD 0 |
| OpenAI (GPT-4o + embeddings) | ~USD 10-25 según volumen |
| respond.io WhatsApp Business | desde USD 79/mes (1k contactos) |
| **Total estimado** | **~USD 110-150/mes** |

## Licencia

Privado. WESEKA.IA / Inmobiliaria Bochile.
