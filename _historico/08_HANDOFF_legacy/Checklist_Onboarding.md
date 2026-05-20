# Checklist Onboarding · Bochile

> Activar el día que firmen. 14 días al lanzamiento.

---

## DÍA 1-2 · Aprobación + setup contractual

### Documental
- [ ] Contrato firmado (digital con Docusign o similar)
- [ ] Carta de propuesta enviada a Bochile
- [ ] Forma de pago acordada (USD)
- [ ] Política de cancelación clara
- [ ] NDA firmado por ambas partes

### Accesos requeridos a WESEKA
- [ ] Acceso admin Facebook Page Bochile
- [ ] Acceso admin Instagram Bochile
- [ ] Tarjeta crédito Bochile linkeada a Meta Ads
- [ ] Acceso lectura ZonaProp panel
- [ ] Google Workspace (calendarios + email vendedores)
- [ ] Lista de teléfonos vendedores activos
- [ ] Listado de propiedades en cartera (Excel/CSV)
- [ ] Logo y manual de marca (si tiene)

### Setup técnico inicial
- [ ] Crear Business Manager (si no existe)
- [ ] Crear Ad Account dentro del BM
- [ ] Verificar dominio bochile.com.ar (si tiene web)
- [ ] Setup Pixel + CAPI
- [ ] Conectar WhatsApp Business API
- [ ] Crear plantilla email reportes

---

## DÍA 3-5 · Producción Ola 1

- [ ] Brief detallado por cada uno de los 6 ads
- [ ] Sesión de captura tours 360° (1 día, 4-6 propiedades)
- [ ] Producción Ad 01 (Tour POV Reel)
- [ ] Producción Ad 05 (IA chat Reel)
- [ ] Producción Ad 09 (Educación UVA Reel)
- [ ] Producción Ad 13 (Top barrios Reel)
- [ ] Producción Ad 17 (Caso éxito Familia Reel)
- [ ] Producción Ad 18 (Caso éxito firma Story)
- [ ] Subir piezas a Drive Bochile para revisión
- [ ] Aprobación Bochile en < 24h

---

## DÍA 6-8 · Carga + QA

- [ ] Subir creativos a Meta Ads Manager
- [ ] Crear 3 ad sets (A1, A2, A3) con audiencias finales
- [ ] Configurar UTMs para cada ad
- [ ] Setup tracking events Pixel + CAPI
- [ ] Setup webhook WhatsApp Business
- [ ] Test end-to-end: anuncio → click → WhatsApp → CRM
- [ ] Verificar que Camila (IA) responde correctamente al primer mensaje
- [ ] Test de ad copy + creative con Compass / Canva preview
- [ ] Setup reglas automáticas (auto-pause)
- [ ] Configurar reportes de Looker Studio

---

## DÍA 9 · 🚀 LANZAMIENTO

- [ ] Confirmación final con Bochile (mañana 09:00)
- [ ] Activar campaña a las 10:00
- [ ] Monitoreo intensivo primeras 4 horas
- [ ] Verificar primeros 5-10 mensajes en WhatsApp
- [ ] Verificar que Camila respondió bien
- [ ] Verificar que CRM está creando los leads correctamente
- [ ] Reporte fin del día 1 a Bochile
- [ ] Cervecita 🍺

---

## DÍA 10-13 · Optimización inicial

- [ ] Revisión diaria CPC / conversaciones
- [ ] Pausar bottom 30% de creativos si CPC > $0.20
- [ ] Reasignar budget al top 50%
- [ ] Detectar quick wins y planear variantes
- [ ] Ajustar audiencias si alguna sobre/sub-performa
- [ ] Capturar 1-2 testimoniales nuevos para sprint 2
- [ ] Iniciar producción ola 2 (7 ads adicionales)

---

## DÍA 14 · Reporte semana 1

