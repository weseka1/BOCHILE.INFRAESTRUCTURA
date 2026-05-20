# 03 - Cómo se opera día a día

> Ver también `OPERAR.md` en la raíz (resumen ejecutivo).

## Flujo típico de un día

### Mañana

1. Abrir Dashboard: `https://bochile-dashboard-ui.onrender.com`
2. **Pestaña Dashboard**: ver KPIs del día anterior (cuántos leads entraron, cuántas visitas se agendaron, etc.)
3. **Pestaña Visitas**: confirmar las que hay agendadas para hoy. Si hace falta llamar al cliente para confirmar, hacelo.
4. **Pestaña Acciones IA**: ver qué hizo Cami en las últimas 24h (escaneo rápido para detectar algo raro).

### Durante el día

- Cami atiende sola los WhatsApp.
- Si vos respondés a un cliente desde respond.io (ej. el cliente preguntó algo técnico que Cami no supo), Cami se pausa 24h sola.
- Si una visita se agenda, te llega un WhatsApp con los datos (al número del vendedor asignado en `empleados`).

### Tarde

1. Dashboard → pestaña Conversaciones → revisar las que tuvieron alguna alerta (Cami marcó como "requiere humano").
2. Dashboard → Leads → ver los nuevos del día. Si alguno te parece importante, podés contactarlo personalmente.

## Tareas frecuentes

### Buscar una conversación específica

Dashboard → Conversaciones → barra de búsqueda → escribir teléfono o nombre.

### Editar un lead manualmente

Sheet → pestaña `leads` → buscar por `lead_id` o `telefono` → editar la fila.

> El dashboard tiene cache de 30 segundos. Después de editar el Sheet, esperá 30s para ver el cambio en el dashboard.

### Cancelar una visita

Sheet → pestaña `visitas` → buscar la fila → columna `estado` → poner `cancelada`.

### Marcar a un cliente como "no responder más"

Sheet → `leads` → fila → `conversacion_cerrada` = `true`. Cami va a ignorarlo hasta que él vuelva a saludar.

### Pausar Cami por un tiempo largo (ej. vacaciones de Bochile)

Hay 2 formas:

**Forma A — pausar todo**:
- n8n → `bochile-n8n.onrender.com` → toggle Active OFF en W1.
- Después prender de vuelta.

**Forma B — pausar SOLO un cliente**:
- Sheet → `leads` → `bot_pausado_hasta` = fecha futura ISO (ej `2026-12-31T00:00:00`).

### Sacar a un vendedor del sistema

Sheet → `empleados` → fila del vendedor → `activo` = `false`.

Cami deja de asignarle visitas. Las visitas ya agendadas con ese vendedor NO se cancelan automáticamente, hay que rehacerlas manual.

### Vendedor de vacaciones

Sheet → `empleados` → fila → rellenar `vacacion_desde` y `vacacion_hasta` (formato YYYY-MM-DD).

Cami detecta y no le asigna visitas en ese rango.

### Agregar una propiedad nueva

**Opción A** (automática): el scraper diario lo hace solo si la propiedad aparece en `bochile.com.ar/propiedades`.

**Opción B** (manual): Sheet → `propiedades` → agregar fila. Después correr re-embed:

```powershell
# Si tenés acceso al Render Shell
cd apps/rag
npm run embed
```

O pedirle a Juani que lo corra.

### Reactivar Cami para un cliente pausado

Sheet → `leads` → `bot_pausado_hasta` → borrar el valor. Listo, Cami vuelve al toque.

## Lo que NO tenés que hacer

- **NO editar workflows desde n8n** salvo que sepas exactamente qué hacés. Cada cambio puede romper el sistema. Si necesitás algo, pedirle a Juani.
- **NO borrar columnas del Sheet**. Agregar está bien, borrar rompe el sistema.
- **NO cambiar los IDs** (`lead_id`, `prop_id`, etc.). Son referencias internas.
- **NO renombrar pestañas** del Sheet. El código las busca por nombre exacto.

## Reportes (próximamente)

- KPI semanal: cuántas conversaciones, cuántas visitas, ratio conversión.
- Top 5 propiedades más consultadas.
- Vendedores con más visitas confirmadas.

(Estos los puedo agregar al dashboard si los pedís).
