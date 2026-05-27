// FIX critico: el nodo "Formatear Match CLIP" no usa el caption del cliente
// para desempatar candidatos visualmente parecidos. Resultado: con la foto
// del Alem 127 (caption "este es el de alem que me encanto") el sistema
// elige Witcomb 65 porque score CLIP esta 0.003 arriba.
//
// Fix:
// 1. Si el caption menciona una palabra que aparece en address/barrio/zona/
//    titulo de algun candidato (excluyendo stopwords) -> ese candidato gana.
// 2. Si scores top1 y top2 estan a menos de 0.05 y el caption no resuelve,
//    el bot pide aclaracion en vez de confirmar.
// 3. Si caption_match resolvio sin ambiguedad -> [CONFIRMADO] con esa prop.

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

const NEW_JS_CODE = `// Formatear Match CLIP v5 - USA EL CAPTION COMO GROUND TRUTH
try {
  const inp = $input.first().json || {};
  const parserData = $("Parsear Mensaje").first().json || {};
  const caption = String(parserData.mensaje_original || "");

  let items = Array.isArray(inp.items) ? inp.items : [];
  const hasError = inp.error || (typeof inp.data === 'string' && inp.data.indexOf('502') >= 0) || (typeof inp.body === 'string' && inp.body.indexOf('502') >= 0);

  // ============================================================
  // CAPTION RE-RANK: si el cliente menciona una calle/barrio que
  // matchea con address/title/zona de un candidato, ese GANA.
  // Tomamos solo palabras significativas (>=3 chars, no stopword).
  // ============================================================
  const STOP = new Set([
    'este','esa','ese','eso','esto','con','que','para','del','los','las',
    'encanto','encanta','encantó','propiedad','prop','depto','dpto',
    'departamento','casa','barrio','calle','foto','imagen','foto','mira',
    'mismo','misma','este','aca','aquí','aqui','hola','buena','bueno','seria',
    'que','quee','quee','muy','mas','más','pero','tambien','también',
    'gracias','dale','listo','perfecto','genial','hermoso','hermosa','linda',
    'lindo','copado','copada','copao','vimos','vi','vista','vivo','venta',
    'alquiler','venden','alquilan','quiero','queria','quería','vender','comprar',
    'me','te','se','le','tu','la','el','un','una','de','y','o','a','en',
  ]);

  function normalize(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9\\s]+/g, ' ');
  }

  function captionKeywords(c) {
    return normalize(c).split(/\\s+/).filter(w => w.length >= 3 && !STOP.has(w));
  }

  function itemHaystack(it) {
    return normalize([it.title, it.address, it.barrio, it.zona].filter(Boolean).join(' '));
  }

  let captionMatchPropId = null;
  let captionMatchedWord = null;

  if (caption && items.length > 0) {
    const keywords = captionKeywords(caption);
    if (keywords.length > 0) {
      // Buscar el item cuyo haystack contenga la mayor cantidad de keywords
      // del caption. Si hay UN item con clear winner, ese gana.
      const scored = items.map((it, idx) => {
        const hay = itemHaystack(it);
        const matched = keywords.filter(w => hay.includes(w));
        return { idx, item: it, captionMatches: matched.length, matchedWords: matched };
      }).sort((a, b) => b.captionMatches - a.captionMatches);

      if (scored[0].captionMatches > 0 && scored[0].captionMatches > (scored[1]?.captionMatches || 0)) {
        captionMatchPropId = scored[0].item.prop_id;
        captionMatchedWord = scored[0].matchedWords[0];
        // Re-ordenar items: el caption-winner primero
        items = [scored[0].item, ...items.filter(it => it.prop_id !== scored[0].item.prop_id)];
      }
    }
  }

  // ============================================================
  // Construccion del bloque a inyectar en el prompt del Cami
  // ============================================================
  let clipBlock;
  if (items.length === 0) {
    clipBlock = hasError
      ? '[RAG_TEMPORALMENTE_LENTO] El motor visual esta saturado.\\nINSTRUCCION: Respondele al cliente algo CALIDO sin admitir el error tecnico: "Buenisima la foto! Estoy mirando el catalogo, dame un segundo. Mientras tanto, te suma si me decis la zona o calle?". JAMAS digas que hubo un error tecnico.'
      : '[IMAGEN_PROCESADA_SIN_MATCH] No identifique la propiedad con seguridad.\\nINSTRUCCION: "Buenisima la foto! No la identifique con seguridad. Me decis en que calle o barrio la viste? Asi te la encuentro al toque." JAMAS pidas ID.';
  } else {
    const top = items[0];
    const second = items[1];
    const sc = Number(top.score || 0);
    const sc2 = Number(second?.score || 0);
    const closeRace = second && (Math.abs(sc - sc2) < 0.05);

    function det(p) {
      const parts = [];
      if (p.title) parts.push('Titulo: ' + p.title);
      if (p.address || p.barrio || p.zona) parts.push('Ubicacion: ' + [p.address, p.barrio, p.zona].filter(Boolean).join(', '));
      if (p.operation) parts.push('Operacion: ' + (p.operation === 'sale' ? 'venta' : 'alquiler'));
      if (p.bedrooms !== null && p.bedrooms !== undefined) parts.push('Dormitorios: ' + p.bedrooms);
      if (p.area_m2) parts.push('Superficie: ' + p.area_m2 + ' m2');
      if (p.price) parts.push('Precio: ' + p.price + ' ' + (p.price_currency || ''));
      if (p.url) parts.push('URL: ' + p.url);
      return parts.join(' | ');
    }
    function corta(p, i) {
      const ubic = p.address || p.barrio || p.zona || '?';
      const precio = p.price ? p.price + ' ' + (p.price_currency || '') : 'Consultar';
      const dorm = (p.bedrooms !== null && p.bedrooms !== undefined) ? p.bedrooms + ' dorm' : '';
      return (i+1) + ') ' + (p.title || '?') + ' | ' + ubic + ' | ' + [dorm, precio].filter(Boolean).join(', ') + ' | URL: ' + (p.url || '');
    }

    if (captionMatchPropId) {
      // El caption del cliente eligio sin ambiguedad. CONFIRMADO con esa prop.
      clipBlock = '[CONFIRMADO_POR_CAPTION cliente menciono "' + captionMatchedWord + '"]\\n' + det(top) + '\\n\\nINSTRUCCION: Confirma "Si, esa es [direccion]" y charla a fondo. NO pidas ID.';
    } else if (closeRace && sc >= 0.55) {
      // Visualmente parecidos y el caption no resuelve -> pedir aclaracion
      clipBlock = '[AMBIGUO] Top 2 visualmente identicos:\\n' + items.slice(0, 2).map(corta).join('\\n') + '\\n\\nINSTRUCCION: NUNCA digas "esta es X" porque hay dos parecidas. Decile al cliente: "Tengo dos parecidas a la foto: [1] y [2]. Cual viste?". JAMAS confirmes una sin estar seguro.';
    } else if (sc >= 0.55) {
      clipBlock = '[CONFIRMADO]\\n' + det(top) + '\\n\\nINSTRUCCION: Confirma "Si, esa es [direccion]" y charla a fondo. NO pidas ID.';
    } else if (sc >= 0.30) {
      clipBlock = '[POSIBLES]\\n' + items.slice(0,3).map(corta).join('\\n') + '\\n\\nINSTRUCCION: "Esa foto se parece a: ... Alguna te suena?". JAMAS pidas ID.';
    } else {
      clipBlock = '[DEBIL]\\n' + items.slice(0,3).map(corta).join('\\n') + '\\n\\nINSTRUCCION: "No la identifique seguro pero tengo estas parecidas: ... O me decis zona". JAMAS pidas ID.';
    }
  }

  const captionBlock = caption ? ('\\n\\n[CAPTION CLIENTE] ' + caption) : '';
  const mensaje = '[IMAGEN RECIBIDA]\\n\\n' + clipBlock + captionBlock;
  return [{ json: Object.assign({}, parserData, { mensaje: mensaje }) }];
} catch (err) {
  const parserData = $("Parsear Mensaje").first().json || {};
  return [{ json: Object.assign({}, parserData, { mensaje: '[IMAGEN RECIBIDA] No pude procesar la foto. INSTRUCCION: Pedile al cliente la zona o calle aproximada para identificarla.' }) }];
}`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(
    path.join(bkpDir, `${WF}_pre_caption_match_${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
    JSON.stringify(w, null, 2),
  );

  const node = w.nodes.find(n => n.name === 'Formatear Match CLIP');
  if (!node) { console.error('No encontre Formatear Match CLIP'); process.exit(1); }

  if (node.parameters.jsCode === NEW_JS_CODE) {
    console.log('ℹ️  Ya estaba actualizado');
    return;
  }

  node.parameters.jsCode = NEW_JS_CODE;
  console.log('✅ Formatear Match CLIP actualizado con caption-priority + ambiguity detection');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);
  console.log('\n=== Comportamiento nuevo ===');
  console.log('1. Cliente manda foto + caption "este es el de alem"');
  console.log('   -> sistema busca "alem" en titulo/address/zona de los candidatos');
  console.log('   -> Alem 127 matchea, gana, [CONFIRMADO_POR_CAPTION]');
  console.log('2. Cliente manda foto sin caption util, scores empatados');
  console.log('   -> [AMBIGUO] -> bot pregunta cual es');
  console.log('3. Foto sola, top con score claro');
  console.log('   -> [CONFIRMADO] (igual que antes)');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
