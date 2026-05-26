# 🚨 RUNBOOK PRODUCCIÓN — Cami (Bochile)
**Última actualización:** 2026-05-21 | **Owner:** Juani / Yamil

Este documento es la guía operativa de producción. Lo lees cuando algo no anda, cuando hay
que escalar, o cuando hay que onboardear a alguien nuevo.

---

## 🟢 ARQUITECTURA EN UNA HOJA

```
WhatsApp (cliente real)
    ↓
respond.io (gateway oficial WA Business)
    ↓ webhook POST /webhook/bochile-chat
n8n Render (weseka.onrender.com) ──► 7 workflows activos
    │
    ├──► OpenAI API (gpt-4o + gpt-4o-mini fallback)
    ├──► RAG Service (rag-bochile.onrender.com) ──► Qdrant Cloud (1839 vectors)
    └──► Google Sheets (1YChe5K...) ◄── Dashboard Web (apps/dashboard-ui)
```

---

## 📋 CUENTAS Y PAGOS QUE NUNCA SE PUEDEN CAER

| Servicio | Plan | Costo/mes | Auto-recharge | Dashboard |
|---|---|---|---|---|
| **Render n8n** | Standard 2GB | USD 25 | (Render no soporta — alerta) | render.com/dashboard |
| **Render RAG** | Starter | USD 7 | (incluido en el USD 7) | render.com/dashboard |
| **OpenAI** | Pay-as-you-go | ~USD 150-210 | **OBLIGATORIO ✅** | platform.openai.com/billing |
| **Qdrant Cloud** | Free 1GB | USD 0 | N/A | cloud.qdrant.io |
| **respond.io** | (plan actual) | (verificar) | revisar | app.respond.io |
| **Google Workspace** | (cuenta cliente) | (verificar) | N/A | console.cloud.google.com |

### 🔋 OpenAI billing — CRÍTICO
URL: <https://platform.openai.com/settings/organization/billing/overview>
- Auto-recharge: **threshold USD 10 → recargar USD 30**
- Si esto falla, Cami DEJA DE RESPONDER en minutos.
- El sistema tiene fallback gpt-4o → gpt-4o-mini pero ambos comparten quota.

---

## 🆘 INCIDENTES MÁS COMUNES Y SU FIX

### 1. Cami no responde a un cliente
**Diagnóstico (en orden):**

```bash
# 1. Verificar último execution
https://weseka.onrender.com/workflow/TEdlfSBCc5ENVslp/executions

# 2. Si está rojo → click → ver el nodo que falló
# 3. Si dice "Insufficient quota" → recargar OpenAI billing
# 4. Si dice "ECONNREFUSED rag-bochile.onrender.com" → RAG dormido, esperar 30s
# 5. Si dice "Sheet API rate limit" → esperar 60s y reintentar
```

**Si nada de eso → escalada a humano (Camila Pomerich):**
- Pausar el bot manualmente en n8n (deactivate workflow CORE)
- Avisar a Camila: el cliente llamó y no fue atendido

### 2. Dashboard no muestra datos / muestra desactualizados
- Cache de 30s en el backend. Esperar 30s y refrescar (F5)
- Si persiste 5 min → reiniciar backend: `cd apps/dashboard-api && npm run dev`

### 3. Matcher devuelve "SIN_STOCK" cuando hay propiedades
- Verificar Qdrant Cloud: <https://cloud.qdrant.io/>
- Si la colección `bochile_properties` está vacía → re-correr scraper:
  ```
  cd apps/scraper && npm run scrape && npm run embed
  ```

### 4. Un mensaje WhatsApp llegó, pero Cami NO respondió Y NO hay error en n8n
- Verificar que respond.io tenga el webhook activo
- Verificar el sandbox de Twilio si está usando ese canal
- Ver logs de respond.io: app.respond.io → Logs

### 5. OpenAI quota agotada
1. <https://platform.openai.com/settings/organization/billing/overview>
2. "Add to credit balance" → USD 30
3. Verificar que "Auto recharge" esté ON
4. Sin necesidad de reiniciar nada, Cami arranca sola.

### 6. n8n Render se cae (502 Bad Gateway)
- Render dashboard → manual deploy / restart
- Verificar que el plan siga siendo Standard 2GB (no downgrade)

### 7. Cliente humano respondió manual (handoff)
- El bot detecta `body.sender.source = 'user' | 'agent'` y se pausa 24h automáticamente.
- Para reactivar antes: borrar manualmente el campo `bot_pausado_hasta` en el Sheet
  (pestaña `leads`, columna correspondiente).

---

## 📊 KPIs DE SALUD QUE HAY QUE VIGILAR DIARIO

