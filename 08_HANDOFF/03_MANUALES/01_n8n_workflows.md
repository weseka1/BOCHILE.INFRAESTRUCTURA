# Manual: n8n — el "cerebro" del sistema

## ¿Qué es n8n?

Es una plataforma de automatización donde vive **el cerebro de Cami**. Cuando un cliente te escribe, el mensaje pasa por n8n antes de llegar a Cami, y la respuesta de Cami vuelve por ahí antes de salir al cliente.

**No necesitás abrir n8n para el día a día.** Solo si algo se rompe o querés ver por qué Cami contestó X cosa.

## Acceso

- URL: **https://weseka.onrender.com**
- Usuario / Contraseña: ver [04_CREDENCIALES_TRANSFERIDAS.md](../04_CREDENCIALES_TRANSFERIDAS.md)

## El workflow principal

| Workflow | Qué hace |
|---|---|
| **Bochile - Chatbot Multi-Agente CORE (v5 respond.io)** | El único workflow productivo. Procesa CADA mensaje que entra/sale del WA, decide si Cami responde, y maneja todo el resto. |

Está activo siempre (toggle verde arriba a la derecha cuando lo abrís).

## Lo que pasa cuando entra un mensaje (resumido)

```
Cliente escribe al WA Bochile
      ↓
respond.io recibe el mensaje
      ↓
Webhook → n8n recibe
      ↓
n8n procesa con varios pasos:
  - Parsear mensaje
  - Si tiene imagen: identificar la propiedad (Vision)
  - Si tiene audio: transcribir (Whisper)
  - Si tiene URL: leer el aviso y cruzar con catálogo
  - Cami razona (Vendedor CORE)
  - Sanitiza el output (saca formalismos)
  - Envía respuesta de vuelta por respond.io
      ↓
Cliente recibe la respuesta
```

Todo eso pasa en 10-25 segundos por mensaje.

## Ver si los mensajes están llegando bien

1. Entrar a n8n → workflow "Bochile - Chatbot Multi-Agente CORE (v5 respond.io)"
2. Tab **"Executions"** (icono reloj arriba)
3. Lista de ejecuciones:
   - ✅ Verde = procesado bien
   - ❌ Rojo = hubo un error → click para ver detalles

## ¿Cuántas ejecuciones es "normal"?

Depende del volumen del día. Una mañana activa puede tener 100-200 ejecuciones. Por las noches, casi nada. Todas deberían ser verdes.

## Lo que NUNCA hay que hacer en n8n

- ❌ Modificar workflows sin avisar a WSK — un error chico rompe todo el sistema
- ❌ Desactivar el workflow (toggle off) — Cami deja de responder a todos
- ❌ Borrar ejecuciones del histórico — perdemos info de debug
- ❌ Cambiar las credenciales (OpenAI account, Google Sheets account)

Si necesitás hacer algo de eso, escribime.

## Pausas controladas

Si por algún motivo querés que Cami NO responda por un rato (ej: feriado, evento, alguien está respondiendo manual), hay 2 opciones:

**Opción A — Pausar Cami para UN cliente específico:** vos respondéle desde tu WhatsApp Business. Cami detecta tu respuesta y se pausa SOLA en ese chat por 2 horas.

**Opción B — Pausar Cami completamente:** entrar a n8n, abrir el workflow, click en el switch verde de arriba a la derecha para desactivar. **OJO:** así no responde a NADIE hasta que lo vuelvas a activar.

> La opción A es la recomendada para el día a día. La B solo en emergencias.
