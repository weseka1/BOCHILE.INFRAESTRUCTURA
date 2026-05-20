"""Update W1 con prompts completos y parser de WhatsApp Cloud correcto."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1_ID = 'CngjqHkUUi8caF6Q'

T = {'leads':'UGNAXqPUX0udDRPi','props':'UlHoNXfh9nX5W8vn','visitas':'UJOWnNg9k0BdMMJP','contratos':'TSBcE3hUHHvzcrr2','empleados':'pfACps5XOWJo7UME','matches':'X1djtSSRbpiiNMTk','convs':'B5WIk9wqVUH8Z0t8','acciones':'XeXT6GunMsOgpGa2'}
def dt(tid, n): return {'__rl':True,'mode':'id','value':tid,'cachedResultName':n}

# === PROMPTS COMPLETOS (versión producción) ===

PROMPT_CORE = """Sos CAMILA, asistente de ventas digital de Inmobiliaria Bochile (Bahia Blanca, desde 1970). Conversas por WhatsApp como una vendedora humana, calidez argentina, vos, sin emojis exagerados.

OBJETIVO: organizar, filtrar, captar, vender. No respondes en piloto automatico: tu tarea es CALIFICAR primero, MATCHEAR despues, AGENDAR la visita.

TU EQUIPO DE SUB-AGENTES (los llamas internamente, el cliente nunca los ve):
- SubAgente Calificador: llamalo apenas tengas contexto suficiente (nombre + intencion). Te devuelve score 0-100 y datos estructurados.
- SubAgente Matcher: llamalo SOLO cuando ya tenes operacion + tipo + zona + presupuesto. Te devuelve hasta 3 propiedades del catalogo.
- SubAgente Administrativo: llamalo para AGENDAR visita, GUARDAR match_pendiente, ACTUALIZAR el lead en CRM.

FLUJO ESTANDAR:
1. Saludas. Si el lead pregunto por una propiedad puntual, pedis 1-2 datos (uso/inversion, presupuesto). Si saludo seco, abris.
2. Cuando tenes lo basico, llamas al Calificador.
3. Si score >= 70 y hay criterios completos -> Matcher.
4. Si hay propiedades, mostras 1-2 con tour 360 y propones agendar visita.
5. Si NO hay propiedades, llamas al Admin para guardar match_pendiente. Promete avisar.
6. Cuando el cliente acepta visita -> Admin para agendar + notificar vendedor.
7. Si score 40-70 (tibio): segui conversando para subir score. Si <40 (frio): corta cortes, deja la puerta abierta.

REGLAS DE ORO (CRITICAS):
- NUNCA inventes datos de propiedades. Siempre Matcher.
- NUNCA agendes sin pasar por Admin (necesita CRM + notificar vendedor + asignar zona).
- Si te preguntan algo que NO sabes (precios fuera catalogo, dudas legales, escritura), respondeles que en breve un humano les contesta y marca requiere_humano=true via el Admin.
- Respuestas CORTAS, conversacionales. Una pregunta clara por mensaje. NUNCA mas de 4 lineas.
- Si la conversacion es cobranza alquiler, reclamo inquilino o gestion contrato: NO uses Matcher, pasa directo al Admin para resolver o escalar.

EDGE CASES:
- Audio/imagen recibido: "Recibi tu audio/foto, te molesta si me lo escribis? me ayuda a responderte mas rapido"
- Saludo seco "hola": presentate y preguntale en que estaba buscando (venta/alquiler).
- Cliente furioso o ironico: NO entres en discusion, escala a humano via Admin con requiere_humano=true.
- Cliente que ya hablo antes (memoria): retoma el hilo donde quedo (la memoria te da los ultimos 20 turnos).

DEVOLVE SIEMPRE la respuesta lista para enviar al cliente final. Texto plano, sin markdown."""

PROMPT_CALIFICADOR = """Sos el sub-agente CALIFICADOR de Inmobiliaria Bochile (Bahia Blanca). Tu UNICA tarea: analizar la conversacion y devolver JSON estructurado segun el parser.

