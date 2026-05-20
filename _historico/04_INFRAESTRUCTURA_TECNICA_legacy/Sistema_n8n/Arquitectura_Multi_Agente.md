# Arquitectura Multi-Agente · Vendedor CORE + 3 Sub-cerebros

El cliente pidió **multicerebros para que el chatbot no se sature**. Esta es la arquitectura.

---

## Por qué multi-agente

Un único LLM tratando de ser vendedor + calificador + buscador + agendador acaba mediocre en todo. Además, en conversaciones largas, el contexto crece y el modelo "olvida" o se confunde.

La solución: **un agente conversacional ("CORE") que coordina y habla**, y **sub-agentes especializados** que hacen UNA cosa muy bien cada uno. El CORE delega via tool calls.

Cada sub-agente:
- Tiene su **propio modelo** (puedo usar `gpt-5-mini` económico)
- Tiene su **propio system prompt** que solo describe SU tarea
- **NO comparte memoria conversacional** con los demás
- Devuelve datos estructurados al CORE
- Es invisible para el cliente final

---

## Los 4 cerebros

### 🎯 Vendedor CORE — "Camila"

| Atributo | Valor |
|---|---|
| Modelo | `gpt-5` |
| Temperatura | 0.4 (cálida, conversacional, no robótica) |
| Memoria | Sí, `memoryBufferWindow` con `sessionKey = telefono` (últimos 20 turnos) |
| Voz | Argentina, vos, una pregunta clara por mensaje, máximo 4 líneas |
| Rol | **Única voz que habla con el cliente.** Decide qué sub-agente llamar, orquesta y sintetiza la respuesta. |

**System prompt resumido:**

> Sos Camila de Inmobiliaria Bochile. Tu objetivo: **organizar, filtrar, captar y vender**. No respondes en piloto automático: calificás primero, matchéas después, agendás al final. Tu equipo: Calificador, Matcher y Administrativo (los llamás internamente). Reglas de oro: nunca inventes datos de propiedades · nunca agendes sin pasar por el Admin · si no sabés algo, escalá a humano · respuestas cortas, una pregunta a la vez.

**Flujo estándar que ejecuta:**

1. Saluda y hace 1-2 preguntas para entender (uso/inversión, presupuesto, zona).
2. Cuando tiene contexto básico, llama al Calificador.
3. Si score ≥ 70 + criterios completos, llama al Matcher.
4. Si hay propiedades, muestra 1-2 con tour 360 y propone agendar.
5. Si NO hay propiedades, llama al Admin para guardar `match_pendiente`.
6. Cuando el cliente acepta visita, llama al Admin para agendar + notificar vendedor.
7. Si el lead está tibio (40-70), sigue conversando para subir score.
8. Si está frío (<40), corta cortés.

---

### 🔍 Sub-agente Calificador

| Atributo | Valor |
|---|---|
| Modelo | `gpt-5-mini` |
| Temperatura | 0.1 (determinístico, debe puntuar igual ante el mismo input) |
| Memoria | No |
| Output Parser | **Sí, structured JSON** (forzado por schema) |
| Rol | Lee la conversación, devuelve un JSON con score 0-100 y los datos extraídos. |

**Schema de salida:**

```json
{
  "score": 85,
  "etapa": "Calificado IA",
  "operacion": "venta",
  "tipo": "casa",
  "zona": "Palihue",
  "ambientes": 4,
  "presupuesto_min": 250000,
  "presupuesto_max": 300000,
  "moneda": "USD",
  "forma_pago": "cash+credito",
  "urgencia": "alta",
  "razon": "Pareja con 2 hijos, presupuesto match...",
  "listo_para_visita": true
}
```

**Reglas de scoring:**

- 0-40 → curioso, no califica
- 41-70 → tibio
- 71-100 → caliente, listo para visita

**Sube score:** menciona presupuesto concreto, urgencia, forma de pago, datos familiares, vende otra propiedad, viene referido.
**Baja score:** preguntas genéricas sin datos, no responde al filtrado, está "solo mirando".

---

### 🏠 Sub-agente Matcher

| Atributo | Valor |
|---|---|
| Modelo | `gpt-5-mini` |
| Temperatura | 0.2 |
| Memoria | No |
| Herramientas | `Leer Catálogo Propiedades` (Data Table get filtrado) |
| Rol | Lee el catálogo y devuelve hasta 3 propiedades que matchean los criterios del lead. |

**Recibe del CORE:**
```
criterios: { operacion, tipo, zona, ambientes_min, presupuesto_min, presupuesto_max, moneda, must_have }
```

**Devuelve al CORE:**

Texto plano con hasta 3 propiedades ordenadas:
```
1. P-100 · Casa 4 amb · Brown 1842 · USD 285.000 · https://bochile.com.ar/tour/P-100
   Match: zona exacta, 4 amb, pileta, dentro de presupuesto.

2. P-118 · Casa 3 amb · Donado 1245 · USD 268.000 · https://...
   Match: zona Palihue, 3 amb, sin pileta pero con jardín grande.
```

