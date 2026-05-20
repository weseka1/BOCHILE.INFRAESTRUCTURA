# 04 · Qué pasa si...

FAQ y troubleshooting. Si algo se rompió, buscá tu problema acá. Si no está, fijate en el resumen final "Si nada funciona".

---

## El bot no responde a mis mensajes

Camila tiene 3 puntos donde puede romperse el camino. Verificá en este orden:

**1) ¿n8n está prendido?**  
Abrí http://localhost:5680. Si no carga → Docker no está corriendo. Hacé:
```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\00_SISTEMA_INTERNO\n8n-infra
docker compose up -d
```

**2) ¿Los workflows están activos?**  
Abrí localhost:5680. El W1 (Chatbot CORE) debe tener el toggle verde a la derecha. Si está gris, prendelo.

**3) ¿ngrok está corriendo y la URL es la correcta?**  
Mirá la terminal donde corriste `ngrok http 5680`. ¿Sigue activa? ¿La URL es la misma que tenés cargada en Twilio?

Para chequear la URL de Twilio:
- https://console.twilio.com/ → Messaging → Sandbox settings → campo "When a message comes in".
- Si dice una URL distinta a la que muestra ngrok, actualizala. Save.

---

## Camila inventa propiedades que no existen

Eso pasa cuando el sub-agente Matcher no encuentra coincidencias y la IA "alucina" para no quedar mal. Hay 2 cosas a chequear:

**1) ¿El catálogo tiene propiedades publicadas?**  
Abrí el Sheet → pestaña `propiedades`. La columna `publicada` debe ser `TRUE` en las que querés que se ofrezcan. Si están todas en `FALSE`, no tiene de dónde tomar.

**2) ¿El scraper W6 corrió bien?**  
Abrí localhost:5680 → W6 Sync Catálogo Web → tab "Executions". Mirá la última ejecución: si está roja, algo de la web cambió y el scraper no parseó bien. Avisale a Juani — hay que actualizar los selectores CSS.

Mitigación inmediata: cargar manualmente 5-10 propiedades reales al Sheet siguiendo el formato del manual `03_COMO_SE_OPERA.md` (sección "Alta de propiedad").

---

## Veo un lead con datos mal

Pasa, sobre todo al principio. Camila a veces interpreta mal el presupuesto o la zona.

**Editalo a mano:** abrí el Sheet → pestaña `leads` → encontrá el lead por teléfono o `lead_id` → corregí la columna que esté mal.

Camila va a respetar tu edición la próxima vez que el lead escriba (la memoria conversacional se mantiene pero el CRM se actualiza con tu valor).

---

## OpenAI da error 429 (rate limit) o timeout

OpenAI tiene cuota por minuto y por día. Si te pasaste:

**Solución rápida:** bajar el modelo a `gpt-4o-mini` en TODOS los nodos del W1.

1. Abrí localhost:5680 → W1.
2. En los 4 nodos "GPT Vendedor CORE / Calificador / Matcher / Admin" cambiá el modelo a `gpt-4o-mini`.
3. Save.

`gpt-4o-mini` es 10x más barato y casi igual de bueno para este caso de uso. La calidad de respuesta baja un poquito pero no es notorio.

**Solución a largo plazo:** subir el saldo en https://platform.openai.com/usage. Con USD 20 ya tenés mes y medio de uso piloto.

---

## Twilio no llega a n8n (mando WhatsApp y no pasa nada)

**Causas más probables:**

**1) Sandbox expiró.**  
El sandbox de Twilio echa a los usuarios después de 3 días sin actividad. Tenés que volver a mandar `join <código>` desde tu WhatsApp al número del sandbox. El código está en Twilio Console → Sandbox.

**2) Webhook URL desactualizada.**  
Pasa cuando ngrok cambia de URL (plan gratis rota cada vez que reiniciás). Solución: ver "El bot no responde / punto 3".

**3) Saldo Twilio agotado.**  
Twilio Console → Billing → ver saldo. Si está en USD 0, cargá fondos.

---

## ngrok cambió de URL y no quiero seguir tocando esto

Tenés 2 opciones:

