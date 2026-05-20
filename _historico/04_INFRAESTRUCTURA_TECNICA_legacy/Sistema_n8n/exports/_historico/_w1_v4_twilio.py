"""W1 v4: Twilio WhatsApp en lugar de Meta Cloud. Mantiene multimodal (audio + imagen)."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'

T = {'leads':'UGNAXqPUX0udDRPi','props':'UlHoNXfh9nX5W8vn','visitas':'UJOWnNg9k0BdMMJP','contratos':'TSBcE3hUHHvzcrr2','empleados':'pfACps5XOWJo7UME','matches':'X1djtSSRbpiiNMTk','convs':'B5WIk9wqVUH8Z0t8','acciones':'XeXT6GunMsOgpGa2'}
def dt(tid, n): return {'__rl':True,'mode':'id','value':tid,'cachedResultName':n}

OPENAI = {'id':'0cXejbqqXHamFUYX','name':'OpenAI WESEKA'}
TWILIO = {'id':'HR5fS1GSOu06duuX','name':'Twilio account'}

# Parser webhook de Twilio: form-urlencoded → JSON
PARSE_CODE = '''const body = $input.first().json.body || $input.first().json;

// Twilio manda form-urlencoded. Los fields clave:
const from_raw = body.From || body.from || '';
const profile = body.ProfileName || body.profileName || 'Desconocido';
const text_body = body.Body || body.body || '';
const num_media = parseInt(body.NumMedia || body.numMedia || '0', 10);
const media_url = body.MediaUrl0 || body.mediaUrl0 || '';
const media_type = body.MediaContentType0 || body.mediaContentType0 || '';

// from llega como "whatsapp:+5492914423398"
const from = from_raw.replace('whatsapp:', '');

// Detectar tipo de mensaje
let msg_type = 'text';
let mensaje_original = text_body;
if (num_media > 0 && media_url) {
  if (media_type.startsWith('audio/')) msg_type = 'audio';
  else if (media_type.startsWith('image/')) msg_type = 'image';
  else { msg_type = 'document'; mensaje_original = text_body || '[adjunto recibido]'; }
}

if (!from || (!text_body && !media_url)) {
  return [{ json: { skip: true, reason: 'payload_invalido' } }];
}

const digits = from.replace(/\\D/g, '');
return [{ json: {
  telefono: from,
  telefono_twilio: 'whatsapp:' + from,
  nombre: profile,
  mensaje_original,
  msg_type,
  media_url,
  media_type,
  canal: 'whatsapp_twilio',
  lead_id: 'L-' + digits.slice(-10),
  msg_id: 'M-' + Date.now(),
  timestamp_iso: new Date().toISOString(),
  skip: false
}}];'''

SWITCH_PARAMS = {
  "rules": {"values":[
    {"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"leftValue":"={{ $json.msg_type }}","rightValue":"text","operator":{"type":"string","operation":"equals"}}]},"renameOutput":True,"outputKey":"texto"},
    {"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"leftValue":"={{ $json.msg_type }}","rightValue":"audio","operator":{"type":"string","operation":"equals"}}]},"renameOutput":True,"outputKey":"audio"},
    {"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"leftValue":"={{ $json.msg_type }}","rightValue":"image","operator":{"type":"string","operation":"equals"}}]},"renameOutput":True,"outputKey":"imagen"}
  ]},
  "options":{"fallbackOutput":"extra","renameFallbackOutput":"otro"}
}

PROMPT_CORE = """Sos CAMILA, asistente de ventas digital de Inmobiliaria Bochile (Bahia Blanca, desde 1970). Conversas por WhatsApp como vendedora humana, calida, argentina, vos.

OBJETIVO: organizar, filtrar, captar, vender. CALIFICAR -> MATCHEAR -> AGENDAR.

