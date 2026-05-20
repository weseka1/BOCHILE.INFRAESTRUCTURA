# Deploy del RAG a Render (24/7 sin PC encendida)

Esta guía deja Qdrant + Bochile RAG corriendo en Render con URL pública permanente, para que el W1 de n8n no dependa de tu PC.

## Tu RAG ahora corre en

- **Qdrant**: `http://localhost:6333` (compartido con WESEKA SALES MACHINE)
- **Bochile RAG API**: `http://localhost:3003`

Cuando termines este deploy, las URLs van a ser:

- **Qdrant**: `https://bochile-qdrant.onrender.com`
- **Bochile RAG API**: `https://bochile-rag.onrender.com`

Y el W1 de n8n local apunta directamente a la URL pública del RAG. Te aviso cómo cambiar el sub-workflow al final.

## Costos

| Servicio | Plan Render | Costo |
|---|---|---|
| `bochile-qdrant` (Web Service Hobby) | starter | **USD 7/mes** |
| `bochile-rag` (Web Service Hobby) | starter | **USD 7/mes** |
| **TOTAL** | | **USD 14/mes** |

**Alternativa más barata (USD 7/mes)**: usar [Qdrant Cloud free tier](https://cloud.qdrant.io/) (1 GB gratis) en vez del Qdrant en Render. Doc al final.

## Pasos (15 min, una sola vez)

### 1 · Subir el código a GitHub

Si todavía no está, creá un repo (público o privado) con esta carpeta `04_INFRAESTRUCTURA_TECNICA/Bochile_RAG/`. Render lee el código de ahí.

```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE
git init
git add 01_CLIENTES/Bochile/04_INFRAESTRUCTURA_TECNICA/Bochile_RAG
git commit -m "Bochile RAG initial deploy"
gh repo create weseka/bochile-rag --private --source . --push
```

(o usás GitHub UI manualmente)

### 2 · Crear el blueprint en Render

1. Abrir https://dashboard.render.com/blueprints
2. Click **New Blueprint Instance**
3. Conectar el repo (Render te pide login a GitHub si no lo hiciste)
4. Render lee `render.yaml` automáticamente y propone crear 2 servicios
5. Dale **Apply**

### 3 · Configurar los secrets (NO van en el yaml por seguridad)

Después del primer deploy, en cada servicio:

**En `bochile-qdrant` → Environment**:
- `QDRANT__SERVICE__API_KEY` = generá un string random largo (ej. `openssl rand -hex 32`), copialo

**En `bochile-rag` → Environment**:
- `OPENAI_API_KEY` = tu API key de OpenAI (la misma que usa Camila)
- `QDRANT_API_KEY` = el MISMO valor que pusiste arriba en bochile-qdrant

Click **Save Changes**. Render redeploya automáticamente.

### 4 · Primer indexado en Render

Después del deploy exitoso de `bochile-rag`:

1. Click en el servicio `bochile-rag`
2. Tab **Shell** (panel derecho)
3. Correr:
   ```bash
   npm run embed -- --reset
   ```

Si todo OK, vas a ver `[embed] terminado: 239 propiedades embedeadas`.

> El JSON del catálogo (`properties-enriched.json`) tiene que estar accesible. Como no se sube a Render por defecto (está en `output/`), tenés 2 opciones:
> - **A**: subirlo al repo (commit el `output/properties-enriched.json`) → simple pero el JSON queda en git
> - **B**: hacer `npm run scrape && npm run enrich` desde Render Shell antes del embed → más limpio pero tarda 4 minutos extra

Recomendado para Bochile: **opción A** (commit el JSON enriquecido). Es ~600 KB, no molesta en git.

### 5 · Verificar URLs públicas

```bash
curl https://bochile-rag.onrender.com/api/health
# → {"status":"ok","collection":"bochile_properties",...}

curl -X POST https://bochile-rag.onrender.com/api/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <QDRANT_API_KEY>" \
  -d '{"query":"casa 3 amb Bahia Blanca 200k USD","filters":{"property_type":"casa","price_max":200000}}'
```

> Render Hobby se suspende después de 15 min sin tráfico. El primer request después de inactividad demora ~30s mientras se levanta. Soluciones:
> - Subir al plan **Standard** (USD 25/mes) que mantiene el servicio "warm"
> - Setear un cron externo (UptimeRobot, gratis) que pegue al `/api/health` cada 10 min
> - Para Bochile en producción con tráfico real, el plan Hobby está bien (cada vez que Camila atiende un mensaje, el servicio queda warm 15 min)

### 6 · Actualizar el sub-workflow del Matcher en n8n

El sub-workflow `Bochile RAG Search` (ID `6Dk2umeJDNViv9yb`) tiene el endpoint hardcoded a `http://host.docker.internal:3003/api/search`. Cambiarlo:

1. Abrir n8n local → workflow **Bochile RAG Search (sub-workflow)**
2. Editar el nodo **Call RAG and Format**
3. Cambiar la línea `const RAG_URL = ...` por:
   ```js
   const RAG_URL = 'https://bochile-rag.onrender.com/api/search';
   ```
4. Save. El W1 Matcher ahora consume del Render automáticamente.

> Si seteaste `QDRANT_API_KEY`, también agregá el header en el código:
> ```js
> data = await this.helpers.httpRequest({
>   method: 'POST',
>   url: RAG_URL,
>   headers: {
>     'Content-Type': 'application/json',
>     'Authorization': 'Bearer TU_QDRANT_API_KEY',
>   },
>   body,
>   json: true,
> });
> ```
> O mejor: setearlo como header server-side y proteger el endpoint con auth basic.

## Alternativa más barata: Qdrant Cloud Free (USD 7/mes total)

Qdrant Cloud te da **1 GB gratis para siempre**, suficiente para 100K propiedades.

### Pasos:

1. Crear cuenta en https://cloud.qdrant.io/
2. Crear un cluster **Free Tier** (1 GB)
3. Copiar la URL del cluster (algo tipo `https://xxxxx.us-east-0.aws.cloud.qdrant.io:6333`)
4. Crear una API key y copiarla
5. En el `render.yaml` de este repo, **borrar el servicio `bochile-qdrant`** completo
6. En el servicio `bochile-rag`, cambiar:
   ```yaml
   - key: QDRANT_URL
     value: https://xxxxx.us-east-0.aws.cloud.qdrant.io:6333
   - key: QDRANT_API_KEY
     sync: false  # pegar la key del Qdrant Cloud
   ```

Total mensual: solo USD 7 del Web Service del RAG.

## Migración del scraper a cron de Render (opcional)

El scraper sigue corriendo local en Windows Task Scheduler. Si lo querés en Render también:

1. Sumar al `render.yaml`:
   ```yaml
   - type: cron
     name: bochile-scraper
     schedule: "0 6 * * *"  # diario 6 AM UTC
     runtime: node
     rootDir: 04_INFRAESTRUCTURA_TECNICA/Bochile_Scraper
     buildCommand: npm install
     startCommand: npm run scrape -- --since 7days --to-sheet
   ```
2. Costo extra: USD 1/mes por cron job
3. Necesita el Service Account JSON del Sheet — montarlo como secret file en Render

## Troubleshooting

| Síntoma | Solución |
|---|---|
| `/api/health` da 503 | Servicio Hobby suspendido — esperá 30s al primer request |
| `collection not found` | Faltó correr `npm run embed -- --reset` desde Shell |
| `401 Unauthorized` desde n8n | Faltó `QDRANT_API_KEY` en el header del Code node del sub-workflow |
| Embed muy lento o falla | El primer embed indexa 239 props, ~30s. Si tarda mas → revisar saldo OpenAI |
| Build fails | Verificar que `package.json` y `src/` están en `rootDir` correcto |

## Estado actual de la fase 2

- [x] `render.yaml` listo en este repo
- [x] Doc completa
- [ ] Push del código a GitHub (acción tuya)
- [ ] Crear Blueprint Instance en Render (acción tuya, 5 clicks)
- [ ] Setear secrets (OPENAI_API_KEY, QDRANT_API_KEY)
- [ ] Correr `npm run embed -- --reset` desde Shell
- [ ] Actualizar URL del sub-workflow `Bochile RAG Search` a la URL pública
