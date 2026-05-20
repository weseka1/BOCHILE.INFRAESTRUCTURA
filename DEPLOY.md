# DEPLOY.md — Subir Bochile a Render (full cloud 24/7)

> Procedimiento completo paso a paso. Si lo seguís en orden, en ~2 horas tenés todo corriendo.

---

## Mapa de servicios y URLs finales

Al terminar este deploy vas a tener:

| Servicio | URL final | Plan Render | Costo |
|---|---|---|---|
| n8n (cerebro) | `https://bochile-n8n.onrender.com` | Standard | USD 25/mes |
| RAG (búsqueda) | `https://bochile-rag.onrender.com` | Starter | USD 7/mes |
| Dashboard API | `https://bochile-dashboard-api.onrender.com` | Starter | USD 7/mes |
| Dashboard UI | `https://bochile-dashboard-ui.onrender.com` | Static | USD 0 |
| Qdrant Cloud | `https://xxxx.aws.cloud.qdrant.io:6333` | Free 1 GB | USD 0 |

**Total**: USD 39/mes (sin OpenAI ni respond.io que ya tenés).

---

## FASE 0 — Preparar cuentas externas (15 min)

### 0.1 Qdrant Cloud (vector DB)

1. Ir a https://cloud.qdrant.io
2. Sign up (usar email WESEKA)
3. **Create Cluster** → Free Tier → región `us-east` o `eu-central`
4. Esperar 1 minuto (creating cluster)
5. **Copiar y guardar**:
   - **URL del cluster** → algo tipo `https://abc-xxx.aws.cloud.qdrant.io:6333`
   - **API Key** → clic en "API Keys" → "Create" → copiar

### 0.2 Google Sheets Service Account (si no lo tenés ya)

Probablemente ya lo tenés en `apps/dashboard-api/credentials/service-account.json` local.

Si no:
1. Ir a https://console.cloud.google.com
2. Crear proyecto (o usar existente)
3. APIs & Services → Library → habilitar **Google Sheets API**
4. APIs & Services → Credentials → Create credentials → Service account
5. Bajar el JSON
6. **Compartir el Sheet** (https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4) con el email del service account, permisos de **Editor**.

### 0.3 OpenAI API key

Ya la tenés en tu `.env` local. Copiala aparte.

### 0.4 respond.io webhook secret

En respond.io → Settings → Integrations → Webhooks → editar el webhook actual → copiar **Clave de firma**.

---

## FASE 1 — Deploy del Blueprint a Render (30 min)

### 1.1 Conectar el repo

1. Ir a https://dashboard.render.com → **New** → **Blueprint**
2. **Connect repository** → seleccionar `weseka1/BOCHILE.INFRAESTRUCTURA`
3. Branch: `main`
4. Render detecta `render.yaml` y propone crear 4 servicios. **Apply**.

### 1.2 Configurar secrets POR servicio

Cuando Render crea los servicios, **pausa cada uno hasta que setees secrets**.

#### bochile-rag (Settings → Environment)
| Variable | Valor |
|---|---|
| `OPENAI_API_KEY` | `sk-proj-...` |
| `QDRANT_URL` | URL del cluster Qdrant Cloud |
| `QDRANT_API_KEY` | API key Qdrant Cloud |
| `RESPONDIO_WEBHOOK_SECRET` | clave de firma respond.io |

#### bochile-dashboard-api (Settings → Environment)
| Variable | Valor |
|---|---|
| `SHEET_ID` | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` |
| `GOOGLE_SHEETS_CREDS_JSON` | **El JSON entero del service-account, en UNA LÍNEA** |

> Para una línea: abrí el JSON, copiá todo, en Render pegalo como valor de la var. Render acepta JSON multi-línea pero por las dudas usá una línea.

#### bochile-n8n (Settings → Environment)
| Variable | Valor |
|---|---|
| `N8N_BASIC_AUTH_USER` | `admin` (o el que quieras) |
| `N8N_BASIC_AUTH_PASSWORD` | password fuerte random (guardalo!) |
| `N8N_ENCRYPTION_KEY` | string random 32+ caracteres (**guardalo, si lo perdés perdés todas las credenciales encriptadas**) |

#### bochile-dashboard-ui
No requiere secrets (`VITE_API_URL` lo setea Render automáticamente).

### 1.3 Trigger Deploy

En cada servicio: **Manual Deploy** → **Deploy latest commit**.

Esperar ~5-10 min por servicio. Mirar logs.

Al terminar:
- `bochile-rag.onrender.com/api/health` → debe responder 200
- `bochile-dashboard-api.onrender.com/api/health` → debe responder 200
- `bochile-dashboard-ui.onrender.com/` → debe cargar el dashboard
- `bochile-n8n.onrender.com/` → debe pedir login

---

## FASE 2 — Cargar el catálogo de propiedades en Qdrant Cloud (30 min)

El catálogo no se carga solo, hay que correr el embed inicial una vez.

### 2.1 Abrir Shell del RAG en Render

Render Dashboard → `bochile-rag` → **Shell** (esquina superior derecha).

### 2.2 Verificar que `output/properties-enriched.json` está en el container

```bash
ls -la output/
```

Si NO está, hay que subirlo. Pero el repo ya lo committeó al disco del scraper. Verificar.

### 2.3 Correr embed inicial (text + CLIP)

```bash
npm run embed -- --reset
```

Esto:
- Embea las 235+ propiedades del catálogo
- Crea la colección `bochile_properties` en Qdrant Cloud
- Toma ~10 min

Para el CLIP visual (más pesado, requiere descargar las imágenes del scraper):

> El CLIP local funciona con imágenes del scraper que están EN TU DISCO LOCAL, no en Render. Para Render, hay que adaptar el scraper para que las imágenes vivan en un bucket (S3/R2) o subirlas al repo (pesado).
>
> **Por ahora**, el CLIP queda local (vos corrés `npm run embed:clip` desde tu PC) y los embeddings se suben directo a Qdrant Cloud.

### 2.4 Verificar

```bash
curl https://bochile-rag.onrender.com/api/stats
# debe responder con points_count > 0
```

---

## FASE 3 — Importar workflows a n8n de Render (45 min)

### 3.1 Login en `https://bochile-n8n.onrender.com`