REGLAS DE SCORING:
- 0-40 (FRIO): pregunta generica sin datos concretos, "estoy mirando", no responde al filtrado.
- 41-70 (TIBIO): tiene intencion clara pero faltan datos clave (presupuesto exacto, urgencia, financiacion).
- 71-100 (CALIENTE): presupuesto concreto + urgencia + zona + tipo + forma de pago definida. Listo para visita.

SUBE SCORE SI: menciona presupuesto en numero concreto, deadline ("para diciembre"), vende otra propiedad, paga cash, es referido, familia con hijos buscando casa familiar (alta intencion).
BAJA SCORE SI: "solo estoy mirando", "todavia no estoy decidido", no responde a 2 preguntas seguidas, presupuesto vago.

VALORES VALIDOS:
- zona: Palihue | Centro | Universitario | Villa Mitre | Villa Belgrano | Patagonia | Tiro Federal | Villa Don Bosco | Almafuerte | Country
- operacion: venta | alquiler | alquiler_temporario
- tipo: casa | departamento | ph | lote | local | oficina
- moneda: USD | ARS
- urgencia: alta | media | baja
- forma_pago: cash | credito | mixto | vende_otra
- listo_para_visita: true SOLO si score >= 70 Y zona Y presupuesto Y tipo definidos

SI FALTA UN DATO: usa null o cadena vacia, NO inventes.

Devolve EXCLUSIVAMENTE el JSON del parser. Sin texto adicional, sin markdown."""

PROMPT_MATCHER = """Sos el sub-agente MATCHER de Inmobiliaria Bochile. Tu tarea: dado un set de criterios, leer el catalogo via tool 'Leer Catalogo Propiedades' y devolver hasta 3 propiedades.

PROCESO:
1. Llama a 'Leer Catalogo Propiedades' con la operacion del criterio.
2. Filtra mentalmente:
   - operacion EXACTA
   - tipo: tolera similitudes (casa ~ ph en zonas residenciales)
   - zona: prioriza exacta, acepta linderas (Palihue ~ Villa Belgrano)
   - moneda EXACTA
   - presupuesto: la propiedad cabe en presupuesto_max. Si esta 10% por encima, marcalo como 'estirado'
   - ambientes: tolera +/- 1
   - caracteristicas_must: prioridad alta si matchea
3. Ordena de mejor a peor match.
4. Devolve hasta 3.

FORMATO DE RESPUESTA (texto plano, una propiedad por bloque):
P-XXX | Titulo | Direccion, Zona | USD/ARS XXX.XXX | X amb | tour: <url>
Razon match: <una linea de por que es buen match>

SI NO HAY COINCIDENCIAS devolve EXACTAMENTE:
SIN_STOCK | <criterios resumidos: operacion, tipo, zona, presupuesto, ambientes, caracteristicas>

Asi el CORE sabe que tiene que registrar un match_pendiente. No agregues comentarios extra."""

PROMPT_ADMIN = """Sos el sub-agente ADMINISTRATIVO de Inmobiliaria Bochile. Eres el unico que ESCRIBE en el CRM y NOTIFICA al vendedor.

3 TAREAS POSIBLES (el CORE te dice cual):

A) AGENDAR VISITA:
1. 'Leer Vendedores Activos' -> elegir el mejor segun zona_especialidad (matchea con zona de la propiedad). Si ninguno matchea exacto, asignar al de menos visitas_mes.
2. 'Crear Visita en CRM' con: lead_id, prop_id, vendedor_id, vendedor_nombre, cliente_nombre, direccion (de la propiedad), fecha (YYYY-MM-DD), hora (HH:MM).
3. 'Avisar Vendedor por WhatsApp' con telefono del vendedor (sin +) y mensaje EXACTO con este formato:
   "VISITA AGENDADA PARA LAS HH:MM CON [NOMBRE CLIENTE] EN [DIRECCION COMPLETA]. Score: XX. Presupuesto: USD/ARS XXX.XXX. Zona: XXX. Tour 360: <url>. Notas: <observaciones clave>"
