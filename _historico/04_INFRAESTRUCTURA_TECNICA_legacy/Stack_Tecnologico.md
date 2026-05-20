# Stack Tecnológico · Bochile

## Diagrama lógico

```
                        ┌──────────────────────────┐
                        │   USUARIO FINAL (lead)   │
                        └────────────┬─────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
        ┌─────▼─────┐         ┌──────▼─────┐         ┌──────▼─────┐
        │ WhatsApp  │         │  Web BB    │         │  ZonaProp  │
        │  Business │         │ (catálogo) │         │ (sindicado)│
        └─────┬─────┘         └──────┬─────┘         └──────┬─────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                          ┌──────────▼──────────┐
                          │   CAMILA (IA)       │
                          │   Anthropic Claude  │
                          │   + Memoria + RAG   │
                          └──────────┬──────────┘
                                     │
        ┌──────────────┬─────────────┼─────────────┬──────────────┐
        │              │             │             │              │
   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │   CRM   │    │ Catálogo│   │ Calendar│   │ Cobranza│   │ Reportes│
   │  Bochile│    │  Props  │   │ Equipo  │   │ MercPago│   │Dashboard│
   └─────────┘    └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

## Componentes

### Front-end

| Componente | Tecnología sugerida | Notas |
|---|---|---|
| Web pública | Next.js 14 + Tailwind | SSR para SEO, ISR para listings |
| Tours 360° | Marzipano / Pannellum | Open source, embebibles |
| Dashboard interno | React + Recharts | El que ya está en el demo |
| CRM UI | Same React app, ruta protegida | Login con Auth0 o magic links |

### Back-end

| Componente | Tecnología | Notas |
|---|---|---|
| API | Node.js + Fastify | Lightweight, fast |
| Base de datos | PostgreSQL | + pgvector para embeddings |
| Cache | Redis | Sesiones IA + listing cache |
| Queue | BullMQ | Tareas asíncronas (envío msgs, etc) |
| Storage | Cloudflare R2 | Imágenes, tours 360°, PDFs |

### IA · Camila

| Capa | Tecnología | Notas |
|---|---|---|
| LLM principal | Anthropic Claude (Sonnet 4.5) | Conversación + razonamiento |
| Memoria conversacional | Redis + summarization | Por conversación + lead |
| Memoria semántica | pgvector + embeddings OpenAI | Catálogo + histórico |
| Function calling | Tools custom | CRM, calendar, cobranza, etc |
| Voice (futuro) | ElevenLabs | Llamadas salientes |

### Integraciones externas

- **WhatsApp Business API** vía Twilio o Meta directo
- **ZonaProp** scraping/sync (no tienen API oficial — feed inmobiliario)
- **Google Calendar API** para los 4 vendedores
- **Mercado Pago** para cobranza alquileres
- **Meta Ads API** para tracking + custom audiences
- **Banco Galicia / Banco Provincia** para simuladores hipotecarios (si necesario)

## Hosting

- **Vercel** — front Next.js
- **Railway / Fly.io** — backend Node + Postgres + Redis
- **Cloudflare** — DNS + R2 storage + CDN

## Costos infraestructura mensual estimados

| Servicio | Costo mensual estimado |
|---|---|
| Vercel Pro | USD 20 |
| Railway (DB + backend) | USD 30-50 |
| Anthropic Claude API | USD 100-300 (según volumen) |
| Twilio WhatsApp | USD 50-150 |
| Cloudflare R2 + DNS | USD 10-20 |
| **TOTAL infra** | **~USD 250-550 / mes** |

> Esto es lo que Bochile paga aparte del fee WESEKA. Hay que aclararlo en el contrato.

## Seguridad

- HTTPS everywhere (Cloudflare)
- 2FA obligatorio para cuentas de equipo Bochile
- Backups diarios DB (Postgres point-in-time recovery)
- Logs de auditoría: quién hizo qué en CRM (cumplimiento legal alquileres)
- Datos personales: encriptación at-rest + cumplimiento Ley 25.326 Argentina

## Roadmap técnico de implementación

| Sprint | Días | Entregable |
|---|---|---|
| 0 | 1-2 | Setup cuentas + repos + dominios |
| 1 | 3-7 | Web pública con catálogo (read-only) |
| 2 | 8-12 | CRM + auth + roles |
| 3 | 13-17 | Camila IA conectada a WhatsApp |
| 4 | 18-22 | Tours 360° + planos interactivos |
| 5 | 23-27 | Dashboard + reportes |
| 6 | 28-32 | Módulo alquileres + cobranza |
| 7 | 33-40 | QA, training equipo, soft launch |
| 8 | 41+ | Lanzamiento público + Meta Ads |

---

*Documento vivo. Marcar componentes ✓ a medida que se implementen.*
