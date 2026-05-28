// Auditoria del flujo de handoff humano:
// 1. ¿El webhook saliente esta llegando? (busco ejecuciones con evento=message.sent reciente)
// 2. ¿El parser marca es_humano correctamente? (ver es_humano en outputs recientes)
// 3. ¿"Marcar Bot Pausado" se dispara cuando llega un mensaje humano?
// 4. ¿Hay casos donde el bot escribio DESPUES de un mensaje humano (handoff roto)?

const https = require('node:https');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function api(m, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  console.log('=== Buscando ejecuciones recientes con mensajes humanos (es_humano=true) ===\n');
  let cursor = null;
  let scanned = 0;
  const MAX = 100;
  const humanos = [];
  const bots = [];
  while (scanned < MAX) {
    const url = `/api/v1/executions?workflowId=${WF}&limit=30${cursor ? '&cursor=' + cursor : ''}`;
    const exs = JSON.parse((await api('GET', url)).b);
    const items = exs.data || [];
    cursor = exs.nextCursor;
    for (const e of items) {
      scanned++;
      const det = JSON.parse((await api('GET', `/api/v1/executions/${e.id}?includeData=true`)).b);
      const par = det.data?.resultData?.runData?.['Parsear Mensaje']?.[0]?.data?.main?.[0]?.[0]?.json;
      if (!par) continue;
      const runData = det.data?.resultData?.runData || {};
      const tieneMarcarPausa = !!runData['Marcar Bot Pausado'];
      const tieneCORE = !!runData['Vendedor CORE'];
      const tieneResponder = !!runData['Responder al Cliente respond.io'];

      // Mensajes humanos detectados
      if (par.mark_pausa === true) {
        humanos.push({ id: e.id, ts: e.startedAt, tel: par.telefono, mensaje: String(par.mensaje_original || '').slice(0, 80), pausado: tieneMarcarPausa });
      }
      // Mensajes del bot (es_bot_propio)
      // Necesitamos ver el output del parser para confirmar es_bot_propio
      // El parser no expone es_bot_propio en output, pero sí lo procesa internamente.
      // Si fue bot_propio para Alquileres, skip=true reason=canal_alquileres_bot_ignorado
      if (par.skip && /bot_propio|bot/i.test(par.reason || '')) {
        bots.push({ id: e.id, ts: e.startedAt, tel: par.telefono, reason: par.reason });
      }
    }
    if (!cursor || items.length === 0) break;
  }

  console.log(`Mensajes humanos detectados (mark_pausa=true): ${humanos.length}`);
  for (const h of humanos) {
    console.log(`  ${h.id} ${h.ts} tel=${h.tel} pausa_marcada=${h.pausado ? 'SI' : 'NO'}`);
    console.log(`    "${h.mensaje}"`);
  }

  console.log(`\nMensajes del bot propio detectados (skip): ${bots.length}`);
  for (const b of bots) {
    console.log(`  ${b.id} ${b.ts} tel=${b.tel} reason=${b.reason}`);
  }

  // Buscar race conditions: pares (mensaje cliente in -> bot responde) ANTES de un mensaje humano
  // que fue ignorado
  console.log('\n=== Verificacion adicional: el webhook saliente esta llegando? ===');
  console.log(`Ejecuciones escaneadas: ${scanned}`);
  if (humanos.length === 0) {
    console.log('⚠️  CERO mensajes humanos detectados en las ultimas 100 ejecuciones.');
    console.log('   Esto puede significar:');
    console.log('   a) Ningun humano respondio manualmente en este periodo (esperado en testing limitado)');
    console.log('   b) El webhook saliente NO esta configurado en respond.io');
    console.log('   c) El webhook esta configurado pero sin las sources correctas (User, Echo Message)');
    console.log('');
    console.log('   Para confirmar: simular un mensaje saliente humano y ver si entra al workflow');
  } else {
    console.log(`✅ Webhook saliente esta funcionando — ${humanos.length} mensajes humanos llegaron`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
