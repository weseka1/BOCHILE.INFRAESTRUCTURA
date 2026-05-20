# Tests E2E del sistema Camila

Dos formas de validar que el sistema funciona end-to-end:

## 1. Test programático (webhook directo)

Pega directo al webhook del W1 con un payload simulado, sin pasar por Twilio. Útil para CI/CD y para verificar después de cambios al W1.

```bash
cd 04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/tests
bash e2e-webhook.sh
```

Manda 5 mensajes distintos (casa Bahía Blanca, alquiler depto, Monte Hermoso, lote Av Colón, propiedad comercial) y verifica que cada uno llegue a la pestaña `conversaciones` del Sheet en menos de 30 segundos.

Exit code = cantidad de fallos. `0` = todo pasó.

## 2. Test real (vía Twilio Sandbox)

Esta es la prueba "del cliente real" — mandás un WhatsApp y ves la respuesta como va a verlo Bochile.

### Setup una vez por teléfono testeador

1. Desde tu WhatsApp (cualquier número), mandá un mensaje al **+1 415 523 8886**.
2. El mensaje tiene que ser exactamente `join <código>` — el código está en Twilio Console → Messaging → Try it out → Send a WhatsApp message → Sandbox. Algo tipo `join brave-elephant`.
3. Twilio te responde "Sandbox: You are all set!".

> Cada participante tiene que repetir esto **cada 3 días** o cuando renueve la suscripción.

### Casos de prueba sugeridos

| # | Mensaje al sandbox | Qué validar |
|---|---|---|
| A | "Hola, soy interesado en una casa en Bahía Blanca" | Camila saluda, pregunta por presupuesto/zona/ambientes |
| B | "Busco casa 3 amb hasta 200 mil USD" | Calificador score ≥ 70, Matcher devuelve 1-3 props o "no hay" honesto |
| C | (audio diciendo "tenes algo en Monte Hermoso?") | Whisper transcribe, Camila responde a partir del audio |
| D | (foto de una casa cualquiera) | GPT-4o Vision describe la imagen y Camila reacciona |
| E | "Quiero agendar visita a la propiedad de Cuyo 1265" | Admin agenda visita, notifica vendedora real |
| F | "Quiero pausar, vuelvo mañana" | Camila cierra cortés y deja la puerta abierta |

### Qué verificar después de cada prueba

1. **Mi WhatsApp recibe la respuesta** de Camila en < 30s.
2. **Dashboard → Leads** muestra el lead (con mi tel) con score/etapa actualizados.
3. **Dashboard → Conversaciones** muestra los mensajes in/out con timestamp correcto.
4. **Dashboard → Acciones IA** registra al menos `conversacion_atendida`.
5. (Si pediste agendar) **Dashboard → Visitas** muestra la nueva visita y la vendedora real recibió WhatsApp de aviso.

### Si algo falla

- Abrir n8n local → Executions del W1 → ver el último → identificar nodo rojo.
- Logs típicos: OpenAI timeout (reintentar), Twilio 401 (token), Sheets quota (esperar 1 min).
- Receta nuclear: `04_INFRAESTRUCTURA_TECNICA/../08_HANDOFF/04_QUE_PASA_SI.md`.

## Cobertura actual

Última corrida exitosa: ejecución 2771 (2026-05-15 00:00:14) — flujo completo de 20 nodos, lead `L-2915512515` creado, conversaciones actualizadas, Camila respondió coherente.

Después de cargar el catálogo nuevo (16 may, 239 propiedades reales scrapeadas de bochile.com), Camila responde con info del catálogo real:
- Pregunta "casa Palihue 300k USD" → responde honestamente "no tengo en Palihue dentro del presupuesto" (correcto: el catálogo solo tiene 1 listing con Palihue y es Consulte precio).
