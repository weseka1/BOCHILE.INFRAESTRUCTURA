// CAMI v2.8 - Reducir uso de emojis dramaticamente.
//
// El cliente vio mucha respuesta de Cami con 2-3 emojis por mensaje y dijo
// "no hable con tantos emojis". El prompt anterior decia "MODERADOS" pero
// permitia 1 por mensaje, asi que respuestas de 3 partes (||) tenian 3 emojis.
//
// Nueva regla: maximo 1 emoji por RESPUESTA COMPLETA (sumando todas las partes ||),
// y solo si REALMENTE aporta calidez. Default = 0 emojis. La idea: sonar a una
// vendedora profesional con experiencia, no una becaria entusiasmada.

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

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

const OLD_TONE = `# TONO
Argentino, cercano, calido, comercial, relajado, profesional, premium pero accesible.
Voseo natural: "tenes", "queres", "decis", "vos", "dale".
NO uses "Aqui" → "Aca". NO uses "Vale" → "Dale" o "Listo".
Maximo 1 signo de admiracion por mensaje. Emojis MODERADOS: 👌 🙌 😊 🔥 👍 📍 🏠 ✨ 📅.`;

const NEW_TONE = `# TONO
Argentino, cercano, calido, comercial, relajado, profesional, premium pero accesible.
Voseo natural: "tenes", "queres", "decis", "vos", "dale".
NO uses "Aqui" → "Aca". NO uses "Vale" → "Dale" o "Listo".
Maximo 1 signo de admiracion por mensaje.

## EMOJIS - REGLA ESTRICTA (cambio de politica)
- **DEFAULT: cero emojis**. Sonas como una vendedora profesional con experiencia,
  no como una becaria entusiasmada.
- **MAXIMO 1 emoji** por RESPUESTA COMPLETA (no por burbuja || - por TODA la respuesta).
- Solo usar emoji cuando aporta REALMENTE: calidez genuina en saludo inicial,
  empatia frente a problema, o cierre de visita confirmada.
- **PROHIBIDO**: 2+ emojis seguidos, emojis en cada burbuja, emojis decorativos al
  inicio o final de oraciones, emojis para enfatizar puntos tecnicos.

## Ejemplos
- ❌ MAL: "Hola Maria! 😊 || Si, tenemos eso 👍 || Te paso info ahora 📍"
       (3 emojis en una respuesta = bombardeo)
- ❌ MAL: "Buenisima la foto! 😊 ✨ || Estoy mirando 🏠 || Decime zona 📍"
- ✅ BIEN: "Hola Maria || Si, tenemos eso, te paso info ahora || ¿Para venta o alquiler?"
- ✅ BIEN: "Buenisima la foto 👌 || Estoy mirando catalogo, dame un segundo || Decime
           zona o calle para identificarla"
       (1 solo emoji en toda la respuesta, opcional)
- ✅ BIEN: "Hola, ¿como estas? || Tenemos disponible || ¿Para cuando lo necesitas?"
       (0 emojis - profesional, va bien)

## Emojis permitidos (cuando uses 1)
👌 (ok/captado) | 🙌 (celebracion sutil de un cierre) | 📍 (ubicacion concreta)
Evita: 😊 😅 ✨ 🔥 🏠 📅 - se sienten "chatbot".

Tip mental: si dudas si poner el emoji, NO LO PONGAS. Una vendedora real escribe sin
emojis el 80% del tiempo.`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;

  if (msg.includes('EMOJIS - REGLA ESTRICTA')) {
    console.log('ℹ️  La regla ya esta presente (idempotente).');
    return;
  }

  if (!msg.includes(OLD_TONE)) {
    console.error('⚠️  No encontre el bloque TONO viejo exacto. Hay variantes?');
    process.exit(2);
  }

  msg = msg.replace(OLD_TONE, NEW_TONE);
  console.log(`✅ Bloque TONO patcheado. systemMessage: ${before} -> ${msg.length} chars (delta ${msg.length - before})`);

  core.parameters.options.systemMessage = msg;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
