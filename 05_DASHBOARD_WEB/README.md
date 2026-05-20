# Bochile · Dashboard Web

Dashboard ejecutivo de Bochile Inmobiliaria. Lee datos en tiempo real del Google Sheet "Bochile · Sistema Operativo" que viene poblado por los 5 workflows n8n del sistema Camila.

**Stack:** Vite + React 18 + TypeScript + TailwindCSS + TanStack Query + Recharts (frontend) · Node 20 + Express + googleapis (backend).

---

## Arquitectura

```
                  Google Sheet                                  Browser (panel)
       (Bochile · Sistema Operativo)                                 │
                       │                                              │
                       ▼                                              ▼
            ┌──────────────────────┐         HTTP             ┌──────────────────┐
            │  Backend Node (3001) │ ◀────────────────────── │ Frontend Vite (5173) │
            │  + googleapis SDK    │   GET /api/leads etc.   │  React + Tailwind   │
            │  + Service Account   │ ──────────────────────▶ │  TanStack Query     │
            └──────────────────────┘         JSON            └──────────────────────┘
```

El **backend** lee del Sheet con un Service Account JSON. El **frontend** consume el backend REST y muestra los datos. Nada de credenciales Google en el browser.

---

## Estructura del proyecto

```
05_DASHBOARD_WEB/
├── README.md                       ◀── este archivo
├── .gitignore
├── backend/                        ◀── Node + Express + googleapis
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example                ◀── copiar a .env y completar
│   └── src/
│       ├── server.ts               ◀── entrypoint Express
│       ├── config.ts               ◀── env vars
│       ├── services/
│       │   └── sheets.ts           ◀── cliente Google Sheets API
│       ├── routes/
│       │   ├── leads.ts
│       │   ├── propiedades.ts
│       │   ├── visitas.ts
│       │   ├── contratos.ts
│       │   ├── empleados.ts
│       │   ├── matches.ts
│       │   ├── conversaciones.ts
│       │   ├── acciones.ts
│       │   └── metrics.ts          ◀── agregaciones para el resumen
│       └── types/
│           └── domain.ts           ◀── interfaces de cada tabla
└── frontend/                       ◀── Vite + React + TS + Tailwind
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── public/
    └── src/
        ├── main.tsx                ◀── entrypoint React
        ├── App.tsx                 ◀── router + layout shell
        ├── index.css               ◀── tailwind + base
        ├── types/
        │   └── domain.ts           ◀── mismas interfaces que backend
        ├── lib/
        │   └── utils.ts            ◀── helpers (cn, formato moneda, etc)
        ├── services/
        │   └── api.ts              ◀── fetch wrappers
        ├── hooks/                  ◀── un hook por entidad
        │   ├── useLeads.ts
        │   ├── usePropiedades.ts
        │   ├── useVisitas.ts
        │   ├── useContratos.ts
        │   ├── useEmpleados.ts
        │   ├── useMatches.ts
        │   ├── useConversaciones.ts
        │   ├── useAcciones.ts
        │   └── useMetrics.ts
        ├── components/
        │   ├── ui/                 ◀── primitivos (Button, Card, Table, Badge)
        │   ├── layout/             ◀── Sidebar, TopBar
        │   └── charts/             ◀── StatCard, LineChart, PieChart
        └── pages/
            ├── DashboardPage.tsx   ◀── resumen ejecutivo
            ├── LeadsPage.tsx
            ├── PropiedadesPage.tsx
            ├── VisitasPage.tsx
            ├── ContratosPage.tsx
            ├── ConversacionesPage.tsx
            └── EmpleadosPage.tsx
```

---

## Setup paso a paso

### 1. Service Account de Google

```bash
# Si todavía no tenés, generá un service account JSON:
# 1. Google Cloud Console → APIs & Services → Credentials
# 2. Create Credentials → Service Account
# 3. Tab "Keys" → Add Key → JSON → descargar
# 4. Compartir el Sheet (1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4) con el email del service account (Lector o Editor)
```

Guardá el JSON en `backend/credentials/service-account.json` (este path está en `.gitignore`).

### 2. Backend

```bash
cd backend
cp .env.example .env
# editá .env y completá SHEET_ID y GOOGLE_APPLICATION_CREDENTIALS
npm install
npm run dev
# Listo: backend escuchando en http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Listo: dashboard en http://localhost:5173
```

---

## Variables de entorno (backend)

| Var | Ejemplo | Función |
|---|---|---|
| `PORT` | `3001` | Puerto del backend |
| `SHEET_ID` | `1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4` | ID del Sheet de Bochile |
| `GOOGLE_APPLICATION_CREDENTIALS` | `./credentials/service-account.json` | Path al JSON del service account |
| `CACHE_TTL_SECONDS` | `30` | TTL del cache en memoria (evita pegarle a Sheets API en cada request) |
| `ALLOW_ORIGIN` | `http://localhost:5173` | CORS origin del frontend |

---

## Endpoints del backend

| Método | Path | Devuelve |
|---|---|---|
| GET | `/api/health` | `{ status: 'ok' }` |
| GET | `/api/leads` | `Lead[]` |
| GET | `/api/propiedades` | `Propiedad[]` |
| GET | `/api/visitas` | `Visita[]` |
| GET | `/api/contratos` | `Contrato[]` |
| GET | `/api/empleados` | `Empleado[]` |
| GET | `/api/matches` | `Match[]` |
| GET | `/api/conversaciones` | `Conversacion[]` |
| GET | `/api/acciones` | `AccionIA[]` |
| GET | `/api/metrics` | `{ kpis, charts }` para el dashboard resumen |

---

## Convenciones

- **Tipos compartidos**: idénticos entre `backend/src/types/domain.ts` y `frontend/src/types/domain.ts`. Si cambia el schema del Sheet, ambos archivos deben actualizarse.
- **Cache**: el backend cachea cada tabla `CACHE_TTL_SECONDS` segundos para no saturar Sheets API (rate limit Google: 60 reads/min por usuario). El frontend además cachea con TanStack Query (5 min default).
- **Estado**: cero estado mutable en el frontend; toda escritura va via n8n (workflows del bot). Esto es un dashboard read-only.
- **Estilo**: TailwindCSS con paleta dark-mode-first. Acento en `--accent` (define una vez en `index.css`).
- **No fetch inline en componentes**: todo via hooks (`useLeads`, etc.) que envuelven TanStack Query.

---

## Roadmap (continuar acá si retomás)

- [ ] **Filtros server-side** por fecha/zona/etapa en cada endpoint
- [ ] **Búsqueda full-text** sobre conversaciones (relevante para auditar QA del bot)
- [ ] **Charts adicionales**: heatmap de leads por hora, embudo de conversión
- [ ] **Export CSV** por pestaña
- [ ] **Notificaciones en vivo**: WebSocket o SSE cuando entra lead nuevo
- [ ] **Auth**: hoy es público localhost — para producción agregar JWT o Clerk
- [ ] **Mobile**: layout responsive ya funciona, pero hace falta pulir tablas en pantallas chicas
- [ ] **Tema light**: hoy solo dark; agregar toggle

---

## Cómo se conecta con el resto del sistema Bochile

```
WhatsApp → Twilio → ngrok → n8n local (W1-W4) → Google Sheet
                                                       │
                                                       │ (lectura via service account)
                                                       ▼
                                          Backend Node (este proyecto)
                                                       │
                                                       │ (REST JSON)
                                                       ▼
                                          Frontend Vite (este proyecto)
```

Ver doc principal del sistema en [`../04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/ESTADO_FINAL.md`](../04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/ESTADO_FINAL.md).
