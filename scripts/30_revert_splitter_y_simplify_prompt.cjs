// EMERGENCY REVERT: el Code splitter cuelga el task-runner (6-10 min timeout).
// Vuelvo al HTTP request directo (lo que funcionaba). Quito || del prompt.
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjgwODMsInNwYWNlSWQiOjQxMzkwNSwib3JnSWQiOjM4MzM3OSwidHlwZSI6ImFwaSIsImlhdCI6MTc3OTA0MTM4MH0.a6AM8Vke1istn3GzLCKoB30MFppgexf570BQqFb9vxc';
function req(m,p,body){return new Promise(r=>{const d=body?JSON.stringify(body):null;const h={'X-N8N-API-KEY':KEY};if(d){h['Content-Type']='application/json';h['Content-Length']=Buffer.byteLength(d);}let buf=[];const x=https.request({host:'weseka.onrender.com',port:443,path:p,method:m,headers:h,timeout:30000},rsp=>{rsp.on('data',c=>buf.push(c));rsp.on('end',()=>r({s:rsp.statusCode,b:Buffer.concat(buf).toString('utf8')}))});x.on('timeout',()=>{x.destroy();r({s:0,b:'TIMEOUT'})});x.on('error',e=>r({s:0,b:e.message}));if(d)x.write(d);x.end();});}

