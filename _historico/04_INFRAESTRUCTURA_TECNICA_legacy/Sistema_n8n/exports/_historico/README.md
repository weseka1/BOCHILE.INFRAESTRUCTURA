# Histórico de scripts del Sistema n8n

Scripts python que se usaron para construir el sistema entre el 29 abril y el 16 may 2026. **Ya no se ejecutan** — los workflows finales están definidos en los `.json` snapshots de la carpeta padre (`W1-W5_*.json`).

Se conservan acá como auditoría de cómo se llegó al estado actual. Si necesitás recrear el sistema desde cero, mejor usar los `.json` directamente.

## Lo que NO es histórico (queda en la carpeta padre)

- `W1_Chatbot_Multi_Agente_CORE.json` — snapshot del W1 actual
- `W2_Recordatorios_Visitas.json` — W2
- `W3_Match_Retroactivo.json` — W3
- `W4_Cobranza_Alquileres.json` — W4
- `W5_Sync_Dashboard_GSheets.json` — W5 (el viejo, reemplazado por backup mensual en n8n local; queda como referencia)
- `_seed_all.py` — seed inicial de las 8 data tables (legacy SQLite, ya no se usa pero está documentado)
- `_refactor_w1_sheet_only.py` — refactor que llevó a la arquitectura Sheet-as-DB actual
- `_refactor_w234_sheet_only.py` — mismo para W2/W3/W4
- `_w5_backup_mensual.py` — script que generó la versión W5 final (backup mensual)

## Scripts movidos acá (orden cronológico aproximado)

| Script | Para qué |
|---|---|
| `_seed.py` | Seed inicial de propiedades (pre-_seed_all.py) |
| `_upload.py`, `_upload_all.py` | Upload de workflows vía API n8n |
| `_fix_w1.py`, `_fix_w1_v3_multimodal.py` | Iteraciones del W1 durante auditoría del 12 may |
| `_fix_w1_expressions.py` | Fix de expresiones de n8n en W1 |
| `_w1_v4_twilio.py` | Migración del W1 de Meta a Twilio |
| `_w1_sync_to_sheet.py`, `_w1_sync_ai_tools.py` | Migración del W1 a leer del Sheet |
| `_fix_columns.py`, `_fix_calificador.py`, `_fix_parser_ar.py`, `_fix_parser_final.py`, `_fix_parser_keep9.py`, `_fix_core_agendar.py`, `_fix_vendor_phone_test.py`, `_fix_batch_and_vendor_phone.py`, `_fix_buffer_ops.py`, `_fix_coherence_w2_w3_w4.py` | Fixes incrementales durante testing |
| `_fix_w5_dashboard.py`, `_fix_w5_columns.py`, `_fix_w5_columns_v2.py` | Iteraciones del W5 antes de pasar a backup mensual |
| `_sync_w2_w3_w4.py` | Sync inicial de W2/W3/W4 al Sheet |
| `_limpieza_sheet.py` | Script ad-hoc de limpieza (reemplazado por `05_DASHBOARD_WEB/backend/src/tools/dedupe-sheet.ts`) |
| `_migrate_to_render.py` | Borrador de migración a Render (fase 2 post-firma) |

## Si necesitás algo de acá

Lo más probable es que estés debuggeando algo específico. Mirá primero el `.json` del workflow actual en la carpeta padre — ahí está la verdad operativa. Estos scripts son historia, no contrato.
