# Fórmulas del Dashboard (Google Sheets)

Fórmulas listas para copiar/pegar. Cada hoja analítica se llena automáticamente a partir de las hojas base que el sync W5 mantiene actualizadas.

> **Convención:** los nombres de pestañas base son lowercase (`leads`, `visitas`, etc.). Las hojas analíticas en MAYUSCULAS para diferenciarlas visualmente.

---

## Hoja `DASHBOARD`

La vista resumen. Replica los KPIs del demo HTML.

### KPIs principales (celda → fórmula)

| Celda | Etiqueta | Fórmula |
|---|---|---|
| `A1` | "Leads esta semana" | (label) |
| `B1` | valor | `=COUNTIFS(leads!T:T, ">="&(TODAY()-7), leads!T:T, "<="&TODAY())` (donde col T = `creado_en`) |
| `A2` | "Visitas hoy" | (label) |
| `B2` | valor | `=COUNTIFS(visitas!H:H, TEXT(TODAY(),"yyyy-mm-dd"), visitas!J:J, "agendada")` |
| `A3` | "Conversión lead → visita" | (label) |
| `B3` | valor (%) | `=IFERROR(COUNTA(visitas!A:A)/COUNTA(leads!A:A), 0)` formatear como % |
| `A4` | "Comisiones del mes" | (label) |
| `B4` | valor | `=SUMIFS(empleados!K:K, empleados!K:K, ">0")` o equivalente |
| `A5` | "Tour 360° abiertos esta semana" | (label) |
| `B5` | valor | `=COUNTIFS(acciones_ia!B:B, "tour_abierto", acciones_ia!I:I, ">="&(TODAY()-7))` |
| `A6` | "Horas humanas ahorradas (mes)" | (label) |
| `B6` | valor | `=ROUND(SUMIFS(acciones_ia!H:H, acciones_ia!I:I, ">="&EOMONTH(TODAY(),-1)+1)/60, 1)` |

### Tile "Trabajo humano ahorrado"

```
B7 = ROUND(B6 * 100 / 200, 0)   // asume 200h/mes como total humano sin IA → %
```

### Acciones rápidas (links a otras pestañas)

| Celda | Texto | Link |
|---|---|---|
| `A10` | "▸ Agenda de hoy" | hyperlink a `AGENDA_HOY` |
| `A11` | "▸ Pipeline del CRM" | hyperlink a `PIPELINE_CRM` |
| `A12` | "▸ Cobranza alquileres" | hyperlink a `ALQUILERES_ESTADO` |
| `A13` | "▸ Feed de la IA (últimas acciones)" | hyperlink a `FEED_IA` |

---

## Hoja `AGENDA_HOY`

**La hoja más usada del equipo.** Una sola fórmula `QUERY` resuelve todo.

### Celda `A1` (encabezado dinámico)

```
="Visitas para "&TEXT(TODAY(),"dddd d 'de' mmmm")
```

### Celda `A3` (la consulta)

```excel
=QUERY(
  visitas!A:O,
  "select B, F, E, G, H, I, J, M
   where H >= date '"&TEXT(TODAY(),"yyyy-mm-dd")&"'
     and H <= date '"&TEXT(TODAY()+1,"yyyy-mm-dd")&"'
     and J in ('agendada','confirmada')
   order by H asc, I asc
   label B 'Lead ID', F 'Cliente', E 'Vendedor', G 'Dirección',
         H 'Fecha', I 'Hora', J 'Estado', M 'Observaciones'",
  1
)
```

> Ajustar columnas según el orden real de la hoja `visitas` después del primer sync.

### Enriquecer con score y tour 360

A la derecha, agregar columnas con VLOOKUP:

| Columna | Fórmula |
|---|---|
| `I` (Score) | `=IFERROR(VLOOKUP(A4, leads!A:O, 15, FALSE), "")` |
| `J` (Tour 360) | `=IFERROR(VLOOKUP(C4, propiedades!A:Q, 16, FALSE), "")` (donde C es prop_id) |

---

## Hoja `PIPELINE_CRM`

Kanban en columnas. 6 columnas, una por etapa.

### Estructura

