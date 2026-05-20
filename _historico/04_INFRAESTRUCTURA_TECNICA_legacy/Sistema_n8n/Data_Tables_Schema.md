# Data Tables · Esquema completo

Las 8 tablas que viven dentro de n8n y forman la memoria del sistema. Cada workflow lee y escribe acá. El sync W5 las espeja a Google Sheets cada 5 min.

---

## 1. `bochile_leads` — el CRM

**ID:** `xElrL4mctuof84We`
**Quién escribe:** W1 (upsert por cada mensaje entrante + update vía sub-agente Admin) · W3 (update etapa al avisar match retroactivo)
**Quién lee:** Sub-agente Admin · W5 sync · Dashboard

| Columna | Tipo | Descripción | Valores |
|---|---|---|---|
| `lead_id` | string | PK · formato `L-<últimos 10 dígitos del tel>` | `L-2914423398` |
| `nombre` | string | Nombre y apellido (lo que el lead diga) | "Lucas Fernández" |
| `telefono` | string | Con código país y `+` | `+5492914423398` |
| `email` | string | Si lo da, sino vacío | |
| `canal` | string | Por dónde entró | `whatsapp` · `web` · `zonaprop` · `meta_ads` · `referido` |
| `operacion` | string | Lo que busca | `venta` · `alquiler` · `alquiler_temporario` |
| `tipo_propiedad` | string | | `casa` · `departamento` · `ph` · `lote` · `local` · `oficina` |
| `zona_pref` | string | Zona deseada (una sola, la principal) | `Palihue` · `Centro` · etc |
| `ambientes` | number | Cantidad deseada | |
| `presupuesto_min` | number | | |
| `presupuesto_max` | number | | |
| `moneda` | string | | `USD` · `ARS` |
| `forma_pago` | string | | `cash` · `credito` · `mixto` · `vende_otra` |
| `urgencia` | string | | `alta` · `media` · `baja` |
| `score` | number | Score del Calificador (0-100) | |
| `etapa` | string | Etapa Kanban del CRM | `Nuevo` · `Calificado IA` · `Visita agendada` · `Negociación` · `Cierre` · `Post-venta` · `En espera de stock` · `Descartado` |
| `vendedor_asignado` | string | `empleado_id` del vendedor responsable | `E-1` |
| `ultima_intencion` | string | Resumen de lo último que dijo/pidió | |
| `notas` | string | Notas libres (la IA las llena con observaciones útiles) | |
| `creado_en` | date | Timestamp ISO | |
| `actualizado_en` | date | Timestamp ISO de la última actualización | |

---

## 2. `bochile_propiedades` — el catálogo

**ID:** `CjCGRQC1lEcHnTgW`
**Quién escribe:** Carga inicial (CSV bulk) + altas manuales del vendedor + API ZonaProp si se integra
**Quién lee:** Sub-agente Matcher · W3 cron · W5 sync · Website público · App dashboard

| Columna | Tipo | Descripción | Valores |
|---|---|---|---|
| `prop_id` | string | PK · `P-<número>` | `P-100` |
| `titulo` | string | Título corto comercial | "Casa 4 amb con quincho · Palihue" |
| `operacion` | string | | `venta` · `alquiler` · `alquiler_temporario` |
| `tipo` | string | | `casa` · `departamento` · `ph` · `lote` · `local` · `oficina` |
| `direccion` | string | Dirección completa | "Brown 1842" |
| `zona` | string | Barrio | "Palihue" |
| `ambientes` | number | | |
| `banos` | number | | |
| `superficie_cubierta` | number | m² cubiertos | |
| `superficie_total` | number | m² totales (incluye lote) | |
| `precio` | number | Precio actual | |
| `moneda` | string | | `USD` · `ARS` |
| `expensas` | number | $ ARS por mes (0 si no tiene) | |
| `estado` | string | Estado en el funnel de propiedades | `nueva` · `publicada` · `ofrecida` · `reservada` · `vendida` · `pausada` |
| `caracteristicas` | string | Lista separada por coma (lowercase) para matching | "pileta,quincho,jardin,cochera,suite" |
| `tour_360_url` | string | URL del tour 360 (Matterport, Kuula, etc.) | |
| `foto_principal` | string | URL de la foto destacada | |
| `propietario` | string | Nombre del dueño | |
| `propietario_telefono` | string | | |
| `vendedor_a_cargo` | string | `empleado_id` del que la captó | |
| `publicada` | boolean | Si está activa en la web | `true`/`false` |
| `fecha_alta` | date | | |

