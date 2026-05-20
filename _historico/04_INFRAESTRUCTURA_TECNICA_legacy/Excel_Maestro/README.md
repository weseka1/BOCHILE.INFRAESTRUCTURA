# Bochile_Dashboard_Maestro · Excel maestro

El archivo único que el equipo Bochile va a abrir todos los días. Vive en Google Sheets (que se ve y se edita como Excel) y desde ahí lo "hosteamos" en una app web con el estilo del demo HTML.

---

## Concepto

```
┌──────────────────────────────────────────────────────────┐
│ Bochile_Dashboard_Maestro.xlsx (Google Sheets)           │
│                                                          │
│ HOJAS BASE (data en bruto, las llena n8n cada 5 min)    │
│ ├─ leads                                                 │
│ ├─ propiedades                                           │
│ ├─ visitas                                               │
│ ├─ contratos                                             │
│ ├─ empleados                                             │
│ ├─ matches_pendientes                                    │
│ ├─ conversaciones                                        │
│ └─ acciones_ia                                           │
│                                                          │
│ HOJAS ANALÍTICAS (fórmulas que arman el dashboard)      │
│ ├─ DASHBOARD ............... vista resumen del HTML demo │
│ ├─ AGENDA_HOY .............. visitas de hoy y mañana    │
│ ├─ PIPELINE_CRM ............ Kanban en columnas         │
│ ├─ EMBUDO_CONVERSION ....... números por etapa          │
│ ├─ RANKING_VENDEDORES ...... cierres y comisiones       │
│ ├─ DEMANDA_X_BARRIO ........ heatmap de consultas       │
│ ├─ ALQUILERES_ESTADO ....... al día / atrasados         │
│ └─ FEED_IA ................. últimas 50 acciones        │
│                                                          │
│ CONFIG ..................... zonas, etapas válidas, etc │
└──────────────────────────────────────────────────────────┘
```

---

## Cómo se crea

### Paso 1 · Crear el Spreadsheet vacío

1. En Google Drive de Bochile, crear nuevo Google Sheets.
2. Nombrarlo: `Bochile_Dashboard_Maestro_2026`.
3. Copiar el **ID** del spreadsheet (de la URL).
4. Pegar ese ID como variable de entorno `BOCHILE_GSHEET_ID` en n8n.

### Paso 2 · Crear las 8 pestañas base

Crear 8 hojas vacías con los siguientes nombres exactos (lowercase, sin acentos):

- `leads`
- `propiedades`
- `visitas`
- `contratos`
- `empleados`
- `matches_pendientes`
- `conversaciones`
- `acciones_ia`

> No hace falta agregar columnas. El workflow W5 las crea automáticamente la primera vez (modo `insertInNewColumn`).

### Paso 3 · Sembrar datos iniciales

Importar los CSV templates de `templates_csv/` en las pestañas correspondientes. El equipo debe completar:

- `empleados.csv` → los 3 vendedores + admin
- `propiedades.csv` → el catálogo inicial (240 propiedades del demo)
- `contratos.csv` → los 86 contratos activos

### Paso 4 · Crear las 9 pestañas analíticas

Crear las hojas: `DASHBOARD`, `AGENDA_HOY`, `PIPELINE_CRM`, `EMBUDO_CONVERSION`, `RANKING_VENDEDORES`, `DEMANDA_X_BARRIO`, `ALQUILERES_ESTADO`, `FEED_IA`, `CONFIG`.

Las fórmulas para cada hoja están en [`Formulas_Dashboard.md`](Formulas_Dashboard.md). Son fórmulas standard de Google Sheets (también funcionan en Excel 365 con leves ajustes).

### Paso 5 · Activar W5

Una vez creado el Spreadsheet, activar el workflow **W5 Sync Dashboard** en n8n. Cada 5 min va a actualizar las hojas base con los datos de las Data Tables.

### Paso 6 · Hostear como app web

Para convertir el Sheets en una app web con el estilo del demo HTML:

