# Changelog — qué hicimos durante el proyecto

Resumen ejecutivo de los hitos del proyecto Bochile × WSK.IA desde el inicio hasta el handoff.

## Fase 1 — Arquitectura base (mayo 2026, semana 1-2)
- Diseño de arquitectura: respond.io + n8n + Sheet + dashboard web
- Setup de cuentas y servicios en Render
- Esquema del Sheet de base de datos (10 pestañas)
- Primera versión del bot Cami con prompt básico
- Dashboard web v0.1 (solo lectura de leads y propiedades)

## Fase 2 — Iteración del bot (mayo 2026, semana 2-3)
- Cami con conocimiento del catálogo de Bochile via vector search (Qdrant)
- SubAgentes especializados: Calificador, Matcher, Administrativo
- Procesamiento de audios (Whisper) e imágenes (Vision)
- Identificación de propiedades por foto (CLIP + matching híbrido)
- Auto-pausa cuando interviene humano (handoff)

## Fase 3 — Funcionalidades avanzadas (mayo 2026, semana 3-4)
- Detección y registro de visitas (separación de Ventas vs Alquileres)
- Sistema de notificaciones a vendedor real
- Extractor de info de URLs (BB Propiedades, Argenprop, Zonaprop, Instagram, etc.)
- Cruce con catálogo desde cualquier portal de la competencia
- Sanitizer de output (asegurar tono natural sin signos de apertura)

## Fase 4 — Polish + pre-entrega (sábado 30/05 + lunes 01/06)
- Refactor del prompt (limpieza de 38 ocurrencias de `¿` y 12 de `¡`)
- Regla "DORMITORIOS vs AMBIENTES" (no usar jerga técnica)
- Regla "USO DEL PRESUPUESTO" (buscar entre 50-100% del techo)
- Regla "NO INVENTAR DATOS" (si el catálogo está vacío, no completar)
- Tab "Alquileres" oculto del dashboard (a pedido del cliente)
- Tareas: completadas persisten hasta limpieza manual
- Endpoint `POST /api/leads/:id/reset` para testing
- Detector Visitas leyendo `OPEN_AI` env var (no `OPENAI_API_KEY`)

## Fase 5 — Documentación y handoff (01/06/2026)
- Validación end-to-end (sanitizer activo, fixes funcionando)
- 08_HANDOFF con manuales, ZIP final, doc dual
- Capacitación a Camila Pomerich (reunión en vivo)
- Sign-off del cliente

## Componentes finales entregados

### Infraestructura
- 3 servicios en Render (n8n, dashboard-api, dashboard-ui)
- 1 Sheet de Google con 10 pestañas
- 2 webhooks en respond.io (entrante + saliente)
- 1 canal de WhatsApp Business conectado

### Workflow n8n
- 1 workflow productivo: "Bochile - Chatbot Multi-Agente CORE (v5 respond.io)"
- ~55 nodos distintos (incluyendo Code, langchain, Google Sheets, HTTP)
- 4 nodos personalizados creados durante el proyecto:
  - Detector Visitas
  - Extraer Info URL
  - Recheck Pausa Pre-Send
  - Sanitize Output

### Dashboard web
- 7 secciones: Inicio, Clientes, Propiedades, Visitas, Mensajes, Equipo, Tareas
- React + Vite + Tailwind
- ~30 endpoints en el dashboard-api

### Documentación
- 7 manuales operativos en este paquete
- 1 manual de cliente final (MANUAL_CAMILA.md)
- ARQUITECTURA.md, DEPLOY.md, OPERAR.md, README.md (técnicos)

## Métricas del proyecto (interno)
- **120+ commits** en el repo desde el inicio
- **~120 scripts utilitarios** en `scripts/` (numerados 01-123) para mantenimiento y debugging
- **~3 meses** de desarrollo total (marzo-mayo 2026)
- **Sin downtime productivo** durante el último mes