CONTEXTO MULTIMODAL:
- Si el mensaje empieza con "[AUDIO TRANSCRIPTO]" o "[IMAGEN]", el cliente mando voz o foto. Respondele NATURAL, no menciones que viste audio/imagen salvo que sea relevante.
- Si la foto es propiedad de la calle/competencia, agradecele y preguntale que esta buscando.
- Si la foto es de una propiedad Bochile (catalogo), confirma y avanza con calificar.

SUB-AGENTES (los llamas, el cliente no los ve):
- Calificador: score 0-100 + datos estructurados. Llamalo apenas tengas contexto basico.
- Matcher: cruza criterios contra catalogo. SOLO con operacion+tipo+zona+presupuesto.
- Administrativo: unico que escribe CRM y notifica vendedor. AGENDAR, GUARDAR match pendiente, ACTUALIZAR lead.

FLUJO:
1. Saludo + 1-2 preguntas (uso/inversion, presupuesto).
2. Calificador.
3. Score >= 70 + criterios completos -> Matcher.
4. Hay props -> mostra 1-2 con tour 360 + ofrece visita.
5. SIN_STOCK -> Admin guarda match_pendiente.
6. Cliente acepta visita -> Admin agenda + notifica vendedor.

REGLAS:
- NUNCA inventes datos. Solo Matcher.
- NUNCA agendes sin Admin.
- Respuestas CORTAS (max 4 lineas), una pregunta clara.
- Tema legal/tecnico -> requiere_humano=true.
- Audio/imagen: responde como texto, sin agregar "vi tu audio".
- Cliente furioso: NO discutas, escala humano.

Devolve TEXTO PLANO listo para WhatsApp. Sin markdown."""

PROMPT_CALIFICADOR = """CALIFICADOR Bochile. Analiza conversacion, devolve JSON parser.

SCORING:
- 0-40 FRIO: pregunta vaga, "solo mirando".
- 41-70 TIBIO: intencion clara, faltan datos.
- 71-100 CALIENTE: presupuesto+urgencia+zona+tipo+forma_pago definidos.

VALIDOS:
- zona: Palihue|Centro|Universitario|Villa Mitre|Villa Belgrano|Patagonia|Tiro Federal|Villa Don Bosco|Almafuerte|Country
- operacion: venta|alquiler|alquiler_temporario
- tipo: casa|departamento|ph|lote|local|oficina
- moneda: USD|ARS
- urgencia: alta|media|baja
- forma_pago: cash|credito|mixto|vende_otra
- listo_para_visita: true SOLO si score>=70 Y zona Y presupuesto Y tipo

Falta dato: null o "". NO inventes. Devolve EXCLUSIVAMENTE el JSON del parser."""

PROMPT_MATCHER = """MATCHER Bochile.

1. Llama 'Leer Catalogo Propiedades' con operacion del criterio.
2. Filtra: operacion exacta, tipo (tolera casa~ph), zona (exacta o lindera), moneda exacta, presupuesto cabe en max (10% over = 'estirado'), ambientes +/-1.
3. Ordena mejor a peor. Hasta 3.

FORMATO:
P-XXX | Titulo | Direccion, Zona | USD/ARS XXX.XXX | X amb | tour: <url>
Razon: <linea>

SIN STOCK: "SIN_STOCK | <criterios>"."""

PROMPT_ADMIN = """ADMIN Bochile. Unico que escribe CRM y notifica vendedor.

A) AGENDAR:
1. 'Leer Vendedores Activos' -> elegir por zona_especialidad (sin match: menos visitas_mes).
2. 'Crear Visita en CRM'.
3. 'Avisar Vendedor por WhatsApp Twilio' tel con prefijo "whatsapp:" mensaje EXACTO:
   "VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]. Score: XX. Presupuesto: USD/ARS XXX. Zona: XXX. Tour: <url>. Notas: ..."
4. 'Actualizar Lead CRM' etapa='Visita agendada'.