4. 'Actualizar Lead CRM' con etapa='Visita agendada', vendedor_asignado=<empleado_id>.

B) GUARDAR MATCH PENDIENTE (cuando Matcher devolvio SIN_STOCK):
1. 'Guardar Match Pendiente' con todos los criterios del lead.
2. 'Actualizar Lead CRM' con etapa='En espera de stock' y notas con los criterios.

C) ACTUALIZAR FICHA LEAD (cuando hay datos nuevos del Calificador):
1. 'Actualizar Lead CRM' con presupuesto, zona, tipo, urgencia, score, etapa.

REGLAS:
- NUNCA agendes sin tener fecha+hora confirmadas por el cliente.
- Telefonos para WhatsApp: SIN el '+', solo numeros (5492914401120, no +5492914401120).
- Si requiere_humano=true en el contexto: solo actualiza CRM con notas, NO agendes.

DEVOLVE al CORE un resumen plano: "Visita V-XXX agendada con Carlos Bochile para 2026-05-15 10:30 en Brown 1842" o "Match pendiente MP-XXX guardado". Sin markdown."""

# === NODOS REVISADOS ===

NORMALIZE_CODE = '''// Parser robusto de payload de WhatsApp Cloud + soporte payload simple
const body = $input.first().json.body || $input.first().json;

// Caso 1: payload nativo de Meta WhatsApp Cloud
let from = '', name = 'Desconocido', message = '', channel = 'whatsapp', msg_type = 'text';

if (body && body.entry && body.entry[0] && body.entry[0].changes) {
  const change = body.entry[0].changes[0].value || {};
  const msg = (change.messages || [])[0] || {};
  const contact = (change.contacts || [])[0] || {};
  from = '+' + (msg.from || '');
  name = (contact.profile && contact.profile.name) || 'Desconocido';
  msg_type = msg.type || 'text';
  if (msg_type === 'text') message = (msg.text && msg.text.body) || '';
  else if (msg_type === 'audio') message = '[audio recibido]';
  else if (msg_type === 'image') message = '[imagen recibida]';
  else if (msg_type === 'document') message = '[documento recibido]';
  else if (msg_type === 'video') message = '[video recibido]';
  else message = '[mensaje tipo ' + msg_type + ']';
}
// Caso 2: payload simple (test manual o web)
else if (body && body.from && body.message) {
  from = String(body.from).startsWith('+') ? body.from : '+' + body.from;
  name = body.name || 'Desconocido';
  message = body.message;
  channel = body.channel || 'whatsapp';
  msg_type = 'text';
}
// Caso 3: payload inesperado - log y skip
else {
  return [{ json: { skip: true, raw: JSON.stringify(body).substring(0, 500) } }];
}

const digits = from.replace(/\\D/g, '');
const lead_id = 'L-' + digits.slice(-10);
const msg_id = 'M-' + Date.now();

return [{ json: {
  telefono: from,
  nombre: name,
  mensaje: message,
  msg_type,
  canal: channel,
  lead_id,
  msg_id,
  timestamp_iso: new Date().toISOString(),
  skip: false
}}];'''

# === ESTRUCTURA NUEVA ===

new_nodes = [
  {"id":"w1-trig","name":"Webhook WhatsApp","type":"n8n-nodes-base.webhook","typeVersion":2.1,"position":[0,300],"parameters":{"httpMethod":"POST","path":"bochile-chat","responseMode":"responseNode"},"webhookId":"bochile-chat-webhook"},
  {"id":"w1-norm","name":"Parsear Mensaje","type":"n8n-nodes-base.code","typeVersion":2,"position":[220,300],"parameters":{"mode":"runOnceForEachItem","language":"javaScript","jsCode":NORMALIZE_CODE}},
  {"id":"w1-if-skip","name":"Saltar si invalido","type":"n8n-nodes-base.if","typeVersion":2.3,"position":[440,300],"parameters":{"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"loose"},"combinator":"and","conditions":[{"id":"sk","leftValue":"={{ $json.skip }}","rightValue":"true","operator":{"type":"boolean","operation":"false","singleValue":True}}]}}},
  # Lead existente check para evitar pisar etapa
  {"id":"w1-lead-exists","name":"Buscar Lead Existente","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[660,200],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $json.lead_id }}"}]},"returnAll":False,"limit":1},"alwaysOutputData":True},
  {"id":"w1-upsert","name":"Upsert Lead CRM","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[880,200],"parameters":{"resource":"row","operation":"upsert","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $(\"Parsear Mensaje\").item.json.lead_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"nombre\": $(\"Parsear Mensaje\").item.json.nombre, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"etapa\": ($json.etapa || \"Nuevo\"), \"actualizado_en\": $(\"Parsear Mensaje\").item.json.timestamp_iso }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"},"alwaysOutputData":True},
  {"id":"w1-log-in","name":"Log Mensaje Entrante","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1100,200],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['convs'],'bochile_conversaciones'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"msg_id\": $(\"Parsear Mensaje\").item.json.msg_id, \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"direccion\": \"in\", \"mensaje\": $(\"Parsear Mensaje\").item.json.mensaje, \"intencion_detectada\": \"\", \"agente_que_respondio\": \"pending\", \"requiere_humano\": false, \"timestamp\": $(\"Parsear Mensaje\").item.json.timestamp_iso }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  # === AGENT CORE + SUB-AGENTES ===
  {"id":"w1-core","name":"Vendedor CORE","type":"@n8n/n8n-nodes-langchain.agent","typeVersion":3.1,"position":[1320,200],"parameters":{"promptType":"define","text":"={{ $(\"Parsear Mensaje\").item.json.mensaje }}","options":{"systemMessage":PROMPT_CORE,"maxIterations":15}}},
  {"id":"w1-core-model","name":"GPT Vendedor CORE","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[1100,460],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5"},"options":{"temperature":0.4}}},
  {"id":"w1-mem","name":"Memoria Conversacion","type":"@n8n/n8n-nodes-langchain.memoryBufferWindow","typeVersion":1.3,"position":[1240,460],"parameters":{"sessionIdType":"customKey","sessionKey":"={{ $(\"Parsear Mensaje\").item.json.telefono }}","contextWindowLength":20}},
  # Calificador
  {"id":"w1-cal","name":"SubAgente Calificador","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[1380,460],"parameters":{"toolDescription":"Sub-agente CALIFICADOR. Analiza la conversacion del lead y devuelve JSON con score 0-100, presupuesto, zona, tipo, urgencia, forma de pago. Llamalo cuando tengas contexto basico del lead.","text":"={{ $fromAI(\"conversacion\", \"Resumen de la conversacion con el lead, mensajes intercambiados separados por saltos de linea\", \"string\") }}","hasOutputParser":True,"options":{"systemMessage":PROMPT_CALIFICADOR}}},
  {"id":"w1-cal-model","name":"GPT Calificador","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[1320,680],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.1}}},
  {"id":"w1-cal-parser","name":"Parser Calificador","type":"@n8n/n8n-nodes-langchain.outputParserStructured","typeVersion":1.3,"position":[1440,680],"parameters":{"schemaType":"fromJson","jsonSchemaExample":"{\"score\":85,\"etapa\":\"Calificado IA\",\"operacion\":\"venta\",\"tipo\":\"casa\",\"zona\":\"Palihue\",\"ambientes\":4,\"presupuesto_min\":250000,\"presupuesto_max\":300000,\"moneda\":\"USD\",\"forma_pago\":\"mixto\",\"urgencia\":\"alta\",\"razon\":\"Pareja 2 hijos, presupuesto claro\",\"listo_para_visita\":true,\"requiere_humano\":false}"}},
  # Matcher
  {"id":"w1-match","name":"SubAgente Matcher","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[1620,460],"parameters":{"toolDescription":"Sub-agente MATCHER. Cruza criterios del lead con catalogo de propiedades. Devuelve hasta 3 propiedades o SIN_STOCK. Llamalo SOLO cuando tengas operacion + tipo + zona + presupuesto.","text":"={{ $fromAI(\"criterios\", \"JSON con criterios: operacion, tipo, zona, ambientes_min, presupuesto_min, presupuesto_max, moneda, caracteristicas_must\", \"string\") }}","options":{"systemMessage":PROMPT_MATCHER}}},
  {"id":"w1-match-model","name":"GPT Matcher","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[1560,680],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.2}}},
  {"id":"w1-match-tool","name":"Leer Catalogo Propiedades","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[1700,680],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['props'],'bochile_propiedades'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"publicada","condition":"eq","keyValue":"true"},{"keyName":"operacion","condition":"eq","keyValue":"={{ $fromAI(\"operacion\", \"venta o alquiler o alquiler_temporario\", \"string\") }}"}]},"returnAll":True}},
  # Admin
  {"id":"w1-adm","name":"SubAgente Administrativo","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[1860,460],"parameters":{"toolDescription":"Sub-agente ADMIN. Unico que escribe en CRM y notifica vendedores. Llamalo para AGENDAR visita / GUARDAR match pendiente / ACTUALIZAR lead.","text":"={{ $fromAI(\"orden\", \"Que tiene que hacer: agendar visita o guardar match o actualizar lead. Incluir TODOS los datos necesarios.\", \"string\") }}","options":{"systemMessage":PROMPT_ADMIN}}},
  {"id":"w1-adm-model","name":"GPT Admin","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[1800,680],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.1}}},
  {"id":"w1-adm-vend","name":"Leer Vendedores Activos","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[1940,680],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['empleados'],'bochile_empleados'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"activo","condition":"eq","keyValue":"true"},{"keyName":"rol","condition":"eq","keyValue":"vendedor"}]},"returnAll":True}},
  {"id":"w1-adm-vis","name":"Crear Visita en CRM","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2080,680],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['visitas'],'bochile_visitas'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"visita_id\": \"V-\" + $now.toMillis(), \"lead_id\": $fromAI(\"lead_id\", \"ID del lead L-XXX\", \"string\"), \"prop_id\": $fromAI(\"prop_id\", \"ID propiedad P-XXX\", \"string\"), \"vendedor_id\": $fromAI(\"vendedor_id\", \"ID vendedor E-X\", \"string\"), \"vendedor_nombre\": $fromAI(\"vendedor_nombre\", \"Nombre completo vendedor\", \"string\"), \"cliente_nombre\": $fromAI(\"cliente_nombre\", \"Nombre del cliente\", \"string\"), \"direccion\": $fromAI(\"direccion\", \"Direccion completa con zona\", \"string\"), \"fecha\": $fromAI(\"fecha\", \"Fecha visita YYYY-MM-DD\", \"string\"), \"hora\": $fromAI(\"hora\", \"Hora HH:MM 24h\", \"string\"), \"estado\": \"agendada\", \"confirmada_cliente\": true, \"notificada_vendedor\": true, \"recordatorio_enviado\": false, \"observaciones\": $fromAI(\"observaciones\", \"Notas del lead\", \"string\"), \"creada_en\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"w1-adm-mp","name":"Guardar Match Pendiente","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2220,680],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['matches'],'bochile_matches_pendientes'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"match_id\": \"MP-\" + $now.toMillis(), \"lead_id\": $fromAI(\"lead_id\", \"ID lead\", \"string\"), \"lead_nombre\": $fromAI(\"lead_nombre\", \"Nombre lead\", \"string\"), \"lead_telefono\": $fromAI(\"lead_telefono\", \"Tel con +\", \"string\"), \"operacion\": $fromAI(\"operacion\", \"venta/alquiler\", \"string\"), \"tipo\": $fromAI(\"tipo\", \"tipo prop\", \"string\"), \"zona\": $fromAI(\"zona\", \"zona\", \"string\"), \"ambientes_min\": $fromAI(\"ambientes_min\", \"amb min\", \"number\"), \"presupuesto_min\": $fromAI(\"presupuesto_min\", \"min\", \"number\"), \"presupuesto_max\": $fromAI(\"presupuesto_max\", \"max\", \"number\"), \"moneda\": $fromAI(\"moneda\", \"USD/ARS\", \"string\"), \"caracteristicas_must\": $fromAI(\"caracteristicas_must\", \"must have\", \"string\"), \"activo\": true, \"creado_en\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"w1-adm-upd","name":"Actualizar Lead CRM","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2360,680],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $fromAI(\"lead_id\", \"ID lead\", \"string\") }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"operacion\": $fromAI(\"operacion\", \"venta/alquiler\", \"string\"), \"tipo_propiedad\": $fromAI(\"tipo_propiedad\", \"tipo\", \"string\"), \"zona_pref\": $fromAI(\"zona_pref\", \"zona\", \"string\"), \"ambientes\": $fromAI(\"ambientes\", \"amb\", \"number\"), \"presupuesto_min\": $fromAI(\"presupuesto_min\", \"min\", \"number\"), \"presupuesto_max\": $fromAI(\"presupuesto_max\", \"max\", \"number\"), \"moneda\": $fromAI(\"moneda\", \"USD/ARS\", \"string\"), \"forma_pago\": $fromAI(\"forma_pago\", \"cash/credito/mixto\", \"string\"), \"urgencia\": $fromAI(\"urgencia\", \"alta/media/baja\", \"string\"), \"score\": $fromAI(\"score\", \"0-100\", \"number\"), \"etapa\": $fromAI(\"etapa\", \"etapa CRM\", \"string\"), \"vendedor_asignado\": $fromAI(\"vendedor_asignado\", \"E-X\", \"string\"), \"ultima_intencion\": $fromAI(\"ultima_intencion\", \"resumen intencion\", \"string\"), \"notas\": $fromAI(\"notas\", \"notas\", \"string\"), \"actualizado_en\": $now.toISO() }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"}},
  {"id":"w1-adm-wa","name":"Avisar Vendedor por WhatsApp","type":"n8n-nodes-base.whatsAppTool","typeVersion":1.1,"position":[2500,680],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $fromAI(\"telefono_vendedor\", \"Telefono SIN el + (ej 5492914401120)\", \"string\") }}","messageType":"text","textBody":"={{ $fromAI(\"mensaje\", \"VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]. Score X. Presupuesto X. Notas.\", \"string\") }}"}},
  # === POST-CORE ===
  {"id":"w1-log-out","name":"Log Mensaje Saliente","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1540,200],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['convs'],'bochile_conversaciones'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"msg_id\": \"M-\" + $now.toMillis() + \"-out\", \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"direccion\": \"out\", \"mensaje\": $json.output, \"intencion_detectada\": \"\", \"agente_que_respondio\": \"Vendedor CORE\", \"requiere_humano\": false, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"w1-log-act","name":"Registrar Accion IA","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1760,200],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['acciones'],'bochile_acciones_ia'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"accion_id\": \"A-\" + $now.toMillis(), \"tipo\": \"conversacion_atendida\", \"agente\": \"Vendedor CORE\", \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"resumen\": \"Mensaje atendido + orquestacion subagentes\", \"detalle\": ($(\"Vendedor CORE\").item.json.output || \"\").substring(0, 400), \"resultado\": \"ok\", \"tiempo_ahorrado_min\": 4, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"w1-reply","name":"Responder al Cliente","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[1980,200],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $(\"Parsear Mensaje\").item.json.telefono.replace(\"+\", \"\") }}","messageType":"text","textBody":"={{ $(\"Vendedor CORE\").item.json.output }}"}},
  {"id":"w1-respond","name":"OK al Webhook","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,"position":[2200,200],"parameters":{"respondWith":"json","responseBody":"={{ ({ ok: true, lead_id: $(\"Parsear Mensaje\").item.json.lead_id }) }}"}},
  # === FAST RESPOND para skip (mensaje invalido) ===
  {"id":"w1-skip-resp","name":"Skip Respond","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,"position":[660,400],"parameters":{"respondWith":"json","responseBody":"={{ ({ ok: false, reason: \"payload_invalido\" }) }}"}}
]

new_conns = {
  "Webhook WhatsApp":{"main":[[{"node":"Parsear Mensaje","type":"main","index":0}]]},
  "Parsear Mensaje":{"main":[[{"node":"Saltar si invalido","type":"main","index":0}]]},
  "Saltar si invalido":{"main":[
    [{"node":"Buscar Lead Existente","type":"main","index":0}],
    [{"node":"Skip Respond","type":"main","index":0}]
  ]},
  "Buscar Lead Existente":{"main":[[{"node":"Upsert Lead CRM","type":"main","index":0}]]},
  "Upsert Lead CRM":{"main":[[{"node":"Log Mensaje Entrante","type":"main","index":0}]]},
  "Log Mensaje Entrante":{"main":[[{"node":"Vendedor CORE","type":"main","index":0}]]},
  "Vendedor CORE":{"main":[[{"node":"Log Mensaje Saliente","type":"main","index":0}]]},
  "GPT Vendedor CORE":{"ai_languageModel":[[{"node":"Vendedor CORE","type":"ai_languageModel","index":0}]]},
  "Memoria Conversacion":{"ai_memory":[[{"node":"Vendedor CORE","type":"ai_memory","index":0}]]},
  "SubAgente Calificador":{"ai_tool":[[{"node":"Vendedor CORE","type":"ai_tool","index":0}]]},
  "GPT Calificador":{"ai_languageModel":[[{"node":"SubAgente Calificador","type":"ai_languageModel","index":0}]]},
  "Parser Calificador":{"ai_outputParser":[[{"node":"SubAgente Calificador","type":"ai_outputParser","index":0}]]},
  "SubAgente Matcher":{"ai_tool":[[{"node":"Vendedor CORE","type":"ai_tool","index":0}]]},
  "GPT Matcher":{"ai_languageModel":[[{"node":"SubAgente Matcher","type":"ai_languageModel","index":0}]]},
  "Leer Catalogo Propiedades":{"ai_tool":[[{"node":"SubAgente Matcher","type":"ai_tool","index":0}]]},
  "SubAgente Administrativo":{"ai_tool":[[{"node":"Vendedor CORE","type":"ai_tool","index":0}]]},
  "GPT Admin":{"ai_languageModel":[[{"node":"SubAgente Administrativo","type":"ai_languageModel","index":0}]]},
  "Leer Vendedores Activos":{"ai_tool":[[{"node":"SubAgente Administrativo","type":"ai_tool","index":0}]]},
  "Crear Visita en CRM":{"ai_tool":[[{"node":"SubAgente Administrativo","type":"ai_tool","index":0}]]},
  "Guardar Match Pendiente":{"ai_tool":[[{"node":"SubAgente Administrativo","type":"ai_tool","index":0}]]},
  "Actualizar Lead CRM":{"ai_tool":[[{"node":"SubAgente Administrativo","type":"ai_tool","index":0}]]},
  "Avisar Vendedor por WhatsApp":{"ai_tool":[[{"node":"SubAgente Administrativo","type":"ai_tool","index":0}]]},
  "Log Mensaje Saliente":{"main":[[{"node":"Registrar Accion IA","type":"main","index":0}]]},
  "Registrar Accion IA":{"main":[[{"node":"Responder al Cliente","type":"main","index":0}]]},
  "Responder al Cliente":{"main":[[{"node":"OK al Webhook","type":"main","index":0}]]}
}

payload = {"name":"Bochile - Chatbot Multi-Agente CORE (v2 producción)","nodes":new_nodes,"connections":new_conns,"settings":{"executionOrder":"v1"}}

# Borrar W1 viejo y crear nuevo
try:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1_ID}', headers={'X-N8N-API-KEY': KEY}, method='DELETE')
    urllib.request.urlopen(req)
    print(f"Borrado W1 viejo: {W1_ID}")
except Exception as e:
    print(f"No se pudo borrar W1: {e}")

req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read())
        print(f"OK W1 v2: {res.get('id')} | {res.get('name')}")
except urllib.error.HTTPError as e:
    print(f"ERROR: {e.code} {e.read().decode()[:800]}")
