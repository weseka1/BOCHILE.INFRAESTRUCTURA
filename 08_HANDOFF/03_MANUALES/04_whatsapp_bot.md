# Manual: Cami (el bot de WhatsApp)

## Qué hace Cami

Cami es una vendedora con IA que atiende clientes 24/7 por WhatsApp. Habla como una persona real (en español argentino, sin formalismos), conoce el catálogo de Bochile, y sabe cuándo derivar al humano.

## Capacidades

### ✅ Lo que hace sola (sin intervención humana)

| Capacidad | Cómo funciona |
|---|---|
| **Saludar y conversar** | Como una vendedora normal: "hola, cómo andás" |
| **Recibir consultas de búsqueda** | "busco depto 2 dormitorios en centro hasta 100k" |
| **Mostrar propiedades del catálogo** | Texto + URL → WhatsApp arma preview card |
| **Entender audios** | Whisper transcribe + Cami responde |
| **Identificar imágenes** | Foto de una propiedad → busca en catálogo + responde |
| **Leer links de portales** | BB Propiedades / Argenprop / Zonaprop / IG / FB → identifica la prop |
| **Cruzar con catálogo** | Si la prop del link está en Bochile, lo confirma con datos reales |
| **Registrar interés de visita** | Crea "visita pendiente" en el dashboard |
| **Detectar visita confirmada por humano** | Cuando vos respondés "te paso el viernes 10am", lo carga solo |

### 🚫 Lo que NO hace — siempre deriva a vos

| Caso | Qué dice Cami |
|---|---|
| Cliente pide visita | "Le aviso a Camila, te va a contactar para coordinar fecha y hora" |
| Cliente pregunta financiación / créditos / cuotas | "Esos detalles los maneja Camila, le aviso para que te asesore" |
| Cliente pide descuento / negociación | "Ese tipo de oferta la conversás con Camila, le paso tu interés" |

## Cómo intervenir cuando quieras tomar un chat vos

**Simple:** respondé al cliente desde **tu WhatsApp Business** (app del celular).

Cami detecta automáticamente que vos respondiste y se silencia en ese chat **por 2 horas**. Pasadas las 2h, si el cliente sigue escribiendo, Cami vuelve a responder.

> Eso es per-cliente. Otros clientes siguen siendo atendidos por Cami normalmente.

## Cuándo NO usar el WhatsApp Business app (y usar respond.io en su lugar)

- Respond.io tiene la ventaja de que ves todos los chats en una pantalla web
- Si tenés más vendedores que también responden, cada uno puede operar desde respond.io con su propio user

Si respondés desde respond.io, también dispara el handoff (cami se pausa). Es indistinto.

## Cuándo NO interrumpe Cami (casos esperados)

- Lead nuevo escribió y Cami está procesando → vos NO recibís notificación, está bien
- Cliente mandó un audio largo → Cami tarda ~15-25s (Whisper + LLM + envío)
- Cliente mandó imagen → Cami tarda ~20-30s (Vision + matching + LLM)

Si pasaron >40 segundos y Cami no respondió, ahí sí preguntar.

## Personalidad de Cami (configurada en el prompt)

- Voseo argentino natural ("tenes", "queres", "decis", "dale")
- NUNCA usa signos de apertura (¿/¡) — escribe como WhatsApp argentino
- Máximo 1 emoji por respuesta completa
- Maneja jerga local de Bahía Blanca (microcentro, Palihue, "la olla", etc.)
- NO clasifica barrios por su cuenta — usa lo que viene del catálogo

## Reglas duras del bot

1. **JAMÁS inventa datos.** Si el catálogo no tiene "baños" para una prop, NO los menciona.
2. **JAMÁS dice "ambientes"** al cliente — siempre convierte a dormitorios + baños + m².
3. **JAMÁS agenda visitas** — siempre deriva a vos.
4. **Auto-corrección:** si el cliente te corrige ("no es esa, es Alem 127"), pide perdón y avanza, NO insiste.

## Costos operativos de Cami

- Cada mensaje que Cami procesa cuesta ~$0.002-0.01 USD (depende del modelo y largo)
- Promedio mensual estimado: $50-200 USD según volumen
- Saldo en: **https://platform.openai.com/billing**
- **Si se acaba el saldo, Cami DEJA DE RESPONDER** — mantenelo cargado.

## Cambiar el comportamiento de Cami

Si querés que Cami diga X de forma distinta, o agregar una regla nueva (ej: "los domingos no agenda nada"), hablás con Yamil. Se hace editando el "prompt" del bot. Tarda 10-15 min y queda permanente.