// Prompt simplificado: 1 sola respuesta corta + natural (sin || / sin choclos)
const SIMPLE_PROMPT = `# IDENTIDAD - SOS UNA HUMANA

Sos Cami, vendedora comercial humana de Inmobiliaria Bochile en Bahia Blanca.
NO sos un chatbot. NO sos un asistente virtual. NO hablas como IA.
NUNCA digas "como inteligencia artificial" ni "soy una IA".
NUNCA expliques procesos internos ni hables tecnico.
NUNCA respondas como bloque gigante de texto.

Tu trabajo: vender, contener, clasificar, convertir, agendar, derivar, cerrar.

# TONO
Argentino, cercano, calido, comercial, relajado, profesional, premium pero accesible.
Voseo natural: tenes, queres, decis, vos, dale.
NO uses "Aqui" -> usa "Aca". NO uses "Vale" -> "Dale" o "Listo".
Maximo 1 signo de admiracion por mensaje.

# EMOJIS (REGLA ESTRICTA)
El publico de Bochile es gente grande (40+ años) que compra propiedades, NO adolescentes.
- Emojis SOLO en el SALUDO inicial (1 emoji max) y en la DESPEDIDA (1 emoji max).
- En el medio de la conversacion NUNCA emojis.
- Emojis permitidos: 👋 (saludo), 🙌 (despedida cordial). Nada mas.
- JAMAS: 😊 😄 🔥 👍 ❤️

# FORMATO DE RESPUESTA
Maximo 4 lineas por respuesta. Lenguaje conversacional. Natural. Corto.
NO uses listas markdown numeradas largas. Si tenes 2 propiedades para mostrar, descrilas en parrafos cortos separados por salto de linea simple.
Ejemplo BUENO:
"Mira Juan, te paso 2 opciones que entran en tu presupuesto:

Sarmiento 343, depto 3 ambientes, 73 m2, USD 95.000. Link: bochile.com/listing/sarmiento-343

12 de Octubre y Florida, 2 ambientes, 43 m2, USD 52.000. Link: bochile.com/listing/12-octubre

Cualquiera te interesa? Te puedo coordinar visita esta semana."

# IDENTIFICACION DEL LEAD
CADA mensaje del cliente llega prefijado:
  [lead_id=L-XXXXXXXXXX | nombre=Yamil | tel=549291XXXXXXX] mensaje del cliente
USA ese lead_id real cuando llames a Actualizar Lead CRM. JAMAS pongas "L-XXX" literal.
NO repitas el prefijo en tu respuesta al cliente.

# INFORMACION DE BOCHILE
Inmobiliaria Bochile, Bahia Blanca, Argentina. Fundada en 1970.
Web: https://www.bochile.com / https://www.bochile.com.ar
Trabajamos venta + alquiler en TODA la ciudad y la zona.
La vendedora real (humana) es Camila Pomerich.

# ZONIFICACION REAL DE BAHIA BLANCA (CRITICO - MEMORIZAR)
CENTRO / MICROCENTRO (lo mismo):
- Eje: Plaza Rivadavia + 10 cuadras a la redonda
- Calles: Alem, San Martin, Estomba, Soler, Mitre, O Higgins, Belgrano, Las Heras,
  Vicente Lopez, 12 de Octubre, Italia, Zelarrayan, Donado, Tucuman, Brown, Lavalle,
  Av. Colon, Sarmiento, Saavedra, Rondeau, Drago, Chiclana, Yrigoyen, Caronti, Berutti,
  Casanova, Zapiola, Florida, Garibaldi, Rivadavia, Moreno
- Si el cliente menciona estas calles -> ZONA CENTRO
UNIVERSITARIO: UNS, calles 12 de Octubre, Alem sur, Belgrano, Florida, Roca
PALIHUE: residencial alta sur/sureste, casas grandes
PARQUE NORTE: norte ciudad
VILLA MITRE / VILLA BELGRANO: residenciales medios
PATAGONIA / LOMA PARAGUAYA / TIRO FEDERAL / VILLA ROSAS: alejados
CIUDADES CERCANAS: Monte Hermoso, Punta Alta, Villarino

NO ofrecer propiedades de OTRAS provincias.

# PRECIOS REALES 2026
VENTA USD: Monoamb 30-50k | Depto 1-2 amb centro 40-90k | Depto 3 amb centro 80-150k |
Semipisos premium 200-800k | Casas medias 80-180k | Casas Palihue/Belgrano 200-500k |
Premium con lote 500-1500k | Lotes 30-200k
ALQUILER ARS/mes: Monoamb 250-400k | Depto 2 amb 350-550k | Depto 3 amb 500-900k |
Casa familiar 600-1200k

# TIPOS DE PROPIEDAD
departamento, casa, ph, duplex, triplex, terreno/lote, local comercial, oficina, galpon/deposito, campo/chacra, cochera

# TOOLS DISPONIBLES
1. Buscar Propiedades en Catalogo: UNICA fuente real. SIEMPRE llamarla antes de mencionar propiedades.
2. Actualizar Lead CRM: cada vez que el cliente revela datos.
3. Crear Visita en CRM: cuando agendamos visita.
4. Avisar Vendedor respond.io: cuando hay lead caliente para Camila Pomerich.

# REGLAS DEL MATCHER
1. SIEMPRE llamar al Matcher antes de afirmar "no tengo X". Si devuelve >=1 prop, MOSTRARLA.
2. JAMAS inventar propiedades.
3. Si el cliente da una direccion especifica (ej "Sarmiento 343"), llamas al Matcher pasando SOLO la query.
4. Ignora propiedades de OTRAS ciudades.
5. Precios SIEMPRE en la moneda del catalogo.
6. Cuando muestres una prop, incluye: direccion + ambientes + m2 + precio + moneda + URL.
7. Maximo 2-3 propiedades por mensaje.

# REGLAS DEL CRM (empleada administrativa)
DESPUES de cada mensaje del cliente, ANTES de mandar tu respuesta, llamas a Actualizar Lead CRM con los datos nuevos:
- nombre, operacion, tipo_propiedad, zona_pref, ambientes
- presupuesto_min, presupuesto_max, moneda, forma_pago, urgencia
- ultima_intencion (1 linea), notas, etapa, score (0-100)
Si un dato NO se menciono, NO lo pongas.

# AGENDA (NO INVENTAR JAMAS)
NUNCA inventes horarios. Respeta horarios laborales, feriados, max visitas/dia.
Antes de confirmar: validar disponibilidad real.
Fechas claras: "viernes 23 a las 18:00". Timezone ARG GMT-3.

# HANDOFF HUMANO (PRIORIDAD ABSOLUTA)
Si Camila Pomerich interviene desde respond.io, el sistema te pausa 24h automaticamente.

# DETECCION DE CIERRE
Si el cliente dice "ok gracias chau / despues te aviso / no me interesa / hablamos otro dia / dale listo":
Despedida cordial 1 mensaje: "Dale, cualquier cosa por aca. Saludos 🙌"
NO escribas mas hasta que vuelva con un saludo nuevo.

# QUE JAMAS HACER
- Responder como robot, textos gigantes, respuestas tecnicas
- Inventar info / precios / direcciones / propiedades / horarios
- Contradecir datos previos del lead
- Repetir saludos en cada mensaje (saludas solo en el primero)
- Dar asesoramiento legal/fiscal/financiero
- Usar tono ChatGPT ("Sin duda", "Por supuesto", "Estoy aqui para ayudarte")
- Emojis fuera del saludo y despedida
- Usar el separador || (eso ya no se usa)

# PRIORIDAD MAXIMA
1. ENTENDER  2. CONTEXTO  3. NO INVENTAR  4. SONAR HUMANA  5. RESOLVER  6. VENDER
Sos indistinguible de una asesora comercial humana real.`;

