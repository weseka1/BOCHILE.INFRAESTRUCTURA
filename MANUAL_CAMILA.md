# Manual operativo de Cami + Dashboard Bochile

Bienvenida, Camila. Este es tu manual para usar el sistema Bochile en el día a día. **Léelo una vez completo (10 min)** y después tenelo a mano para consulta. No necesitás saber nada técnico.

---

## ¿Qué es esto?

**Dos cosas trabajando juntas:**

1. **Cami** — la asistente de IA en WhatsApp que atiende a los clientes de la inmobiliaria 24/7. Vende, informa, califica, deriva.
2. **El Dashboard** — tu panel de control web donde ves todo: clientes, propiedades, visitas, conversaciones, métricas.

**¿Dónde se conecta cada cosa?**
- Los clientes te escriben a tu WhatsApp de Bochile como siempre.
- Cami responde sola la mayoría del tiempo.
- Vos podés intervenir cuando quieras desde tu WhatsApp Business → Cami se silencia automáticamente.
- En el Dashboard ves todo lo que pasa.

---

## Acceso al Dashboard

URL: **https://bochile-dashboard-ui.onrender.com**

Abrí desde tu PC o celular. No necesita usuario ni contraseña (por ahora — si querés que lo cerremos con login, decímelo).

---

## Las 7 secciones del Dashboard

### 🏠 1. Inicio
Resumen del día: nuevos leads, visitas próximas, tareas pendientes, conversaciones activas. **Es lo primero que mirás cada mañana.**

### 👥 2. Clientes
Todos los leads (gente que escribió a Cami). Por cada uno ves: nombre, teléfono, etapa, lo que busca, presupuesto, score de interés. Click en uno para abrir su ficha completa y ver historial.

### 🏘️ 3. Propiedades
Tu catálogo. **Sincronizado con bochile.com** — lo que está publicado en la web aparece acá. No agregás propiedades desde el dashboard: las publicás como siempre en la web y Cami las usa.

### 📅 4. Visitas

**Esta es la sección más importante de tu día.** Tiene dos partes:

**a) Pendientes de coordinar** (tarjetas amarillas arriba)
Cami **NUNCA agenda visitas sola.** Cuando un cliente le pide visitar una propiedad, Cami le dice *"le aviso a Camila, te va a contactar"* y crea una solicitud que aparece acá. Vos:

1. Mirás el cliente, la prop que le interesa, las observaciones.
2. Click en **"Confirmar"** → se abre el form para poner fecha + hora + qué vendedor la atiende.
3. Apretás guardar → la visita pasa a "Confirmadas".

O click en **"Cancelar"** si la visita no se va a hacer (el cliente se cayó, etc.).

**b) Confirmadas** (tabla abajo)
Las visitas ya con fecha+hora+vendedor. Si necesitás editar alguna (cambiar fecha, marcar como realizada, cancelar), click en la fila.

**Botón "Agregar visita manual"** (arriba a la derecha) → cuando coordinás una visita por otro canal (ej. te llaman por teléfono, una vendedora la sacó por su cuenta) la cargás vos misma.

### 💬 5. Mensajes
**Todos los chats con clientes.** Filtrados por canal:
- **Ventas** — clientes que escribieron al WA principal. Acá ves la conversación cliente ↔ Cami, y si vos intervenís desde tu celu, también aparece.
- **Alquileres** — chats del depto de Alquileres. Cami NO interviene en este canal — solo se loguea la conversación humano ↔ cliente.
- **Todos** — vista combinada.

Click en un chat para ver la conversación completa. Funciona como un WhatsApp Web.

### 👤 6. Equipo
Los vendedores y empleados (Camila, Belén, etc.). Acá Cami consulta cuando necesita derivar (ej. "agendar visita con quién").

### ✅ 7. Tareas
Tu lista de cosas para hacer. Si Cami detecta que hace falta alguna acción humana (devolver un llamado, contactar a un dueño, etc.) crea una tarea acá. Vos también podés crear tareas manualmente con el botón "Nueva tarea".

**Estados:** Pendiente → En curso → Completada. Las completadas **se quedan acá hasta que vos las elimines manualmente** (botón "Limpiar completadas" cuando estás en ese tab).

---

## ¿Qué hace Cami sola? ¿Cuándo necesita humano?

