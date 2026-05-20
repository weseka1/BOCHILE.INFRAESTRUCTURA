# 00 · Cheatsheet operativo Bochile

Tu referencia rápida del sistema. Para vos, Juani, cuando se te olvide un comando o necesites un ID.

> **Si recibiste esto como ZIP por primera vez** (Yamil u otro tercero), saltá a la sección [Setup desde el ZIP](#setup-desde-el-zip) al final.

## Sistema vivo

- **n8n**: http://localhost:5680 (Docker local, mapeado del 5680 al 5678 interno)
- **Sheet maestro**: https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4/edit
- **Dashboard**: http://localhost:5176 (frontend) · http://localhost:3002/api/health (backend)
- **Twilio Sandbox**: +1 415 523 8886 · join `<código del sandbox>`

## Encender todo (orden)

```bash
# 1) n8n
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\00_SISTEMA_INTERNO\n8n-infra
docker compose up -d

# 2) ngrok (terminal aparte)
ngrok http 5680
# si la URL cambió: actualizá WEBHOOK_URL + N8N_PUBLIC_URL en docker-compose.yml + docker compose up -d
# y actualizá también la Webhook URL en Twilio Console

# 3) Dashboard backend (terminal aparte)
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\05_DASHBOARD_WEB\backend
npm run dev

# 4) Dashboard frontend (terminal aparte)
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\05_DASHBOARD_WEB\frontend
npm run dev
```

## Apagar todo

```bash
docker compose down  # en 00_SISTEMA_INTERNO/n8n-infra
# Ctrl+C en las terminales de ngrok, backend y frontend
```

## IDs

| Recurso | ID |
|---|---|
| W1 Chatbot CORE | `aUMQyupnGJ5IWm5e` |
| W2 Recordatorios | `f1CC972kzNPR8ebi` |
| W3 Match Retroactivo | `W327qYVE9SpwQiRi` |
| W4 Cobranza | `wrFto5o6Zk02sZty` |
| W5 Backup mensual | `lf3gZgVCD3SdPri4` |
| W6 Sync Catálogo Web | _pendiente sábado_ |
| Sheet maestro | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` |
| OpenAI cred n8n | `4mQx97qkHBIhXxu3` |
| Google Sheets cred n8n | `9NvEcPkNdH6i0j3L` |
| Google Drive cred n8n | `s6bzy7p0HH3Gjmfr` |
| Twilio cred n8n | `HR5fS1GSOu06duuX` |

## Estado al cierre del Día 1 (15 may 2026)

**Listo:**
- 5 workflows refactor "Sheet-only" en n8n local, sistema E2E validado anoche (ejec. 2771).
- Dashboard backend + frontend: código completo, deps instaladas, `.env` creado.
- Doc para Yamil: 7 archivos (manuales 01-06 + esta página + `00_PARA_YAMIL.md`).
- Memorias Claude actualizadas para próximas sesiones.

**Pendiente Día 1:**
- Service Account JSON → `05_DASHBOARD_WEB/backend/credentials/service-account.json`. Compartir Sheet con email del SA.
- Levantar backend + frontend y validar las 8 páginas con datos reales.

**Pendiente Día 2 (sábado 16):**
- W6 — Sync Catálogo Web. Scraping con Cheerio + cron 2h. Necesito la URL de la web de Bochile.
- 4-5 pruebas E2E vía Twilio (texto + audio + imagen + lead caliente + lead frío).

**Pendiente Día 3 (domingo 17):**
- Reescribir `INDEX.md` raíz (está desactualizado, todavía menciona cloud y gpt-5).
- Limpieza repo: mover scripts python históricos a `_historico/`, borrar `__pycache__`, `WORKFLOWS.zip` viejo, backups obsoletos.
- Armar ZIP final.

## Cuando Yamil pregunte algo, mandarle:

`00_PARA_YAMIL.md` (1 página, ejecutivo).  
Si quiere profundizar técnico: los manuales `08_HANDOFF/`.

## Comandos que uso seguido

```bash
# Logs de n8n en vivo
docker logs n8n -f --tail=100

# Reiniciar solo n8n
docker compose restart n8n   # en 00_SISTEMA_INTERNO/n8n-infra

# Test del webhook sin Twilio
curl -X POST http://localhost:5680/webhook/bochile-chat \
  -H "Content-Type: application/json" \
  -d '{"from":"+5492914423398","name":"Test","message":"Hola busco casa Palihue"}'

# Test del backend dashboard
curl http://localhost:3002/api/health
curl http://localhost:3002/api/metrics
```

## Cosas que me confunden y querría no olvidar

- El n8n cloud `weseka.app.n8n.cloud` es BACKUP VIEJO. No usar. Tiene workflows con IDs distintos y bugs sin corregir.
- En el docker-compose, el puerto interno es 5678 pero el externo es 5680. Si ves URL `:5678/healthz` adentro de un docker exec, está bien.
- `N8N_ENCRYPTION_KEY` no rotar sin migrar — pierde acceso a las credenciales guardadas.
- Twilio sandbox kickea testers cada 3 días. Renovar `join <código>`.
- El SA es read-only (`spreadsheets.readonly`). Si querés que el Dashboard escriba al Sheet en el futuro, cambiar el scope.

## Documentación para profundizar

- Qué construimos + decisiones técnicas: `08_HANDOFF/05_ARQUITECTURA.md`
- Cómo prende paso a paso: `08_HANDOFF/02_COMO_PRENDE.md`
- Uso diario / operación: `08_HANDOFF/03_COMO_SE_OPERA.md`
- Troubleshooting: `08_HANDOFF/04_QUE_PASA_SI.md`
- URLs/IDs/credenciales: `08_HANDOFF/06_CONTACTOS_Y_CUENTAS.md`
- Scraper del catálogo: `08_HANDOFF/07_SCRAPER.md`
- Estado técnico final del sistema n8n: `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/ESTADO_FINAL.md`
- Tests E2E del W1: `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/tests/README.md`

---

## Setup desde el ZIP

Si recibiste esto como ZIP, falta regenerar 3 cosas (que NO van en el ZIP por peso/seguridad).

### 1. Dependencias npm (~3 minutos)

```bash
cd 05_DASHBOARD_WEB/backend && npm install
cd ../frontend && npm install
cd ../../04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper && npm install
```

### 2. Service Account de Google (~5 minutos, una sola vez)

Sigue los 5 pasos del manual `08_HANDOFF/06_CONTACTOS_Y_CUENTAS.md` → sección "Service Account" → guardar el JSON en `05_DASHBOARD_WEB/backend/credentials/service-account.json`.

El email del SA hay que **compartirlo como Viewer** con el Sheet maestro (link en el manual).

### 3. (Opcional) Imágenes del catálogo (~12 minutos)

Las imágenes de las propiedades están como URLs públicas en el Sheet, así que el sistema funciona sin descargarlas. Si querés tenerlas locales:

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper
npm run scrape -- --download-images
```

Eso baja 2697 imágenes (~613 MB) a `output/images/{id}/`.

### Validación rápida post-setup

```bash
# Encender el backend del dashboard
cd 05_DASHBOARD_WEB/backend && npm run dev

# En otra terminal, smoke test:
curl http://localhost:3002/api/health
# debe devolver: {"status":"ok","sheet":"1YChe...","timestamp":"..."}

curl http://localhost:3002/api/propiedades | head -50
# debe devolver array con 239 propiedades reales del catálogo
```

Si esos dos comandos funcionan, el resto del setup es correr `02_COMO_PRENDE.md` paso a paso.
