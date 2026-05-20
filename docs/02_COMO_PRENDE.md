# 02 - Cómo prende el sistema

## Modalidad CLOUD (Render, lo normal)

**Si seguiste DEPLOY.md y todo está en Render, no tenés que hacer NADA**. El sistema vive 24/7. Solo abrís el Dashboard cuando querés mirar:

```
https://bochile-dashboard-ui.onrender.com
```

Si Cami deja de responder, **lo más probable** es que algún servicio en Render se haya pausado por inactividad (los planes Starter se ponen a dormir tras 15 min sin tráfico).

- Para activarlo: simplemente mandar un mensaje al WhatsApp del bot. La primera vez tarda ~30 segundos (cold start). Después responde normal.
- Para que NUNCA duerma: upgradear el plan a Standard (USD 25/mes por servicio).

## Modalidad LOCAL (para desarrollo o si Render cae)

Si necesitás levantar TODO en tu PC (raro, solo para desarrollo o emergencia), seguí estos pasos:

### 1. Docker Desktop

Abrir la app. Esperar ~30 seg hasta que el icono esté quieto (no animado).

### 2. n8n + Qdrant locales

```powershell
cd "C:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\00_SISTEMA_INTERNO\n8n-infra"
docker compose up -d
```

Verificar en `http://localhost:5680` que n8n responde y muestra los 7 workflows.

### 3. RAG server local

```powershell
cd "C:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\apps\rag"
npm install   # solo la primera vez
npm run dev
```

Verificar `http://localhost:3003/api/health` → debe responder `{"status":"ok"}`.

### 4. Dashboard backend

```powershell
cd "C:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\apps\dashboard-api"
npm install   # solo la primera vez
npm run dev
```

Verificar `http://localhost:3002/api/health`.

### 5. Dashboard frontend

```powershell
cd "C:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\apps\dashboard-ui"
npm install
npm run dev
```

Abrir `http://localhost:5175/`.

### 6. Tunnel público (para que respond.io le pegue a tu n8n local)

```powershell
cloudflared tunnel --url http://localhost:5680
```

Te da una URL tipo `https://random-xxx.trycloudflare.com`. Esa URL la tenés que pegar en:

- respond.io → Settings → Integrations → Webhooks → Punto final:
  ```
  https://random-xxx.trycloudflare.com/webhook/bochile-chat
  ```

**Ojo**: cada vez que reiniciás cloudflared, la URL cambia. Tenés que actualizar respond.io de vuelta.

## Cómo apago

### CLOUD
No se apaga. Los servicios de Render quedan corriendo (o duermen si Starter sin tráfico). Si querés bajar costos, pausá los servicios desde el dashboard Render.

### LOCAL
- Ctrl+C en cada terminal de los servicios Node
- `docker compose down` en la carpeta de n8n-infra
- Cerrar Docker Desktop

## Mini-troubleshooting

| Síntoma | Fix |
|---|---|
| `docker compose up` falla | Abrir Docker Desktop primero |
| `npm install` falla | Borrar `node_modules` y reinstalar |
| n8n no muestra workflows | Verificar que el disco está montado (en local: `volumes` del docker-compose) |
| Cloudflared "tunnel cannot be created" | Reiniciar el comando, a veces hay que esperar 30 seg |
| RAG no responde | Verificar `.env` con `OPENAI_API_KEY` y `QDRANT_URL` correctos |
