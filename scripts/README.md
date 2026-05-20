# scripts/

Utilidades de mantenimiento curadas. Cada script tiene un único propósito claro.

| Script | Qué hace | Cuándo usarlo |
|---|---|---|
| `01_backup_workflow.cjs` | Exporta el W1 del n8n a `_backups/W1_LATEST.json` | Antes de tocar el editor de n8n manualmente |
| `02_restore_workflow.cjs` | Restaura el W1 desde `W1_LATEST.json` | Si la UI rompió algo |
| `03_export_all_workflows.cjs` | Exporta los 7 workflows a JSON committeable | Después de cambios grandes, para versionar |
| `04_e2e_test.cjs` | Simula un mensaje entrante (webhook) y verifica el flow completo | Antes de un deploy o después de un fix |
| `05_reset_demo_data.cjs` | Borra leads/conversaciones/visitas/etc del Sheet (no toca propiedades/empleados) | Para arrancar producción limpio post-demo |
| `06_setup_calendar_labor.cjs` | Crea la pestaña `feriados_args` + agrega columnas de horario/vacaciones a `empleados` | Setup inicial del Sheet |
| `07_setup_handoff_columns.cjs` | Agrega columnas `bot_pausado_hasta`, `ultimo_humano_respondio`, `conversacion_cerrada` a `leads` | Setup inicial del Sheet |

## Requisitos

Todos los scripts asumen:
- Node 18+ instalado
- Variables del archivo padre (n8n API key hardcoded en los 01-04, service account en 05-07)

> **Importante**: los scripts 01-04 tienen el `N8N_API_KEY` hardcoded. Cuando migres a Render, vas a tener que actualizar las URLs y el API key. Eventualmente esto debería estar en un `.env` pero por simplicidad están inline.

## Cómo correr

```bash
cd scripts
node 01_backup_workflow.cjs
```

## Orden recomendado en setup inicial (post-deploy Render)

1. `06_setup_calendar_labor.cjs` (crea feriados + columnas empleados)
2. `07_setup_handoff_columns.cjs` (agrega columnas de pausa al lead)
3. `05_reset_demo_data.cjs` (si querés arrancar limpio)
4. `04_e2e_test.cjs` (verifica que TODO funciona end-to-end)

## Mantenimiento periódico

- **Semanal**: `01_backup_workflow.cjs` antes de cualquier edit manual
- **Mensual**: `03_export_all_workflows.cjs` y commit a git para versionar el estado actual del workflow
