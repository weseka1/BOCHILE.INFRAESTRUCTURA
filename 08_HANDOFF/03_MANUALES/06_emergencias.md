# Emergencias: qué hacer si rompe algo

## 🔴 Cami NO le responde a un cliente

### Causas comunes (ordenadas de + a - probable)

**1. El cliente ESTÁ pausado porque alguien respondió como humano antes**
- Esperar 2 horas (la pausa es per-lead, dura 2h)
- O reactivar manualmente: contactar a Yamil para que despause

**2. Se acabó el saldo de OpenAI**
- Verificar en https://platform.openai.com/billing
- Cargar saldo (de la cuenta que ya tenés)
- Cami vuelve sola en 1-2 min

**3. El workflow de n8n está desactivado**
- Entrar a https://weseka.onrender.com → workflow "Bochile - Chatbot Multi-Agente CORE (v5 respond.io)"
- Confirmar que el switch arriba a la derecha está VERDE/ON
- Si está off, activarlo

**4. Algún servicio de Render se cayó**
- Probar: https://bochile-dashboard-api.onrender.com/api/health (debería decir `{"status":"ok"}`)
- Si dice algo distinto: Render → servicio → Manual Deploy
- Si no podés vos, Yamil lo hace en 2 min

**5. respond.io desconectó el WA Business** (raro pero pasa)
- Login a respond.io
- Tab Canales → ver si el "WhatsApp Business (6)" dice "Conectado"
- Si dice "Desconectado": clickear y volver a vincular (escaneo de QR del WA Business)

## 🔴 El dashboard NO carga

1. Refrescar la página (F5)
2. Probar otro navegador / modo incógnito
3. Verificar en https://bochile-dashboard-ui.onrender.com — debería abrir
4. Si la URL devuelve error: Render → servicio "bochile-dashboard-ui" → Manual Deploy → Deploy latest commit
5. Si nada: WhatsApp a Yamil

## 🔴 El Sheet está raro / con datos cambiados

1. NO seguir editando
2. Sheet → File → Version history → See version history
3. Buscar versión anterior al "rompimiento" (timestamp donde estaba bien)
4. Click "Restore this version"
5. Avisar a Yamil

## 🔴 Cami dijo algo MUY mal (alucinó, ofendió, dio info falsa)

1. Sacar captura del chat
2. Mandarmela por WhatsApp con contexto: qué dijo el cliente, qué respondió Cami, qué debió decir
3. Yamil ajusta el "prompt" del bot. Generalmente en <30 min queda.

> **No la corrijo "en caliente" si te apurás** — el prompt del bot es delicado. Mejor ajustar bien y testear que cambiar sin probar y romper otra cosa.

## 🔴 Visita pendiente que aparece duplicada

1. Dashboard → Visitas → identificar las duplicadas
2. Click en una de las dos → botón "Cancelar"
3. La que queda, "Confirmar" con los datos

## 🔴 Alguien borró una propiedad del catálogo y Cami sigue ofreciéndola

1. Verificar en bochile.com → asegurar que está despublicada
2. Esperar ~10 minutos (la sincronización del catálogo tiene cache)
3. Si Cami sigue ofreciéndola: avisar a Yamil

## 🔴 Workflow de n8n con ejecución en ROJO

1. Entrar al workflow → tab Executions
2. Click en la ejecución roja
3. Sacar captura del error (la pantalla muestra qué nodo falló y por qué)
4. Mandarmela
5. Errores comunes que no son críticos:
   - "Insufficient quota" = cargar saldo OpenAI
   - "TIMEOUT" = problema temporal, esperar 5 min y reintentar
   - "ECONNRESET" = problema de red, generalmente se resuelve solo

## 🔴 Llegan duplicados al cliente (Cami responde 2 veces lo mismo)

Raro. Si pasa:
1. Verificar que NO haya 2 workflows activos en n8n haciendo lo mismo
2. Sacar captura del WA del cliente
3. Avisar a Yamil de urgencia

## 🚨 Sistema caído (CAMI NO RESPONDE A NADIE Y TIENE QUE FUNCIONAR YA)

Plan B manual:
1. Avisar al cliente principal por WhatsApp con tu WA Business: "Hola, te respondo yo Camila/Belén porque el sistema tiene un downtime"
2. Mientras tanto Yamil arregla
3. Generalmente: 5-30 min de downtime máximo

## Contacto soporte

**Yamil Pintos (WSK.IA)**
- WhatsApp: 5492915512515 (tu contacto principal)
- Email: yamilpintos18@gmail.com
- Horario de respuesta: lun-sáb 9-22hs ART
- **Urgencias 24/7 (sistema caído):** WhatsApp directo

Tiempos de respuesta:
- Consultas no urgentes: <12h
- Bugs (cosa concreta no funciona): <4h
- Sistema caído (afecta operación de Bochile): <1h