```
| A: Nuevo            | B: Calificado IA      | C: Visita agendada  | D: Negociación       | E: Cierre            | F: Post-venta        |
|---------------------|-----------------------|---------------------|----------------------|----------------------|----------------------|
| Lead · Score · Tel  | Lead · Score · Tel    | (...)               |                      |                      |                      |
```

### Fórmulas por columna

`A2` (Nuevo):
```excel
=QUERY(leads!A:V,
  "select B, P, C where P = 'Nuevo' order by U desc",
  1)
```

`B2` (Calificado IA):
```excel
=QUERY(leads!A:V,
  "select B, P, C where P = 'Calificado IA' order by O desc",
  1)
```

Y así sucesivamente para C2 (`Visita agendada`), D2 (`Negociación`), E2 (`Cierre`), F2 (`Post-venta`).

### Color por score (formato condicional)

Aplicar a las celdas con score:
- `>= 71` → fondo verde claro
- `41-70` → fondo amarillo claro
- `< 41` → fondo rojo claro

---

## Hoja `EMBUDO_CONVERSION`

5 valores en columna A, números en B.

| Celda | Fórmula |
|---|---|
| `A1` | "Leads" |
| `B1` | `=COUNTA(leads!A2:A)` |
| `A2` | "Calificados (score ≥ 41)" |
| `B2` | `=COUNTIF(leads!O:O, ">=41")` |
| `A3` | "Visitas agendadas" |
| `B3` | `=COUNTA(visitas!A2:A)` |
| `A4` | "Negociaciones abiertas" |
| `B4` | `=COUNTIF(leads!P:P, "Negociación")` |
| `A5` | "Cierres del mes" |
| `B5` | `=COUNTIFS(leads!P:P, "Cierre", leads!U:U, ">="&EOMONTH(TODAY(),-1)+1)` |

### Tasas de conversión (col C)

| Celda | Fórmula |
|---|---|
| `C2` | `=IFERROR(B2/B1, 0)` formato % |
| `C3` | `=IFERROR(B3/B2, 0)` |
| `C4` | `=IFERROR(B4/B3, 0)` |
| `C5` | `=IFERROR(B5/B4, 0)` |

### Gráfico

Insertar gráfico de embudo (Funnel) con rango `A1:B5`.

---

## Hoja `RANKING_VENDEDORES`

```excel
=QUERY(empleados!A:K,
  "select B, J, K, I
   where C = 'vendedor' and H = TRUE
   order by K desc",
  1)
```

Columnas devueltas:
- B = nombre
- J = cierres_mes
- K = comisiones_mes
- I = visitas_mes

Agregar columna calculada "Eficiencia" = cierres / visitas (formato %).

---

## Hoja `DEMANDA_X_BARRIO`

Heatmap por zona de búsqueda.

### Tabla pivot

```excel
=QUERY(leads!A:V,
  "select H, count(A)
   where H is not null and U >= date '"&TEXT(EOMONTH(TODAY(),-1)+1,"yyyy-mm-dd")&"'
   group by H
   order by count(A) desc
   label H 'Barrio', count(A) 'Consultas'",
  1)
```

(`H` = `zona_pref`, `U` = `actualizado_en` o `creado_en`).

### Formato condicional

Gradient color scale en la columna "Consultas" — del más claro al más intenso del color plata de la marca.

---

## Hoja `ALQUILERES_ESTADO`

### Stats arriba

| Celda | Etiqueta | Fórmula |
|---|---|---|
| `B1` | Contratos activos | `=COUNTIF(contratos!N:N, "activo")` |
| `B2` | Pagos este mes | `=SUMIFS(contratos!G:G, contratos!O:O, ">="&EOMONTH(TODAY(),-1)+1)` |
| `B3` | Pendientes hoy | `=COUNTIFS(contratos!I:I, DAY(TODAY()), contratos!P:P, 0)` |
| `B4` | Atrasados | `=COUNTIF(contratos!P:P, ">0")` |
| `B5` | Morosos | `=COUNTIF(contratos!N:N, "moroso")` |

### Tabla detallada