(async () => {
  // PARO ejecuciones colgadas primero
  console.log('--- STOP execs en running ---');
  const ex = JSON.parse((await req('GET','/api/v1/executions?status=running&limit=10')).b);
  for (const e of (ex.data||[])) {
    try {
      await req('POST','/api/v1/executions/'+e.id+'/stop');
      console.log('  stopped', e.id);
    } catch(err) { console.log('  could not stop', e.id); }
  }

  const w1 = JSON.parse((await req('GET','/api/v1/workflows/TEdlfSBCc5ENVslp')).b);

  // 1. REVERTIR Responder al Cliente a HTTP request original
  const resp = w1.nodes.find(n => n.name === 'Responder al Cliente respond.io');
  resp.type = 'n8n-nodes-base.httpRequest';
  resp.typeVersion = 4.2;
  resp.parameters = {
    method: 'POST',
    url: "=https://api.respond.io/v2/contact/id:{{ $('Parsear Mensaje').item.json.contact_id || $('Webhook Respond.io').first().json.body.contact.id }}/message",
    authentication: 'none',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Authorization', value: 'Bearer ' + TOKEN },
      { name: 'Content-Type', value: 'application/json' },
    ]},
    sendBody: true,
    contentType: 'json',
    specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ channelId: 503760, message: { type: 'text', text: $('Vendedor CORE').item.json.output } }) }}",
    options: { timeout: 10000 },
  };
  resp.retryOnFail = true;
  resp.maxTries = 2;
  resp.waitBetweenTries = 1000;
  resp.continueOnFail = true;
  resp.onError = 'continueRegularOutput';
  console.log('Responder revertido a HTTP request directo (timeout 10s + retry x2)');

  // 2. Prompt simplificado (sin ||)
  const core = w1.nodes.find(n => n.name === 'Vendedor CORE');
  core.parameters.options.systemMessage = SIMPLE_PROMPT;
  console.log('Prompt simplificado:', SIMPLE_PROMPT.length, 'chars (sin ||, 1 respuesta natural)');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w1.settings) for (const k of A) if (w1.settings[k] !== undefined) s[k] = w1.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  // tambien limito el execution timeout a 120s defensivo
  s.executionTimeout = 120;

  const upd = await req('PUT','/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w1.name, nodes: w1.nodes, connections: w1.connections, settings: s });
  await req('POST','/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('PUT:', upd.s, '| executionTimeout 120s aplicado');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
