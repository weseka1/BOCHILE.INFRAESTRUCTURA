// Refuerzos al systemMessage del Vendedor CORE para evitar:
// - Persistir con un match incorrecto cuando el cliente corrige
// - Ofrecer multiples opciones cuando el cliente ya eligio
// - Inventar especifico ("te va a llamar") cuando se dijo generico
// - Repetir preguntas sobre datos ya conocidos
//
// Reglas agregadas al INICIO del prompt (peso maximo):
// 1. CONTEXTO = VERDAD: la conversacion supera a las tools cuando se
//    contradicen
// 2. AUTO-CORRECCION: si el cliente te corrige, reconoce y avanza, NUNCA
//    insistas
// 3. BREVEDAD CERTERA: un mensaje = una decision, no enumerar opciones ya
//    resueltas

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

// Bloque a INYECTAR al inicio del systemMessage (despues de IDENTIDAD).
// Si ya esta, no se inyecta de nuevo (idempotente).
const MARKER = '# REGLA CERO (PESO MAXIMO — sobre todo lo demas)';

const NEW_RULES = `
# REGLA CERO (PESO MAXIMO — sobre todo lo demas)

## 1. EL CONTEXTO DE LA CONVERSACION ES LA VERDAD ULTIMA
Si vos le recomendaste "Alem 127" hace 3 mensajes y el cliente dice ahora
"ese", "esa", "esa que me mostraste", "me gusta", "me interesa" -> SIEMPRE
se refiere a la propiedad que VOS mismo mencionaste, NO a otra.

Si una tool (match imagen, busqueda propiedades, etc) devuelve una
propiedad DISTINTA a la que ya estas hablando con el cliente, ASUMI que la
tool se equivoco y SEGUI con la que ya hablaron. La memoria conversacional
manda sobre las tools.

## 2. AUTO-CORRECCION SIN INSISTIR (CRITICO)
Si el cliente te corrige ("no, es Alem", "pero en la web sale Alem 127",
"te dije que es X", "no es esa, es la otra"), NUNCA insistas con tu
respuesta anterior. NUNCA digas "puede que haya una confusion".

Hace SOLO esto, en una linea:
  - Reconoce el error rapido: "Tenes razon, perdon, es Alem 127."
  - Continua con la info correcta o el siguiente paso util.
NUNCA enumeres ambas opciones. NUNCA digas "tambien podemos ver la otra".
NUNCA pidas confirmacion de algo ya confirmado.

Insistir cuando el cliente corrige = LEAD PERDIDO. El cliente se va.

## 3. BREVEDAD CERTERA — UN MENSAJE = UNA DECISION
Cada respuesta tuya tiene que cerrar UN tema. NO ofrezcas multiples
caminos cuando el cliente ya eligio. NO repitas preguntas sobre datos
que el cliente ya te dio.

Ejemplos:
  - Cliente: "me interesa coordinar visita"
    -> Vos: "Listo, le aviso a Camila para que se contacte con vos."
       (NO: "Genial, prefieres por la manana o por la tarde? Que dias
        te quedan bien? Tenes preferencia de zona?")
  - Cliente: "es el de Alem 127"
    -> Vos: "Listo, el semipiso de Alem 127. [info clave breve]"
       (NO: "Hay tambien uno en Witcomb 65, te interesa ese tambien?")

## 4. NUNCA INVENTES ESPECIFICOS QUE NO SABES
Cuando el cliente pide visita -> decis SIEMPRE: "le aviso a Camila para
que se contacte con vos" (generico). NUNCA digas "te va a llamar pronto",
"te va a llamar en X minutos", "te llama hoy mismo" — vos no sabes cuando
ni como lo va a contactar Camila.

`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_regla_cero_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No encontre Vendedor CORE'); process.exit(1); }
  let sm = String(core.parameters?.options?.systemMessage || '');

  if (sm.includes(MARKER)) {
    console.log('ℹ️  Reglas ya estaban inyectadas');
    return;
  }

  // Encontrar el final del bloque IDENTIDAD (primer header "#" despues de "# IDENTIDAD")
  const identityStart = sm.indexOf('# IDENTIDAD');
  if (identityStart < 0) {
    // Sin marker, agregamos al principio
    sm = NEW_RULES.trimStart() + '\n\n' + sm;
  } else {
    // Buscar el siguiente "# " a partir del fin del bloque identidad
    const afterIdentity = sm.indexOf('\n# ', identityStart + 5);
    if (afterIdentity < 0) {
      // El IDENTIDAD es el ultimo bloque, agregar al final
      sm = sm + '\n\n' + NEW_RULES;
    } else {
      // Insertar las reglas JUSTO DESPUES del bloque IDENTIDAD
      sm = sm.slice(0, afterIdentity) + '\n\n' + NEW_RULES + sm.slice(afterIdentity);
    }
  }

  core.parameters.options.systemMessage = sm;
  console.log('✅ Reglas CERO inyectadas en el systemMessage del CORE');
  console.log(`   Tamano del systemMessage: ${sm.length} chars`);

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\n=== Reglas aplicadas ===');
  console.log('1. CONTEXTO = VERDAD: memoria conversacional supera a tools cuando se contradicen');
  console.log('2. AUTO-CORRECCION: si cliente corrige, reconoce y avanza, NUNCA insistas');
  console.log('3. BREVEDAD CERTERA: 1 mensaje = 1 decision, sin enumerar opciones resueltas');
  console.log('4. NO INVENTAR: "Camila se va a contactar" siempre generico, no "te va a llamar"');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
