# Setup de producción · Sistema Bochile

Guía paso a paso para llevar el sistema de "creado en n8n" a "en producción atendiendo clientes".

---

## Prerequisitos del cliente

| # | Necesitamos | Por qué |
|---|---|---|
| 1 | Cuenta de **WhatsApp Business Cloud API** (Meta) verificada | Para que Camila reciba/envíe mensajes |
| 2 | **Phone Number ID** de WhatsApp Cloud | Lo necesitamos como `BOCHILE_WA_PHONE_ID` |
| 3 | API Key de **OpenAI** con saldo (~USD 200/mes inicial) | Para los 4 modelos LLM |
| 4 | Cuenta de **Google Workspace** con permisos para crear Sheets | Para el dashboard |
| 5 | Dominio `bochile.com.ar` con acceso DNS | Para webhook, web pública y dashboard |
| 6 | Lista de los 3 vendedores con teléfonos | Para sembrar `bochile_empleados` |
| 7 | CSV con catálogo de propiedades actual | Para sembrar `bochile_propiedades` |
| 8 | CSV con contratos de alquiler activos | Para sembrar `bochile_contratos` |

---

## Día 0 · Credenciales y variables

### En n8n (https://weseka.app.n8n.cloud)

**Credenciales a cargar:**

1. `OpenAI Bochile` → API key de la cuenta OpenAI de Bochile.
2. `Bochile WhatsApp Cloud` → access token y phone number id del WhatsApp Cloud.
3. `Bochile Google Sheets` → OAuth con la cuenta `operaciones@bochile.com.ar`.

**Variables de entorno** (Settings → Environment):

| Variable | Valor | Notas |
|---|---|---|
| `BOCHILE_WA_PHONE_ID` | (Phone Number ID de WhatsApp Cloud) | Está en Meta Business → WhatsApp → API Setup |
| `BOCHILE_GSHEET_ID` | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` | **Spreadsheet ya creado** en Drive de ju4nl0pezs@gmail.com |
| `BOCHILE_CARLOS_TEL` | `5492914401120` | Para escalamientos de morosos |

---

## Día 1 · Crear el dashboard maestro

1. En el Google Drive de Bochile, crear nuevo Google Sheets llamado `Bochile_Dashboard_Maestro_2026`.
2. Copiar el ID del spreadsheet (de la URL: `https://docs.google.com/spreadsheets/d/`**`<este ID>`**`/edit`).
3. Pegar ese ID en n8n como `BOCHILE_GSHEET_ID`.
4. Crear las 8 pestañas con los nombres exactos:
   `leads`, `propiedades`, `visitas`, `contratos`, `empleados`, `matches_pendientes`, `conversaciones`, `acciones_ia`.
5. Compartir el spreadsheet con la cuenta de servicio que usa n8n (lectura+escritura).

---

## Día 2 · Sembrar datos iniciales

Hay **dos formas** de cargar los datos iniciales en las Data Tables de n8n:

### Opción A · Cargar manualmente desde la UI de n8n

1. Ir a n8n → Variables → Data Tables.
2. Abrir cada tabla y usar el botón **Import** para subir los CSV de `Excel_Maestro/templates_csv/`.

### Opción B · Usar el workflow de bootstrap (más rápido)

Hay un endpoint que tira `POST /bochile-bulk-import` con todos los CSVs. (Si no existe, lo creamos en este día).

### Datos mínimos para arrancar:

- ✅ `empleados.csv` → los 3 vendedores + 1 admin
- ✅ `propiedades.csv` → mínimo 20 propiedades (las que se quieran publicar primero)
- ✅ `contratos.csv` → todos los contratos activos (~86)

Las otras tablas (`leads`, `visitas`, `conversaciones`, `matches_pendientes`, `acciones_ia`) **arrancan vacías** — se llenan solas conforme entren clientes.

---

## Día 3 · Activar workflows y testear

### Orden de activación

1. **W5 · Sync Dashboard** primero (verificar que llena el Sheets).
2. Esperar 5 min, abrir el Sheets, confirmar que aparecen las hojas pobladas.
3. **W2, W3, W4** (crons).
4. **W1 · Chatbot** último.

### Test punta a punta de W1

1. Configurar el webhook de WhatsApp Cloud para apuntar a:
   ```
   https://weseka.app.n8n.cloud/webhook/bochile-chat
   ```
   (Verify token y modo de suscripción según Meta).

2. Enviar un mensaje desde un teléfono personal al número de Bochile:
   > "Hola! Vi un aviso de una casa en Palihue, está disponible?"

3. **Validaciones:**
   - ✅ Llega respuesta de Camila en < 30 segundos.
   - ✅ En n8n, la ejecución del W1 muestra los 24 nodos ejecutados.
   - ✅ En la Data Table `bochile_leads`, aparece un nuevo lead.
   - ✅ En `bochile_conversaciones`, aparecen 2 filas (in + out).
   - ✅ En `bochile_acciones_ia`, aparece 1 acción.
   - ✅ En el Sheets, después de 5 min, aparecen actualizadas las 4 pestañas.

