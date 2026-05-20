# 01 · Qué es esto

Sistema operativo de Inmobiliaria Bochile. Construido por WESEKA.IA. Entrega 18 may 2026.

## Una vendedora digital, no un bot

El sistema es **Camila Pomerich**. Atiende WhatsApp 24/7 como una vendedora más del equipo. No es un menú de opciones ni un chatbot de FAQs: conversa, entiende contexto, busca propiedades del catálogo real, agenda visitas, escala a humano cuando hace falta.

## Las 3 capas

```
   Cliente manda WhatsApp
              │
              ▼
   CEREBRO · n8n local (Docker)
   6 workflows · 4 agentes IA
              │
              ▼
   LIBRETA · Google Sheet
   "Bochile · Sistema Operativo"
              │
              ▼
   PANTALLA · Dashboard web
   http://localhost:5173
```

### Cerebro · n8n

n8n es una plataforma de automatizaciones. Cada workflow es una secuencia que se ejecuta ante un evento. Tenemos 6:

| Workflow | Trigger | Función |
|---|---|---|
| W1 — Chatbot Multi-Agente | Webhook Twilio | Procesa cada WhatsApp y responde |
| W2 — Recordatorios | Cron horario | Avisa 24h y 1h antes de cada visita |
| W3 — Match Retroactivo | Cron 15 min | Cruza props nuevas con leads en espera |
| W4 — Cobranza Alquileres | Cron diario 9am | Recordatorios de pago + escalado |
| W5 — Backup Mensual | Cron mensual 03h | Duplica Sheet a Drive + reset transaccional |
| W6 — Sync Catálogo Web | Cron 2h | Scrapea web de Bochile y actualiza propiedades |

Dentro del W1 viven 4 agentes IA:
- **Vendedor CORE (Camila)** — gpt-4o, orquesta y única voz al cliente.
- **Calificador** — gpt-4o-mini, devuelve score 0-100 + datos estructurados.
- **Matcher** — gpt-4o-mini, busca propiedades en el catálogo.
- **Administrativo** — gpt-4o-mini, agenda visitas, notifica vendedores, actualiza CRM.

### Libreta · Google Sheet

Una sola fuente de verdad para el negocio: un Sheet con 8 pestañas.

| Pestaña | Qué contiene |
|---|---|
| `leads` | Clientes captados |
| `propiedades` | Catálogo (lo alimenta el scraper W6) |
| `visitas` | Agenda |
| `contratos` | Alquileres activos |
| `empleados` | Equipo |
| `matches_pendientes` | Leads esperando que aparezca su propiedad |
| `conversaciones` | Log de cada mensaje |
| `acciones_ia` | Log de qué hizo cada agente |

**Por qué Sheet y no DB tradicional**: para que el cliente pueda ver y editar todo sin saber programar. Decisión clave del proyecto.

### Pantalla · Dashboard web

Frontend React (puerto 5173) que lee del Sheet vía un backend Node (puerto 3001) con Service Account. 8 páginas: Dashboard ejecutivo, Leads, Propiedades, Visitas, Contratos, Conversaciones, Acciones IA, Empleados.

## Qué hace que esto sea distinto a un chatbot común

1. **4 cerebros en lugar de uno.** Un único prompt gigante "calificar + buscar + agendar" se confunde y aluciha. La orquestación con sub-agentes lo evita.
2. **Multimodal.** Texto, audio (Whisper) e imagen (GPT-4o Vision) entran al mismo flow.
3. **Memoria por cliente.** Camila recuerda los últimos 20 mensajes de cada teléfono. Si volvés a escribirle dos semanas después, retoma desde donde dejaron.
4. **El Sheet manda.** Editás a mano, el dashboard se actualiza. Pausás un workflow, el bot para. Cero dependencia técnica.

## Para profundizar

- **Arquitectura completa con decisiones técnicas**: `05_ARQUITECTURA.md`
- **Cómo se prende todo**: `02_COMO_PRENDE.md`
- **Uso diario**: `03_COMO_SE_OPERA.md`
- **Troubleshooting**: `04_QUE_PASA_SI.md`