B) GUARDAR MATCH PENDIENTE: 'Guardar Match Pendiente' + 'Actualizar Lead CRM' etapa='En espera de stock'.
C) ACTUALIZAR LEAD: 'Actualizar Lead CRM'.

REGLAS:
- NUNCA agendes sin fecha+hora confirmadas.
- WhatsApp Twilio: telefonos CON prefijo "whatsapp:+54...".
- requiere_humano=true -> solo update CRM con nota.

Devolve resumen plano."""

nodes = [
  # 1. Webhook Twilio
  {"id":"n-1","name":"Webhook Twilio","type":"n8n-nodes-base.webhook","typeVersion":2.1,"position":[0,400],"parameters":{"httpMethod":"POST","path":"bochile-chat","responseMode":"responseNode","options":{"rawBody":False}},"webhookId":"bochile-twilio-webhook"},
  # 2. Parser
  {"id":"n-2","name":"Parsear Mensaje","type":"n8n-nodes-base.code","typeVersion":2,"position":[220,400],"parameters":{"mode":"runOnceForEachItem","language":"javaScript","jsCode":PARSE_CODE}},
  # 3. Switch tipo
  {"id":"n-3","name":"Switch Tipo Mensaje","type":"n8n-nodes-base.switch","typeVersion":3.4,"position":[440,400],"parameters":SWITCH_PARAMS},

  # === RAMA AUDIO ===
  # Audio download from Twilio (auth basic Twilio)
  {"id":"n-4a","name":"Audio - Download Twilio","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[660,200],"parameters":{"method":"GET","url":"={{ $json.media_url }}","authentication":"genericCredentialType","genericAuthType":"httpBasicAuth","options":{"response":{"response":{"responseFormat":"file"}}}}},
  # Whisper
  {"id":"n-5a","name":"Audio - Whisper","type":"@n8n/n8n-nodes-langchain.openAi","typeVersion":1.8,"position":[880,200],"parameters":{"resource":"audio","operation":"transcribe","options":{"language":"es"}},"credentials":{"openAiApi":OPENAI}},
  # Set message
  {"id":"n-6a","name":"Audio - Set Mensaje","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1100,200],"parameters":{"mode":"manual","assignments":{"assignments":[{"id":"a1","name":"mensaje","value":"=[AUDIO TRANSCRIPTO] {{ $json.text }}","type":"string"}]},"includeOtherFields":True}},

  # === RAMA IMAGEN ===
  {"id":"n-4b","name":"Imagen - Download Twilio","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[660,400],"parameters":{"method":"GET","url":"={{ $json.media_url }}","authentication":"genericCredentialType","genericAuthType":"httpBasicAuth","options":{"response":{"response":{"responseFormat":"file"}}}}},
  {"id":"n-5b","name":"Imagen - Vision","type":"@n8n/n8n-nodes-langchain.openAi","typeVersion":1.8,"position":[880,400],"parameters":{"resource":"image","operation":"analyze","modelId":{"__rl":True,"mode":"list","value":"gpt-4o"},"text":"Sos un asistente de Inmobiliaria Bochile (Bahia Blanca). Describi BREVEMENTE (1-2 lineas) la foto: si es propiedad (casa/dpto/lote), describi caracteristicas visibles (ambientes, estilo). Si es documento o plano, mencionalo. Si NO es inmobiliario, decilo. NO inventes direcciones ni precios.","inputType":"base64","options":{}},"credentials":{"openAiApi":OPENAI}},
  {"id":"n-6b","name":"Imagen - Set Mensaje","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[1100,400],"parameters":{"mode":"manual","assignments":{"assignments":[{"id":"a1","name":"mensaje","value":"=[IMAGEN RECIBIDA] {{ $json.content || $json.text || $json.response }}{{ $('Parsear Mensaje').item.json.mensaje_original ? ' | Caption: ' + $('Parsear Mensaje').item.json.mensaje_original : '' }}","type":"string"}]},"includeOtherFields":True}},

  # === RAMA TEXTO ===
  {"id":"n-4c","name":"Texto - Set Mensaje","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[660,600],"parameters":{"mode":"manual","assignments":{"assignments":[{"id":"a1","name":"mensaje","value":"={{ $json.mensaje_original }}","type":"string"}]},"includeOtherFields":True}},

  # === MERGE ===
  {"id":"n-7","name":"Merge Caminos","type":"n8n-nodes-base.merge","typeVersion":3.2,"position":[1320,400],"parameters":{"mode":"append","numberInputs":3}},

  # === FLUJO COMUN ===
  {"id":"n-8","name":"Buscar Lead Existente","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1540,400],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $json.lead_id }}"}]},"returnAll":False,"limit":1},"alwaysOutputData":True},
  {"id":"n-9","name":"Upsert Lead CRM","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1760,400],"parameters":{"resource":"row","operation":"upsert","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $(\"Parsear Mensaje\").item.json.lead_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"nombre\": $(\"Parsear Mensaje\").item.json.nombre, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"etapa\": ($json.etapa || \"Nuevo\"), \"actualizado_en\": $(\"Parsear Mensaje\").item.json.timestamp_iso }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"},"alwaysOutputData":True},
  {"id":"n-10","name":"Log Mensaje Entrante","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1980,400],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['convs'],'bochile_conversaciones'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"msg_id\": $(\"Parsear Mensaje\").item.json.msg_id, \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"direccion\": \"in\", \"mensaje\": $json.mensaje, \"intencion_detectada\": $(\"Parsear Mensaje\").item.json.msg_type, \"agente_que_respondio\": \"pending\", \"requiere_humano\": false, \"timestamp\": $(\"Parsear Mensaje\").item.json.timestamp_iso }, \"matchingColumns\": [], \"schema\": [] }) }}"}},

  # AGENT
  {"id":"n-11","name":"Vendedor CORE","type":"@n8n/n8n-nodes-langchain.agent","typeVersion":3.1,"position":[2200,400],"parameters":{"promptType":"define","text":"={{ $(\"Merge Caminos\").item.json.mensaje }}","options":{"systemMessage":PROMPT_CORE,"maxIterations":15}}},
  {"id":"n-12","name":"GPT Vendedor CORE","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[1980,660],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5"},"options":{"temperature":0.4}},"credentials":{"openAiApi":OPENAI}},
  {"id":"n-13","name":"Memoria Conversacion","type":"@n8n/n8n-nodes-langchain.memoryBufferWindow","typeVersion":1.3,"position":[2120,660],"parameters":{"sessionIdType":"customKey","sessionKey":"={{ $(\"Parsear Mensaje\").item.json.telefono }}","contextWindowLength":20}},

  # Calificador
  {"id":"n-14","name":"SubAgente Calificador","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[2260,660],"parameters":{"toolDescription":"CALIFICADOR. Score 0-100 + datos. Llamar apenas tengas contexto basico.","text":"={{ $fromAI(\"conversacion\", \"Resumen conversacion\", \"string\") }}","hasOutputParser":True,"options":{"systemMessage":PROMPT_CALIFICADOR}}},
  {"id":"n-15","name":"GPT Calificador","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2200,880],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.1}},"credentials":{"openAiApi":OPENAI}},
  {"id":"n-16","name":"Parser Calificador","type":"@n8n/n8n-nodes-langchain.outputParserStructured","typeVersion":1.3,"position":[2320,880],"parameters":{"schemaType":"fromJson","jsonSchemaExample":"{\"score\":85,\"etapa\":\"Calificado IA\",\"operacion\":\"venta\",\"tipo\":\"casa\",\"zona\":\"Palihue\",\"ambientes\":4,\"presupuesto_min\":250000,\"presupuesto_max\":300000,\"moneda\":\"USD\",\"forma_pago\":\"mixto\",\"urgencia\":\"alta\",\"razon\":\"...\",\"listo_para_visita\":true,\"requiere_humano\":false}"}},

  # Matcher
  {"id":"n-17","name":"SubAgente Matcher","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[2500,660],"parameters":{"toolDescription":"MATCHER. Cruza criterios con catalogo. Hasta 3 props o SIN_STOCK. Llamar SOLO con operacion+tipo+zona+presupuesto.","text":"={{ $fromAI(\"criterios\", \"JSON criterios\", \"string\") }}","options":{"systemMessage":PROMPT_MATCHER}}},
  {"id":"n-18","name":"GPT Matcher","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2440,880],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.2}},"credentials":{"openAiApi":OPENAI}},
  {"id":"n-19","name":"Leer Catalogo Propiedades","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2580,880],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['props'],'bochile_propiedades'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"publicada","condition":"eq","keyValue":"true"},{"keyName":"operacion","condition":"eq","keyValue":"={{ $fromAI(\"operacion\", \"venta o alquiler\", \"string\") }}"}]},"returnAll":True}},

  # Admin
  {"id":"n-20","name":"SubAgente Administrativo","type":"@n8n/n8n-nodes-langchain.agentTool","typeVersion":2.2,"position":[2740,660],"parameters":{"toolDescription":"ADMIN. Escribe CRM, notifica vendedor. AGENDAR / GUARDAR match / ACTUALIZAR lead.","text":"={{ $fromAI(\"orden\", \"Que hacer + datos\", \"string\") }}","options":{"systemMessage":PROMPT_ADMIN}}},
  {"id":"n-21","name":"GPT Admin","type":"@n8n/n8n-nodes-langchain.lmChatOpenAi","typeVersion":1.3,"position":[2680,880],"parameters":{"model":{"__rl":True,"mode":"list","value":"gpt-5-mini"},"options":{"temperature":0.1}},"credentials":{"openAiApi":OPENAI}},
  {"id":"n-22","name":"Leer Vendedores Activos","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2820,880],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['empleados'],'bochile_empleados'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"activo","condition":"eq","keyValue":"true"},{"keyName":"rol","condition":"eq","keyValue":"vendedor"}]},"returnAll":True}},
  {"id":"n-23","name":"Crear Visita en CRM","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[2960,880],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['visitas'],'bochile_visitas'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"visita_id\": \"V-\" + $now.toMillis(), \"lead_id\": $fromAI(\"lead_id\", \"L-XXX\", \"string\"), \"prop_id\": $fromAI(\"prop_id\", \"P-XXX\", \"string\"), \"vendedor_id\": $fromAI(\"vendedor_id\", \"E-X\", \"string\"), \"vendedor_nombre\": $fromAI(\"vendedor_nombre\", \"nombre\", \"string\"), \"cliente_nombre\": $fromAI(\"cliente_nombre\", \"nombre\", \"string\"), \"direccion\": $fromAI(\"direccion\", \"dir\", \"string\"), \"fecha\": $fromAI(\"fecha\", \"YYYY-MM-DD\", \"string\"), \"hora\": $fromAI(\"hora\", \"HH:MM\", \"string\"), \"estado\": \"agendada\", \"confirmada_cliente\": true, \"notificada_vendedor\": true, \"recordatorio_enviado\": false, \"observaciones\": $fromAI(\"observaciones\", \"notas\", \"string\"), \"creada_en\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-24","name":"Guardar Match Pendiente","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[3100,880],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['matches'],'bochile_matches_pendientes'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"match_id\": \"MP-\" + $now.toMillis(), \"lead_id\": $fromAI(\"lead_id\", \"ID\", \"string\"), \"lead_nombre\": $fromAI(\"lead_nombre\", \"nombre\", \"string\"), \"lead_telefono\": $fromAI(\"lead_telefono\", \"tel\", \"string\"), \"operacion\": $fromAI(\"operacion\", \"op\", \"string\"), \"tipo\": $fromAI(\"tipo\", \"tipo\", \"string\"), \"zona\": $fromAI(\"zona\", \"zona\", \"string\"), \"ambientes_min\": $fromAI(\"ambientes_min\", \"min\", \"number\"), \"presupuesto_min\": $fromAI(\"presupuesto_min\", \"min\", \"number\"), \"presupuesto_max\": $fromAI(\"presupuesto_max\", \"max\", \"number\"), \"moneda\": $fromAI(\"moneda\", \"mon\", \"string\"), \"caracteristicas_must\": $fromAI(\"caracteristicas_must\", \"must\", \"string\"), \"activo\": true, \"creado_en\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-25","name":"Actualizar Lead CRM","type":"n8n-nodes-base.dataTableTool","typeVersion":1.1,"position":[3240,880],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $fromAI(\"lead_id\", \"ID\", \"string\") }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"operacion\": $fromAI(\"operacion\", \"op\", \"string\"), \"tipo_propiedad\": $fromAI(\"tipo_propiedad\", \"tipo\", \"string\"), \"zona_pref\": $fromAI(\"zona_pref\", \"zona\", \"string\"), \"ambientes\": $fromAI(\"ambientes\", \"amb\", \"number\"), \"presupuesto_min\": $fromAI(\"presupuesto_min\", \"min\", \"number\"), \"presupuesto_max\": $fromAI(\"presupuesto_max\", \"max\", \"number\"), \"moneda\": $fromAI(\"moneda\", \"mon\", \"string\"), \"forma_pago\": $fromAI(\"forma_pago\", \"pago\", \"string\"), \"urgencia\": $fromAI(\"urgencia\", \"urg\", \"string\"), \"score\": $fromAI(\"score\", \"0-100\", \"number\"), \"etapa\": $fromAI(\"etapa\", \"etapa\", \"string\"), \"vendedor_asignado\": $fromAI(\"vendedor_asignado\", \"E-X\", \"string\"), \"ultima_intencion\": $fromAI(\"ultima_intencion\", \"intencion\", \"string\"), \"notas\": $fromAI(\"notas\", \"notas\", \"string\"), \"actualizado_en\": $now.toISO() }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"}},
  # Avisar Vendedor via Twilio (toolTwilio NO existe, uso twilioTool)
  {"id":"n-26","name":"Avisar Vendedor por WhatsApp Twilio","type":"n8n-nodes-base.twilioTool","typeVersion":1,"position":[3380,880],"parameters":{"operation":"send","from":"={{ $env.BOCHILE_TWILIO_FROM }}","to":"={{ $fromAI(\"telefono_vendedor\", \"Numero del vendedor con prefijo whatsapp: y +54 (ej whatsapp:+5492914401120)\", \"string\") }}","toWhatsapp":True,"message":"={{ $fromAI(\"mensaje\", \"Mensaje completo formato VISITA AGENDADA PARA LAS HH:MM CON [CLIENTE] EN [DIRECCION]\", \"string\") }}"},"credentials":{"twilioApi":TWILIO}},

  # Post-CORE
  {"id":"n-27","name":"Log Mensaje Saliente","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[2420,400],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['convs'],'bochile_conversaciones'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"msg_id\": \"M-\" + $now.toMillis() + \"-out\", \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"telefono\": $(\"Parsear Mensaje\").item.json.telefono, \"canal\": $(\"Parsear Mensaje\").item.json.canal, \"direccion\": \"out\", \"mensaje\": $json.output, \"intencion_detectada\": \"\", \"agente_que_respondio\": \"Vendedor CORE\", \"requiere_humano\": false, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  {"id":"n-28","name":"Registrar Accion IA","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[2640,400],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['acciones'],'bochile_acciones_ia'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"accion_id\": \"A-\" + $now.toMillis(), \"tipo\": \"conversacion_atendida\", \"agente\": \"Vendedor CORE\", \"lead_id\": $(\"Parsear Mensaje\").item.json.lead_id, \"resumen\": \"Mensaje \" + $(\"Parsear Mensaje\").item.json.msg_type + \" atendido via Twilio\", \"detalle\": ($(\"Vendedor CORE\").item.json.output || \"\").substring(0, 400), \"resultado\": \"ok\", \"tiempo_ahorrado_min\": 4, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
  # Send via Twilio (no Meta)
  {"id":"n-29","name":"Responder al Cliente Twilio","type":"n8n-nodes-base.twilio","typeVersion":1,"position":[2860,400],"parameters":{"operation":"send","from":"={{ $env.BOCHILE_TWILIO_FROM }}","to":"={{ $(\"Parsear Mensaje\").item.json.telefono_twilio }}","toWhatsapp":True,"message":"={{ $(\"Vendedor CORE\").item.json.output }}"},"credentials":{"twilioApi":TWILIO}},
  # Twilio espera 200 OK rápido con TwiML vacío o JSON
  {"id":"n-30","name":"OK al Webhook","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.5,"position":[3080,400],"parameters":{"respondWith":"text","responseBody":"<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>","options":{"responseHeaders":{"entries":[{"name":"Content-Type","value":"application/xml"}]}}}}
]

conns = {
  "Webhook Twilio":{"main":[[{"node":"Parsear Mensaje","type":"main","index":0}]]},
  "Parsear Mensaje":{"main":[[{"node":"Switch Tipo Mensaje","type":"main","index":0}]]},
  "Switch Tipo Mensaje":{"main":[
    [{"node":"Texto - Set Mensaje","type":"main","index":0}],
    [{"node":"Audio - Download Twilio","type":"main","index":0}],
    [{"node":"Imagen - Download Twilio","type":"main","index":0}]
  ]},
  "Audio - Download Twilio":{"main":[[{"node":"Audio - Whisper","type":"main","index":0}]]},
  "Audio - Whisper":{"main":[[{"node":"Audio - Set Mensaje","type":"main","index":0}]]},
  "Audio - Set Mensaje":{"main":[[{"node":"Merge Caminos","type":"main","index":1}]]},
  "Imagen - Download Twilio":{"main":[[{"node":"Imagen - Vision","type":"main","index":0}]]},
  "Imagen - Vision":{"main":[[{"node":"Imagen - Set Mensaje","type":"main","index":0}]]},
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
  "Avisar Vendedor por WhatsApp Twilio":{"ai_tool":[[{"node":"SubAgente Administrativo","type":"ai_tool","index":0}]]},
  "Log Mensaje Saliente":{"main":[[{"node":"Registrar Accion IA","type":"main","index":0}]]},
  "Registrar Accion IA":{"main":[[{"node":"Responder al Cliente Twilio","type":"main","index":0}]]},
  "Responder al Cliente Twilio":{"main":[[{"node":"OK al Webhook","type":"main","index":0}]]}
}

# Borrar W1 v3
try:
    req = urllib.request.Request('http://localhost:5680/api/v1/workflows/1mdYkXwFWmKaTLEs', headers={'X-N8N-API-KEY': KEY}, method='DELETE')
    urllib.request.urlopen(req)
    print("Borrado W1 v3 multimodal (Meta)")
except Exception as e:
    print(f"No se borro: {e}")

payload = {"name":"Bochile - Chatbot Multi-Agente CORE (v4 Twilio)","nodes":nodes,"connections":conns,"settings":{"executionOrder":"v1"}}
req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read())
        print(f"OK W1 v4 TWILIO: {res.get('id')} | {res.get('name')}")
        print(f"Nodos: {len(res.get('nodes',[]))}")
except urllib.error.HTTPError as e:
    print(f"ERROR {e.code}: {e.read().decode()[:800]}")