User: el de `N8N_BASIC_AUTH_USER`. Pass: el que pusiste.

### 3.2 Crear las credenciales de n8n (antes de importar workflows)

n8n necesita tener cargadas las credenciales para que los nodos importados funcionen.

**Settings → Credentials → New** para cada una:

1. **OpenAi account** (tipo: OpenAi)
   - API Key: la misma de `OPENAI_API_KEY`
   - Save → anotar el ID que asigna

2. **Google Sheets account** (tipo: Google Sheets OAuth2)
   - Hacer el flow OAuth (n8n te abre ventana de Google → autorizar)
   - Save → anotar ID

3. **Respond.io API** (tipo: Header Auth)
   - Name: `Authorization`
   - Value: `Bearer <tu-respondio-api-token>`
   - Save → anotar ID

### 3.3 Importar workflows en orden

En el menú principal de n8n: **+ Add workflow** → **Import from File**.

**ORDEN OBLIGATORIO** (el W1 referencia al SUB, hay que importar el SUB primero):

1. `workflows/01_SUB_Bochile_RAG_Search.json`
2. `workflows/02_W1_CORE_Multi_Agente.json` ← el principal
3. `workflows/03_W2_Recordatorios_Visitas.json`
4. `workflows/04_W3_Match_Retroactivo.json`
5. `workflows/05_W4_Cobranza_Alquileres.json`
6. `workflows/06_W5_Backup_Mensual.json`
7. `workflows/07_W7_Reactivar_Bot_Pausado.json`

Por cada workflow después de importar:
- n8n marca en amarillo los nodos que tienen credenciales sin asignar
- Abrí cada nodo amarillo → seleccioná la credencial correspondiente del dropdown
- Click **Save**

### 3.4 Actualizar URLs internas en W1 y SUB

El workflow tiene URLs hardcoded a `http://host.docker.internal:3003/...` que son para tu localhost. Hay que cambiarlas a Render.

**En `02_W1_CORE_Multi_Agente` → nodo "Parsear Mensaje"**:
- Buscar: `http://host.docker.internal:3003/api/buffer/`
- Reemplazar por: `https://bochile-rag.onrender.com/api/buffer/`

**En `01_SUB_Bochile_RAG_Search` → nodo "Call RAG and Format"**:
- Buscar: `const RAG_URL = 'http://host.docker.internal:3003/api/search';`
- Reemplazar por: `const RAG_URL = 'https://bochile-rag.onrender.com/api/search';`

**En W1 → nodo "Buscar Por Imagen"** (HTTP request):
- URL: `https://bochile-rag.onrender.com/api/search-by-image`

### 3.5 Activar workflows

Por cada workflow importado: toggle **Active** arriba a la derecha.

---

## FASE 4 — Actualizar webhook URL en respond.io (5 min)

1. respond.io → Settings → Integrations → Webhooks → editar el actual
2. **Punto final** → reemplazar por:
   ```
   https://bochile-n8n.onrender.com/webhook/bochile-chat
   ```
3. **Eventos suscritos**: dejar marcado `message.received`. (Si querés que detecte cuando vos respondés como humano, marcar también `message.sent`).
4. Save

---

## FASE 5 — Test E2E (5 min)

Desde un WhatsApp que esté en el sandbox de respond.io o en el número Business:

```
Cliente: hola
```

Esperar ~10 segundos. Cami debería responder algo tipo:
> "Hola, soy Cami de Bochile. Contame, en qué andas?"

Si responde → **DEPLOY OK**.

Si no responde, ir a `bochile-n8n.onrender.com` → ver ejecuciones del W1 → cuál falló y por qué.

---

## FASE 6 — Apagar el setup local

Una vez que TODO funciona en Render:

```powershell
# Apagar Docker Desktop
# Matar procesos node locales del RAG y dashboard
# Matar cloudflared
```

Listo. Bochile vive 100% en cloud, sobrevive a tu PC apagada.

---

## Troubleshooting común

| Síntoma | Causa probable | Fix |
|---|---|---|
| n8n: "Module not found" | Build del Docker falló | Ver logs, asegurar que `n8n.Dockerfile` está OK |
| Dashboard: 500 en `/api/leads` | `GOOGLE_SHEETS_CREDS_JSON` mal pegado | Re-pegar JSON, validar con jsonlint |
| RAG: "QDRANT_URL is undefined" | Falta env var | Settings → Environment del bochile-rag |
| Cami no responde | URL respond.io apunta a la vieja (cloudflared) | Actualizar a `bochile-n8n.onrender.com` |
| n8n al reiniciar pierde workflows | Disco no persistente | Verificar disk montado en `/home/node/.n8n` |
| Cami inventa fechas | Workflow no importó bien | Re-importar W1, verificar nodo "Formatear Equipo y Agenda" |

---

## Anexo — Backup periódico del workflow

Configurar un cron local (o GitHub Action) que cada noche:

```bash
node scripts/01_backup_workflow.cjs
```

Pero apuntando al n8n de Render (cambiar host en el script de `localhost:5680` a `bochile-n8n.onrender.com` + agregar header de basic auth). Lo dejo como mejora post-MVP.
