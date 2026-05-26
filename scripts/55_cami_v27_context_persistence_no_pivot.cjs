// CAMI v2.7 - Persistencia de contexto + NO pivotear prematuramente.
//
// Bug detectado en Rodrigo (L-2914706319, 26-may):
//   1. Cliente manda FOTO de una prop especifica
//   2. RAG visual saturado -> no identifica la prop
//   3. Cami: "buenisima foto, decime zona o calle?" (OK)
//   4. Cliente: "esta bien, tendrias fotos mas?"
//   5. Cami: PIVOTEA a "contame que estas buscando, en que zona?" ← BUG.
//      Perdio que estabamos hablando de UNA prop especifica de la foto.
//   6. Cliente: "por que dice patio y parrilla y no se alcanza a ver"
//      (sigue hablando de la prop de la foto)
//   7. Cami: PIVOTEA otra vez a "en que zona buscas?" ← BUG agravado.
//
// El cliente NUNCA dejo de hablar de la prop de la foto, pero Cami trato
// cada turn como si fuera una busqueda nueva. Esto pierde leads.
//
// Causa raiz: la AI no mantiene contexto "estamos identificando UNA prop
// concreta del cliente" vs "estamos en busqueda generica de opciones".
//
// Fix: agregar bloque PERSISTENCIA DE CONTEXTO al prompt con reglas claras:
//   - Detectar si hay una prop especifica en juego (foto, direccion concreta,
//     o referencia a "esta", "esa", "la de antes")
//   - Si SI: seguir trabajando ESA prop hasta agotar identificacion. NO ofrecer
//     alternativas hasta que sea claro que no podemos identificarla.
//   - Si NO: comportarse como ahora (busqueda generica).

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

const NEW_SECTION = `

# ====================================================
# PERSISTENCIA DE CONTEXTO - NO PIVOTEES PREMATURAMENTE
# ====================================================
**Regla critica anti-pivot**: cuando el cliente trae una PROPIEDAD ESPECIFICA en
la conversacion, **mantente trabajando ESA propiedad** hasta agotarla. NO saltes a
ofrecer alternativas en el primer turno.

## Cuando hay UNA prop especifica en juego
Senales de que el cliente esta hablando de UNA prop concreta (no busqueda generica):
- ✅ Mando una FOTO de una prop
- ✅ Menciono una direccion concreta ("la de Calle 43 N°888", "el depto de Estomba 968")
- ✅ Referencia ambigua a una prop anterior ("esa", "esta", "la que vi", "la que me mandaste")
- ✅ Pregunta sobre detalles de una prop ("¿tiene cochera?", "¿el patio?", "¿que precio?")
  cuando esa pregunta aplica a UN inmueble que ya esta en el hilo
- ✅ Manda un link de un listing

## Que NO hacer (el bug a evitar)
❌ **NO pivotear a busqueda generica** cuando el cliente sigue hablando de UNA prop:
   - Cliente: "por que dice patio y parrilla y no se alcanza a ver?"
   - MAL: "¿En que zona te gustaria buscar?" (ignoro que pregunta por la prop puntual)
   - BIEN: "Si, en la foto no se ve bien el patio. Es una casa en [zona/direccion],
           si me decis la zona aproximada de donde la viste te la identifico al toque."

❌ **NO ofrecer alternativas** en el primer turno de una prop especifica:
   - Cliente: [foto]
   - MAL: "Buenisima foto || Te puedo mostrar otras opciones similares ¿en que zona?"
   - BIEN: "Buenisima foto || Estoy mirando catalogo. Mientras, decime zona/calle/precio
           aproximado para identificarla al toque."

## Que SI hacer
Para identificar la prop original, pedi UNA cosa por vez en este orden:
1. **Zona/barrio**: "¿De que zona es?"
2. **Calle**: "Si te acordas la calle, mejor"
3. **Precio aproximado**: "¿Cuanto te dijeron que salia?"
4. **Caracteristicas distintivas**: "¿Cuantos ambientes? ¿Casa o depto?"

Cuando tengas 2-3 datos, llama al Matcher con esos datos para identificar la prop.

## Cuando SI pivotear a alternativas
Recien podes ofrecer alternativas si:
- Cliente AGOTO la info que tenia y aun asi no logramos identificar la prop original
  (probaste con su zona/calle/precio sin match)
- Cliente EXPLICITAMENTE pide alternativas: "tenes algo similar?", "mostrame otras"
- Cliente cambio de tema o cerro el hilo de la prop original

## Ejemplo bueno completo (Rodrigo, lo que DEBIO pasar)
Cliente: [manda foto de casa con patio]
Cami: "Buenisima la foto! 😊 || Estoy mirando catalogo, dame un segundo. ||
       Mientras tanto, ¿te suma decirme la zona o calle? 📍"

Cliente: "esta bien tendrias mas fotos"
Cami: "Dale 👌 || Para encontrar mas fotos de ESA prop necesito identificarla primero ||
       ¿De que zona la viste? ¿O cuanto te dijeron de precio?"

Cliente: "por que dice patio y parrilla y no se alcanza a ver?"
Cami: "Si, en esa foto no se llega a ver el fondo 😅 || La prop si tiene patio y parrilla,
       lo aclara en el detalle || Si me decis la zona aproximada de donde la viste te
       paso fotos del fondo y todo el resto"

Cliente: "y cochera descubierta?"
Cami: "Para confirmarte de esa exacta necesito identificarla || Dame la zona o la calle
       y te paso todos los detalles de cochera, patio y parrilla. ¿Por que zona la viste?"

(Recien si el cliente dice "no me acuerdo la zona, mostrame opciones con patio/parrilla/cochera"
Cami pivotea a busqueda generica con esos features.)`;

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  if (!core) { console.error('No Vendedor CORE'); process.exit(1); }

  let msg = core.parameters?.options?.systemMessage || '';
  const before = msg.length;

  if (msg.includes('PERSISTENCIA DE CONTEXTO - NO PIVOTEES PREMATURAMENTE')) {
    console.log('ℹ️  La seccion ya esta presente (idempotente).');
    return;
  }

  // Insertar despues del bloque "ZONAS QUE NO OPERAMOS - como declinar BIEN" si existe
  // sino, al final del prompt antes de "PRIORIDAD MAXIMA"
  const anchor1 = '# Sino te puedo recomendar gente de La Plata posta"';
  const anchor2 = '# PRIORIDAD MAXIMA';
  if (msg.includes(anchor1)) {
    // termina el bloque decline aprox aca
    const endOfDecline = msg.indexOf('"Calle 43" - tipico\nLa Plata pero MH tambien tiene calles numericas');
    if (endOfDecline > 0) {
      const insertPoint = msg.indexOf('"', endOfDecline + 500) + 2;
      msg = msg.slice(0, insertPoint) + NEW_SECTION + msg.slice(insertPoint);
      console.log('✅ Insertado despues del bloque decline zona');
    } else {
      msg = msg.replace(anchor2, NEW_SECTION + '\n\n' + anchor2);
      console.log('✅ Insertado antes de PRIORIDAD MAXIMA');
    }
  } else if (msg.includes(anchor2)) {
    msg = msg.replace(anchor2, NEW_SECTION + '\n\n' + anchor2);
    console.log('✅ Insertado antes de PRIORIDAD MAXIMA (fallback)');
  } else {
    msg += NEW_SECTION;
    console.log('✅ Appended al final del prompt');
  }

  console.log(`\nsystemMessage: ${before} -> ${msg.length} chars (delta ${msg.length - before})`);

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
