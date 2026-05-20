# 06 - Contactos y cuentas

> URLs, credenciales (path, no valor), costos. Referencia rápida.

---

## URLs principales

| Servicio | URL | Login |
|---|---|---|
| Dashboard (uso diario) | `https://bochile-dashboard-ui.onrender.com` | sin login |
| n8n (workflows) | `https://bochile-n8n.onrender.com` | basic auth: `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD` (Render env) |
| RAG (interno) | `https://bochile-rag.onrender.com` | sin login (API REST) |
| Dashboard API (interno) | `https://bochile-dashboard-api.onrender.com` | sin login |
| Google Sheet | https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4 | cuenta WESEKA |
| respond.io | https://app.respond.io | cuenta WESEKA |
| Render Dashboard | https://dashboard.render.com | cuenta WESEKA |
| Qdrant Cloud | https://cloud.qdrant.io | cuenta WESEKA |
| OpenAI Platform | https://platform.openai.com | cuenta WESEKA |
| GitHub repo | https://github.com/weseka1/BOCHILE.INFRAESTRUCTURA | cuenta weseka1 |

---

## Cuentas externas y costos mensuales

| Servicio | Plan | Costo USD/mes |
|---|---|---|
| Render Web Service (n8n) | Standard | 25 |
| Render Web Service (RAG) | Starter | 7 |
| Render Web Service (Dashboard API) | Starter | 7 |
| Render Static Site (Dashboard UI) | Free | 0 |
| Qdrant Cloud | Free Tier 1GB | 0 |
| OpenAI API | pay-per-use | ~10-25 |
| respond.io | depende del plan | desde 79 (1k contactos) |
| **TOTAL aprox** | | **~130-150** |

---

## Credenciales (qué hay, dónde, cómo se obtiene)

> **NO se commitean al repo**. Se setean como Environment Variables en Render Dashboard.

| Credencial | Dónde se usa | Cómo se obtiene | Cómo se rota |
|---|---|---|---|
| `OPENAI_API_KEY` | RAG, n8n (sub-agentes) | platform.openai.com → API Keys → Create | Si se filtra: revocar la vieja + crear nueva + actualizar env vars |
| `QDRANT_URL` + `QDRANT_API_KEY` | RAG | cloud.qdrant.io → cluster → API Keys | Crear key nueva en Qdrant, actualizar Render |
| `GOOGLE_SHEETS_CREDS_JSON` | Dashboard API, n8n | Google Cloud Console → Service Account → keys → JSON | Crear nuevo service-account, dar acceso al Sheet, reemplazar JSON |
| `RESPONDIO_WEBHOOK_SECRET` | n8n (Parser HMAC) | respond.io → Webhook → Clave de firma | Recrear webhook en respond.io |
| `N8N_BASIC_AUTH_USER` / `_PASSWORD` | login del n8n | vos elegís | cambiarlas en Render env vars, redeploy |
| `N8N_ENCRYPTION_KEY` | encriptación interna de credenciales en n8n | random 32+ chars | **NO CAMBIAR** post-deploy. Si cambia, todas las credenciales en n8n se rompen y hay que recrearlas |
| respond.io API token | n8n (Responder al Cliente) | respond.io → Settings → Integrations → API | Revocar + crear nueva en respond.io |

---

## Service Account de Google Sheets

- **Email del service account**: `bochile-dashboard@<project>.iam.gserviceaccount.com` (ver en el JSON)
- **Permiso en el Sheet**: Editor (compartido)
- **Scope**: `https://www.googleapis.com/auth/spreadsheets`
- **Path local**: `apps/dashboard-api/credentials/service-account.json` (gitignored)
- **En Render**: como `GOOGLE_SHEETS_CREDS_JSON` env var (contenido del JSON en una línea)

---

## Cuenta de Twilio (legacy, no usar)

El sistema viejo usaba Twilio Sandbox para WhatsApp. Ya NO se usa, migró a respond.io. Si ves credenciales de Twilio dando vueltas en el código, son de antes.

---

## Datos de Bochile (cliente)

- **Inmobiliaria Bochile**, Bahía Blanca, Argentina
- Año de fundación: 1970
- Web: https://www.bochile.com / https://www.bochile.com.ar
- WhatsApp principal: el que está conectado a respond.io
- Sheet master: ver URL arriba

---

## Equipo WESEKA (interno)

- **Juani** (Juan Ignacio Lopez): founder, dev principal. WhatsApp para urgencias.
- **Yamil Pintos**: socio + operador del sistema. Acceso al Dashboard + respond.io.

---

## Backup y recuperación

- **GitHub repo**: tiene TODO el código. Si Render se cae, podés re-deployar en otro proveedor (Fly.io, Railway, etc.).
- **Sheet maestro**: tiene TODA la data del negocio. Si n8n se cae, el Sheet sigue siendo la verdad.
- **W5 Backup Mensual**: cron que copia el Sheet entero a Google Drive día 1 de cada mes 03:00.
- **Workflow backups**: `scripts/01_backup_workflow.cjs` → corre antes de cualquier edit manual de n8n.

---

## En caso de incidente grave

1. **Bajar el bot**: n8n → W1 → toggle Active OFF. Esto detiene a Cami inmediatamente. Vos seguís pudiendo responder manual desde respond.io.
2. **Avisar a Juani**: WhatsApp.
3. **Documentar**: qué pasó, cuándo, captura de pantalla del Sheet o n8n.
4. **Restore si hace falta**: `scripts/02_restore_workflow.cjs` restaura el workflow al último backup.