**Opción A (gratis pero molesto):** vivir con URLs cambiantes. Cada vez que reiniciás ngrok, actualizá en 2 lugares: Twilio Sandbox + `docker-compose.yml` (variables `WEBHOOK_URL` y `N8N_PUBLIC_URL`).

**Opción B (USD 8/mes):** plan ngrok personal. Te da una URL fija que nunca cambia. Lo configurás una vez y olvidate.

**Opción C (lo correcto a largo plazo):** migrar n8n a un servidor real con dominio propio. Ver `05_ARQUITECTURA.md` sección "Fase 2 post-firma".

---

## Dashboard no carga (http://localhost:5176 da error)

**1) ¿El frontend está corriendo?**  
Mirá la terminal donde hiciste `npm run dev` del frontend. Si está cerrada, volvé a correrla:
```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\05_DASHBOARD_WEB\frontend
npm run dev
```

**2) ¿El backend responde?**  
Probá: http://localhost:3002/api/health  
Debe devolver `{"status":"ok",...}`. Si no, el backend está caído. Levantalo igual:
```bash
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\01_CLIENTES\Bochile\05_DASHBOARD_WEB\backend
npm run dev
```

**3) ¿Error de service account?**  
Si el backend tira `Error: Could not load credentials` o `403`, el problema está en el archivo `credentials/service-account.json` (falta, está mal o el Sheet no le dio permisos). Pasos para arreglar: ver `06_CONTACTOS_Y_CUENTAS.md` sección "Service Account".

---

## El dashboard muestra datos viejos

Hay 2 capas de cache:
- Backend cachea las pestañas del Sheet por 30 segundos.
- Frontend cachea por 5 minutos con TanStack Query.

Si necesitás ver datos frescos YA, hacé hard refresh: **Ctrl+F5** en el navegador.

Si querés cambiar el cache a más corto: editá `backend/.env` y bajá `CACHE_TTL_SECONDS=30` a `5`. Reiniciá el backend.

---

## Google Sheets API rate limit (60 reads/min)

Si ves errores tipo `Quota exceeded for quota metric 'Read requests'`:

- El cache del backend (30s) debería evitar esto en uso normal. Pero si alguien le pega muy fuerte al dashboard, puede saltar.
- Solución corta: esperar 1 minuto y reintentar.
- Solución larga: subir el cache TTL a 60s en `backend/.env`.

---

## Quiero rotar la API key de OpenAI / Twilio / lo que sea

1. Abrí localhost:5680 → **Settings → Credentials**.
2. Encontrá la credencial vieja.
3. Click "Edit" → pegá el valor nuevo → Save.
4. Los workflows que la usaban siguen funcionando sin tocar nada — ya apuntan a la credencial por ID, no al valor.

---

## Reiniciar TODO desde cero (cuando ya no entendés qué pasa)

Receta nuclear:

```bash
# 1) Bajar n8n
cd c:\Users\46094\Desktop\WESEKA_IA_STRUCTURE\00_SISTEMA_INTERNO\n8n-infra
docker compose down

# 2) Matar ngrok: Ctrl+C en su terminal

# 3) Matar backend dashboard: Ctrl+C en su terminal
# 4) Matar frontend dashboard: Ctrl+C en su terminal

# 5) Levantar todo de nuevo siguiendo 02_COMO_PRENDE.md
```

Los datos del Sheet no se tocan. Workflows y credenciales tampoco. Solo se reinician los procesos.

---

## Si nada de lo anterior funciona

Hablale a Juani. Tiene contexto completo en su Claude Code y puede debuggear en remoto si hace falta.

Si Juani no está disponible, podés revisar los logs:
```bash
docker logs n8n -f --tail=100
```

Lo que veas ahí pasalo a un soporte técnico.

---

## Errores que NO son problemas (no te preocupes si los ves)

- **n8n: "MCP Server enabled but no API key set"** → es solo si no se generó la API key. No bloquea workflows.
- **Backend: "2 moderate severity vulnerabilities"** al hacer `npm install` → son advertencias de dependencias, no impactan funcionamiento.
- **Frontend: "Browser doesn't support..."** → algunos features de TanStack Query advierten cosas en consola. Ignorá.
