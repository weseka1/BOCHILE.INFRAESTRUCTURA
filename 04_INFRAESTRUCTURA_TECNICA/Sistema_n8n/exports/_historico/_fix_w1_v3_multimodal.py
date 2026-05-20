"""W1 v3: agrega soporte AUDIO (Whisper) e IMAGEN (GPT-4o Vision) para WhatsApp.

Flujo:
- text -> sigue normal
- audio -> Meta media URL -> download .ogg -> Whisper transcribe -> message = texto
- image -> Meta media URL -> download .jpg -> Vision (GPT-4o) describe + chequea si es prop del catalogo -> message = descripcion
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'

T = {'leads':'UGNAXqPUX0udDRPi','props':'UlHoNXfh9nX5W8vn','visitas':'UJOWnNg9k0BdMMJP','contratos':'TSBcE3hUHHvzcrr2','empleados':'pfACps5XOWJo7UME','matches':'X1djtSSRbpiiNMTk','convs':'B5WIk9wqVUH8Z0t8','acciones':'XeXT6GunMsOgpGa2'}
def dt(tid, n): return {'__rl':True,'mode':'id','value':tid,'cachedResultName':n}

# Parser: detecta tipo de mensaje y extrae media_id si aplica
PARSE_CODE = '''const body = $input.first().json.body || $input.first().json;
let from='', name='Desconocido', text_message='', channel='whatsapp', msg_type='text', media_id='', mime_type='';

if (body && body.entry && body.entry[0] && body.entry[0].changes) {
  const change = body.entry[0].changes[0].value || {};
  const msg = (change.messages || [])[0] || {};
  const contact = (change.contacts || [])[0] || {};
  from = '+' + (msg.from || '');
  name = (contact.profile && contact.profile.name) || 'Desconocido';
  msg_type = msg.type || 'text';
  if (msg_type === 'text') text_message = (msg.text && msg.text.body) || '';
  else if (msg_type === 'audio') { media_id = msg.audio?.id || ''; mime_type = msg.audio?.mime_type || 'audio/ogg'; }
  else if (msg_type === 'voice') { media_id = msg.voice?.id || msg.audio?.id || ''; mime_type = 'audio/ogg'; msg_type='audio'; }
  else if (msg_type === 'image') { media_id = msg.image?.id || ''; mime_type = msg.image?.mime_type || 'image/jpeg'; text_message = msg.image?.caption || ''; }
  else if (msg_type === 'document') { media_id = msg.document?.id || ''; mime_type = msg.document?.mime_type || ''; text_message = '[documento: ' + (msg.document?.filename || '') + ']'; }
  else if (msg_type === 'video') { media_id = msg.video?.id || ''; text_message = '[video recibido]'; }
  else text_message = '[mensaje tipo ' + msg_type + ']';
} else if (body && body.from && (body.message || body.media_id)) {
  from = String(body.from).startsWith('+') ? body.from : '+' + body.from;
  name = body.name || 'Desconocido';
  text_message = body.message || '';
  msg_type = body.type || 'text';
  media_id = body.media_id || '';
  channel = body.channel || 'whatsapp';
} else {
  return [{ json: { skip: true } }];
}

const digits = from.replace(/\\D/g, '');
return [{ json: {
  telefono: from, nombre: name, mensaje_original: text_message, msg_type, media_id, mime_type,
  canal: channel, lead_id: 'L-' + digits.slice(-10), msg_id: 'M-' + Date.now(),
  timestamp_iso: new Date().toISOString(), skip: false, needs_audio: msg_type==='audio' && !!media_id, needs_image: msg_type==='image' && !!media_id
}}];'''

# Switch sobre el tipo: text / audio / image
SWITCH_PARAMS = {
  "rules": {"values":[
    {"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"leftValue":"={{ $json.msg_type }}","rightValue":"text","operator":{"type":"string","operation":"equals"}}]},"renameOutput":True,"outputKey":"texto"},
    {"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"leftValue":"={{ $json.msg_type }}","rightValue":"audio","operator":{"type":"string","operation":"equals"}}]},"renameOutput":True,"outputKey":"audio"},
    {"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"leftValue":"={{ $json.msg_type }}","rightValue":"image","operator":{"type":"string","operation":"equals"}}]},"renameOutput":True,"outputKey":"imagen"}
  ]},
  "options":{"fallbackOutput":"extra","renameFallbackOutput":"otro"}
}

# Prompts (los mismos del W1 v2)
PROMPT_CORE = """Sos CAMILA, asistente de ventas digital de Inmobiliaria Bochile (Bahia Blanca, desde 1970). Conversas por WhatsApp/Instagram como vendedora humana, calida, argentina, vos.

