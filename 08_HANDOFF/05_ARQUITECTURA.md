# 05 · Arquitectura

Este manual es para entender QUÉ construimos y POR QUÉ. Pensado para vos como socio que evalúa el laburo. Si solo querés operarlo, los manuales 02 y 03 te alcanzan.

---

## Vista general

El sistema tiene 3 capas independientes que se comunican por interfaces simples:

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE CONTACTO                         │
│  WhatsApp del cliente ─→ Twilio Sandbox ─→ webhook n8n      │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PROCESAMIENTO                    │
│  n8n local (Docker)                                         │
│   ├─ W1  Chatbot Multi-Agente (Camila + 3 sub-agentes)      │
│   ├─ W2  Recordatorios de Visitas        (cron 1h)          │
│   ├─ W3  Match Retroactivo               (cron 15min)       │
│   ├─ W4  Cobranza Alquileres             (cron diario 9am)  │
│   ├─ W5  Backup Mensual + Reset          (cron mensual 03h) │
│   └─ W6  Sync Catálogo Web (scraping)    (cron 2h)          │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE DATOS                            │
│  Google Sheet "Bochile · Sistema Operativo"                 │
│   ├─ leads                  ├─ matches_pendientes           │
│   ├─ propiedades            ├─ conversaciones               │
│   ├─ visitas                ├─ acciones_ia                  │
│   ├─ contratos              └─ empleados                    │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                     │
│  Dashboard Web (React + Tailwind)                           │
│   └─ Lee del Sheet vía backend Node + Service Account       │
└─────────────────────────────────────────────────────────────┘
```

Cada flecha es un protocolo simple: HTTP/JSON entre Twilio→n8n y entre Dashboard→Sheet, y la API oficial de Google entre n8n→Sheet. Nada propietario, todo reemplazable.

---

## Decisión 1 — Google Sheet como base de datos

**El problema:** una inmobiliaria chica no tiene equipo técnico. Si la base de datos vive en Postgres / MongoDB / Firebase, cada cambio operativo (corregir un teléfono, marcar una visita realizada, cargar una propiedad nueva) necesita o un panel admin construido a medida, o pedirnos a nosotros que lo hagamos. **Crea dependencia técnica que el cliente no puede sostener.**

**La decisión:** usamos un Google Sheet como única fuente de verdad del negocio. n8n escribe ahí, el Dashboard lee de ahí, y vos / Camila humana pueden editar a mano cuando hace falta.

**Trade-offs:**
- ✓ Cliente puede editar todo desde un navegador, sin código.
- ✓ Backup gratis (versiones de Google Sheets) y compartido por mail.
- ✓ Integración instantánea con Looker Studio si quieren reportes más elaborados.
- ✗ Sheets tiene rate limit de 60 reads/min/user. Con cache de 30s del backend, esto no es problema hasta ~120 usuarios concurrentes en el dashboard. Para escala mayor habría que pasar a una DB real, pero estamos lejos de eso.
- ✗ Sin transacciones. Si dos workflows escriben al mismo tiempo a la misma fila puede haber race condition. Mitigación: cada workflow usa `prop_id`/`lead_id`/`visita_id` como matching key, y los upserts son por columna, no full row. Riesgo concreto: bajo.

**Cuándo migrar a DB real:** cuando el cliente tenga >50 transacciones/minuto sostenidas o >10 usuarios concurrentes operando.

---

## Decisión 2 — Multi-cerebro en vez de un solo agente

**El problema:** un solo agente con un prompt gigante que abarca "calificar + buscar + agendar + reclamar pagos" se confunde, alucina, mezcla contextos, y cuando lo querés mejorar tenés que tocar todo. Es deuda técnica desde el día 1.

**La decisión:** un agente ORQUESTADOR (Camila / Vendedor CORE) que es la única voz al cliente, y 3 sub-agentes ESPECIALISTAS que actúan como herramientas:

| Agente | Modelo | Rol | Temperatura |
|---|---|---|---|
| Vendedor CORE (Camila) | gpt-4o | Conversa, decide cuándo llamar a sub-agentes | 0.4 |
| Calificador | gpt-4o-mini | Devuelve score 0-100 + datos estructurados del lead | 0.1 |
| Matcher | gpt-4o-mini | Busca propiedades en el catálogo y devuelve top 3 | 0.2 |
| Administrativo | gpt-4o-mini | Agenda visitas, notifica vendedores, actualiza CRM | 0.1 |

**Por qué funciona:**
- Cada cerebro tiene un prompt corto y específico. Menos margen de error.
- Los sub-agentes son `agentTool` en n8n: el CORE los llama cuando los necesita, no en todos los turnos.
- Si querés sumar capacidades (ej. un agente "Tasador" que estima precio de mercado), se conecta sin tocar los otros 4.
- El cliente final solo ve UNA voz coherente (Camila). Los sub-agentes son invisibles.

**Costo aproximado por conversación:** 5-10 mensajes intercambiados ≈ USD 0.005 (gpt-4o + gpt-4o-mini con cache). 1.000 conversaciones/mes ≈ USD 5.

---

## Decisión 3 — Twilio Sandbox para el piloto

**Twilio Sandbox** es un número de WhatsApp compartido (`+14155238886`) que cualquiera puede usar mandando un código de "join" desde su WhatsApp.

**Por qué empezamos acá:**
- Setup en 5 minutos vs 1-3 días que tarda Meta en aprobar un número WhatsApp Business propio.
- Cero costo fijo.
- Permite probar el sistema con un grupo cerrado de testers antes de pagar.

**Limitación:**
- Solo atiende teléfonos que se "unieron" mandando `join <código>`. **No sirve para clientes reales que no conocen el sistema.**
- Cada tester tiene que renovar la unión cada 3 días.

**Próximo paso (fase 2 post-firma):** contratar número WhatsApp Business pago con Twilio (~USD 15/mes Twilio + aprobación gratuita de Meta). Reemplazás 1 variable en n8n y listo, atiende a cualquier WhatsApp del mundo.

---

## Decisión 4 — Scraping del catálogo en vez de integración API

**El problema:** la web de Bochile la armó un dev externo, no tenemos código fuente ni acceso al backend del hosting (Hosting Bahía es shared, sin terminal). No podemos meter un endpoint `/api/propiedades`.

**La decisión:** cada 2 horas, el W6 visita la web pública de Bochile, parsea el HTML con Cheerio, y vuelca las propiedades al Sheet. Si Bochile sube una propiedad nueva a su web, en menos de 2h Camila puede ofrecerla.

**Trade-offs:**
- ✓ Cero coordinación con el dev de la web. Cero cambios en su sitio.
- ✓ Single source of truth: la web de Bochile.
- ✗ Frágil. Si rediseñan la web cambian los selectores CSS y el scraper se rompe. Mitigación: logging detallado en W6 + alerta al admin si más del 20% de propiedades fallan parse.
- ✗ Lag de hasta 2h. Si Bochile sube una propiedad estrella y un cliente la pregunta antes del próximo cron, Camila no la conoce. Solución: bajar el cron a 30 min si hace falta.

**Cuándo migrar a integración limpia:** cuando se rehaga la web de Bochile (fase 2 acordada con cliente). Le pedimos al dev nuevo un endpoint JSON y reemplazamos el scraper.

---

## Decisión 5 — Dashboard React + Backend Node en vez de directo a Sheets

**Alternativa más simple:** que el frontend lea directo del Sheet vía Google Sheets API.

**Por qué NO:** las credenciales de Google quedarían expuestas en el navegador (cualquiera con devtools las roba). Riesgo de seguridad.

**La decisión:** backend Node con Service Account JSON (que queda en el server) + frontend que solo habla con el backend vía HTTP. Las credenciales nunca salen del servidor.

**Bonus:** el backend hace cache (30s TTL) que evita pegarle a Google 1000 veces si hay muchos usuarios.

---

## Decisión 6 — n8n en vez de código custom

**Alternativa:** escribir todo en Python/Node desde cero.

**Por qué n8n:**
- 80% del laburo es "cuando entra esto, hacé aquello, después lo otro" — n8n es exactamente esa abstracción.
- Visualmente claro. Cualquier dev junior puede entender un workflow mirando los nodos. Código no es así.
- Integraciones (OpenAI, Twilio, Google Sheets, WhatsApp) ya vienen como nodos. No reescribimos auth ni manejo de errores.
- Re-deployable: exportás un workflow como JSON y lo importás en otra instancia.

**Trade-offs:**
- Para lógica compleja (parsing custom, scraping con cheerio), usamos Code nodes embebidos. n8n los soporta nativo.
- n8n no es ideal para algoritmos pesados (ML, geoespacial, etc.). Para esos casos haríamos un microservicio aparte y n8n lo llamaría vía HTTP.

---

## Costos mensuales del sistema (estimados al volumen del piloto)

| Servicio | Costo | Notas |
|---|---|---|
| OpenAI (gpt-4o + gpt-4o-mini + Whisper + Vision) | USD 10-25 | Depende del volumen de conversaciones. Cada 1000 conversaciones ≈ USD 5-10. |
| Twilio Sandbox | USD 0 | Gratis hasta que pasen a número propio. |
| Twilio Producción (cuando se migre) | USD ~15 + USD ~0.005/msg saliente | Plan + uso. |
| Google Sheets | USD 0 | Gratis dentro de cuotas. |
| Google Drive (backups mensuales) | USD 0 | Dentro de los 15GB gratis por mucho tiempo. |
| ngrok | USD 0 (gratis con URL variable) o USD 8 (URL fija) | Mientras n8n corra en localhost. |
| Hosting n8n (futuro) | USD 7-20 | Render Hobby + DB managed. Reemplaza ngrok+localhost cuando migremos. |
| Dashboard hosting (futuro) | USD 0 | Vercel free tier para frontend, Render free tier para backend. |

**Total operativo piloto:** USD 10-30/mes.  
**Total operativo producción full (post-fase 2):** USD 50-80/mes.

---

## Roadmap fase 2 (post-firma)

Cosas que NO van al lunes pero están planificadas:

1. **WhatsApp Business pago.** Reemplazar Twilio Sandbox por número real. Setup: 1 día (incluye aprobación de Meta).
2. **Migrar n8n a Render.** Sale de la PC de Juani, pasa a server 24/7. Setup: 0.5 día. Playbook en `00_SISTEMA_INTERNO/n8n-infra/MIGRACION_LOCAL_A_RENDER.md`.
3. **Dashboard hosteado.** Frontend en Vercel + backend en Render. Setup: 0.5 día.
4. **Catálogo via API limpia.** Cuando se rehaga la web, reemplazar scraper por endpoint JSON oficial.
5. **Capacitación al equipo Bochile.** Sesión de 1h por Zoom mostrando dashboard + Sheet + cómo pausar bot.
6. **Métricas exportables.** Botón "Export CSV" en cada tabla del dashboard.
7. **Notificaciones en vivo.** WebSocket o SSE para que el dashboard refresque sin que tengas que hacer F5.
8. **Filtros server-side.** Hoy el dashboard trae todo el Sheet y filtra en el cliente. Con escala (>10.000 leads) hay que filtrar en el backend.

---

## Cómo agregar features sin romper nada

**Sumar un sub-agente nuevo (ej. Tasador):**
1. En el W1, agregar nodo `agentTool` con su prompt + LLM + tools.
2. Conectarlo al CORE como `ai_tool`.
3. Mencionarlo en el prompt del CORE diciendo cuándo llamarlo.

**Agregar una pestaña nueva al Sheet:**
1. Crear la pestaña con headers en fila 1.
2. Agregar el tipo en `backend/src/types/domain.ts`.
3. Agregar route en `backend/src/routes/<entidad>.ts` (copy/paste de otra).
4. Frontend: hook `useEntidad.ts` + page `EntidadPage.tsx` (copy/paste).
5. Mismo `domain.ts` en frontend.

**Agregar un cron nuevo:**
1. Workflow nuevo en n8n con trigger Schedule.
2. Lógica del cron.
3. Si toca el Sheet, usar los nodos googleSheets / googleSheetsTool.
4. Importante: setear `onError: 'continueRegularOutput'` + `retryOnFail` en los nodos que tocan APIs externas (Sheets, OpenAI, Twilio).

**Cambiar un modelo OpenAI:**
1. Abrir el W1.
2. Editar el nodo "GPT Vendedor CORE" / "GPT Calificador" / etc.
3. Cambiar el campo `model` (lista desplegable).
4. Save. Sin restart.

---

## Decisiones que dejamos fuera (por scope, no por mérito)

- **Instagram DMs**: armar W7 análogo al W1 con webhook de Instagram Graph API. Reusable: los mismos 3 sub-agentes funcionan, solo cambia el parser de entrada y el sender de salida.
- **Reconocimiento de propiedades en imágenes**: si un cliente manda foto de fachada, GPT-4o Vision podría compararla con `bochile_propiedades` y decir "esa es Brown 1842, te paso el tour". Hoy describe la foto en texto y listo.
- **TTS para responder con audio**: ElevenLabs API. Útil si Bochile descubre que sus clientes prefieren audios. ~USD 0.01 por mensaje de 30 segundos.
- **Auth en el dashboard**: hoy es público en localhost. Para hostearlo necesita JWT o Clerk.
- **Búsqueda full-text en conversaciones**: hoy filtra por substring en el cliente. Para volumen grande, conviene Postgres + tsvector o Algolia.

---

## Mantra arquitectónico

> "El Sheet es la verdad. n8n es la fábrica. El Dashboard es la pantalla. Twilio es el cartero."

Si entendés eso, podés debuggear cualquier problema preguntando "¿en qué capa está fallando?".