> **Importante:** `estado = nueva` dispara el cron W3 (match retroactivo). Cuando se ofrece a un lead, pasa a `ofrecida`. Cuando se firma reserva, a `reservada`. Cuando escritura, a `vendida`.

---

## 3. `bochile_visitas` — la agenda

**ID:** `c2WJgyO4zdb5GKCj`
**Quién escribe:** Sub-agente Admin (al agendar) · W2 cron (marca recordatorio enviado) · Vendedor (al confirmar resultado, opcional manual)
**Quién lee:** W2 cron · W5 sync · Dashboard hoja AGENDA_VISITAS_HOY

| Columna | Tipo | Descripción |
|---|---|---|
| `visita_id` | string | PK · `V-<timestamp>` |
| `lead_id` | string | FK a leads |
| `prop_id` | string | FK a propiedades |
| `vendedor_id` | string | FK a empleados |
| `vendedor_nombre` | string | Denormalizado para el dashboard |
| `cliente_nombre` | string | Denormalizado |
| `direccion` | string | Denormalizada |
| `fecha` | date | `YYYY-MM-DD` |
| `hora` | string | `HH:MM` (24h) |
| `estado` | string | `agendada` · `confirmada` · `realizada` · `cancelada` · `no_show` |
| `confirmada_cliente` | boolean | El cliente confirmó por WhatsApp |
| `notificada_vendedor` | boolean | El vendedor recibió el mensaje "VISITA AGENDADA…" |
| `recordatorio_enviado` | boolean | Recordatorio 24h enviado |
| `resultado` | string | Después de la visita: `interesado` · `negociando` · `descartó` · `pidio_otra` |
| `observaciones` | string | Notas del vendedor |
| `creada_en` | date | |

---

## 4. `bochile_conversaciones` — el log

**ID:** `o1YlacRRq4UHLloF`
**Quién escribe:** W1 (mensaje in y out, ambos)
**Quién lee:** Memoria del Vendedor CORE (vía Memory Buffer Window) · W5 sync (top 2000)

| Columna | Tipo | Descripción |
|---|---|---|
| `msg_id` | string | PK · `M-<timestamp>` |
| `lead_id` | string | FK a leads |
| `telefono` | string | |
| `canal` | string | `whatsapp` · `web` · `zonaprop` |
| `direccion` | string | `in` (cliente → IA) o `out` (IA → cliente) |
| `mensaje` | string | El texto completo |
| `intencion_detectada` | string | El CORE puede etiquetarlo: `consulta` · `agendar` · `cobranza` · `reclamo` · `saludo` |
| `agente_que_respondio` | string | `Vendedor CORE` · `SubAgente Admin` · `Humano` |
| `requiere_humano` | boolean | Si la IA escaló |
| `timestamp` | date | ISO |

---

## 5. `bochile_empleados` — el staff

**ID:** `uyFS9uEbdCQQXiJn`
**Quién escribe:** Carga inicial + ABM manual
**Quién lee:** Sub-agente Admin (para elegir vendedor por zona) · W2 cron (datos para notificar) · W5 sync · Dashboard hoja RANKING_VENDEDORES

| Columna | Tipo | Descripción | Valores |
|---|---|---|---|
| `empleado_id` | string | PK | `E-1` |
| `nombre` | string | | "Carlos Bochile" |
| `rol` | string | | `vendedor` · `corredor` · `admin` · `dueno` |
| `telefono` | string | Sin `+`, con código país | `5492914401120` |
| `email` | string | | |
| `zona_especialidad` | string | Lista separada por coma | `Palihue,Villa Belgrano` |
| `calendar_id` | string | Google Calendar ID (si se integra) | |
| `activo` | boolean | | |
| `visitas_mes` | number | Contador del mes actual | |
| `cierres_mes` | number | | |
| `comisiones_mes` | number | $ ARS o USD según convención | |

> **Carga inicial mínima:** los 3 vendedores Bochile (Carlos, Julieta, Valentín) + 1 admin.

---

