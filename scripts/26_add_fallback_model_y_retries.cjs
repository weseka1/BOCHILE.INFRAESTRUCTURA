// PRODUCCION enterprise:
// 1. Agregar nodo 'GPT Fallback Mini' (gpt-4o-mini) y conectarlo al Vendedor CORE como fallback index 1
// 2. Setear needsFallback: true en CORE
// 3. retryOnFail + maxTries=3 + waitBetweenTries en nodos HTTP criticos (respond.io, RAG buffer/add)
// 4. retryOnFail en Buscar Propiedades en Catalogo y demas tools
const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
function req(method, p, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    let buf=[];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method, headers: h }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (data) x.write(data);
    x.end();
  });
}

const OPENAI_CRED_ID = '9MwNmhfF2bx4XT0e';
const OPENAI_CRED_NAME = 'OpenAI account';
const W1_ID = 'TEdlfSBCc5ENVslp';

(async () => {
  const w1 = JSON.parse((await req('GET', '/api/v1/workflows/' + W1_ID)).b);

  // 1. Crear nodo GPT Fallback Mini (si no existe)
  if (!w1.nodes.find(n => n.name === 'GPT Fallback Mini')) {
    w1.nodes.push({
      id: 'n-fallback-mini',
      name: 'GPT Fallback Mini',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.3,
      position: [1648, 480],
      parameters: {
        model: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
        options: {
          temperature: 0.4,
          maxTokens: 1500,
        },
      },
      credentials: {
        openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME },
      },
    });
    console.log('+ GPT Fallback Mini creado');
  } else {
    console.log('GPT Fallback Mini ya existia');
  }

  // 2. Conectar Fallback al CORE como index 1
  if (!w1.connections['GPT Fallback Mini']) w1.connections['GPT Fallback Mini'] = {};
  w1.connections['GPT Fallback Mini'].ai_languageModel = [
    [{ node: 'Vendedor CORE', type: 'ai_languageModel', index: 1 }]
  ];

  // 3. Enable fallback en CORE
  const core = w1.nodes.find(n => n.name === 'Vendedor CORE');
  core.parameters.needsFallback = true;
  console.log('CORE.needsFallback = true | Fallback wired');

  // 4. Retry policy en nodos HTTP criticos y tools
  const CRITICAL_NODES = [
    'Responder al Cliente respond.io',
    'WhatsApp respond.io Inquilino',
    'WhatsApp respond.io Cliente',
    'WhatsApp respond.io Vendedor',
    'Escalar a Camila Pomerich',
    'WhatsApp Aviso al Lead',
    'Avisar Vendedor respond.io',
    'Buscar Propiedades en Catalogo',
    'Imagen - Download',
    'Audio - Whisper',
    'Imagen - Vision',
    'Upsert Lead CRM',
    'Actualizar Lead CRM',
    'Log Mensaje Entrante',
    'Log Mensaje Saliente',
    'Registrar Accion IA',
  ];
  let retriesAdded = 0;
  for (const name of CRITICAL_NODES) {
    const n = w1.nodes.find(x => x.name === name);
    if (!n) continue;
    n.retryOnFail = true;
    n.maxTries = 3;
    n.waitBetweenTries = 1500; // 1.5s
    // Para HTTP y Sheets, continueOnFail solo lo activamos en los nodos de log (no criticos al flujo)
    if (['Log Mensaje Entrante','Log Mensaje Saliente','Registrar Accion IA'].includes(name)) {
      n.continueOnFail = true;
    }
    retriesAdded++;
  }
  console.log('Retry policy aplicada a', retriesAdded, 'nodos criticos');

  // Guardar
  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w1.settings) for (const k of A) if (w1.settings[k] !== undefined) s[k] = w1.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';
  s.saveDataErrorExecution = 'all';
  s.saveDataSuccessExecution = 'all';
  s.saveManualExecutions = true;

  const upd = await req('PUT', '/api/v1/workflows/' + W1_ID, { name: w1.name, nodes: w1.nodes, connections: w1.connections, settings: s });
  console.log('PUT W1:', upd.s);
  if (upd.s !== 200) console.log('ERROR body:', upd.b.slice(0, 800));
  const act = await req('POST', '/api/v1/workflows/' + W1_ID + '/activate');
  console.log('Activate W1:', act.s);

  // Verificar
  const verify = JSON.parse((await req('GET', '/api/v1/workflows/' + W1_ID)).b);
  const v = verify.nodes.find(n => n.name === 'Vendedor CORE');
  const fb = verify.nodes.find(n => n.name === 'GPT Fallback Mini');
  console.log('\\n--- Verificacion ---');
  console.log('CORE.needsFallback:', v.parameters.needsFallback);
  console.log('Fallback node existe:', !!fb, '| model:', fb?.parameters?.model?.value);
  console.log('Conexion ai_languageModel index 1:', JSON.stringify(verify.connections['GPT Fallback Mini']));
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