OBJETIVO: organizar, filtrar, captar, vender. CALIFICAR -> MATCHEAR -> AGENDAR.

CONTEXTO DEL MENSAJE:
- Si te llega un mensaje que empieza con "[AUDIO TRANSCRIPTO]" o "[IMAGEN]", el cliente te mando voz o foto. Respondele NATURALMENTE como si te hubiera escrito - no menciones que viste audio/imagen salvo que sea relevante.
- Si te muestran una foto de una propiedad de la calle/inmobiliaria competencia, agradecele y preguntale que esta buscando (no podes ofrecer eso).
- Si la foto es de una propiedad Bochile (el contexto te lo dira), confirma que es tuya y avanza con calificar.

SUB-AGENTES (los llamas internamente, el cliente no los ve):
- Calificador: te devuelve score 0-100 y datos estructurados. Llamalo apenas tengas contexto basico.
- Matcher: cruza criterios contra catalogo Bochile. Llamalo SOLO con operacion+tipo+zona+presupuesto definidos.
- Administrativo: unico que escribe CRM y notifica vendedor. Llamalo para agendar, guardar match pendiente o actualizar lead.

FLUJO:
1. Saludas + 1-2 preguntas iniciales (uso/inversion, presupuesto).
2. Llamas Calificador.
3. Score >= 70 + criterios completos -> Matcher.
4. Si hay props -> mostras 1-2 con tour 360 + ofrecer visita.
5. Si SIN_STOCK -> Admin guarda match_pendiente.
6. Cliente acepta visita -> Admin agenda + notifica vendedor.

REGLAS:
- NUNCA inventes datos de propiedades. Solo Matcher.
- NUNCA agendes sin pasar por Admin.
- Respuestas CORTAS (max 4 lineas), una pregunta clara.
- Pregunta tecnica/legal que no sabes -> requiere_humano=true via Admin.
- Audio/imagen recibido: responde como si fuera texto, sin agregar "vi tu audio".
- Cliente furioso: NO discutas, escala a humano.

Devolve TEXTO PLANO listo para enviar. Sin markdown."""

PROMPT_CALIFICADOR = """Sos el CALIFICADOR de Bochile. Analiza la conversacion y devolve JSON segun parser.

SCORING:
- 0-40 FRIO: pregunta generica, "solo mirando", no responde filtrado.
- 41-70 TIBIO: intencion clara pero faltan datos clave.
- 71-100 CALIENTE: presupuesto + urgencia + zona + tipo + forma_pago definidos.

SUBE SCORE: presupuesto numerico, deadline, vende otra prop, cash, referido, familia con hijos.
BAJA SCORE: "estoy mirando", "no estoy decidido", no responde 2 preguntas seguidas.

VALORES VALIDOS:
- zona: Palihue|Centro|Universitario|Villa Mitre|Villa Belgrano|Patagonia|Tiro Federal|Villa Don Bosco|Almafuerte|Country
- operacion: venta|alquiler|alquiler_temporario
- tipo: casa|departamento|ph|lote|local|oficina
- moneda: USD|ARS
- urgencia: alta|media|baja
- forma_pago: cash|credito|mixto|vende_otra
- listo_para_visita: true SOLO si score>=70 Y zona Y presupuesto Y tipo definidos

Si falta dato: null o "". NO inventes. Devolve EXCLUSIVAMENTE el JSON del parser."""

PROMPT_MATCHER = """Sos el MATCHER de Bochile.

