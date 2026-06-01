# Credenciales transferidas — Bochile × WSK.IA

> ⚠️ **IMPORTANTE**: Mantener este documento en lugar seguro (gestor de contraseñas tipo 1Password / Bitwarden / Apple Keychain). Cualquier filtración o pérdida → avisar a Yamil para rotar las claves comprometidas.

## Cuentas con acceso (titularidad de Bochile)

| Servicio | URL | Usuario / Email | Notas |
|---|---|---|---|
| **Render** | https://dashboard.render.com | _<a confirmar con Yamil>_ | Hosting de los 3 servicios (n8n, dashboard-api, dashboard-ui). Owner: cliente |
| **OpenAI** | https://platform.openai.com | _<email de Bochile>_ | API key usada por Cami. Mantenerse cargado de saldo. |
| **Google Workspace** | https://workspace.google.com | _<admin de Bochile>_ | Donde vive el Sheet del sistema |
| **respond.io** | https://app.respond.io/space/413905 | _<usuario>_ | Conector WA ↔ Cami |
| **WhatsApp Business** | App del celular de Camila | (línea telefónica) | El WA donde Cami atiende |
| **bochile.com (WordPress)** | _<URL admin>_ | _<admin>_ | Catálogo de propiedades (fuente de verdad) |

## Service accounts (Google)

| Email del Service Account | Para qué se usa | Notas |
|---|---|---|
| `bochile-sheet-sa@<...>.iam.gserviceaccount.com` | Leer/escribir el Sheet del sistema desde el dashboard-api | **NO rotar sin avisar** — todo el sistema lo usa |

## Secretos y API keys

| Servicio | Dónde se guarda | Quién la tiene |
|---|---|---|
| OpenAI API Key | Render env var `OPEN_AI` del servicio n8n + Credential "OpenAI account" en n8n | Yamil (durante soporte) + cliente |
| Google Sheets Service Account JSON | Render env var `GOOGLE_SHEETS_CREDS_JSON` del dashboard-api | Yamil + cliente |
| respond.io API Token | Workflow n8n (nodo "Responder al Cliente respond.io") | Yamil |
| n8n API Key | Local de Yamil | Yamil (solo para scripts de mantenimiento) |

## Sheet del sistema

- **ID:** `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4`
- **URL:** https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4
- **Owner:** _<a confirmar — cuenta de Bochile o de Yamil>_
- **Editores:** Service Account de Bochile + tu cuenta personal

## URLs productivas

| Servicio | URL |
|---|---|
| Dashboard web (lo que usás vos) | https://bochile-dashboard-ui.onrender.com |
| API REST del dashboard | https://bochile-dashboard-api.onrender.com |
| n8n (cerebro del bot) | https://weseka.onrender.com |
| Webhook entrada del workflow | https://weseka.onrender.com/webhook/bochile-chat |

## Política de WSK con tus credenciales

- WSK mantiene acceso a Render + n8n + Sheet **durante el período de soporte incluido (30 días post-entrega)**.
- Después del soporte: las credenciales que solo Yamil tiene en su local (n8n API Key) se borran de su lado.
- Las credenciales productivas (Render, OpenAI, Google) son siempre del cliente. Yamil tiene acceso solo en lo que dure el soporte.
- Si querés que WSK pierda acceso antes del fin del soporte: avisar y se hace.

## Recomendaciones

1. **Usar un gestor de contraseñas** (1Password / Bitwarden) para guardar todas estas creds.
2. **Activar 2FA** en Render, OpenAI, Google Workspace, respond.io.
3. **Rotar API keys cada 6-12 meses** — coordinado con Yamil para no romper nada.
4. **No compartir el ID del Sheet** públicamente (aunque tiene auth, no es público es información sensible).