4. Continuar la conversación hasta agendar una visita y verificar que:
   - ✅ Se crea fila en `bochile_visitas`.
   - ✅ El vendedor (en este caso uno de los teléfonos sembrados) recibe el mensaje **VISITA AGENDADA PARA LAS X CON Y EN Z**.
   - ✅ El lead cambia a etapa `Visita agendada` en `bochile_leads`.

---

## Día 4 · Hostear el dashboard como app web

### Apps Script (lo más rápido)

1. En el Sheets, Extensions → Apps Script.
2. Pegar el código de `Excel_Maestro/Formulas_Dashboard.md` (sección "Cómo lo hosteamos").
3. Deploy → New deployment → Type: Web app → Execute as: Me → Who has access: Anyone.
4. Copiar la URL del deployment.

### Frontend dashboard

1. Tomar el HTML del demo (`02_DEMO_OPERATIVO/Bochile-Demo.html`).
2. Reemplazar los datos hardcodeados por `fetch()` al endpoint Apps Script.
3. Subir a Netlify/Vercel como página estática.
4. Apuntar `dashboard.bochile.com.ar` al deploy.

> **El equipo Bochile entra a `dashboard.bochile.com.ar` y ve TODO en vivo.**

---

## Día 5 · Capacitación al equipo

Una llamada de 1 hora con:

- **Carlos Bochile:** mostrar Dashboard y feed IA. Cómo escalan morosos.
- **3 vendedores:** mostrar `AGENDA_HOY`, cómo reciben el WhatsApp de "VISITA AGENDADA…", cómo confirman resultado de la visita (manual o por WhatsApp).
- **Admin:** mostrar `ALQUILERES_ESTADO`, `FEED_IA`. Cómo pausar/reactivar workflows si algo se rompe.

---

## Día 6+ · Monitoreo y ajustes

### Métricas clave a vigilar la primera semana

| Métrica | Target | Cómo se ve |
|---|---|---|
| Mensajes atendidos / día | > 20 | `bochile_conversaciones` con `direccion=in` |
| Tasa de calificación | > 70% conversaciones con score asignado | Score llenado en `bochile_leads` |
| Visitas agendadas / mensajes | > 15% | `bochile_visitas` vs leads totales |
| Conversaciones que escalaron a humano | < 10% | `bochile_conversaciones` con `requiere_humano=true` |
| Tiempo de respuesta IA | < 30s | Ver duración de ejecuciones W1 en n8n |
| Errores en ejecuciones | < 1% | n8n → Executions → filter Error |

### Ajustes típicos primeras 2 semanas

- **Si Camila es muy formal o muy lanzada:** ajustar `temperature` o el system prompt en el nodo `Vendedor CORE`.
- **Si filtra mal curiosos:** ajustar reglas del prompt del Calificador (umbrales de score).
- **Si propone propiedades fuera de presupuesto:** ajustar la tolerancia en el prompt del Matcher.

Todos estos ajustes son **un solo edit de prompt** en n8n. No requieren redeploy.

---

## Día 7+ · Apagar workflows o sub-agentes

Si algo se rompe o el cliente quiere bajar funcionalidad:

- **Apagar Camila** (modo emergencia "humanos toman el chat"): desactivar W1 en n8n. El webhook empieza a tirar 404. WhatsApp puede configurarse para entonces caer en el inbox humano.
- **Apagar cobranza automática**: desactivar W4.
- **Apagar match retroactivo**: desactivar W3.

Cada workflow es independiente.

---

## Costos estimados (referencial mensual)

| Concepto | Costo estimado USD |
|---|---|
| OpenAI (gpt-5 + gpt-5-mini, ~5000 mensajes) | 150-250 |
| WhatsApp Business Cloud (conversaciones marketing/utility) | 80-200 (depende volumen) |
| n8n Cloud (plan Starter o Pro) | 50-100 |
| Google Workspace | (ya lo tienen) |
| Netlify/Vercel hosting estático | 0 (free tier) |
| **TOTAL infraestructura** | **~280-550 USD/mes** |

> El cliente paga **ese piso** + nuestro fee de implementación + mantenimiento.

---

## Próximos pasos opcionales (fase 2)

- 📲 Integración con **Google Calendar** real (que la IA agende directo en el calendario del vendedor).
- 🎙️ **Voz** — recibir audios de WhatsApp y transcribirlos antes de pasarlos al CORE.
- 🧠 **Memoria de largo plazo** — guardar resúmenes de cada conversación en `bochile_leads.notas` para que Camila recuerde clientes de hace meses.
- 🤝 **Integración ZonaProp / Argenprop** — pull automático de listings ajenos para comparativas.
- 💰 **Integración Mercado Pago / Modo** — generar links de pago automáticos para alquileres.
- 📊 **Dashboard avanzado** — migrar de Apps Script a app propia con autenticación por vendedor.

---

*Última actualización: 2026-05-11 · WESEKA.IA · Lista para go-live.*