## 6. `bochile_contratos` — alquileres

**ID:** `k3CNXwMircXckck0`
**Quién escribe:** Carga inicial + W4 cron (update dias_atraso y estado)
**Quién lee:** W4 cron · W5 sync · Dashboard hoja ALQUILERES_ESTADO

| Columna | Tipo | Descripción |
|---|---|---|
| `contrato_id` | string | PK · `C-<n>` |
| `prop_id` | string | FK a propiedades |
| `direccion` | string | Denormalizada |
| `inquilino_nombre` | string | |
| `inquilino_telefono` | string | Con código país y `+` |
| `propietario` | string | |
| `monto_actual` | number | Alquiler actual (post-ajustes) |
| `moneda` | string | `ARS` · `USD` |
| `dia_vencimiento` | number | Día del mes (1-28) |
| `frecuencia_ajuste` | string | `trimestral` · `cuatrimestral` · `semestral` · `anual` |
| `indice_ajuste` | string | `IPC` · `ICL` · `fijo_porcentaje` |
| `fecha_inicio` | date | |
| `fecha_fin` | date | Vencimiento del contrato |
| `estado` | string | `activo` · `moroso` · `por_vencer` · `vencido` · `rescindido` |
| `ultimo_pago` | date | |
| `dias_atraso` | number | 0 si está al día |

---

## 7. `bochile_matches_pendientes` — la lista de espera

**ID:** `T8b4ZTN8469TcrPR`
**Quién escribe:** Sub-agente Admin (cuando un lead pide algo sin stock)
**Quién lee:** W3 cron (cruza con propiedades nuevas) · W5 sync

| Columna | Tipo | Descripción |
|---|---|---|
| `match_id` | string | PK · `MP-<timestamp>` |
| `lead_id` | string | FK a leads |
| `lead_nombre` | string | Denormalizado |
| `lead_telefono` | string | Con `+` |
| `operacion` | string | `venta` · `alquiler` |
| `tipo` | string | `casa` · `departamento` · `ph` · `lote` |
| `zona` | string | Zona deseada |
| `ambientes_min` | number | |
| `presupuesto_min` | number | |
| `presupuesto_max` | number | |
| `moneda` | string | |
| `caracteristicas_must` | string | Lista separada por coma de cosas obligatorias (`pileta,cochera`) |
| `activo` | boolean | Cuando se notifica al lead, se pasa a `false` |
| `creado_en` | date | |

---

## 8. `bochile_acciones_ia` — el feed de actividad

**ID:** `SYVdPtTV2zHwiDX0`
**Quién escribe:** Los 5 workflows (cada uno inserta lo que hizo)
**Quién lee:** W5 sync (top 2000) · Dashboard hoja FEED_IA · Cálculo de "horas ahorradas"

| Columna | Tipo | Descripción |
|---|---|---|
| `accion_id` | string | PK · `A-<timestamp>` |
| `tipo` | string | `conversacion_atendida` · `lead_calificado` · `visita_agendada` · `recordatorio_visita` · `match_retroactivo` · `cobranza_alquiler` · `reclamo_resuelto` · `match_pendiente_guardado` |
| `agente` | string | `Vendedor CORE` · `SubAgente Admin` · `Cron Recordatorios` · `Cron Matcher` · `Cron Cobranza` |
| `lead_id` | string | FK opcional |
| `resumen` | string | 1 línea de qué pasó |
| `detalle` | string | Hasta 400 caracteres |
| `resultado` | string | `ok` · `enviado` · `escalado` · `error` |
| `tiempo_ahorrado_min` | number | Estimación humana (suma → dashboard) |
| `timestamp` | date | ISO |

---

## Relaciones (ER conceptual)

```
leads ──┬─< conversaciones (1:N)
        ├─< visitas (1:N) >── propiedades (1:N) ── empleados (vendedor_a_cargo)
        ├─< matches_pendientes (1:N)
        └─< acciones_ia (1:N)

contratos >── propiedades (N:1)

empleados ──< visitas (1:N)
```

No hay foreign keys reales (n8n Data Table no las soporta), pero los IDs respetan estas relaciones.

---

*Editar este archivo cada vez que se agregue una columna nueva. Los CSV templates (`Excel_Maestro/templates_csv/`) deben mantenerse en sintonía.*
