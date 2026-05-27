// CAMI ↛ Alquileres: bypass total del bot para el channel 508045 (Alquileres).
//
// Logica:
// - El WA de Alquileres tiene su propio depto humano que atiende los chats.
// - Cami solo responde en Ventas (506217).
// - Los duenos quieren VER las conversaciones de Alquileres desde el dashboard
//   sin que los empleados se enteren (observador pasivo).
//
// Implementacion:
// 1. Parser n8n detecta channel_id === 508045 (Alquileres)
// 2. Hace HTTP POST a https://bochile-dashboard-api.onrender.com/api/conversaciones
//    para loguear el mensaje con channel_id correcto
// 3. Retorna { skip: true, reason: 'canal_alquileres_observador' }
// 4. El Router Parser detecta skip=true y termina el flow (no llama a Cami)
//
// Funciona para los 3 casos:
// - cliente -> empleado depto Alquileres (in)
// - empleado depto Alquileres -> cliente (out, es_humano=true)
// - bot interno de respond.io en Alquileres -> cliente (out, es_bot_propio=true)
//
// El parser ya tiene los 3 distinguidos. Solo agrego el branch alquileres ARRIBA
// para que tenga prioridad.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';
const ALQUILERES_ID = '508045';

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

// Codigo a insertar en el parser, JUSTO DESPUES de extraer channel_id_val
// y antes de los checks de skip/humano/bot.
const ALQUILERES_BLOCK = `
  // ====== BYPASS ALQUILERES: solo logear, no procesar con Cami ======
  // El WA de Alquileres (508045) tiene su propio depto humano.
  // Solo registramos la conversacion para que los duenos vean en el dashboard.
  if (String(channel_id_val) === '${ALQUILERES_ID}') {
    const isOut = (evento === 'message.sent' || evento === 'message_sent');
    const dir = isOut ? 'out' : 'in';
    const ag = es_bot_propio ? 'Bot Alquileres' : (es_humano ? 'Empleado Alquileres' : '');
    const intent = dir === 'in' ? 'received_alquileres' : (es_humano ? 'humano_alquileres' : 'bot_alquileres');
    // Compute text_body and media for the snapshot before the if-else block runs
    let snapText = '';
    let snapMediaUrl = '';
    let snapMsgType = 'text';
    if (innerMessage) {
      const att = innerMessage.attachment;
      const etype = String(innerMessage.type || (att && att.type) || 'text').toLowerCase();
      if (etype === 'text') { snapText = String(innerMessage.text || innerMessage.body || ''); snapMsgType = 'text'; }
      else if (etype === 'audio' || etype === 'voice') { snapMsgType = 'audio'; snapMediaUrl = String((att && att.url) || ''); }
      else if (etype === 'image') { snapMsgType = 'image'; snapMediaUrl = String((att && att.url) || ''); snapText = String((att && (att.caption || att.description)) || ''); }
      else { snapMsgType = 'document'; snapMediaUrl = String((att && att.url) || ''); snapText = String((att && (att.caption || att.description)) || ''); }
    }
    const tel = String(from || '');
    const digits = tel.replace(/\\D/g, '');
    try {
      await this.helpers.httpRequest({
        method: 'POST',
        url: 'https://bochile-dashboard-api.onrender.com/api/conversaciones',
        headers: { 'Content-Type': 'application/json' },
        body: {
          msg_id: 'M-' + Date.now() + '-' + dir + '-alq',
          lead_id: tel ? ('L-' + digits.slice(-10)) : '',
          telefono: tel,
          nombre: profile || '',
          canal: 'whatsapp_alquileres',
          direccion: dir,
          mensaje: snapText,
          msg_type: snapMsgType,
          media_url: snapMediaUrl,
          intencion_detectada: intent,
          agente_que_respondio: ag,
          requiere_humano: false,
          timestamp: new Date().toISOString(),
          channel_id: '${ALQUILERES_ID}',
        },
        json: true,
      });
    } catch (err) {
      console.log('[alquileres log] HTTP error:', err.message);
    }
    return [{ json: { skip: true, reason: 'canal_alquileres_observador' } }];
  }
  // ====== FIN BYPASS ALQUILERES ======

`;

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  const bkpPath = path.join(bkpDir, `${WF}_pre_alquileres_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(bkpPath, JSON.stringify(w, null, 2));
  console.log('Backup:', bkpPath);

  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  if (!parser) { console.error('No Parsear Mensaje'); process.exit(1); }
  let code = parser.parameters?.jsCode || '';

  if (code.includes('canal_alquileres_observador')) {
    console.log('ℹ️  Parser ya tiene bypass alquileres (idempotente)');
    return;
  }

  // Insertar el bloque despues del setup de channel_id (que script 63 dejo)
  // Buscamos el marker que dejo script 63
  const marker = 'channel_id_val = channelObj.id || body.channelId || null;';
  if (!code.includes(marker)) {
    console.error('No encontre el marker channel_id_val. Verificar que script 63 corrio.');
    process.exit(2);
  }

  // Insertar el bloque despues de la linea del marker + cerrar correctamente el if/else del parser
  // El bloque va al FINAL del if (isRespondio) {...} branch, ANTES del else { Twilio path }
  const insertPoint = 'if (!from) return [{ json: { skip: true, reason: \'sin_from\' } }];';
  if (!code.includes(insertPoint)) {
    console.error('No encontre el insertPoint final (sin_from). Code parser cambio?');
    process.exit(3);
  }

  // Insertar JUSTO ANTES de "if (!from)" - asi pasa por todos los datos parseados
  code = code.replace(insertPoint, ALQUILERES_BLOCK + insertPoint);
  parser.parameters.jsCode = code;
  console.log('✅ Bloque ALQUILERES insertado en parser');

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', `/api/v1/workflows/${WF}`, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', `/api/v1/workflows/${WF}/activate`);
  console.log('Activate:', act.s);

  console.log('\nLISTO. Comportamiento esperado:');
  console.log('  - Mensaje al WA Ventas (506217)    -> Cami responde normal');
  console.log('  - Mensaje al WA Alquileres (508045) -> Solo se loggea, Cami NO responde');
  console.log('  - Dashboard tab Alquileres         -> Ve la conversacion real cliente <-> depto Alquileres');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
