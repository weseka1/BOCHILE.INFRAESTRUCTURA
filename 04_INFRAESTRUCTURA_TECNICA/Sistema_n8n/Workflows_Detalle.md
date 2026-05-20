# Workflows n8n · Detalle por workflow

Los 5 workflows que componen el sistema, con sus nodos, frecuencia y qué hace cada uno.

---

## W1 · Bochile · Chatbot Multi-Agente (CORE)

- **ID:** `j0Mh8IkFfv4q5pB7`
- **URL:** https://weseka.app.n8n.cloud/workflow/j0Mh8IkFfv4q5pB7
- **Trigger:** Webhook `POST /bochile-chat`
- **Frecuencia:** bajo demanda (cada mensaje entrante)
- **Nodos:** 24

### Qué hace

Recibe mensajes de WhatsApp/Web/ZonaProp, los normaliza, escribe en CRM y log, y deja que el Vendedor CORE responda orquestando 3 sub-agentes.

### Cadena lineal de nodos

| # | Nodo | Tipo | Función |
|---|---|---|---|
| 1 | Webhook WhatsApp/Web | Trigger | POST con `{from, name, message, channel}` |
| 2 | Normalizar Mensaje | Set | Estructura el payload, genera `lead_id` y `msg_id` |
| 3 | Upsert Lead CRM | DataTable | Upsert en `bochile_leads` por `lead_id` |
| 4 | Log Mensaje Entrante | DataTable | Insert en `bochile_conversaciones` (`direccion=in`) |
| 5 | **Vendedor CORE** | **AI Agent** | Cerebro principal (ver subnodos abajo) |
| 6 | Log Mensaje Saliente | DataTable | Insert en `bochile_conversaciones` (`direccion=out`) |
| 7 | Registrar Accion IA | DataTable | Insert en `bochile_acciones_ia` |
| 8 | Responder al Cliente | WhatsApp Send | Manda la respuesta al cliente |
| 9 | OK al Webhook | Respond to Webhook | `{ok, lead_id, respuesta}` |

### Subnodos del Vendedor CORE

```
Vendedor CORE
├── GPT Vendedor CORE (lmChatOpenAi · gpt-5 · temp 0.4)
├── Memoria Conversacion (memoryBufferWindow · sessionKey = telefono · 20 turnos)
└── tools:
    ├── SubAgente Calificador (agentTool)
    │   ├── GPT Calificador (gpt-5-mini · temp 0.1)
    │   └── Parser Calificador (outputParserStructured · JSON schema)
    │
    ├── SubAgente Matcher (agentTool)
    │   ├── GPT Matcher (gpt-5-mini · temp 0.2)
    │   └── tools:
    │       └── Leer Catalogo Propiedades (dataTableTool · get filtrado)
    │
    └── SubAgente Administrativo (agentTool)
        ├── GPT Admin (gpt-5-mini · temp 0.1)
        └── tools:
            ├── Leer Vendedores Activos (dataTableTool · get)
            ├── Crear Visita en CRM (dataTableTool · insert)
            ├── Guardar Match Pendiente (dataTableTool · insert)
            ├── Actualizar Lead CRM (dataTableTool · update)
            └── Avisar Vendedor por WhatsApp (whatsAppTool · send)
```

### Credenciales requeridas

- `openAiApi: OpenAI Bochile` — usada por los 4 modelos LLM
- `whatsAppApi: Bochile WhatsApp Cloud` — usada por el send al cliente y el send al vendedor

### Variables de entorno

- `BOCHILE_WA_PHONE_ID` — Phone Number ID del WhatsApp Business Cloud de Bochile

---

## W2 · Bochile · Recordatorios de Visitas (cron)

- **ID:** `KgNZYq4R6MhCGvt1`
- **URL:** https://weseka.app.n8n.cloud/workflow/KgNZYq4R6MhCGvt1
- **Trigger:** Schedule cada 1 hora
- **Nodos:** 9

### Qué hace

Cada hora busca visitas `estado=agendada` con `recordatorio_enviado=false`. Calcula si la visita está en las próximas 24h (manda recordatorio de mañana) o en la próxima 1h (manda aviso "salí ya"). Envía 2 WhatsApp por visita (cliente + vendedor) y marca la visita como notificada.

### Cadena de nodos

| # | Nodo | Función |
|---|---|---|
| 1 | Cada hora | Schedule Trigger |
| 2 | Visitas pendientes recordatorio | DataTable get filtrado |
| 3 | Datos del Vendedor | DataTable get (por `vendedor_id`) |
| 4 | Datos del Lead | DataTable get (por `lead_id`) |
| 5 | Filtrar y armar mensajes | Code · calcula `diffMin`, decide `24h` o `1h`, arma `msg_cliente` y `msg_vendedor` |
| 6 | WhatsApp Cliente | WhatsApp Send |
| 7 | WhatsApp Vendedor | WhatsApp Send |
| 8 | Marcar recordatorio enviado | DataTable update (`recordatorio_enviado=true`) |
| 9 | Log accion recordatorio | DataTable insert en `acciones_ia` |

### Mensajes que envía

**24h antes al cliente:**
> Hola Lucas! Te recuerdo la visita de mañana 2026-05-02 a las 10:30 hs en Brown 1842, Palihue con Carlos Bochile. Si necesitas mover, avisame.

**24h antes al vendedor:**
> Mañana 10:30 hs VISITA con Lucas Fernandez en Brown 1842, Palihue. Reconfirma a la tarde.

**1h antes al cliente:**
> Hola Lucas! En 1 hora te esperamos en Brown 1842, Palihue. Carlos Bochile ya está yendo.

**1h antes al vendedor:**
> VISITA EN 1 HORA · Lucas Fernandez · Brown 1842, Palihue · 10:30 hs. Salir ya.