- [ ] Compilar números reales semana 1
- [ ] Reunión de revisión con Bochile (60 min)
- [ ] Decidir ajustes para semana 2
- [ ] Confirmar producción ola 2 está en marcha
- [ ] Documentar aprendizajes en `06_OPERACIONES/`

---

## CHECKLIST COMPLETO POR ÁREA

### Cuentas y accesos
- [ ] Business Manager creado y configurado
- [ ] Ad Account con forma de pago activa
- [ ] WhatsApp Business API conectada
- [ ] ZonaProp sync (si aplica)
- [ ] Google Calendar de los 4 vendedores accesible

### Web e infraestructura
- [ ] Dominio bochile.com.ar verificado
- [ ] Pixel instalado en todas las páginas
- [ ] CAPI server-side activa
- [ ] Tour 360° ejemplo accesible públicamente
- [ ] Catálogo propiedades sincronizado

### IA · Camila
- [ ] Mensaje de bienvenida configurado
- [ ] Conocimiento de catálogo cargado (RAG)
- [ ] Conocimiento de barrios BB cargado
- [ ] Function calling: agendar visita (Calendar)
- [ ] Function calling: crear lead en CRM
- [ ] Function calling: cotizar crédito (simulador)
- [ ] Test: 10 conversaciones de prueba con distintos perfiles
- [ ] Política de escalada a humano definida

### Equipo Bochile
- [ ] Carlos · acceso admin total
- [ ] Vendedores · acceso al CRM
- [ ] Capacitación equipo de 90 minutos
- [ ] Plantillas de respuestas rápidas armadas
- [ ] Política interna: cuándo intervenir vs dejar a la IA
- [ ] Horarios de cobertura humana definidos

### Reportes
- [ ] Looker Studio dashboard publicado
- [ ] Acceso lectura para Bochile
- [ ] Reporte automático cada lunes 09:00
- [ ] Reunión mensual agendada (todos los primeros lunes)
- [ ] Reporte trimestral agendado

### Compliance
- [ ] Política privacidad publicada en web
- [ ] Cumplimiento Ley 25.326 (Argentina)
- [ ] WhatsApp opt-in claro en cada conversación
- [ ] Backup datos cliente con cifrado
- [ ] Templates de consentimiento testimoniales

### Seguridad
- [ ] 2FA activo en todas las cuentas Bochile
- [ ] Acceso WESEKA con cuentas separadas (no compartir contraseñas)
- [ ] Logs de auditoría activados
- [ ] Backups DB diarios automáticos
- [ ] Plan de recuperación ante caída

---

## Checklist semanal recurrente

### Cada lunes (WESEKA)
- [ ] Compilar datos semana anterior
- [ ] Pausar/mantener creativos
- [ ] Email resumen a Bochile
- [ ] Actualizar `06_OPERACIONES/KPIs_Tracking.md`

### Cada miércoles (WESEKA)
- [ ] Producción ola actual avanzando
- [ ] Estado de aprobación creativos pendientes
- [ ] Ajustar reglas automáticas si algo cambió

### Cada viernes (WESEKA)
- [ ] Forecast próxima semana
- [ ] Alertas configuradas correctamente
- [ ] Backup datos completo

---

## Si algo se rompe

### Pixel caído
1. Verificar Tag Manager
2. Verificar dominio en BM
3. Re-instalar pixel código
4. Test con Pixel Helper

### WhatsApp Business no recibe
1. Verificar webhook en Meta dashboard
2. Verificar token API
3. Verificar número conectado
4. Restart Camila service

### CPC se disparó
1. Pausar 24h
2. Revisar fatiga (frequency > 4)
3. Revisar competencia (¿alguien lanzó campaña agresiva?)
4. Rotar creatividades top
5. Re-encender con presupuesto reducido 50% temporal

### Camila respondiendo mal
1. Capturar conversación
2. Revisar prompts y contexto
3. Ajustar memory + system prompt
4. Re-test con 5 conversaciones de prueba
5. Comunicar al equipo Bochile

---

*Última actualización: 29 abr 2026*
