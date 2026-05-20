# Bochile · Sistema n8n · Estado Final

**Fecha:** 2026-05-15
**Versión arquitectura:** Sheet-as-DB (Opción A pura)
**Estado:** Producción local, listo para uso

---

## Arquitectura

```
Cliente WhatsApp
     ↓ (Twilio Sandbox webhook)
     ↓ ngrok tunnel
n8n local (localhost:5680)
     ↓ workflows W1-W5
Google Sheet "Bochile · Sistema Operativo"
     ↓ (consulta directa)
Looker Studio / Dashboard
```

**Principio:** el Google Sheet es la **única fuente de verdad del negocio**. n8n usa SQLite interno SOLO para correr el motor (workflows + credenciales + history), no para datos de negocio. Los datos de Bochile (leads, propiedades, visitas, conversaciones, etc.) viven 100% en el Sheet.

---

## Workflows activos

| ID | Nombre | Trigger | Función |
|---|---|---|---|
| `aUMQyupnGJ5IWm5e` | W1 - Chatbot Multi-Agente CORE | Webhook Twilio | Recibe WhatsApp, agent GPT-4o con sub-agentes (Calificador / Matcher / Admin), responde y agenda |
| `f1CC972kzNPR8ebi` | W2 - Recordatorios de Visitas | Cron horario | Manda recordatorio cliente + vendedora 24h y 1h antes de cada visita |
| `W327qYVE9SpwQiRi` | W3 - Match Retroactivo | Cron 15min | Cruza props nuevas con leads en espera de stock |
| `wrFto5o6Zk02sZty` | W4 - Cobranza Alquileres | Cron diario 9am | Recordatorios + escalado por atrasos de inquilinos |
| `lf3gZgVCD3SdPri4` | W5 - Backup Mensual + Reset | Cron día 1 mes 03:00 | Duplica Sheet a Drive como histórico y resetea pestañas transaccionales |

---

## Sheet (Sistema Operativo de Bochile)

**ID:** `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4`
**URL:** https://docs.google.com/spreadsheets/d/1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4/edit

### Pestañas y columnas

| Pestaña | Función | Matching key | Crece en el mes |
|---|---|---|---|
| `leads` | CRM de leads (clientes) | `lead_id` | Sí (1-N por cliente nuevo) |
| `propiedades` | Catálogo de propiedades | `prop_id` | No (persiste, alta manual) |
| `visitas` | Visitas agendadas | `visita_id` | Sí |
| `contratos` | Contratos de alquiler activos | `contrato_id` | No (persiste) |
| `empleados` | Vendedores y admin | `empleado_id` | No (persiste) |
| `matches_pendientes` | Leads en espera de stock | `match_id` | Sí |
| `conversaciones` | Log mensajes in/out | `msg_id` | Sí |
| `acciones_ia` | Log de acciones del bot | `accion_id` | Sí |

---

## Vendedora actual

**Camila Pomerich** (empleado_id `E-1B`, tel `+5492914413200`)
La IA del bot ES Camila Pomerich (primera persona). Cuando coordina visitas las hace ella misma.

---

## Configuración técnica

### Credenciales en uso

| Credencial | ID | Uso |
|---|---|---|
| OpenAi account | `4mQx97qkHBIhXxu3` | GPT-4o (Vendedor CORE, sub-agentes), Whisper, Vision |
| Google Sheets account | `9NvEcPkNdH6i0j3L` | Todos los nodos googleSheets/googleSheetsTool |
| Google Drive account | `s6bzy7p0HH3Gjmfr` | W5 backup mensual |
| Twilio account | `HR5fS1GSOu06duuX` | Recibir/enviar WhatsApp |

### Modelos OpenAI

- **GPT Vendedor CORE**: `gpt-4o` (temperatura 0.4)
- **GPT Calificador / Matcher / Admin**: `gpt-4o-mini`
- **Audio Whisper**: `whisper-1`
- **Imagen Vision**: `gpt-4o`

### Twilio

- **From (Sandbox):** `+14155238886`
- **Webhook entrante:** `https://<ngrok>.ngrok-free.app/webhook/bochile-chat`
- **Para producción real**: contratar número WhatsApp Business con Twilio. La sandbox solo entrega a números que se "unieron" con `join <código>`.

---

## Flujo de un mensaje (W1)

