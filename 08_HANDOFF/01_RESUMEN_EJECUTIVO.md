# Resumen Ejecutivo — Bochile Inmobiliaria × WSK.IA

## Qué construimos

Un sistema que combina:

1. **Cami** — una vendedora con IA que atiende a tus clientes 24/7 por WhatsApp como si fuera una persona real del equipo.
2. **Un dashboard web** que te muestra todo lo que está pasando: clientes nuevos, visitas a coordinar, mensajes, tareas, propiedades.
3. **Integración con tu WhatsApp Business existente** — no necesitás cambiar de número ni de app, todo se conecta atrás.

## Para qué sirve

- **Nunca más perder un lead** porque "no llegamos a contestar a tiempo". Cami responde en segundos, día y noche.
- **Identificar propiedades al instante** cuando un cliente pega un link de Bahía Blanca Propiedades o Argenprop, o manda una foto.
- **Coordinación de visitas centralizada** — todo lo que pide visita queda en una sola lista, vos confirmás cuando podés.
- **Sin perder conversaciones** — todo queda logueado para que puedas volver a leer cualquier chat de hace 3 meses.
- **Sin que Cami pise tu trabajo** — cuando vos respondés a un cliente desde tu celu, Cami se calla solita en ese chat por 2h.

## Lo que viene incluido (entregado hoy)

- ✅ Cami operativa en producción (canal de WhatsApp ya conectado)
- ✅ Dashboard web con 7 secciones (Inicio, Clientes, Propiedades, Visitas, Mensajes, Equipo, Tareas)
- ✅ Detector automático de visitas (cuando vos confirmás algo por WhatsApp, se carga sola al dashboard)
- ✅ Lectura inteligente de links de portales inmobiliarios (BB Propiedades, Argenprop, Zonaprop, IG, etc.)
- ✅ Manual operativo completo (este paquete)
- ✅ Catálogo de propiedades sincronizado con bochile.com
- ✅ Soporte post-entrega: **30 días incluidos** (ver [05_SOPORTE.md](05_SOPORTE.md))

## Reglas no negociables del sistema (entender estas 4 cosas evita el 80% de los problemas)

| Regla | Por qué |
|---|---|
| Cami **NUNCA agenda visitas**, solo registra el interés | Las visitas las coordinás vos (por eso aparecen en el dashboard como "pendientes") |
| Cami **NUNCA habla de financiación/créditos** | Eso lo manejás vos. Cami deriva esos clientes a tu mano |
| Si vos respondés desde tu WA, Cami se **pausa 2h en ese chat** | Para no pisar lo que vos estás haciendo |
| Las propiedades vienen del catálogo de **bochile.com** | Lo que publicás ahí, Cami lo conoce automáticamente |

## Lo que necesitamos de vos para que funcione bien

1. **Cargar los datos vacíos del catálogo** — algunas propiedades tienen el campo "baños" vacío. Si lo llenan, Cami da info más completa.
2. **Mirar el dashboard al menos 1x/día** — sobre todo el tab "Visitas Pendientes" para confirmar las que vienen.
3. **Cuando intervengan manualmente en un chat, hacerlo desde el WhatsApp Business app del celu** (no desde respond.io UI) — así el handoff funciona.
4. **Mantener cargado el saldo de OpenAI** (esa cuenta usa Cami para razonar). Si se acaba, Cami deja de responder.

## Costos operativos mensuales (referencia, no incluyen WSK)

| Servicio | Estimado USD/mes |
|---|---|
| OpenAI (Cami) | $50-200 según volumen |
| Render (hosting) | $7-25 (3 servicios en plan Starter) |
| respond.io | según tu plan actual |
| Total infra | ~$60-230/mes |

## Soporte

- **Incluido hasta:** 01 de julio 2026 (30 días)
- **Después:** plan mensual o por hora (ver [05_SOPORTE.md](05_SOPORTE.md))
- **Contacto:** Yamil Pintos — WhatsApp

## Resultados esperados (a evaluar en 30-60 días)

| KPI | Antes (estimado) | Meta a 30 días |
|---|---|---|
| Tiempo de primer contacto | 2-12h | <30 segundos |
| Leads sin responder | ~30% | <5% |
| Visitas pendientes con seguimiento | manual, frágil | 100% trackeable en dashboard |
| Chat de calidad | depende del que conteste | estándar Cami + handoff humano |

> Si después de 30 días no se ven mejoras claras en esos KPIs, hablamos y ajustamos. La idea es que Bochile vea ROI claro.
