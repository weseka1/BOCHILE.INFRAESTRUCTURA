# workflows/

Los 7 workflows de n8n exportados a JSON, listos para importar en el n8n de Render.

## Orden de import OBLIGATORIO

n8n necesita que el sub-workflow exista ANTES que el workflow principal que lo referencia. Por eso el nombre con prefijo numérico:

| # | Archivo | Tipo | Función |
|---|---|---|---|
| 01 | `01_SUB_Bochile_RAG_Search.json` | Sub-workflow | Recibe criterios, llama al RAG, devuelve formato. Referenciado por W1. |
| 02 | `02_W1_CORE_Multi_Agente.json` | **Principal** | El chatbot Cami completo (50 nodos, 106 KB). Maneja todo el flujo de WhatsApp. |
| 03 | `03_W2_Recordatorios_Visitas.json` | Cron horario | Manda recordatorios 24h y 1h antes de cada visita. |
| 04 | `04_W3_Match_Retroactivo.json` | Cron 15min | Detecta leads sin match y prueba contra propiedades nuevas. |
| 05 | `05_W4_Cobranza_Alquileres.json` | Cron diario 9am | Recordatorios de alquileres vencidos. |
| 06 | `06_W5_Backup_Mensual.json` | Cron mensual día 1 | Snapshot del Sheet a Google Drive. |
| 07 | `07_W7_Reactivar_Bot_Pausado.json` | Cron horario | Limpia `bot_pausado_hasta` de leads con timestamp vencido. |

## Cómo importar (en n8n de Render)

1. Login en `https://bochile-n8n.onrender.com`
2. Menú principal → **+ Add workflow**
3. En el editor del workflow nuevo: menú **...** arriba derecha → **Import from File**
4. Seleccionar el JSON correspondiente, en orden 01 → 07

## Después de importar cada workflow

n8n marca en amarillo los nodos que tienen credenciales sin asignar. Para cada uno:

1. Click sobre el nodo amarillo
2. En el panel, dropdown "Credential" → seleccionar la credencial correspondiente (creada en Settings → Credentials)
3. **Save**

## Cambios manuales requeridos post-import

Hay URLs hardcoded de localhost que hay que ajustar a Render:

### En `02_W1_CORE_Multi_Agente`:

| Nodo | Buscar | Reemplazar |
|---|---|---|
| Parsear Mensaje | `http://host.docker.internal:3003/api/buffer/` | `https://bochile-rag.onrender.com/api/buffer/` |
| Buscar Por Imagen (HTTP) | URL: `http://host.docker.internal:3003/api/search-by-image` | `https://bochile-rag.onrender.com/api/search-by-image` |

### En `01_SUB_Bochile_RAG_Search`:

| Nodo | Buscar | Reemplazar |
|---|---|---|
| Call RAG and Format (Code) | `const RAG_URL = 'http://host.docker.internal:3003/api/search';` | `const RAG_URL = 'https://bochile-rag.onrender.com/api/search';` |

## Activar workflows

Después de importar y configurar credenciales, **toggle Active** arriba a la derecha de cada workflow.

Orden de activación recomendado: 01 → 02 → resto. (Si activás el W1 antes que el SUB, el SUB no responde y W1 falla.)

## Backup periódico

El script `../scripts/01_backup_workflow.cjs` exporta el W1 a un JSON con timestamp. Útil correrlo antes de hacer cambios manuales desde el editor (por si rompe algo).

## Restore si algo se rompió

`../scripts/02_restore_workflow.cjs` toma el último backup y lo restaura via API. Tarda 2 segundos.
