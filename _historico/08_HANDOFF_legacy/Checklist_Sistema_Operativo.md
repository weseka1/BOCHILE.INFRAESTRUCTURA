# Checklist de Onboarding · Sistema Bochile en producción

Lista paso a paso para llevar el sistema al aire después de que el cliente firme.

---

## ✅ Pre-go-live (lo que ya está hecho por WESEKA)

- [x] 8 Data Tables creadas en n8n con su esquema completo
- [x] W1 Chatbot Multi-Agente (CORE + 3 sub-agentes) — `j0Mh8IkFfv4q5pB7`
- [x] W2 Recordatorios de Visitas — `KgNZYq4R6MhCGvt1`
- [x] W3 Match Retroactivo — `EYmiN3Uy3u5PUuQa`
- [x] W4 Cobranza Alquileres — `zKPoASiEv8KbovaY`
- [x] W5 Sync Dashboard — `6VmlquxKOf2EtKEV`
- [x] Documentación de arquitectura, esquemas, prompts y setup
- [x] Excel maestro diseñado con 17 hojas y fórmulas

---

## 🟡 Pendientes — del cliente

### Credenciales y accesos

- [ ] Cuenta WhatsApp Business Cloud verificada (Meta Business Suite)
- [ ] Número de WhatsApp dedicado para Bochile (el de operaciones)
- [ ] API Key de OpenAI con USD 250 cargados de saldo inicial
- [ ] Acceso al dominio `bochile.com.ar` (cuenta DNS)
- [ ] Cuenta Google Workspace `operaciones@bochile.com.ar` para el Sheets

### Datos iniciales

- [ ] CSV con los 3 vendedores (nombre, teléfono, zona de especialidad)
- [ ] CSV con el catálogo de propiedades actual (mínimo 20 para arrancar, ideal 240)
- [ ] CSV con los contratos de alquiler activos (los 86)
- [ ] Foto profesional para cada propiedad principal (1 mínima, idealmente 5)
- [ ] Tours 360 (Matterport / Kuula / Cupix) — al menos 5 para piloto

### Decisiones del cliente

- [ ] Confirmar nombre de la asistente IA ("Camila" o el que decidan)
- [ ] Confirmar tono (vos / usted, formal / cálido)
- [ ] Confirmar horarios de atención (¿24/7 o solo horario comercial?)
- [ ] Definir umbral de "lead caliente" (default: 70)
- [ ] Definir umbral de "lead curioso" para cortar amablemente (default: 40)
- [ ] Decidir qué vendedor recibe leads por defecto si no hay match de zona

---

## 🔵 Pendientes — de WESEKA en setup

### Día 0 (configuración)

- [ ] Cargar credencial `OpenAI Bochile` en n8n
- [ ] Cargar credencial `Bochile WhatsApp Cloud` en n8n
- [ ] Cargar credencial `Bochile Google Sheets` en n8n
- [ ] Setear variable `BOCHILE_WA_PHONE_ID`
- [ ] Setear variable `BOCHILE_GSHEET_ID` (al final del Día 1)
- [ ] Setear variable `BOCHILE_CARLOS_TEL`

### Día 1 (dashboard)

- [ ] Crear spreadsheet `Bochile_Dashboard_Maestro_2026` en Drive del cliente
- [ ] Crear las 8 pestañas base
- [ ] Crear las 9 pestañas analíticas con fórmulas
- [ ] Compartir Sheets con la cuenta de servicio n8n

### Día 2 (datos)

- [ ] Importar `empleados.csv` a la Data Table `bochile_empleados`
- [ ] Importar `propiedades.csv` a la Data Table `bochile_propiedades`
- [ ] Importar `contratos.csv` a la Data Table `bochile_contratos`
- [ ] Verificar que las 3 tablas tienen filas

### Día 3 (activar y testear)