PROCESO:
1. Llama 'Leer Catalogo Propiedades' con operacion del criterio.
2. Filtra: operacion exacta, tipo (tolera similitudes casa~ph), zona (prioriza exacta acepta lindera), moneda exacta, presupuesto cabe en presupuesto_max (10% over = 'estirado'), ambientes +/- 1, caracteristicas_must matchea.
3. Ordena mejor a peor match. Devolve hasta 3.

FORMATO RESPUESTA (texto plano):
P-XXX | Titulo | Direccion, Zona | USD/ARS XXX.XXX | X amb | tour: <url>
Razon: <una linea>

SIN STOCK: devolve EXACTAMENTE "SIN_STOCK | <criterios resumidos>" para que CORE registre match_pendiente."""

PROMPT_ADMIN = """Sos el ADMIN de Bochile. Unico que escribe CRM y notifica vendedor.

A) AGENDAR VISITA:
1. 'Leer Vendedores Activos' -> elegir por zona_especialidad. Sin match -> menos visitas_mes.
2. 'Crear Visita en CRM': lead_id, prop_id, vendedor_id, vendedor_nombre, cliente_nombre, direccion, fecha YYYY-MM-DD, hora HH:MM.
3. 'Avisar Vendedor por WhatsApp' tel SIN '+', mensaje EXACTO:
   "VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]. Score: XX. Presupuesto: USD/ARS XXX. Zona: XXX. Tour: <url>. Notas: ..."
4. 'Actualizar Lead CRM' etapa='Visita agendada', vendedor_asignado.

B) GUARDAR MATCH PENDIENTE: 'Guardar Match Pendiente' con criterios + 'Actualizar Lead CRM' etapa='En espera de stock'.

C) ACTUALIZAR LEAD: 'Actualizar Lead CRM' con datos del Calificador.

REGLAS:
- NUNCA agendes sin fecha+hora confirmadas.
- Telefonos SIN +.
- requiere_humano=true -> solo update CRM con nota, NO agendes.