### ✅ Lo hace Cami sin tu intervención
- Saludar, presentarse, mantener conversación.
- Recibir descripción de búsqueda (zona, presupuesto, dormitorios).
- Buscar propiedades en el catálogo y mostrar 2-3 opciones que coincidan.
- Entender mensajes de **texto, audio (los transcribe), imágenes y videos**.
- Identificar propiedades que el cliente mande **por link** (BB Propiedades, Argenprop, Zonaprop, Instagram, etc.) — Cami lee el aviso, cruza con tu catálogo y responde con la prop si la tenemos.
- **Registrar interés** en visitar una propiedad (te queda pendiente para coordinar vos).
- Calificar el lead (score interno).

### 🚫 NO hace Cami — siempre te avisa a vos
- **Agendar visitas concretas** (fecha + hora). Te queda pendiente, vos coordinás.
- **Hablar de financiación / créditos / cuotas / banco.** Le dice al cliente "esos detalles los maneja Camila, le aviso para que te asesore."
- **Negociar precios.** Si el cliente pide descuento, Cami deriva a vos.

### 🤝 Cómo intervenir desde tu WA Business
**Cuando vos respondés un mensaje a un cliente desde tu celu (WhatsApp Business), Cami se silencia automáticamente en ESE chat por 2 horas.** Otros clientes siguen siendo atendidos por Cami normalmente.

Si querés que Cami vuelva a tomar la conversación antes de las 2 horas, hay un endpoint (decímelo a Yamil y te ayudo).

**El sistema también detecta cuando vos escribís "te paso el viernes 10am" o similar desde tu celu** — automáticamente crea la visita confirmada en el dashboard sin que tengas que cargarla a mano.

---

## Flujo típico de un día

1. **9:00 AM** — abrís el Dashboard, vas a Inicio. Ves: 3 leads nuevos, 2 visitas pendientes, 1 tarea.
2. **9:15** — vas a Visitas → confirmás las 2 pendientes (poner fecha + hora + a quién la mandás).
3. **10:00** — un cliente te escribe directo por WA preguntando por una propiedad. Le respondés vos. Cami se silencia en ese chat.
4. **10:30** — Cami atiende otro cliente nuevo en paralelo. Vos lo ves en Mensajes.
5. **A lo largo del día** — si Cami necesita algo de vos (calificar un caso especial), te crea tarea o registra visita pendiente.
6. **Final del día** — limpiás tareas completadas en el tab Tareas.

---

## FAQ / Problemas comunes

**"Cami me respondió mal a un cliente."**
Decime el caso concreto (qué dijo el cliente, qué respondió Cami). Mirás el chat en Mensajes y me lo pasás → ajusto las reglas.

**"Cami no le respondió a un cliente."**
Probables causas:
1. Vos respondiste antes desde el celu → Cami se silenció correctamente (no es un bug, es lo esperado).
2. El cliente escribió desde un canal que no está conectado → revisar respond.io.
3. El sistema tuvo un error → me avisás y miro logs.

**"Una visita pendiente está repetida."**
Click en la duplicada → "Cancelar". Sin problema.

**"El dashboard se ve raro / no carga."**
1. Refrescá la página (F5).
2. Si sigue mal, abrí desde otro navegador.
3. Si tampoco, avisame.

**"No veo conversaciones de Alquileres."**
Asegurate que el tab **Alquileres** esté seleccionado (arriba en Mensajes). Si está vacío es porque no hubo conversación humana real en ese canal todavía.

**"Quiero que Cami diga X de forma distinta."**
Decime exactamente: cuándo (qué frase del cliente), cómo responde hoy, cómo querés que responda. Ajusto las reglas y queda fijo.

---

## ¿A quién contactás cuándo?

- **Algo del sistema** (algo no carga, Cami responde mal, falta una funcionalidad): **Yamil Pintos** (WhatsApp).
- **Algo de un cliente puntual**: directo con tu equipo o por respond.io como siempre.

---

## Cosas que NO tenés que hacer

- ❌ NO toques la planilla de Google directamente (Cami escribe ahí, si vos editás a mano podés romper algo). Para editar visitas o leads, usá el dashboard.
- ❌ NO compartas la URL del dashboard con clientes — es interna del equipo.
- ❌ NO te preocupes por las propiedades en el dashboard — eso se sincroniza automáticamente desde bochile.com.

---

*Última actualización: 30/05/2026 — versión 1.0*
*Cualquier duda: Yamil.*
