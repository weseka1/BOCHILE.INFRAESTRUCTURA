# 06 · Contactos y cuentas

Referencia rápida de URLs, accesos y costos. **No incluye contraseñas ni tokens — solo paths donde están y quién las gestiona.**

---

## URLs del sistema

| Recurso | URL | Para qué |
|---|---|---|
| **Sheet Bochile** | https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4/edit | Editar datos a mano |
| **Dashboard local** | http://localhost:5176 | Pantalla de control (cuando corre el frontend) |
| **Dashboard backend** | http://localhost:3002/api/health | Test de salud del backend |

> Nota: los puertos 3002/5176 son los que usamos en la PC de Juani porque el 3001/5173 los tienen otros proyectos. Si Yamil corre esto en una PC limpia, puede volver a los defaults (3001/5173) editando `backend/.env` y `frontend/vite.config.ts`.
| **n8n local** | http://localhost:5680 | Ver y editar workflows |
| **Twilio Console** | https://console.twilio.com | Sandbox WhatsApp + facturación |
| **OpenAI Platform** | https://platform.openai.com | Saldo + API keys |
| **Google Cloud Console** | https://console.cloud.google.com | Service Account (Sheets API) |
| **Web de Bochile** | _(la URL del cliente — Juani te la pasa)_ | Fuente del scraper W6 |

---

## Cuentas Google involucradas

| Cuenta | Para qué | Quién la maneja |
|---|---|---|
| `yamilpintos18@gmail.com` | Cuenta personal de Juani / login Claude Code | Juani |
| `ju4nl0pezs@gmail.com` | Workspace donde vive el Sheet de Bochile | Juani |
| `growthjuania@gmail.com` | Otra cuenta Workspace usada en n8n (Project Owner) | Juani |
| `<service-account>@<proyecto>.iam.gserviceaccount.com` | Service Account que el Dashboard usa para leer el Sheet | Generado en GCP, JSON en backend/credentials/ |

---

## Credenciales en uso (paths, NO valores)

| Credencial | Dónde está | Cómo se rota |
|---|---|---|
| **Service Account JSON** | `05_DASHBOARD_WEB/backend/credentials/service-account.json` | Generar nuevo en GCP, reemplazar archivo, reiniciar backend |
| **OpenAI API Key** | n8n Settings → Credentials → "OpenAi account" (`4mQx97qkHBIhXxu3`) | n8n UI · Settings · Credentials · Edit |
| **Twilio Account SID + Auth Token** | n8n Settings → Credentials → "Twilio account" (`HR5fS1GSOu06duuX`) | n8n UI · Settings · Credentials · Edit |
| **Google Sheets OAuth** | n8n Settings → Credentials → "Google Sheets account" (`9NvEcPkNdH6i0j3L`) | n8n UI · re-authenticate |
| **Google Drive OAuth** | n8n Settings → Credentials → "Google Drive account" (`s6bzy7p0HH3Gjmfr`) | n8n UI · re-authenticate |

⚠️ **NUNCA** subir el archivo `service-account.json` a git ni a un drive público. Está en `.gitignore` del proyecto, mantenelo así.

---

## Variables de entorno

