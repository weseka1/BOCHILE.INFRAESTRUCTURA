# OPERAR.md — Uso diario de Bochile (para Yamil)

> Cómo usar el sistema sin tocar código. Manual operativo.

---

## ¿Qué es Bochile en 30 segundos?

Una **vendedora digital** que se llama Cami. Atiende WhatsApp 24/7. Responde, califica leads, agenda visitas con vos (o con quien sea vendedor real), y avisa cuando una conversación requiere mano humana.

Detrás hay 3 lugares donde mirar:

1. **WhatsApp** → donde el cliente habla con Cami
2. **Google Sheet** (la base de datos) → cada lead, conversación, visita queda guardado
3. **Dashboard web** → vista bonita y rápida de TODO lo que está pasando

---

## URLs importantes

| Qué | URL |
|---|---|
| Dashboard | `https://bochile-dashboard-ui.onrender.com` |
| n8n (cerebro) | `https://bochile-n8n.onrender.com` (login admin) |
| Google Sheet | https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4 |
| respond.io | `https://app.respond.io` |

---

## Tareas diarias frecuentes

### 1. Ver los leads que entraron hoy

Dashboard → pestaña **Leads**. Ordenados por más recientes arriba.

### 2. Ver toda la conversación con un cliente

Dashboard → pestaña **Conversaciones** → buscar el teléfono o nombre.

### 3. Ver visitas agendadas próximos 7 días

Dashboard → pestaña **Visitas**. Filtrar por estado "agendada".

### 4. Marcar una propiedad como vendida / pausada

Ir directo al Sheet → pestaña `propiedades` → buscar fila → editar columna `estado` a `vendida` o `pausada`.

> El scraper diario actualiza automáticamente este campo si la propiedad desaparece de bochile.com, pero podés forzarlo manual.

### 5. Pausar a Cami para que NO responda a un cliente

Sheet → pestaña `leads` → buscar la fila por `telefono` o `lead_id` → columna `bot_pausado_hasta` → escribir una fecha futura en formato ISO (ej. `2026-12-31T23:59:00`).

> Cami no le va a responder hasta que esa fecha se pase. Cuando vos respondés al cliente desde respond.io (humano), Cami se pausa automáticamente por 24h.

### 6. Reactivar a Cami antes de tiempo

Sheet → `leads` → fila → columna `bot_pausado_hasta` → borrar el valor (dejar vacío). Cami vuelve al toque.

### 7. Marcar una conversación como cerrada (cliente no compró)

Sheet → `leads` → fila → columna `conversacion_cerrada` → poner `true`. La columna `etapa` ponerle `cerrada_por_cliente` o `descartado`.

---

## Quién es quién

### Vendedores (Sheet pestaña `empleados`)

Los datos de cada vendedor que el sistema usa para asignar visitas:

| Columna | Qué significa | Ejemplo |
|---|---|---|
| `empleado_id` | ID único | `E-1` |
| `nombre` | Nombre del vendedor | `Camila Pomerich` |
| `telefono` | WhatsApp para recibir avisos | `5492914413200` |
| `zona_especialidad` | Zonas donde labura | `Centro, Universitario` |
| `activo` | `true` / `false` | `true` |
| `horario_inicio` | HH:MM | `09:00` |
| `horario_fin` | HH:MM | `19:00` |
| `dias_laborales` | Días que trabaja | `L,M,X,J,V,S` |
| `vacacion_desde` | Inicio de vacas (YYYY-MM-DD) | `2026-07-15` |
| `vacacion_hasta` | Fin de vacas | `2026-07-29` |
| `max_visitas_dia` | Capacidad diaria | `4` |

**Para dar de baja a un vendedor**: marcar `activo` = `false`. Cami deja de asignarle visitas.

**Para vacaciones**: rellenar `vacacion_desde` y `vacacion_hasta`. Cami no le va a agendar nada en ese rango.

---

## Cuando algo se rompe

Ver [`docs/04_QUE_PASA_SI.md`](docs/04_QUE_PASA_SI.md) — FAQ completo de troubleshooting.

Resumen rápido:

| Síntoma | Primera acción |
|---|---|
| Cami no responde | Ver `bochile-n8n.onrender.com` → últimas ejecuciones del W1 |
| Dashboard no carga | Ver `bochile-dashboard-api.onrender.com/api/health` |
| Cami inventa cosas | Limpiar conversación: Sheet → `leads` → `conversacion_cerrada=true` para empezar de cero |
| Visita duplicada | Sheet → `visitas` → borrar la duplicada manual |
| Lead repetido | Sheet → `leads` → buscar por teléfono → eliminar duplicado, dejar el más antiguo |

---

## Conceptos clave

- **Cami nunca inventa propiedades**. Si menciona una propiedad concreta, es porque está en el catálogo (Sheet `propiedades`). Si vos no ves una propiedad, Cami tampoco la va a recomendar.

- **Cami pausa el bot solo si vos respondés**. Cuando vos contestás al cliente desde respond.io, Cami se calla 24h. Después vuelve sola (al día siguiente). Esto evita que Cami "interrumpa" cuando vos ya estás manejando el caso.

- **Cami detecta cierre de conversación**. Si el cliente dice "ok gracias chau", "después te aviso", "no me interesa", Cami se despide y deja de mandar mensajes. Si después el cliente vuelve a saludar ("hola"), Cami se reactiva.

- **Cami sabe que día es hoy, qué feriados vienen, qué vendedores están de vacaciones, y qué slots están ocupados**. Antes de proponer un horario para visita, ve toda la agenda real.

---

## Cuando agregás propiedades nuevas

Hay 2 caminos:

**Camino A — automático (el normal)**:
El scraper diario (corre 6am) lee bochile.com.ar/propiedades y mete las nuevas en el Sheet `propiedades` automáticamente.

**Camino B — manual** (si el scraper falla o querés cargar una propiedad que no está en bochile.com.ar):

1. Sheet → pestaña `propiedades` → agregar fila
2. Completar al menos: `prop_id` (único), `title`, `operation` (sale/rent), `property_type` (casa/departamento/etc), `price`, `price_currency` (USD/ARS), `zona`, `barrio`, `address`, `bedrooms`, `area_m2`, `url`
3. Para que Cami la "vea" en sus búsquedas, hay que correr un re-embed:
   - Ir al RAG en Render → Shell → `npm run embed`
4. Listo. En 5 min Cami ya la recomienda.

---

## Backup y respaldo

- Todo el código está en GitHub (`weseka1/BOCHILE.INFRAESTRUCTURA`). Si Render se cae, podés re-deployar en otro lado.
- El Sheet es la verdad. Si Cami se rompe pero el Sheet está OK, perdiste conversaciones nuevas pero NO data histórica.
- El workflow del n8n se respalda manualmente con `node scripts/01_backup_workflow.cjs` (corre cuando quieras).

---

## Mejoras que quedaron para "Fase 2"

(post-MVP, opcionales)

- Validación HMAC de webhook respond.io en modo ENFORCE (hoy solo loggea WARN).
- Integración con Google Calendar de cada vendedor (sync bidireccional).
- Notificación al admin si Cami devuelve error o entra en bucle.
- Rate limit por contacto (si alguien manda 30 mensajes en 5 min, pausa).
- Re-rank LLM del top-3 visual (mejora 15% accuracy en reconocimiento de imágenes).

---

## Contacto

Si algo se rompe y no podés resolverlo solo: WhatsApp Juani.
