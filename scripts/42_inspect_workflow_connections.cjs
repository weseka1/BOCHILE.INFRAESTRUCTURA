// Inspecciona el workflow y reporta: nodos, sus conexiones, y nodos "isla" (sin entradas).
// Sirve para detectar SubAgentes que quedaron desconectados.

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

(async () => {
  const r = await req('GET', '/api/v1/workflows/TEdlfSBCc5ENVslp');
  const w = JSON.parse(r.b);
  console.log(`Workflow: ${w.name}`);
  console.log(`Active: ${w.active}`);
  console.log(`Nodos totales: ${w.nodes.length}\n`);

  // Construir set de nodos que reciben input (estan en el "lado destino" de alguna conexion)
  const targets = new Set();
  for (const [srcName, conns] of Object.entries(w.connections || {})) {
    for (const arr of Object.values(conns || {})) {
      for (const branch of arr || []) {
        for (const item of branch || []) {
          if (item && item.node) targets.add(item.node);
        }
      }
    }
  }

  // Tambien las connections estilo AI: ai_languageModel, ai_tool, ai_memory
  // En n8n los SubAgentes se conectan via ai_tool -> el agente padre
  // El padre figura como TARGET, el subagente como SOURCE.

  // Source = nodos que tienen output
  const sources = new Set(Object.keys(w.connections || {}));

  console.log('=== NODOS Y SUS CONEXIONES ===');
  for (const n of w.nodes) {
    const hasInput = targets.has(n.name);
    const hasOutput = sources.has(n.name);
    const conns = w.connections[n.name] || {};
    const outTypes = Object.keys(conns);
    const flag = (hasInput || hasOutput) ? '   ' : '⚠️ ISLA';
    console.log(`${flag} [${n.type.split('.').pop()}] ${n.name}`);
    if (outTypes.length > 0) {
      for (const t of outTypes) {
        const branches = conns[t] || [];
        for (const branch of branches) {
          for (const item of branch || []) {
            console.log(`         └─[${t}]→ ${item.node}`);
          }
        }
      }
    }
  }

  // Focus: nodos isla
  console.log('\n=== NODOS ISLA (sin entradas Y sin salidas) ===');
  const islas = w.nodes.filter(n => !targets.has(n.name) && !sources.has(n.name));
  if (islas.length === 0) console.log('  (ninguno - todo conectado)');
  else for (const n of islas) console.log(`  ⚠️ ${n.name} (${n.type})`);

  // Focus: agente admin
  console.log('\n=== BUSCAR "Admin" ===');
  const admins = w.nodes.filter(n => /admin/i.test(n.name));
  for (const n of admins) {
    const hasIn = targets.has(n.name);
    const hasOut = sources.has(n.name);
    console.log(`  ${n.name} | input=${hasIn} | output=${hasOut} | type=${n.type}`);
    const conns = w.connections[n.name] || {};
    for (const [t, branches] of Object.entries(conns)) {
      for (const branch of branches) {
        for (const item of branch || []) {
          console.log(`     └─[${t}]→ ${item.node}`);
        }
      }
    }
  }

  // Buscar quien apunta a "SubAgente Administrativo" si existe
  console.log('\n=== Quien recibe "SubAgente Administrativo" como input ===');
  const subAdminName = w.nodes.find(n => /sub.*admin/i.test(n.name))?.name;
  if (subAdminName) {
    console.log(`  Buscando: "${subAdminName}"`);
    let found = false;
    for (const [src, conns] of Object.entries(w.connections || {})) {
      for (const [type, branches] of Object.entries(conns)) {
        for (const branch of branches) {
          for (const item of branch || []) {
            if (item.node === subAdminName) {
              console.log(`    ${src} ─[${type}]→ ${subAdminName}`);
              found = true;
            }
          }
        }
      }
    }
    if (!found) console.log('  ⚠️ NADIE le pasa input → SubAgente DESCONECTADO');

    // Sub agente apunta a alguien?
    const outAdmin = w.connections[subAdminName];
    if (outAdmin) {
      console.log('  Outputs del SubAgente Administrativo:');
      for (const [type, branches] of Object.entries(outAdmin)) {
        for (const branch of branches) {
          for (const item of branch || []) {
            console.log(`    └─[${type}]→ ${item.node}`);
          }
        }
      }
    } else {
      console.log('  ⚠️ El SubAgente Administrativo TAMPOCO tiene outputs');
    }
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