| Variable | Dónde se setea | Valor |
|---|---|---|
| `SHEET_ID` | `05_DASHBOARD_WEB/backend/.env` | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` |
| `GOOGLE_APPLICATION_CREDENTIALS` | `05_DASHBOARD_WEB/backend/.env` | `./credentials/service-account.json` |
| `CACHE_TTL_SECONDS` | `05_DASHBOARD_WEB/backend/.env` | `30` |
| `WEBHOOK_URL` | `00_SISTEMA_INTERNO/n8n-infra/docker-compose.yml` | URL de ngrok actual |
| `N8N_PUBLIC_URL` | mismo lugar | URL de ngrok actual |
| `GENERIC_TIMEZONE` | mismo lugar | `America/Argentina/Buenos_Aires` |
| `N8N_ENCRYPTION_KEY` | mismo lugar | _(no rotar sin migrar)_ |

---

## IDs de workflows y data tables (referencia rápida)

| ID | Recurso | Tipo |
|---|---|---|
| `aUMQyupnGJ5IWm5e` | W1 — Chatbot Multi-Agente CORE | Workflow n8n |
| `f1CC972kzNPR8ebi` | W2 — Recordatorios Visitas | Workflow n8n |
| `W327qYVE9SpwQiRi` | W3 — Match Retroactivo | Workflow n8n |
| `wrFto5o6Zk02sZty` | W4 — Cobranza Alquileres | Workflow n8n |
| `lf3gZgVCD3SdPri4` | W5 — Backup Mensual + Reset | Workflow n8n |
| _(pendiente sábado)_ | W6 — Sync Catálogo Web | Workflow n8n |
| `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` | Sheet maestro | Google Sheet |

---

## Contactos humanos

### Equipo WESEKA

| Rol | Nombre | Contacto |
|---|---|---|
| Founder técnico | Juan Ignacio López (Juani) | yamilpintos18@gmail.com |
| Socio comercial | Yamil Pintos | _(vos)_ |

### Cliente Bochile

| Rol | Nombre | Notas |
|---|---|---|
| Dueño | Carlos Bochile | Inactivo en el sistema (solo recibe escalados de la IA) |
| Vendedora digital | Camila Pomerich (IA) | empleado_id `E-1B`, tel `+5492914413200` |
| Equipo histórico (inactivo) | Julieta Méndez, Valentín Soto | Quedaron `activo=false` en `bochile_empleados` |

---

## Costos mensuales actuales (al volumen del piloto)

| Servicio | Costo aprox |
|---|---|
| OpenAI (gpt-4o + mini + Whisper + Vision) | USD 10-25 |
| Twilio Sandbox | USD 0 |
| Google Sheets + Drive | USD 0 |
| ngrok free | USD 0 |
| Dashboard hosting | USD 0 (corre local) |
| **Total piloto** | **USD 10-25/mes** |

## Costos mensuales fase 2 (producción full)

| Servicio | Costo aprox |
|---|---|
| OpenAI | USD 20-50 (volumen mayor) |
| Twilio número WhatsApp Business | USD 15 |
| Twilio mensajes salientes | USD 0.005/msg × volumen |
| Hosting n8n (Render Hobby + DB) | USD 7-15 |
| Dashboard hosting (Vercel + Render) | USD 0 (free tiers) |
| ngrok pago | USD 0 (no se usa) |
| **Total producción** | **USD 50-80/mes** |

---

## Quién hace qué cuando algo se rompe

| Problema | Quién resuelve | Cómo |
|---|---|---|
| Workflow n8n falla | Juani | Logs en n8n + ajuste de nodos |
| Saldo OpenAI agotado | Yamil o Juani | Recargar en platform.openai.com |
| ngrok caído | Yamil | Reiniciar `ngrok http 5680` + actualizar Twilio |
| Sheet borrado/desordenado | Yamil o Juani | Restaurar desde backup de Drive |
| Cliente pide cambio de copy | Juani | Editar prompt del agente en n8n |
| Scraper W6 roto (web cambió) | Juani | Actualizar selectores CSS |

---

## Documentos relacionados

- **Brief del cliente**: `00_RESUMEN/Brief_Cliente.md` — info comercial del cliente.
- **Stack técnico detallado**: `04_INFRAESTRUCTURA_TECNICA/Stack_Tecnologico.md` — versiones de cada cosa.
- **Setup de producción n8n**: `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/Setup_Produccion.md`.
- **README del Dashboard**: `05_DASHBOARD_WEB/README.md` — devs.
- **Roadmap META Ads**: `03_ROADMAP_META/Bochile-Roadmap-META.pdf` — fase de marketing.
- **Minutas reuniones**: `07_REUNIONES/`.

---

## Para emergencias

Si pasa algo serio y el sistema cae en horario de operación:

1. Mensaje a Juani (founder) por WhatsApp/Slack/lo que usen.
2. Mientras tanto: **pausá el W1** en n8n (toggle off) y avisá al cliente que Camila está en mantenimiento por X horas.
3. Volver a leer `04_QUE_PASA_SI.md` para el problema específico.