- [ ] Activar W5 Sync Dashboard
- [ ] Verificar después de 5 min que el Sheets recibió data
- [ ] Activar W2 (recordatorios)
- [ ] Activar W3 (match retroactivo)
- [ ] Activar W4 (cobranza)
- [ ] Activar W1 (chatbot) — último
- [ ] Configurar webhook en WhatsApp Cloud apuntando a `/bochile-chat`
- [ ] Test punta a punta con teléfono propio:
  - [ ] Mandar mensaje → recibe respuesta de Camila
  - [ ] Conversar hasta agendar visita
  - [ ] Verificar mensaje al vendedor "VISITA AGENDADA PARA LAS X CON Y EN Z"
  - [ ] Verificar fila en `bochile_visitas`
  - [ ] Verificar update de `bochile_leads` a etapa "Visita agendada"

### Día 4 (dashboard web)

- [ ] Pegar Apps Script en el Sheets y deployar como web app
- [ ] Tomar HTML del demo, reemplazar datos mock por fetch al Apps Script
- [ ] Deploy en Netlify/Vercel
- [ ] Apuntar `dashboard.bochile.com.ar` al deploy

### Día 5 (capacitación)

- [ ] Llamada de 1h con Carlos Bochile (dashboard, escalamientos)
- [ ] Llamada de 30min con cada vendedor (AGENDA_HOY, WhatsApp recibidos)
- [ ] Llamada de 30min con admin oficina (alquileres, feed IA)
- [ ] Grabar el video tutorial maestro (20 min) y dejarlo en el repo

---

## 🟢 Post go-live (mantenimiento WESEKA)

### Semana 1

- [ ] Monitoreo diario de ejecuciones n8n (alertas si error rate > 5%)
- [ ] Revisar conversaciones donde `requiere_humano=true` → 1x día
- [ ] Ajustar prompts del CORE/Calificador/Matcher según feedback del equipo
- [ ] Verificar facturación OpenAI y WhatsApp (no debe explotar)

### Mes 1

- [ ] Reunión retro con Bochile → ¿qué le sobra, qué le falta a la IA?
- [ ] Optimizar workflows si hay nodos lentos (>10s)
- [ ] Validar accuracy del Matcher (¿está sugiriendo bien?)
- [ ] Validar accuracy del Calificador (¿el equipo coincide con los scores?)

### Mes 3

- [ ] Decisión fase 2: integraciones avanzadas (Calendar real, voz, Mercado Pago)
- [ ] Migración dashboard a app propia con autenticación
- [ ] Capacitación a posibles nuevos vendedores que entren

---

## 🛠️ Cosas que rompen y cómo resolverlas

| Síntoma | Causa más probable | Fix |
|---|---|---|
| Mensajes entran pero Camila no responde | W1 desactivado o credencial OpenAI vencida | Reactivar W1, revisar credencial |
| Dashboard no se actualiza | W5 desactivado o credencial Sheets revocada | Reactivar W5, re-autorizar OAuth |
| Camila responde pero no agenda | Sub-agente Admin no tiene credencial WhatsApp | Verificar `Bochile WhatsApp Cloud` cred |
| Recordatorios no llegan | W2 desactivado o columna `recordatorio_enviado` mal seteada | Reactivar W2, revisar manualmente las visitas |
| El sub-agente Matcher devuelve "no hay propiedades" siempre | `bochile_propiedades` vacía o sin `publicada=true` | Sembrar propiedades, verificar columna |
| Mensaje al vendedor con texto "undefined" | Falta el teléfono del vendedor en `bochile_empleados` | Completar la fila del vendedor |
| Cobranza manda mensajes a teléfonos vacíos | `bochile_contratos` con `inquilino_telefono` vacío | Limpiar/completar los contratos |

Cualquier error grave: contactar Yamil Pintos (WESEKA) → yamilpintos18@gmail.com.

---

## 🎯 Lo que el cliente puede esperar el día del go-live

> "Abro mi celular, mando un WhatsApp al número de Bochile diciendo que busco una casa en Palihue. En 20 segundos Camila me responde, me hace 2-3 preguntas, me manda una propiedad con tour 360 y me agenda una visita el sábado a las 10:30 con Carlos. Carlos recibe el WhatsApp con la dirección y el contexto del lead, y en la pestaña AGENDA_HOY del dashboard aparece la visita."

Si eso pasa, el sistema está operativo.

---

*Yamil Pintos · WESEKA.IA · 2026-05-11*
