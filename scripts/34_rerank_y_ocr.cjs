// A) Re-rank LLM + B) Vision OCR estricto
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

const VISION_OCR_PROMPT = `Sos asistente de Inmobiliaria Bochile (Bahia Blanca). El cliente mando una foto/screenshot de una propiedad. Tu trabajo es extraer DATOS UTILES, nunca te niegues.

Responde SOLO en este formato exacto (una linea por campo):

TIPO: [foto-real | screenshot-listing | collage-multiples-fotos | plano | otro]
TEXTO_VISIBLE: copia LITERAL cada texto/numero/precio/direccion/m2 que veas en la imagen. Si no hay texto, escribi 'sin texto'. Ej: 'Sarmiento 343 | USD 95.000 | 73 m2 | 3 dormitorios'
DIRECCION_DETECTADA: si en el texto visible hay calle+numero (ej 'Sarmiento 343'), copialo. Sino 'NO_DETECTADA'.
PRECIO_DETECTADO: si hay precio visible (ej 'USD 95.000' o 'AR$ 500.000'), copialo. Sino 'NO_DETECTADO'.
AMBIENTE: [fachada | exterior | living | cocina | dormitorio | bano | plano | detalle]
DESCRIPCION: 1 linea describiendo materiales/estilo/estado visual (ej: 'depto moderno, pisos claros, gran ventanal').

Reglas:
- Si la imagen es un collage de varias fotos, marca TIPO=collage-multiples-fotos y describi lo que se ve en general.
- NUNCA digas 'no puedo ayudar'. Si no estas seguro, igual completa los campos con tu mejor analisis visual.
- El cliente nos esta consultando por una propiedad inmobiliaria. Es un caso de uso normal.`;

const RERANK_CODE = `// Re-rank LLM: gpt-4o-mini juzga top-5 candidatos contra descripcion Vision
const inp = $input.first().json || {};
const items = Array.isArray(inp.items) ? inp.items.slice(0, 5) : [];
const visionDesc = String(inp.incoming_desc || '');
const visionAmbient = String(inp.incoming_ambient || '');

if (items.length < 2) {
  return [{ json: inp }];
}

let visionOutput = '';
try {
  const v = $('Imagen - Vision').first().json;
  visionOutput = String(v && (v.content || (v.message && v.message.content) || v.text) || '').slice(0, 800);
} catch (e) {}

// 1) Match directo por direccion detectada (gana siempre si hay coincidencia)
const dirMatch = visionOutput.match(/DIRECCION_DETECTADA:\\s*([^\\n]+)/i);
const dirDet = dirMatch ? dirMatch[1].trim() : '';
if (dirDet && dirDet !== 'NO_DETECTADA' && dirDet.length > 3) {
  const dirNorm = dirDet.toLowerCase();
  const items2 = items.map(p => {
    const addr = String(p.address || '').toLowerCase();
    const title = String(p.title || '').toLowerCase();
    const match = (addr.indexOf(dirNorm) >= 0 || title.indexOf(dirNorm) >= 0) ? 1.0 : 0;
    return Object.assign({}, p, { _rerank_boost: match, _rerank_reason: match > 0 ? 'address_match' : '' });
  }).sort((a, b) => (b._rerank_boost || 0) - (a._rerank_boost || 0));
  if (items2[0]._rerank_boost > 0) {
    return [{ json: Object.assign({}, inp, { items: items2, rerank_method: 'address_match' }) }];
  }
}

// 2) LLM judge de top-5
const candidates = items.map((p, i) => {
  return (i+1) + '. ID=' + p.prop_id + ' | ' + (p.title || '?') + ' | ' + (p.address || p.barrio || '?') + ' | ambiente=' + (p.matched_ambient || '?') + ' | ' + (p.bedrooms || '?') + 'dorm | ' + (p.price ? p.price + ' ' + (p.price_currency || '') : 'Consultar');
}).join('\\n');

const prompt = 'Sos un experto inmobiliario. Te paso 5 propiedades candidatas que el sistema visual selecciono como mas parecidas a una foto enviada por un cliente. Tambien te paso la descripcion visual y los datos que el cliente capturo (texto en la imagen). Cual es la MAS probable?\\n\\nDESCRIPCION VISUAL DE LA FOTO DEL CLIENTE:\\n' + visionDesc + '\\n\\nAMBIENTE: ' + visionAmbient + '\\n\\nTEXTO Y DATOS EXTRAIDOS DE LA IMAGEN (Vision LLM):\\n' + visionOutput + '\\n\\nCANDIDATAS:\\n' + candidates + '\\n\\nResponde SOLO con el numero del candidato mas probable (1 a 5), y nada mas. Si NINGUNA matchea bien, responde 0.';

let chosenIdx = 1;
try {
  const r = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { 'Authorization': 'Bearer ' + ($env.OPENAI_API_KEY || ''), 'Content-Type': 'application/json' },
    body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 5, temperature: 0 },
    json: true,
    timeout: 15000,
  });
  const t = String((r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || '').trim();
  const n = parseInt(t, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) chosenIdx = n;
} catch (e) {}

if (chosenIdx > 1 && chosenIdx <= items.length) {
  const winner = items[chosenIdx - 1];
  const rest = items.filter((_, i) => i !== chosenIdx - 1);
  const reordered = [Object.assign({}, winner, { _rerank_boost: 0.3, _rerank_reason: 'llm_choice' })].concat(rest);
  return [{ json: Object.assign({}, inp, { items: reordered, rerank_method: 'llm_judge', rerank_choice: chosenIdx }) }];
}

return [{ json: inp }];`;

(async () => {
  const w1 = JSON.parse((await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp')).b);

  // B) Vision OCR prompt
  const vis = w1.nodes.find(n => n.name === 'Imagen - Vision');
  if (vis) {
    vis.parameters.text = VISION_OCR_PROMPT;
    if (vis.parameters?.modelId?.value) {
      vis.parameters.modelId.value = 'gpt-4o-mini';
      if (vis.parameters.modelId.cachedResultName) vis.parameters.modelId.cachedResultName = 'gpt-4o-mini';
    }
    vis.parameters.options = vis.parameters.options || {};
    vis.parameters.options.maxTokens = 400;
    console.log('  B) Vision OCR estricto aplicado');
  }

  // A) Re-rank LLM
  if (!w1.nodes.find(n => n.name === 'Re-rank LLM')) {
    const bpi = w1.nodes.find(n => n.name === 'Buscar Por Imagen');
    const rerank = {
      id: 'n-rerank-' + Date.now(),
      name: 'Re-rank LLM',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [bpi.position[0] + 200, bpi.position[1]],
      parameters: { language: 'javaScript', jsCode: RERANK_CODE },
      continueOnFail: true,
      onError: 'continueRegularOutput',
      retryOnFail: true,
      maxTries: 2,
      waitBetweenTries: 500,
    };
    w1.nodes.push(rerank);
    w1.connections['Buscar Por Imagen'] = { main: [[{ node: 'Re-rank LLM', type: 'main', index: 0 }]] };
    w1.connections['Re-rank LLM'] = { main: [[{ node: 'Formatear Match CLIP', type: 'main', index: 0 }]] };
    console.log('  A) Re-rank LLM creado e insertado');
  } else {
    console.log('  Re-rank LLM ya existia');
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