```
Webhook Twilio (POST)
  ↓
Parsear Mensaje (Code node: extrae tel, mensaje, msg_type)
  ↓
Switch Tipo Mensaje (Texto / Audio / Imagen)
  ↓
  ├─ Texto → Set Mensaje
  ├─ Audio → Download + Whisper → Set Mensaje
  └─ Imagen → Download + Vision → Set Mensaje
  ↓
Merge Caminos (unifica las 3 ramas)
  ↓
Buscar Lead Existente (Sheet lookup por lead_id)
  ↓
Upsert Lead CRM (Sheet appendOrUpdate)
  ↓
Log Mensaje Entrante (Sheet append a conversaciones)
  ↓
Vendedor CORE (Agent GPT-4o)
  ├─ Memoria Conversacion (window buffer, sessionId=telefono)
  ├─ SubAgente Calificador (tool, devuelve JSON score)
  ├─ SubAgente Matcher (tool, busca props en Sheet)
  ├─ SubAgente Administrativo (tool)
  │    ├─ Crear Visita en CRM (Sheet append)
  │    ├─ Guardar Match Pendiente (Sheet append)
  │    ├─ Actualizar Lead CRM (Sheet update)
  │    └─ Avisar Vendedor por WhatsApp Twilio
  ├─ Leer Catalogo Propiedades (Sheet read)
  └─ Leer Vendedores Activos (Sheet read)
  ↓
Log Mensaje Saliente (Sheet append a conversaciones)
  ↓
Registrar Accion IA (Sheet append a acciones_ia)
  ↓
Responder al Cliente Twilio (manda WhatsApp)
  ↓
OK al Webhook
```

---

## Datos seed cargados (estado base)

- **13 leads** con datos reales de prueba
- **10 propiedades** ficticias representativas (P-001 a P-010, zonas reales de Bahía Blanca)
- **6 visitas** históricas
- **6 contratos** activos
- **4 empleados** (1 vendedora Camila Pomerich + 3 originales históricos)
- **2 matches pendientes**

---

## Pendientes (no bloquean operación)

1. **Producción Twilio**: salir del sandbox y contratar número WhatsApp Business pago (~$15/mes Twilio + costo aprobación Meta). Sin esto, el bot solo atiende a números que hicieron `join` al sandbox.
2. **ngrok pago o Render**: para que el bot esté online 24/7 sin depender de la PC encendida. Ver [`00_SISTEMA_INTERNO/n8n-infra/MIGRACION_LOCAL_A_RENDER.md`](../../../00_SISTEMA_INTERNO/n8n-infra/MIGRACION_LOCAL_A_RENDER.md).
3. **Catálogo real de propiedades**: hoy hay 10 propiedades ficticias. Reemplazar con el catálogo real de Bochile (alta manual en pestaña `propiedades` del Sheet).
4. **Dashboard visual**: conectar Looker Studio al Sheet para gráficos de leads/conversion/visitas. ~10 min de setup.
5. **Renombrar vendedora histórica**: si el cliente solo quiere a Camila Pomerich activa, marcar `activo=false` a Carlos Bochile / Julieta Mendez / Valentín Soto.

---

## Mantenimiento

### Cron W5 mensual (automático)
- **Día 1 de cada mes 03:00 AM**: duplica el Sheet en Drive (`Bochile YYYY-MM Backup`) y resetea las pestañas transaccionales (`leads`, `conversaciones`, `visitas`, `matches_pendientes`, `acciones_ia`).
- Las pestañas maestras (`propiedades`, `contratos`, `empleados`) NO se tocan.

### Si el Sheet se rompe / desordena
- Restaurar desde el último backup en Drive carpeta `Backups Bochile Mensuales`

### Si n8n crashea / Docker se reinicia
- Los workflows y credenciales se mantienen (viven en SQLite del volumen montado)
- Solo se pierde el historial de execuciones

---

## Archivos relevantes en este proyecto

| Archivo | Función |
|---|---|
| `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports/W1-W5_*.json` | Snapshots de los 5 workflows (importables) |
| `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports/_seed_all.py` | Script de seed inicial de las 8 data tables (legacy SQLite, ya no se usa) |
| `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports/_refactor_w1_sheet_only.py` | Refactor W1 a Sheet-only |
| `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports/_refactor_w234_sheet_only.py` | Refactor W2/W3/W4 a Sheet-only |
| `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports/_w5_backup_mensual.py` | Creación W5 backup |
| `04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/exports/W1_BACKUP_pre_refactor_sheets_only.json` | Backup del W1 antes del refactor |
| `00_SISTEMA_INTERNO/n8n-infra/docker-compose.yml` | Stack Docker del n8n local |
| `00_SISTEMA_INTERNO/n8n-infra/MIGRACION_LOCAL_A_RENDER.md` | Playbook para mover a Render |

---

## Test E2E validado

**Ejecución 2771 (2026-05-15 00:00:14)**:
- HTTP 200 OK desde Twilio webhook
- 20 nodos del workflow ejecutaron OK
- Datos llegaron al Sheet:
  - `leads`: row L-2915512515 actualizado
  - `conversaciones`: 2 rows nuevas (in + out)
  - `acciones_ia`: 1 row nueva (conversacion_atendida)
- Respuesta de Camila al cliente: coherente y en primera persona

**Nota de operación:** OpenAI API puede tener timeouts transitorios. Si una ejecución falla con "Request timed out", el siguiente mensaje del cliente la reactiva sin problema. n8n loggea el error en `executions` para auditoría.