---

## W3 · Bochile · Match Retroactivo (cron)

- **ID:** `EYmiN3Uy3u5PUuQa`
- **URL:** https://weseka.app.n8n.cloud/workflow/EYmiN3Uy3u5PUuQa
- **Trigger:** Schedule cada 15 minutos
- **Nodos:** 9

### Qué hace

Resuelve el caso "el lead pidió algo que no había en stock". Cada 15 min:

1. Lee propiedades con `estado=nueva` y `publicada=true`.
2. Lee todos los `matches_pendientes` con `activo=true`.
3. Cruza con un algoritmo determinístico (operación + tipo + zona + presupuesto + ambientes + características obligatorias).
4. Para cada match encontrado: avisa al lead por WhatsApp con tour 360, desactiva el match, actualiza el lead a `Calificado IA`, marca la propiedad como `ofrecida`.

### Algoritmo de scoring del match (en el nodo Code)

- Base: 60
- Zona exacta: +15
- Precio dentro del presupuesto: +10
- Ambientes ≥ mínimo: +5
- Características obligatorias cumplidas: +10

Si pasa todos los filtros duros (operación exacta, tipo exacto, moneda exacta, ambientes mínimos, precio dentro de ±5/-10%) y el score final ≥ 60 → se notifica.

### Mensaje al lead

> Hola Lucas! Soy Camila de Bochile. ¿Te acordás que buscabas una casa en Palihue? Justo ingresó una al portafolio: Casa 4 amb Palihue en Brown 1842, 4 amb, USD 285.000. Te dejo el tour 360: https://bochile.com.ar/tour/P-100. ¿La querés ver presencialmente esta semana?

---

## W4 · Bochile · Cobranza Alquileres (cron diario)

- **ID:** `zKPoASiEv8KbovaY`
- **URL:** https://weseka.app.n8n.cloud/workflow/zKPoASiEv8KbovaY
- **Trigger:** Schedule diario 9:00 AM
- **Nodos:** 8

### Qué hace

Cada día 9 AM revisa todos los contratos activos. Según el día del mes:

| Día del mes | Acción | Mensaje |
|---|---|---|
| `día_vencimiento - 5` | Recordatorio suave | "Te recuerdo que el 5 vence el alquiler..." |
| `día_vencimiento - 1` | Recordatorio firme | "Mañana vence el alquiler..." |
| `día_vencimiento` | Aviso del día | "Hoy vence el alquiler..." |
| `> día_vencimiento` | Aviso de atraso | "Tu alquiler está con X días de atraso..." |

Si **atraso ≥ 3 días** → escala a Carlos Bochile por WhatsApp.
Si **atraso > 7 días** → cambia `estado` del contrato a `moroso`.

### Mensaje de escalamiento a Carlos

> ATRASO 5 DIAS · Contrato C-23 · Florencia Bértola · Alem 1456 · Monto ARS 580000. La IA ya intentó 3 veces. Requiere decisión humana.

---

## W5 · Bochile · Sync Dashboard a Google Sheets

- **ID:** `6VmlquxKOf2EtKEV`
- **URL:** https://weseka.app.n8n.cloud/workflow/6VmlquxKOf2EtKEV
- **Trigger:** Schedule cada 5 minutos
- **Nodos:** 17

### Qué hace

Vuelca las 8 Data Tables al spreadsheet maestro `Bochile_Dashboard_Maestro` (1 pestaña por tabla). Usa `appendOrUpdate` con `matchingColumns` = la PK de cada tabla.

### Cadena de nodos

```
Cada 5 min
   │
   ├─→ Leer leads → Volcar leads (sheet: leads)
   │
   ├─→ Leer propiedades → Volcar propiedades (sheet: propiedades)
   │
   ├─→ Leer visitas → Volcar visitas (sheet: visitas)
   │
   ├─→ Leer contratos → Volcar contratos (sheet: contratos)
   │
   ├─→ Leer empleados → Volcar empleados (sheet: empleados)
   │
   ├─→ Leer matches_pendientes → Volcar matches (sheet: matches_pendientes)
   │
   ├─→ Leer conversaciones (top 2000) → Volcar conversaciones (sheet: conversaciones)
   │
   └─→ Leer acciones_ia (top 2000) → Volcar acciones_ia (sheet: acciones_ia)
```

### Variables de entorno

- `BOCHILE_GSHEET_ID` — ID del Google Sheets maestro

### Credenciales

- `googleSheetsOAuth2Api: Bochile Google Sheets`

---

## Orden de despliegue

1. Crear credenciales (sin activar workflows).
2. Sembrar `bochile_empleados`, `bochile_propiedades`, `bochile_contratos`.
3. Activar W5 primero → el Sheets debe estar creado.
4. Verificar que el Sheets recibe datos.
5. Activar W2, W3, W4 (crons).
6. Activar W1 (chatbot) último.
7. Configurar el webhook de WhatsApp Cloud para que apunte a `/bochile-chat`.

---

## Resumen visual de frecuencias

```
┌────────────────────────┬───────────────────────────────┐
│ Bajo demanda           │ W1 Chatbot (cada mensaje)     │
├────────────────────────┼───────────────────────────────┤
│ Cada 5 min             │ W5 Sync Dashboard             │
├────────────────────────┼───────────────────────────────┤
│ Cada 15 min            │ W3 Match Retroactivo          │
├────────────────────────┼───────────────────────────────┤
│ Cada hora              │ W2 Recordatorios de Visitas   │
├────────────────────────┼───────────────────────────────┤
│ Diario 9 AM            │ W4 Cobranza Alquileres        │
└────────────────────────┴───────────────────────────────┘
```

---

*Última actualización: 2026-05-11*
