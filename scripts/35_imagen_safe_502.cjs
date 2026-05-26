// Hacer el flow de imagen SAFE ante 502 del RAG:
// 1. Buscar Por Imagen: neverError=true (devuelve siempre, no rompe el flow)
// 2. Verificar conexion Buscar Por Imagen -> Formatear Match CLIP
// 3. Formatear Match CLIP: codigo defensivo que maneja error/502/HTML
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';

function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    let buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h, timeout: 30000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

const NEW_FMC_CODE = `// Formatear Match CLIP v4 SAFE - tolera 502, error, HTML, items vacios
try {
  const inp = $input.first().json || {};
  const parserData = $("Parsear Mensaje").first().json || {};
  const caption = parserData.mensaje_original || "";

  // Detectar si el RAG devolvio error (502 etc.)
  let items = Array.isArray(inp.items) ? inp.items : [];
  const hasError = inp.error || (typeof inp.data === 'string' && inp.data.indexOf('502') >= 0) || (typeof inp.body === 'string' && inp.body.indexOf('502') >= 0);

  let clipBlock;
  if (items.length === 0) {
    clipBlock = hasError
      ? '[RAG_TEMPORALMENTE_LENTO] El motor visual esta saturado en este momento.\\nINSTRUCCION: Respondele al cliente algo CALIDO sin admitir el error tecnico: "Buenisima la foto! Estoy mirando el catalogo, dame un segundo. Mientras tanto, te suma si me decis la zona o calle?". JAMAS digas que hubo un error tecnico.'
      : '[IMAGEN_PROCESADA_SIN_MATCH] No identifique la propiedad con seguridad.\\nINSTRUCCION: "Buenisima la foto! No la identifique con seguridad. Me decis en que calle o barrio la viste? Asi te la encuentro al toque." JAMAS pidas ID.';
  } else {
    const top = items[0];
    const sc = Number(top.score || 0);
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
    if (sc >= 0.55) {
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
  const w1 = JSON.parse((await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp')).b);

  // 1. Buscar Por Imagen: neverError=true (que NUNCA rompa el flow)
  const bpi = w1.nodes.find(n => n.name === 'Buscar Por Imagen');
  if (bpi) {
    bpi.parameters.options = bpi.parameters.options || {};
    bpi.parameters.options.response = bpi.parameters.options.response || {};
    bpi.parameters.options.response.response = { neverError: true };
    bpi.parameters.options.timeout = 30000;
    bpi.continueOnFail = true;
    bpi.onError = 'continueRegularOutput';
    bpi.retryOnFail = true;
    bpi.maxTries = 3;
    bpi.waitBetweenTries = 3000;
    console.log('Buscar Por Imagen: neverError=true + retry 3x3s + timeout 30s');
  }

  // 2. Asegurar conexion directa Buscar Por Imagen -> Formatear Match CLIP
  w1.connections['Buscar Por Imagen'] = {
    main: [[{ node: 'Formatear Match CLIP', type: 'main', index: 0 }]]
  };
  console.log('Conexion: Buscar Por Imagen -> Formatear Match CLIP (directa)');

  // 3. Formatear Match CLIP: codigo defensivo nuevo
  const fmc = w1.nodes.find(n => n.name === 'Formatear Match CLIP');
  if (fmc) {
    fmc.parameters.jsCode = NEW_FMC_CODE;
    fmc.continueOnFail = true;
    fmc.onError = 'continueRegularOutput';
    console.log('Formatear Match CLIP v4 SAFE: detecta 502/error/items vacios');
  }

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w1.settings) for (const k of A) if (w1.settings[k] !== undefined) s[k] = w1.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  s.executionTimeout = 300;
  const upd = await req('PUT', '/api/v1/workflows/TEdlfSBCc5ENVslp', { name: w1.name, nodes: w1.nodes, connections: w1.connections, settings: s });
  await req('POST', '/api/v1/workflows/TEdlfSBCc5ENVslp/activate');
  console.log('PUT:', upd.s);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
