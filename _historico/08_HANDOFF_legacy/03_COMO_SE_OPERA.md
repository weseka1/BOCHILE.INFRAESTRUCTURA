# 03 · Cómo se opera

Este manual es el "día a día" del sistema. Cosas que vas a hacer cuando ya está prendido y querés trabajar con él.

No hace falta saber programar. Casi todo se hace desde 2 lugares:
- **El Dashboard** (http://localhost:5176) — ver datos, métricas, agenda.
- **El Google Sheet** (https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4/edit) — editar datos a mano cuando hace falta.

Como regla: si es para LEER → Dashboard. Si es para ESCRIBIR → Sheet.

---

## Ver los leads que entraron hoy

Dashboard → pestaña **Leads**.

Filtrá visualmente por `creado_en` o por `etapa`. Los leads nuevos aparecen al inicio.

Si querés profundizar en un lead específico, anotá su `lead_id` o teléfono y andá a "Buscar conversación" abajo.

**Qué significa cada columna:**
- `score`: 0-100, qué tan caliente está el lead. Lo calcula el sub-agente Calificador.
- `etapa`: `Nuevo`, `Calificado IA`, `Visita agendada`, `En espera de stock`, `Cerrado`, `Perdido`.
- `vendedor_asignado`: hoy todos van a Camila Pomerich. Cuando se sumen más vendedores se distribuye automáticamente.

---

## Buscar una conversación

Dashboard → pestaña **Conversaciones**.

En el buscador podés tipear:
- Un número de teléfono (con o sin `+` y código país)
- Un `lead_id` (formato `L-XXXXXXXXXX`)
- Una palabra del mensaje ("palihue", "300k", "alquiler")

Los mensajes aparecen tipo chat: los entrantes (`in`) en gris, los salientes (`out`) en verde. Cada uno tiene timestamp.

Esto sirve para auditar QA: "¿qué le contestó la IA a este cliente?", o para retomar contexto si el lead llamó por otro canal.

---

## Ver la agenda de visitas

Dashboard → pestaña **Visitas**.

Vas a ver todas las visitas con: cliente, propiedad, fecha, hora, estado (`agendada`, `realizada`, `cancelada`).

Las visitas se agendan automáticamente cuando un lead acepta la propuesta de la IA. Pero si hace falta meter una manual:
1. Abrí el Sheet → pestaña `visitas`.
2. Agregá una fila al final con todos los campos (lead_id, prop_id, vendedor_id, fecha, hora, estado=`agendada`, etc.).
3. El cron W2 va a mandar los recordatorios automáticamente.

---

## Alta de una propiedad nueva

**Opción A — Subirla a la web de Bochile.** El scraper W6 se ejecuta cada 2 horas y la importa al Sheet. Camila la va a empezar a ofrecer en menos de 2h.

**Opción B — Cargarla directo al Sheet (más rápido).** Abrí el Sheet → pestaña `propiedades` → agregá una fila con:

| Campo | Ejemplo |
|---|---|
| `prop_id` | `P-001` (ID único, no repetir) |
| `titulo` | `Casa 4 amb Palihue con quincho` |
| `operacion` | `venta` o `alquiler` o `alquiler_temporario` |
| `tipo` | `casa`, `departamento`, `ph`, `lote`, `local`, `oficina` |
| `direccion` | `Av. Alem 1234, Palihue` |
| `zona` | `Palihue`, `Centro`, `Universitario`, etc. |
| `ambientes` | `4` |
| `banos` | `2` |
| `superficie_cubierta` | `180` |
| `superficie_total` | `350` |
| `precio` | `280000` |
| `moneda` | `USD` o `ARS` |
| `expensas` | `0` (en USD, si aplica) |
| `estado` | `nueva` (para que W3 la matchee) |
| `caracteristicas` | `quincho, parrilla, cochera` |
| `tour_360_url` | `https://...` (opcional) |
| `foto_principal` | URL de la foto |
| `propietario` | nombre |
| `propietario_telefono` | con código país, sin + |
| `vendedor_a_cargo` | empleado_id, ej. `E-1B` |
| `publicada` | `TRUE` (Camila solo ofrece las publicadas) |
| `fecha_alta` | hoy en formato `2026-05-15` |

---

## Marcar un pago de alquiler recibido

Cuando un inquilino paga el alquiler:

1. Abrí el Sheet → pestaña `contratos`.
2. Encontrá la fila del inquilino (buscá por `inquilino_nombre` o `direccion`).
3. Actualizá:
   - `ultimo_pago`: fecha de hoy (formato `2026-05-15`)
   - `dias_atraso`: `0`
   - `estado`: `al_dia`

El cron W4 (Cobranza) chequea esto todos los días a las 9am y para de mandarle recordatorios automáticamente.

---

## Pausar al bot

Si querés que Camila no responda por un rato (por ejemplo, atender vos a un cliente manualmente, o porque están haciendo mantenimiento del sitio):

1. Abrí http://localhost:5680
2. Andá al workflow **W1 — Chatbot Multi-Agente CORE**
3. Apagá el toggle "Active" (queda gris).

Mientras esté apagado, los mensajes entran a Twilio pero no se procesan. Twilio los guarda 1 día. Cuando reactives el toggle, los pendientes se procesan en cola.

**Importante:** si vas a dejarlo pausado más de unas horas, avisale a Camila humana (la vendedora real) para que atienda directo desde su WhatsApp.

---

## Ver qué hizo la IA en las últimas 24 horas

Dashboard → pestaña **Acciones IA**.

Cada acción tiene:
- `tipo`: `conversacion_atendida`, `visita_agendada`, `match_pendiente_creado`, `lead_actualizado`, etc.
- `agente`: cuál de los 4 cerebros la ejecutó.
- `resumen` y `detalle`: qué hizo.
- `tiempo_ahorrado_min`: estimación de minutos de trabajo humano que se evitaron.

Sumar esos minutos te da el "tiempo total ahorrado por la IA" — KPI clave para mostrarle al cliente cuánto vale el sistema.

---

## Métricas y reportes

Dashboard → pestaña **Dashboard** (la principal).

KPIs visibles:
- Leads total / leads de hoy / leads calificados (score ≥ 70)
- Visitas agendadas
- Propiedades activas
- Matches pendientes (gente esperando que aparezca lo que busca)
- Acciones IA en los últimos 7 días
- Tiempo total ahorrado

Charts:
- Leads por etapa del pipeline (barra)
- Leads por zona (barra) — útil para saber qué barrio demanda más
- Mensajes por día (últimos 14 días, línea)
- Acciones por agente (barra) — qué sub-agente trabajó más

Si querés exportar esto a Excel para presentarlo: por ahora copy/paste manual. Hay un item en el roadmap para botón "Export CSV" en cada tabla.

---

## Cuando entra un lead que NO querés que atienda la IA

Por ejemplo: alguien conocido del cliente, alguien que ya está negociando con un vendedor humano, etc.

1. Abrí el Sheet → pestaña `leads`.
2. Encontrá el lead.
3. En la columna `notas` agregá `NO_AUTO` (o el texto que quieras).
4. En la columna `etapa` poné `requiere_humano` o `bloqueado`.

> **TODO técnico**: Camila no respeta hoy un campo "bloqueado". Hay que modificar el W1 para que filtre leads con `notas` que contengan `NO_AUTO`. Este check está en el roadmap post-firma.

Como workaround inmediato: si querés bloquear a UN cliente, pausá el bot mientras dure la negociación, o desviá el WhatsApp a Camila humana manualmente.

---

## Backup mensual

No tenés que hacer nada. El cron W5 corre solo el primer día de cada mes a las 3am:
1. Hace una copia del Sheet en Drive (carpeta `Backups Bochile Mensuales`) con nombre `Bochile YYYY-MM`.
2. Resetea las pestañas transaccionales (`leads`, `visitas`, `conversaciones`, `matches_pendientes`, `acciones_ia`) para que el mes nuevo empiece limpio.
3. Las pestañas maestras (`propiedades`, `contratos`, `empleados`) NO se tocan.

Si querés ver los backups, abrí Drive y buscá la carpeta `Backups Bochile Mensuales`.

---

## Si pasa algo raro

`04_QUE_PASA_SI.md` tiene la lista de problemas comunes y cómo resolverlos.