**Opción A — Apps Script (gratis, rápido):**
1. Extensions → Apps Script en el Sheets.
2. Crear archivo `Code.gs` que sirve un endpoint `doGet()` devolviendo JSON con los datos de las hojas analíticas.
3. Deploy → New deployment → Web app → access "Anyone".
4. La URL pública se incrusta en un iframe en `bochile.com.ar/dashboard` o se consume desde una SPA estática.

**Opción B — Looker Studio (gratis, visual):**
1. Conectar Looker Studio al Spreadsheet.
2. Diseñar el dashboard con el estilo del demo HTML.
3. Publicar y compartir el link.

**Opción C — App propia (lo más customizable):**
1. Backend Node/Python que lee el Sheets via Google Sheets API.
2. Frontend con el HTML del demo + Tailwind/CSS variables.
3. Deploy en Vercel/Netlify.

**Recomendación WESEKA:** empezar con Opción A para go-live rápido. Migrar a Opción C en fase 2 cuando el cliente quiera marca propia y más funcionalidades.

---

## Estructura de las hojas analíticas (resumen)

### `DASHBOARD` — la pantalla de inicio

Es el espejo de la pestaña "Resumen" del demo HTML. Muestra:

- **4 tiles KPI** (top): Leads esta semana, Visitas hoy, Conversión lead→visita, Comisiones del mes
- **Flow operativo end-to-end** (6 pasos)
- **% trabajo humano ahorrado** (gauge calculado desde `acciones_ia.tiempo_ahorrado_min`)
- **Acceso rápido** a las otras pestañas (links internos)

### `AGENDA_HOY` — lo más usado por los vendedores

> Esta es **la pestaña que abren los vendedores** al empezar el día.

```
| Hora  | Cliente            | Vendedor      | Propiedad        | Dirección              | Tour 360 | Score | Notas IA          |
|-------|--------------------|----------------|--------------------|------------------------|----------|-------|-------------------|
| 10:30 | Lucas Fernández    | Carlos Bochile | Casa 4 amb Palihue | Brown 1842, Palihue    | [link]   | 88    | Pareja, 2 hijos…  |
| 16:30 | Familia Beltrán    | Carlos Bochile | Casa Palihue       | Brown 1842 (2da visita)| [link]   | 85    | Casi cerrando     |
```

### `PIPELINE_CRM` — Kanban

Columnas: Nuevo · Calificado IA · Visita agendada · Negociación · Cierre · Post-venta

Cada fila es un lead. Color del score (verde >70, amarillo 40-70, rojo <40).

### Y así con el resto…

Ver detalle de columnas y fórmulas en [`Formulas_Dashboard.md`](Formulas_Dashboard.md).

---

## Cómo lo usa el equipo

| Persona | Pestaña que abre | Qué hace |
|---|---|---|
| **Carlos Bochile** (dueño) | `DASHBOARD` | Ve el negocio en 5 segundos. Decide. |
| **Vendedores** (3) | `AGENDA_HOY` + `PIPELINE_CRM` | Ven sus visitas del día y sus leads activos. |
| **Admin de oficina** | `ALQUILERES_ESTADO` + `FEED_IA` | Ve cobros pendientes, escalamientos. |
| **Marketing/Growth** | `EMBUDO_CONVERSION` + `DEMANDA_X_BARRIO` | Ve qué barrios atraen más, cuál es la fuga. |

---

## Mantenimiento

- **El Sheets se actualiza solo** cada 5 min vía W5.
- **No editar manualmente las hojas base** (`leads`, `propiedades`, etc.). Se sobrescribirán en el próximo sync.
- **Para corregir datos**, editar la Data Table de n8n directamente o, mejor, mandarle el cambio al sistema (ej: pedirle a la IA "actualizá el lead L-123 con score 65").
- **Las hojas analíticas son seguras de editar** (solo tienen fórmulas, no se sobreescriben).

---

*Diseñado para que abrir el dashboard sea más rápido que abrir el mail.*
