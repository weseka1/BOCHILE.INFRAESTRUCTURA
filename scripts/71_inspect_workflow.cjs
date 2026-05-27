// Inspecciona el workflow para entender:
// 1. Como decide el parser si Cami responde vs alquileres bypass
// 2. Donde / como se notifica a humanos (Avisar Vendedor respond.io)
// 3. Que otros nodos podrian molestar durante un test productivo

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: { 'X-N8N-API-KEY': KEY }, timeout: 25000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  const r = await req('GET', `/api/v1/workflows/${WF}`);
  if (r.s !== 200) { console.error('GET fallo:', r.s); process.exit(1); }
  const w = JSON.parse(r.b);

  // Volcar nombres + tipo de todos los nodos
  console.log('=== TODOS LOS NODOS ===');
  for (const n of w.nodes) {
    console.log(`  ${n.name.padEnd(45)} ${n.type}`);
  }

  // Buscar nodos relacionados con humano / vendedor / escalado
  console.log('\n=== NODOS DE ESCALADO A HUMANO ===');
  for (const n of w.nodes) {
    const blob = JSON.stringify(n.parameters || {}).toLowerCase();
    if (/avisar.vendedor|requiere_humano|escalar|notif.*vendedor|notificar.*humano/i.test(n.name + ' ' + blob)) {
      console.log(`\n  >>> ${n.name} (${n.type})`);
      // dump primeros 400 chars de params
      console.log('     params:', JSON.stringify(n.parameters || {}).slice(0, 600));
    }
  }

  // Buscar el code del parser para canal 506217 vs 508045
  console.log('\n=== PARSER: bloques de canales ===');
  const parser = w.nodes.find(n => n.name === 'Parsear Mensaje');
  if (parser) {
    const code = parser.parameters.jsCode;
    // Buscar referencias a channel ids
    const matches506 = code.match(/.{60}506217.{60}/gs);
    const matches508 = code.match(/.{60}508045.{60}/gs);
    const matches111 = code.match(/.{60}508111.{60}/gs);
    console.log('Menciones a 506217:', matches506?.length || 0);
    if (matches506) for (const m of matches506.slice(0, 3)) console.log('  ...', m.replace(/\n/g, ' | '));
    console.log('\nMenciones a 508045:', matches508?.length || 0);
    if (matches508) for (const m of matches508.slice(0, 3)) console.log('  ...', m.replace(/\n/g, ' | '));
    console.log('\nMenciones a 508111:', matches111?.length || 0);
  }

  // Lista las connections del Cami output para entender el flujo post-respuesta
  console.log('\n=== Connections desde "Vendedor CORE" / output Cami ===');
  for (const key of Object.keys(w.connections)) {
    if (/cami|vendedor.core|core|cerrar|avisar/i.test(key)) {
      console.log(`\n  ${key}:`);
      const c = w.connections[key];
      for (const port of Object.keys(c)) {
        const branches = c[port];
        for (let i = 0; i < branches.length; i++) {
          const items = branches[i] || [];
          const targets = items.map(it => it.node).join(', ');
          console.log(`    ${port}[${i}] -> ${targets}`);
        }
      }
    }
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