| Métrica | Donde se ve | Umbral |
|---|---|---|
| Workflows activos | n8n /workflows | **7/7** |
| Executions failed/día | n8n /executions filtro "error" | **<5%** |
| OpenAI credit balance | platform.openai.com/billing | **>USD 10** |
| Render n8n status | render.com/dashboard | **active** |
| RAG health | curl rag-bochile.onrender.com/api/health | **{"status":"ok"}** |
| Leads nuevos/día | dashboard | **trending** |

---

## 🔄 OPERACIONES DE RUTINA

### Actualizar catálogo (scraper)
**Frecuencia:** cuando Bochile suba/baje propiedades (1-2 veces por semana).

**Procedimiento:**
```bash
cd apps/scraper
npm run scrape    # ~10 min: trae las propiedades de bochile.com.ar
npm run embed     # ~10 min: re-embeddea a Qdrant Cloud
```

### Verificar billing semanal
- OpenAI usage: <https://platform.openai.com/usage>
- Render: <https://dashboard.render.com/billing>

### Backup semanal del Sheet
- Auto: workflow W5 corre el día 1 de cada mes 03:00 AM AR
- Manual: ejecutar `scripts/19b_backup_sheet_readonly.cjs`

---

## 🔑 IDS Y URLS (REFERENCIA RÁPIDA)

| Recurso | ID/URL |
|---|---|
| n8n CORE workflow | `TEdlfSBCc5ENVslp` |
| n8n sub-workflow RAG Search | `mKKIYx7pA2Kr7t4L` |
| Sheet ID | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` |
| RAG service | `https://rag-bochile.onrender.com` |
| n8n base | `https://weseka.onrender.com` |
| Webhook entrante | `https://weseka.onrender.com/webhook/bochile-chat` |
| Qdrant Cloud | `https://e68bfd5f-f3d0-4dcd-84e4-b49dc149a088.us-east-1-1.aws.cloud.qdrant.io` |
| Dashboard local frontend | `http://localhost:5175` |
| Dashboard local backend | `http://localhost:3002` |

---

## 🛡️ RESILIENCIA QUE YA ESTÁ ARMADA

- **Fallback model**: si gpt-4o falla, automáticamente cae a gpt-4o-mini (mismo prompt, ~80% calidad, 10x más barato).
- **Retry policy**: 3 intentos con 1.5s entre cada uno en TODOS los nodos HTTP y Sheets críticos.
- **continueOnFail** en nodos de log: si Log Mensaje no puede escribir, NO frena el flujo de respuesta.
- **Sub-workflow RAG**: si el filtro estricto devuelve 0, hace fallback semántico automático.
- **Handoff humano automático**: si vendedor humano responde, bot se pausa 24h.
- **Detección de cierre**: si cliente dice "chau gracias", bot se despide y no insiste.

---

## 📞 CONTACTOS DE ESCALAMIENTO

| Rol | Persona | Cuándo llamar |
|---|---|---|
| Owner técnico | Juani | Bug grave / infraestructura caída |
| Owner administrativo | Yamil | Cliente quejándose / operación |
| Vendedora humana Bochile | Camila Pomerich (+5492914413200) | Lead urgente que el bot no resolvió |

---

## 📝 CHANGELOG DE ESTA RELEASE (2026-05-21)

- ✅ Fallback model gpt-4o → gpt-4o-mini configurado
- ✅ Retry x3 en 11 nodos HTTP/Sheets críticos
- ✅ Sub-workflow RAG con address detection v5 (strict + blacklist + fallback semántico)
- ✅ Re-ranking por número exacto cuando hay dirección (Sarmiento 343 → score 2.21)
- ✅ Parser v10 captura caption de imagen (attachment.description)
- ✅ Vision LLM extrae texto visible OCR-like (TIPO/TEXTO_VISIBLE/DESCRIPCION/DIRECCION_DETECTADA)
- ✅ CORE: extracción estructurada de TODOS los datos del lead (operacion, presupuesto, urgencia, etc.)
- ✅ Lead_id real inyectado vía text field
- ✅ Upsert Lead CRM lee del Merge Caminos (fix fila vacía)
- ✅ Log Mensaje Entrante: 13 columnas completas
- ✅ Header conversaciones corregido (estaba clonado de leads)
- ✅ SubAgente Administrativo: revertido systemMessage (era incompatible)
- ✅ Timezone America/Argentina/Buenos_Aires en los 7 workflows
- ✅ executions purga: 84 ejecuciones viejas eliminadas
- ✅ Backup Sheet pre-deploy en `scripts/_sheet_backups/`
