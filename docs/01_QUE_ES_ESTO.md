# 01 - ¿Qué es esto?

## En 1 oración

Cami es una vendedora digital de Inmobiliaria Bochile que atiende WhatsApp 24/7 con tono de una corredora argentina experimentada.

## En 5 minutos

Imaginate que tenés una vendedora estrella que:

1. **Está online siempre**: nunca duerme, nunca se va de vacaciones, contesta a los 7 segundos.
2. **Sabe TODO el catálogo de memoria**: 235+ propiedades con precio, ambientes, m², zona, fotos. Si el cliente pregunta por un departamento en el Centro hasta 80mil USD, Cami le tira las 5 mejores opciones reales.
3. **Reconoce propiedades por foto**: si el cliente le manda una foto de una cocina, Cami dice "ah, esa es la cocina de la casa de San Martín 566". Sin que el cliente diga la dirección.
4. **Agenda visitas inteligente**: sabe qué día es hoy, qué feriados vienen, qué vendedores están de vacaciones, qué slots ya están ocupados. Nunca propone un horario imposible.
5. **Se calla cuando vos hablás**: si vos contestás al cliente desde respond.io, Cami se pausa 24h sola. Vuelve al día siguiente automático.
6. **Cierra cordialmente**: si el cliente dice "ok gracias chau", Cami se despide en una línea y deja de molestar.
7. **Te avisa en momentos clave**: cuando una visita se agenda, Cami te manda un WhatsApp con todos los datos para que vayas preparado.

## ¿Cómo se conecta todo?

3 piezas:

1. **El cerebro** (n8n + RAG): donde vive Cami. Procesa cada mensaje entrante, decide qué responder, escribe en la base.
2. **La libreta** (Google Sheet): cada lead, conversación, visita, propiedad, vendedor queda guardado acá. Es la fuente de verdad.
3. **La pantalla** (Dashboard web): vista bonita y rápida de TODO lo que está pasando. Para que vos puedas mirar sin abrir el Sheet ni el n8n.

```
WhatsApp ──► respond.io ──► n8n (Cami) ──► Google Sheet ──► Dashboard
                                ▲                              ▲
                                │                              │
                                └── RAG (búsquedas) ──Qdrant   │
                                                               │
                              Vos mirás todo desde acá ────────┘
```

## ¿Qué NO hace Cami?

- **NO inventa propiedades**. Solo recomienda lo que está en el catálogo.
- **NO presiona al cliente**. Si dice "después veo", Cami acepta y no insiste.
- **NO maneja pagos**. Eso lo seguís haciendo vos manual o por mercadopago.
- **NO redacta contratos**. Eso lo haces vos / el escribano.
- **NO atiende llamadas telefónicas**. Solo WhatsApp escrito + audio + imagen.

## ¿Qué pasa si Cami se equivoca?

Pasa, pero poco. Cuando pasa:

1. Vos respondés al cliente desde respond.io (correctivo). Cami se pausa 24h sola.
2. Al día siguiente Cami vuelve. Si vos no querés que vuelva, en el Sheet poné `bot_pausado_hasta` con una fecha futura.
3. Si querés revisar qué pasó, andá al dashboard → pestaña Conversaciones → buscás el teléfono → ves todo el ida y vuelta.

## ¿Por dónde sigo leyendo?

- **Quiero usarlo día a día** → [`03_COMO_SE_OPERA.md`](03_COMO_SE_OPERA.md)
- **Quiero entender qué hay adentro** → [`05_ARQUITECTURA_DETALLE.md`](05_ARQUITECTURA_DETALLE.md)
- **Algo se rompió** → [`04_QUE_PASA_SI.md`](04_QUE_PASA_SI.md)
- **Necesito un contacto / credencial** → [`06_CONTACTOS_Y_CUENTAS.md`](06_CONTACTOS_Y_CUENTAS.md)
