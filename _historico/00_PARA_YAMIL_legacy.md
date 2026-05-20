# Bochile · FYI para Yamil

Yamil, te paso esta página corta para que estés al tanto del laburo en Bochile. Si necesitás más detalle técnico está todo en `08_HANDOFF/`, pero con esta página alcanza para saber qué construimos, qué cuesta, y qué te puede tocar a vos.

---

## Qué construimos

Un sistema completo de captación + atención + gestión para Inmobiliaria Bochile. La cara visible es **Camila Pomerich**, una vendedora digital hecha con IA que atiende WhatsApp 24/7. Camila:

- Saluda al cliente, lo califica (entiende presupuesto, zona, urgencia).
- Le ofrece propiedades del catálogo real de Bochile.
- Agenda visitas con el equipo real.
- Hace cobranza automática de alquileres.
- Cruza propiedades nuevas con leads que quedaron esperando algo similar.

Detrás hay 3 capas: el cerebro (n8n con 6 workflows + 4 agentes IA), la libreta (Google Sheet con todos los datos), y la pantalla de control (dashboard web).

## Qué nos costó construir

3 semanas de laburo de Juani (desde fines de abril). 5 workflows iniciales, refactor a sheet-only mid-sprint, dashboard web full stack, integración con la web pre-existente de Bochile vía scraping, validación end-to-end.

## Qué cuesta operarlo cada mes

- **Hoy (piloto)**: USD 10-25/mes. Casi todo OpenAI. Twilio Sandbox es gratis, hosting es localhost, Google es gratis.
- **Producción real (post-firma)**: USD 50-80/mes. Sumás Twilio número WhatsApp Business pago + hosting de n8n en Render.

## Qué te puede tocar a vos

Casi nada técnico. La operación la maneja Juani. Cosas que SÍ podrían pedirte:

1. **Cargar saldo en OpenAI** cuando se agote. Es ir a platform.openai.com con la cuenta WESEKA y pagar tarjeta. USD 20-30 alcanza para semanas.
2. **Aprobar el upgrade de Twilio** cuando salgamos del sandbox. ~USD 15/mes + aprobación de Meta (3 días) para el número WhatsApp Business propio.
3. **Cerrar comercial con Bochile** cuando firmen. Tu rol comercial pega más fuerte ahí.
4. **Si algo serio se cae y Juani no está disponible**: pausar el bot (en n8n local → workflow W1 → toggle off) y avisar al cliente. Detalles en `08_HANDOFF/04_QUE_PASA_SI.md`.

## Estado al 15 may 2026

- Sistema funcionando, validado end-to-end anoche.
- Entrega producción al cliente: **lunes 18 may 2026**.
- WhatsApp queda en sandbox Twilio para la entrega (atiende a testers, no clientes reales todavía). Upgrade a producción real es la semana siguiente.
- n8n corre en localhost de Juani con ngrok. Para 24/7 sin depender de su PC: migración a Render planificada como fase 2 post-firma.

## Si querés profundizar

Carpeta `08_HANDOFF/`:
- `01_QUE_ES_ESTO.md` — qué es Camila y cómo funciona el sistema (5 min).
- `05_ARQUITECTURA.md` — decisiones técnicas con trade-offs (15 min).
- `06_CONTACTOS_Y_CUENTAS.md` — URLs, costos, accesos.

## Si pasa algo y necesitás reaccionar

Hablale a Juani primero. Si Juani no responde y el sistema está caído:
1. Avisale a Bochile que Camila está en mantenimiento.
2. El equipo real de Bochile atiende WhatsApp a mano por unas horas.
3. Cuando Juani vuelve, levanta todo en 5 min.

---

Cualquier cosa, hablamos. — Juani