```excel
=QUERY(contratos!A:P,
  "select B, D, F, G, H, I, P, N
   order by P desc, I asc
   label B 'ID', D 'Dirección', F 'Inquilino', G 'Monto',
         H 'Moneda', I 'Día venc.', P 'Atraso (días)', N 'Estado'",
  1)
```

Formato condicional:
- `P > 0` y `P < 3` → amarillo
- `P >= 3` → rojo

---

## Hoja `FEED_IA`

Las últimas 50 acciones de la IA, estilo feed.

```excel
=QUERY(acciones_ia!A:I,
  "select I, C, B, F, G, H
   where I is not null
   order by I desc
   limit 50
   label I 'Cuándo', C 'Agente', B 'Tipo',
         F 'Resumen', G 'Resultado', H 'Min ahorrados'",
  1)
```

(`I` = timestamp, `C` = agente, `B` = tipo, `F` = resumen, `G` = resultado, `H` = tiempo_ahorrado_min).

---

## Hoja `CONFIG`

Parámetros editables manualmente por el equipo. Las otras hojas leen de acá.

### Listas válidas (col A en adelante)

| A | B | C | D |
|---|---|---|---|
| **Zonas** | **Etapas CRM** | **Tipos** | **Operaciones** |
| Palihue | Nuevo | casa | venta |
| Centro | Calificado IA | departamento | alquiler |
| Universitario | Visita agendada | ph | alquiler_temporario |
| Villa Mitre | Negociación | lote | |
| Villa Belgrano | Cierre | local | |
| Patagonia | Post-venta | oficina | |
| Tiro Federal | En espera de stock | | |
| Villa Don Bosco | Descartado | | |
| Almafuerte | | | |

### Parámetros operativos

| Celda | Nombre | Valor |
|---|---|---|
| `F1` | URL Tours base | `https://bochile.com.ar/tour/` |
| `F2` | URL Pago base | `https://bochile.com.ar/pagar/` |
| `F3` | Telefono Carlos | `5492914401120` |
| `F4` | Horas humanas mes (base) | `200` |
| `F5` | Score umbral visita | `70` |
| `F6` | Score umbral curioso | `40` |

---

## Cómo lo "hosteamos" como app web

El Sheets queda como **fuente de verdad**. Para mostrarlo bonito (estilo del demo HTML):

### Opción rápida (1 día) — Apps Script

```javascript
function doGet(e) {
  const ss = SpreadsheetApp.openById('BOCHILE_GSHEET_ID');
  const data = {
    kpis: leerHoja(ss, 'DASHBOARD'),
    agenda: leerHoja(ss, 'AGENDA_HOY'),
    pipeline: leerHoja(ss, 'PIPELINE_CRM'),
    embudo: leerHoja(ss, 'EMBUDO_CONVERSION'),
    ranking: leerHoja(ss, 'RANKING_VENDEDORES'),
    barrios: leerHoja(ss, 'DEMANDA_X_BARRIO'),
    alquileres: leerHoja(ss, 'ALQUILERES_ESTADO'),
    feed: leerHoja(ss, 'FEED_IA')
  };
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function leerHoja(ss, nombre) {
  const sheet = ss.getSheetByName(nombre);
  return sheet.getDataRange().getValues();
}
```

Deploy como **Web App** con acceso "Anyone with the link". La URL pública se llama desde el frontend.

### Frontend (basado en el demo HTML)

El HTML del demo ya tiene todo el estilo. Solo hay que reemplazar los datos hardcodeados por un `fetch()` al endpoint de Apps Script y `renderTable(data.kpis)`, `renderAgenda(data.agenda)`, etc.

```html
<script>
fetch('https://script.google.com/macros/s/.../exec')
  .then(r => r.json())
  .then(data => {
    renderKPIs(data.kpis);
    renderAgenda(data.agenda);
    // ...
  });
</script>
```

Deploy del HTML como página estática en Netlify/Vercel apuntando al dominio `dashboard.bochile.com.ar`.

---

*Estas fórmulas se prueban primero en el Sheets, después se documentan acá. Ajustar las letras de columnas (A, B, C…) según el orden real que dejó W5 en el primer sync.*