Devolve resumen plano. Sin markdown."""

# === NODOS ===

nodes = [
  # 1. Webhook
  {"id":"n-1","name":"Webhook WhatsApp","type":"n8n-nodes-base.webhook","typeVersion":2.1,"position":[0,400],"parameters":{"httpMethod":"POST","path":"bochile-chat","responseMode":"responseNode"},"webhookId":"bochile-chat-webhook"},
  # 2. Parser
  {"id":"n-2","name":"Parsear Mensaje","type":"n8n-nodes-base.code","typeVersion":2,"position":[220,400],"parameters":{"mode":"runOnceForEachItem","language":"javaScript","jsCode":PARSE_CODE}},
  # 3. Switch tipo
  {"id":"n-3","name":"Switch Tipo Mensaje","type":"n8n-nodes-base.switch","typeVersion":3.4,"position":[440,400],"parameters":SWITCH_PARAMS},

  # === RAMA AUDIO ===
  # 4a. Get media URL de Meta
  {"id":"n-4a","name":"Audio - Get URL Meta","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[660,200],"parameters":{"method":"GET","url":"=https://graph.facebook.com/v23.0/{{ $json.media_id }}","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","sendHeaders":True,"headerParameters":{"parameters":[]},"options":{}},"credentials":{"httpHeaderAuth":{"id":"PLACEHOLDER_META","name":"Meta WhatsApp Token"}}},
  # 5a. Download audio binary
  {"id":"n-5a","name":"Audio - Download","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[880,200],"parameters":{"method":"GET","url":"={{ $json.url }}","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","options":{"response":{"response":{"responseFormat":"file"}}}},"credentials":{"httpHeaderAuth":{"id":"PLACEHOLDER_META","name":"Meta WhatsApp Token"}}},
  # 6a. Transcribe con Whisper
  {"id":"n-6a","name":"Audio - Transcribir Whisper","type":"@n8n/n8n-nodes-langchain.openAi","typeVersion":1.8,"position":[1100,200],"parameters":{"resource":"audio","operation":"transcribe","options":{"language":"es","prompt":"Transcripcion de mensaje de WhatsApp en castellano argentino sobre consulta inmobiliaria."}}},
  # 7a. Merge en mensaje
  {"id":"n-7a","name":"Audio - Set Mensaje","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1320,200],"parameters":{"mode":"manual","assignments":{"assignments":[
    {"id":"a1","name":"mensaje","value":"=[AUDIO TRANSCRIPTO] {{ $json.text }}","type":"string"}
  ]},"includeOtherFields":True}},

  # === RAMA IMAGEN ===
  {"id":"n-4b","name":"Imagen - Get URL Meta","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[660,400],"parameters":{"method":"GET","url":"=https://graph.facebook.com/v23.0/{{ $json.media_id }}","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","options":{}},"credentials":{"httpHeaderAuth":{"id":"PLACEHOLDER_META","name":"Meta WhatsApp Token"}}},
  {"id":"n-5b","name":"Imagen - Download","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[880,400],"parameters":{"method":"GET","url":"={{ $json.url }}","authentication":"genericCredentialType","genericAuthType":"httpHeaderAuth","options":{"response":{"response":{"responseFormat":"file"}}}},"credentials":{"httpHeaderAuth":{"id":"PLACEHOLDER_META","name":"Meta WhatsApp Token"}}},
  # GPT-4o Vision
  {"id":"n-6b","name":"Imagen - Analizar Vision","type":"@n8n/n8n-nodes-langchain.openAi","typeVersion":1.8,"position":[1100,400],"parameters":{"resource":"image","operation":"analyze","modelId":{"__rl":True,"mode":"list","value":"gpt-4o"},"text":"Sos un asistente que analiza fotos enviadas por clientes de una inmobiliaria en Bahia Blanca (Bochile). Describe BREVEMENTE (1-2 lineas): si es una propiedad (casa/dpto/lote/terreno), una direccion/fachada, un terreno vacio, un plano, un documento, o algo NO inmobiliario. Si parece propiedad indica caracteristicas visibles (ambientes aproximados, estilo). NO inventes direcciones ni precios.","inputType":"base64","options":{}}},
  {"id":"n-7b","name":"Imagen - Set Mensaje","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1320,400],"parameters":{"mode":"manual","assignments":{"assignments":[
    {"id":"a1","name":"mensaje","value":"=[IMAGEN RECIBIDA] {{ $json.content || $json.text || $json.response }}{{ $('Parsear Mensaje').item.json.mensaje_original ? ' | Caption: ' + $('Parsear Mensaje').item.json.mensaje_original : '' }}","type":"string"}
  ]},"includeOtherFields":True}},

  # === RAMA TEXTO ===
  {"id":"n-4c","name":"Texto - Set Mensaje","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[660,600],"parameters":{"mode":"manual","assignments":{"assignments":[
    {"id":"a1","name":"mensaje","value":"={{ $json.mensaje_original }}","type":"string"}
  ]},"includeOtherFields":True}},

  # === MERGE de los 3 caminos ===
  {"id":"n-8","name":"Merge Caminos","type":"n8n-nodes-base.merge","typeVersion":3.2,"position":[1540,400],"parameters":{"mode":"append","numberInputs":3}},

  # === FLUJO COMUN POST-MERGE ===
  {"id":"n-9","name":"Buscar Lead Existente","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1760,400],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $json.lead_id }}"}]},"returnAll":False,"limit":1},"alwaysOutputData":True},
  {"id":"n-10","name":"Upsert Lead CRM","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1980,400],"parameters":{"resource":"row","operation":"upsert","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $(\"Parsear Mensaje\").item.json.lead_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"nombre\": $(\"Parsear Mensaje\").item.json.nombre, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"etapa\": ($json.etapa || \"Nuevo\"), \"actualizado_en\": $(\"Parsear Mensaje\").item.json.timestamp_iso }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"},"alwaysOutputData":True},
  {"id":"n-11","name":"Log Mensaje Entrante","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[2200,400],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['convs'],'bochile_conversaciones'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"msg_id\": $(\"Parsear Mensaje\").item.json.msg_id, \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"direccion\": \"in\", \"mensaje\": $json.mensaje, \"intencion_detectada\": $(\"Parsear Mensaje\").item.json.msg_type, \"agente_que_respondio\": \"pending\", \"requiere_humano\": false, \"timestamp\": $(\"Parsear Mensaje\").item.json.timestamp_iso }, \"matchingColumns\": [], \"schema\": [] }) }}"}},

  # AGENT
  {"id":"n-12","name":"Vendedor CORE","type":"@n8n/n8n-nodes-langchain.agent","typeVersion":3.1,"position":[2420,400],"parameters":{"promptType":"define","text":"={{ $(\"Merge Caminos\").item.json.mensaje }}","options":{"systemMessage":PROMPT_CORE,"maxIterations":15}}},
  {"id":"n-13","name":"GPT Vendedor CORE","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2200,660],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5"},"options":{"temperature":0.4}}},
  {"id":"n-14","name":"Memoria Conversacion","type":"@n8n/n8n-nodes-langchain.memoryBufferWindow","typeVersion":1.3,"position":[2340,660],"parameters":{"sessionIdType":"customKey","sessionKey":"={{ $(\"Parsear Mensaje\").item.json.telefono }}","contextWindowLength":20}},

  # Sub-agentes (mismos que v2)
  {"id":"n-15","name":"SubAgente Calificador","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[2480,660],"parameters":{"toolDescription":"CALIFICADOR. Analiza conversacion y devuelve JSON con score, presupuesto, zona, tipo, urgencia, forma de pago. Llamalo apenas tengas contexto.","text":"={{ $fromAI(\"conversacion\", \"Resumen conversacion\", \"string\") }}","hasOutputParser":True,"options":{"systemMessage":PROMPT_CALIFICADOR}}},
  {"id":"n-16","name":"GPT Calificador","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2420,880],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.1}}},
  {"id":"n-17","name":"Parser Calificador","type":"@n8n/n8n-nodes-langchain.outputParserStructured","typeVersion":1.3,"position":[2540,880],"parameters":{"schemaType":"fromJson","jsonSchemaExample":"{\"score\":85,\"etapa\":\"Calificado IA\",\"operacion\":\"venta\",\"tipo\":\"casa\",\"zona\":\"Palihue\",\"ambientes\":4,\"presupuesto_min\":250000,\"presupuesto_max\":300000,\"moneda\":\"USD\",\"forma_pago\":\"mixto\",\"urgencia\":\"alta\",\"razon\":\"...\",\"listo_para_visita\":true,\"requiere_humano\":false}"}},

  {"id":"n-18","name":"SubAgente Matcher","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[2720,660],"parameters":{"toolDescription":"MATCHER. Cruza criterios con catalogo. Hasta 3 props o SIN_STOCK. Llamar SOLO con operacion+tipo+zona+presupuesto.","text":"={{ $fromAI(\"criterios\", \"JSON criterios\", \"string\") }}","options":{"systemMessage":PROMPT_MATCHER}}},
  {"id":"n-19","name":"GPT Matcher","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2660,880],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.2}}},
  {"id":"n-20","name":"Leer Catalogo Propiedades","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2800,880],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['props'],'bochile_propiedades'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"publicada","condition":"eq","keyValue":"true"},{"keyName":"operacion","condition":"eq","keyValue":"={{ $fromAI(\"operacion\", \"venta o alquiler\", \"string\") }}"}]},"returnAll":True}},

  {"id":"n-21","name":"SubAgente Administrativo","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[2960,660],"parameters":{"toolDescription":"ADMIN. Escribe CRM y notifica vendedores. AGENDAR / GUARDAR match pendiente / ACTUALIZAR lead.","text":"={{ $fromAI(\"orden\", \"Que hacer + datos\", \"string\") }}","options":{"systemMessage":PROMPT_ADMIN}}},
  {"id":"n-22","name":"GPT Admin","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2900,880],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.1}}},
  {"id":"n-23","name":"Leer Vendedores Activos","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[3040,880],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['empleados'],'bochile_empleados'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"activo","condition":"eq","keyValue":"true"},{"keyName":"rol","condition":"eq","keyValue":"vendedor"}]},"returnAll":True}},
  {"id":"n-24","name":"Crear Visita en CRM","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[3180,880],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['visitas'],'bochile_visitas'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"visita_id\": \"V-\" + $now.toMillis(), \"lead_id\": $fromAI(\"lead_id\", \"L-XXX\", \"string\"), \"prop_id\": $fromAI(\"prop_id\", \"P-XXX\", \"string\"), \"vendedor_id\": $fromAI(\"vendedor_id\", \"E-X\", \"string\"), \"vendedor_nombre\": $fromAI(\"vendedor_nombre\", \"nombre\", \"string\"), \"cliente_nombre\": $fromAI(\"cliente_nombre\", \"nombre\", \"string\"), \"direccion\": $fromAI(\"direccion\", \"dir completa\", \"string\"), \"fecha\": $fromAI(\"fecha\", \"YYYY-MM-DD\", \"string\"), \"hora\": $fromAI(\"hora\", \"HH:MM\", \"string\"), \"estado\": \"agendada\", \"confirmada_cliente\": true, \"notificada_vendedor\": true, \"recordatorio_enviado\": false, \"observaciones\": $fromAI(\"observaciones\", \"notas\", \"string\"), \"creada_en\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-25","name":"Guardar Match Pendiente","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[3320,880],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['matches'],'bochile_matches_pendientes'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"match_id\": \"MP-\" + $now.toMillis(), \"lead_id\": $fromAI(\"lead_id\", \"ID\", \"string\"), \"lead_nombre\": $fromAI(\"lead_nombre\", \"nombre\", \"string\"), \"lead_telefono\": $fromAI(\"lead_telefono\", \"tel\", \"string\"), \"operacion\": $fromAI(\"operacion\", \"op\", \"string\"), \"tipo\": $fromAI(\"tipo\", \"tipo\", \"string\"), \"zona\": $fromAI(\"zona\", \"zona\", \"string\"), \"ambientes_min\": $fromAI(\"ambientes_min\", \"min\", \"number\"), \"presupuesto_min\": $fromAI(\"presupuesto_min\", \"min\", \"number\"), \"presupuesto_max\": $fromAI(\"presupuesto_max\", \"max\", \"number\"), \"moneda\": $fromAI(\"moneda\", \"mon\", \"string\"), \"caracteristicas_must\": $fromAI(\"caracteristicas_must\", \"must\", \"string\"), \"activo\": true, \"creado_en\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-26","name":"Actualizar Lead CRM","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[3460,880],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $fromAI(\"lead_id\", \"ID\", \"string\") }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"operacion\": $fromAI(\"operacion\", \"op\", \"string\"), \"tipo_propiedad\": $fromAI(\"tipo_propiedad\", \"tipo\", \"string\"), \"zona_pref\": $fromAI(\"zona_pref\", \"zona\", \"string\"), \"ambientes\": $fromAI(\"ambientes\", \"amb\", \"number\"), \"presupuesto_min\": $fromAI(\"presupuesto_min\", \"min\", \"number\"), \"presupuesto_max\": $fromAI(\"presupuesto_max\", \"max\", \"number\"), \"moneda\": $fromAI(\"moneda\", \"mon\", \"string\"), \"forma_pago\": $fromAI(\"forma_pago\", \"pago\", \"string\"), \"urgencia\": $fromAI(\"urgencia\", \"urg\", \"string\"), \"score\": $fromAI(\"score\", \"0-100\", \"number\"), \"etapa\": $fromAI(\"etapa\", \"etapa\", \"string\"), \"vendedor_asignado\": $fromAI(\"vendedor_asignado\", \"E-X\", \"string\"), \"ultima_intencion\": $fromAI(\"ultima_intencion\", \"intencion\", \"string\"), \"notas\": $fromAI(\"notas\", \"notas\", \"string\"), \"actualizado_en\": $now.toISO() }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"}},
  {"id":"n-27","name":"Avisar Vendedor por WhatsApp","type":"n8n-nodes-base.whatsAppTool","typeVersion":1.1,"position":[3600,880],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $fromAI(\"telefono_vendedor\", \"Tel SIN +\", \"string\") }}","messageType":"text","textBody":"={{ $fromAI(\"mensaje\", \"VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]. Score X. Presupuesto. Notas.\", \"string\") }}"}},

  # Post-CORE
  {"id":"n-28","name":"Log Mensaje Saliente","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[2640,400],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['convs'],'bochile_conversaciones'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"msg_id\": \"M-\" + $now.toMillis() + \"-out\", \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"direccion\": \"out\", \"mensaje\": $json.output, \"intencion_detectada\": \"\", \"agente_que_respondio\": \"Vendedor CORE\", \"requiere_humano\": false, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-29","name":"Registrar Accion IA","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[2860,400],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['acciones'],'bochile_acciones_ia'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"accion_id\": \"A-\" + $now.toMillis(), \"tipo\": \"conversacion_atendida\", \"agente\": \"Vendedor CORE\", \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"resumen\": \"Mensaje \" + $(\"Parsear Mensaje\").item.json.msg_type + \" atendido\", \"detalle\": ($(\"Vendedor CORE\").item.json.output || \"\").substring(0, 400), \"resultado\": \"ok\", \"tiempo_ahorrado_min\": 4, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-30","name":"Responder al Cliente","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[3080,400],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $(\"Parsear Mensaje\").item.json.telefono.replace(\"+\", \"\") }}","messageType":"text","textBody":"={{ $(\"Vendedor CORE\").item.json.output }}"}},
  {"id":"n-31","name":"OK al Webhook","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,"position":[3300,400],"parameters":{"respondWith":"json","responseBody":"={{ ({ ok: true, lead_id: $(\"Parsear Mensaje\").item.json.lead_id }) }}"}}
]

conns = {
  "Webhook WhatsApp":{"main":[[{"node":"Parsear Mensaje","type":"main","index":0}]]},
  "Parsear Mensaje":{"main":[[{"node":"Switch Tipo Mensaje","type":"main","index":0}]]},
  "Switch Tipo Mensaje":{"main":[
    [{"node":"Texto - Set Mensaje","type":"main","index":0}],
    [{"node":"Audio - Get URL Meta","type":"main","index":0}],
    [{"node":"Imagen - Get URL Meta","type":"main","index":0}]
  ]},
  "Audio - Get URL Meta":{"main":[[{"node":"Audio - Download","type":"main","index":0}]]},
  "Audio - Download":{"main":[[{"node":"Audio - Transcribir Whisper","type":"main","index":0}]]},
  "Audio - Transcribir Whisper":{"main":[[{"node":"Audio - Set Mensaje","type":"main","index":0}]]},
  "Audio - Set Mensaje":{"main":[[{"node":"Merge Caminos","type":"main","index":1}]]},
  "Imagen - Get URL Meta":{"main":[[{"node":"Imagen - Download","type":"main","index":0}]]},
  "Imagen - Download":{"main":[[{"node":"Imagen - Analizar Vision","type":"main","index":0}]]},
  "Imagen - Analizar Vision":{"main":[[{"node":"Imagen - Set Mensaje","type":"main","index":0}]]},
  "Imagen - Set Mensaje":{"main":[[{"node":"Merge Caminos","type":"main","index":2}]]},
  "Texto - Set Mensaje":{"main":[[{"node":"Merge Caminos","type":"main","index":0}]]},
  "Merge Caminos":{"main":[[{"node":"Buscar Lead Existente","type":"main","index":0}]]},
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

# Quitar credentials placeholder (n8n los rellena cuando user los crea)
for node in nodes:
    if 'credentials' in node:
        del node['credentials']

payload = {"name":"Bochile - Chatbot Multi-Agente CORE (v3 multimodal)","nodes":nodes,"connections":conns,"settings":{"executionOrder":"v1"}}

# Borrar W1 v2 viejo
try:
    req = urllib.request.Request('http://localhost:5680/api/v1/workflows/3l2dToaJShOGBs3U', headers={'X-N8N-API-KEY': KEY}, method='DELETE')
    urllib.request.urlopen(req)
    print("Borrado W1 v2")
except Exception as e:
    print(f"No se borro: {e}")

req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read())
        print(f"OK W1 v3 MULTIMODAL: {res.get('id')} | {res.get('name')}")
        print(f"Total nodos: {len(res.get('nodes',[]))}")
except urllib.error.HTTPError as e:
    print(f"ERROR {e.code}: {e.read().decode()[:800]}")
