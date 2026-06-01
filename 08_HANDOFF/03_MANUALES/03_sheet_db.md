# Manual: Google Sheet (base de datos del sistema)

## ¿Qué es?

Es el Sheet de Google donde Cami escribe TODO lo que pasa: leads nuevos, conversaciones, visitas, propiedades, tareas, acciones de la IA, etc. **Es la fuente de verdad del sistema.**

Vos NO tenés que editar el Sheet a mano para el día a día. Pero podés mirarlo cuando quieras (es solo lectura recomendado).

## Acceso

- ID del Sheet: `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4`
- URL completa: ver [04_CREDENCIALES_TRANSFERIDAS.md](../04_CREDENCIALES_TRANSFERIDAS.md)

## Pestañas (tablas) del Sheet

| Pestaña | Qué guarda | Cómo se ve en el dashboard |
|---|---|---|
| `leads` | Cada persona que escribió a Cami | Tab "Clientes" |
| `conversaciones` | Todos los mensajes (entrantes y salientes) | Tab "Mensajes" |
| `propiedades` | Catálogo de propiedades (sincronizado con bochile.com) | Tab "Propiedades" |
| `visitas` | Visitas pendientes y confirmadas | Tab "Visitas" |
| `tareas` | Tareas del equipo | Tab "Tareas" |
| `empleados` | Vendedores activos | Tab "Equipo" |
| `acciones_ia` | Auditoría de lo que Cami decidió | (interno, no se muestra al usuario) |
| `matches_pendientes` | Cuando Cami no está segura de qué propiedad mostrar | (interno) |

## Por qué NO editar el Sheet a mano

- Si borrás filas, los workflows pueden romperse porque buscan IDs específicos.
- Si reordenás columnas, todos los nodos de n8n dejan de funcionar.
- Si cambias nombres de pestañas, igual.

**Para editar leads, visitas, tareas → usá el dashboard.** El dashboard sabe escribir bien al Sheet.

## Si tenés que editar a mano sí o sí (caso de emergencia)

1. **Hacé un duplicado del Sheet primero** (File → Make a copy). Por si rompés algo, tenés backup.
2. Edita SOLO el valor en una celda. NO borres filas. NO cambies headers.
3. Avisame antes para confirmar.

## Lo que podés agregar a mano sin riesgo

En la pestaña `propiedades`, los campos vacíos como `banos`, `expensas`, `caracteristicas`, `tour_360_url` → si los completás, Cami los usa automáticamente en sus respuestas.

> **Tip:** completar el campo `banos` de las propiedades activas hace que Cami dé info más rica (ej: "Casa 2 dormitorios, 2 baños, 132 m²" en vez de solo "2 dormitorios, 132 m²").

## Cómo recuperar el Sheet si lo rompiste por error

1. Abrir el Sheet → menú **File → Version history → See version history**
2. Lateral derecho: lista de versiones por fecha/hora
3. Click en la versión anterior al "rompimiento"
4. Click "Restore this version"
5. Avisame para confirmar que quedó bien

## Backups automáticos

Google Sheets guarda historial completo de cambios. No hay backup manual necesario.

Si querés backup externo (por si te roban la cuenta de Google), Yamil puede sacarte un dump CSV cada X días.