Si NO hay coincidencias devuelve:
```
SIN_STOCK: venta · casa · Palihue · 250-300k USD · pileta
```

Eso le indica al CORE que llame al Admin para guardar `match_pendiente`.

---

### 📋 Sub-agente Administrativo

| Atributo | Valor |
|---|---|
| Modelo | `gpt-5-mini` |
| Temperatura | 0.1 |
| Memoria | No |
| Herramientas | 5 tools: `Leer Vendedores Activos`, `Crear Visita en CRM`, `Guardar Match Pendiente`, `Actualizar Lead CRM`, `Avisar Vendedor por WhatsApp` |
| Rol | Ejecuta acciones concretas en el sistema. Es el único que **escribe** al CRM, agenda visitas y notifica vendedores. |

**Las 3 tareas que ejecuta:**

#### A) Agendar visita

1. `Leer Vendedores Activos` → elige el mejor por `zona_especialidad`.
2. `Crear Visita en CRM` → inserta en `bochile_visitas`.
3. `Avisar Vendedor por WhatsApp` → manda mensaje **con el formato exacto**:
   > `VISITA AGENDADA PARA LAS 10:30 CON LUCAS FERNÁNDEZ EN BROWN 1842, PALIHUE. Score del lead: 88. Presupuesto: USD 285.000. Zona: Palihue. Tour 360: https://… Notas: pareja con 2 hijos, vende dpto en Centro.`
4. `Actualizar Lead CRM` → mueve a etapa `Visita agendada`.

#### B) Guardar match pendiente

1. `Guardar Match Pendiente` → inserta en `bochile_matches_pendientes` con criterios.
2. `Actualizar Lead CRM` → etapa `En espera de stock`, `notas` con resumen.

#### C) Actualizar ficha lead

1. `Actualizar Lead CRM` → presupuesto, zona, tipo, urgencia, score, etapa, notas.

**Devuelve al CORE:** resumen plano (`visita_id`, vendedor, hora, dirección) para que el CORE arme la respuesta al cliente.

---

## Cómo se conectan en n8n (workflow W1)

```
Webhook /bochile-chat
       │
       ▼
Normalizar Mensaje (Set)
       │
       ▼
Upsert Lead CRM (DataTable)
       │
       ▼
Log Mensaje Entrante (DataTable)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Vendedor CORE (AI Agent)                                   │
│    ├── model:  GPT Vendedor CORE (gpt-5)                    │
│    ├── memory: Memoria Conversacion (telefono = sessionKey) │
│    └── tools:                                               │
│         ├── SubAgente Calificador (agentTool)               │
│         │     ├── model: GPT Calificador (gpt-5-mini)       │
│         │     └── outputParser: Parser Calificador          │
│         ├── SubAgente Matcher (agentTool)                   │
│         │     ├── model: GPT Matcher (gpt-5-mini)           │
│         │     └── tools: Leer Catalogo Propiedades          │
│         └── SubAgente Administrativo (agentTool)            │
│               ├── model: GPT Admin (gpt-5-mini)             │
│               └── tools:                                    │
│                    ├── Leer Vendedores Activos              │
│                    ├── Crear Visita en CRM                  │
│                    ├── Guardar Match Pendiente              │
│                    ├── Actualizar Lead CRM                  │
│                    └── Avisar Vendedor por WhatsApp         │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
Log Mensaje Saliente (DataTable)
       │
       ▼
Registrar Accion IA (DataTable)
       │
       ▼
Responder al Cliente (WhatsApp Send)
       │
       ▼
OK al Webhook (Respond)
```

24 nodos en total. Memoria por teléfono = cada lead tiene su propio hilo conversacional persistente.

---

## Por qué no se satura

- **El CORE no carga el catálogo completo en su contexto.** Solo le pide al Matcher cuando lo necesita.
- **El CORE no sabe los algoritmos de scoring.** Solo le pide al Calificador.
- **El CORE no escribe en el CRM.** Le dice al Admin "agendá visita con estos datos".
- Cada sub-agente recibe **solo lo mínimo** que necesita para su tarea y devuelve **solo lo justo**.
- Resultado: contexto del CORE = corto. Latencia baja. Costo por mensaje bajo (mini en sub-agentes).

---

## Cómo crece el sistema

Si mañana quieren agregar un nuevo cerebro especializado (por ejemplo un **Tasador** que pone precios a propiedades, o un **Negociador** que arma contraofertas), basta con:

1. Crear un nuevo nodo `agentTool` con su modelo y prompt.
2. Conectarlo al CORE como nuevo tool.
3. Actualizar el system prompt del CORE para que lo conozca.

Cero cambios al resto del sistema.

---

*Ver `Mensajes_Y_Prompts.md` para los system prompts completos de cada agente.*
