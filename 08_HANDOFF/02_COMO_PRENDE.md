# 02 · Cómo prende

Este es el manual para encender todo el sistema desde cero. Útil cuando:
- Te entregamos el ZIP y querés correrlo por primera vez.
- Reiniciaste la PC y hay que volver a levantar.
- Algo se cayó y querés empezar limpio.

Sigue el orden. Cada paso te dice qué tenés que ver para saber que salió bien.

---

## Antes de arrancar (instalación una vez)

Si es la primera vez en esta PC, instalá:

1. **Docker Desktop** → https://www.docker.com/products/docker-desktop/  
   Dejalo corriendo en la bandeja del sistema. Ícono de ballena = OK.
2. **Node.js 20 o superior** → https://nodejs.org/  
   Verificá en una terminal: `node --version` (debe decir v20.x.x o más).
3. **ngrok** → https://ngrok.com/download  
   La versión gratis te alcanza. Si querés que la URL sea fija (para no andar tocando Twilio cada vez), pagá el plan personal ~USD 8/mes.

Si ya está todo instalado, salteá esta sección.

---

## Paso 1 — Levantar n8n (el cerebro)

n8n corre en un Docker. Para encenderlo:

```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\00_SISTEMA_INTERNO\n8n-infra
docker compose up -d
```

**Qué tiene que pasar:**
- Docker baja la imagen (la primera vez tarda 1-2 min, después es instantáneo).
- El container `n8n` arranca.

**Cómo verificás que está bien:**
```bash
docker compose ps
```
Tenés que ver una línea con `n8n` en estado `Up (healthy)`.

**Abrí en el navegador:** http://localhost:5680  
Debería aparecer el login de n8n. Si nunca te logueaste, va a pedirte crear usuario admin. Después de loguearte, vas al panel de workflows.

**Verificá que los 6 workflows están activos** (toggle verde a la derecha de cada uno):
- W1 — Chatbot Multi-Agente CORE
- W2 — Recordatorios de Visitas
- W3 — Match Retroactivo
- W4 — Cobranza Alquileres
- W5 — Backup Mensual + Reset
- W6 — Sync Catálogo Web

Si alguno está inactivo, abrilo y prendé el toggle.

---

## Paso 2 — Exponer n8n a internet (ngrok)

n8n corre en tu PC. Para que Twilio (que está en internet) le pueda mandar los mensajes de WhatsApp, hay que abrirle una puerta. Eso es ngrok.

En otra terminal:

```bash
ngrok http 5680
```

**Qué tiene que pasar:**
Ngrok te muestra una pantalla con una línea tipo:

```
Forwarding   https://unmossed-rosamond-untensely.ngrok-free.dev -> http://localhost:5680
```

**Copiá esa URL `https://...ngrok-free.dev`.** Esa es la "puerta" pública.

> **Si tenés plan gratis de ngrok**: cada vez que reinicies ngrok, la URL cambia. Entonces hay que actualizar dos lugares: el `docker-compose.yml` (variables `WEBHOOK_URL` y `N8N_PUBLIC_URL`) y la config de Twilio (paso 3). Si la URL cambió, hacé:
> 1. Editá `00_SISTEMA_INTERNO/n8n-infra/docker-compose.yml` y pegá la nueva URL en `WEBHOOK_URL` y `N8N_PUBLIC_URL`.
> 2. Reiniciá n8n: `docker compose up -d` (recarga la config nueva).

---

## Paso 3 — Apuntar Twilio al ngrok

WhatsApp llega vía Twilio Sandbox. Twilio necesita saber a dónde mandarte los mensajes.

1. Andá a https://console.twilio.com/
2. Login con la cuenta de WESEKA.
3. Menú izquierda: **Messaging → Try it out → Send a WhatsApp message → Sandbox settings**.
4. En el campo **"When a message comes in"** pegá:
   ```
   https://<tu-url-de-ngrok>/webhook/bochile-chat
   ```
   (reemplazá `<tu-url-de-ngrok>` por la URL del paso anterior)
5. Method: **POST**.
6. Click **Save**.

Listo. Ahora cuando un cliente mande un WhatsApp al número del sandbox (`+1 415 523 8886` con código del sandbox), Twilio lo va a redirigir a tu n8n local.

---

## Paso 4 — Encender el Dashboard web (la pantalla)

El Dashboard tiene 2 partes: un backend (que lee del Sheet) y un frontend (lo que ves).

**Terminal 3 — Backend:**
```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\05_DASHBOARD_WEB\backend
npm run dev
```

**Qué tiene que pasar:**
```
Bochile Dashboard API on http://localhost:3002
Sheet: 1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4
CORS origin: http://localhost:5176
```

**Test:** abrí en el navegador http://localhost:3002/api/health  
Tiene que devolver `{"status":"ok","sheet":"1YChe...","timestamp":"..."}`.

**Terminal 4 — Frontend:**
```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\05_DASHBOARD_WEB\frontend
npm run dev
```

**Qué tiene que pasar:**
```
  VITE v5.x.x  ready in 234 ms
  ➜  Local:   http://localhost:5176/
```

**Abrí en el navegador:** http://localhost:5176  
Tendría que aparecer el dashboard con los KPIs cargados (Leads, Visitas, Propiedades, etc.).

---

## Paso 5 — Test punta a punta (5 min)

Vamos a verificar que todo el circuito funciona.

1. **Unirte al sandbox de Twilio** (una vez por teléfono):  
   Desde tu WhatsApp personal, mandale el código del sandbox al `+1 415 523 8886`. El código está en Twilio Console → Sandbox (algo tipo `join brave-elephant`). Twilio te responde "Sandbox: You are all set!".

2. **Mandale un mensaje a Camila:**  
   Desde tu WhatsApp escribile al mismo número: *"Hola, busco casa de 4 ambientes en Palihue hasta 300 mil USD."*

3. **Qué tiene que pasar:**
   - En menos de 30 segundos, Camila te responde como vendedora.
   - Abrís el dashboard → pestaña Leads → tu número aparece como lead nuevo.
   - Pestaña Conversaciones → ves tu mensaje y la respuesta de Camila.

Si pasa todo eso: **el sistema está prendido y funcionando.**

Si no pasa: andá al manual `04_QUE_PASA_SI.md`.

---

## Resumen para tener a mano (TL;DR de encendido)

| Paso | Comando | Verificación |
|---|---|---|
| 1 | `docker compose up -d` (en n8n-infra) | http://localhost:5680 muestra workflows |
| 2 | `ngrok http 5680` | URL `https://...ngrok-free.dev` |
| 3 | Pegar URL en Twilio Sandbox | Twilio guarda OK |
| 4a | `npm run dev` (en backend) | `/api/health` devuelve `ok` |
| 4b | `npm run dev` (en frontend) | http://localhost:5176 carga |
| 5 | WhatsApp → "Hola" al sandbox | Camila responde + lead aparece en dashboard |

---

## Cómo apagar todo

Si querés bajar el sistema (sin perder los datos):

```bash
# Bajar n8n
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\00_SISTEMA_INTERNO\n8n-infra
docker compose down
```

```bash
# Cerrar ngrok: Ctrl+C en su terminal
# Cerrar backend y frontend: Ctrl+C en cada terminal
```

Los workflows, credenciales y datos del Sheet siguen ahí. La próxima vez que prendas, todo vuelve al mismo estado.
