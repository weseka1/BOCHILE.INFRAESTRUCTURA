// Audita las conversaciones del Sheet para detectar:
//   1. Errores donde Cami se nego ("no tengo", "no manejo", "no me especializo")
//   2. Barrios/zonas que los clientes mencionan
//   3. Calles/direcciones especificas (data para enriquecer prompt)
//   4. Errores tecnicos visibles al cliente (RAG_TEMPORALMENTE_LENTO, etc)
//   5. Conversaciones agrupadas por lead con flujo turn-by-turn

const http = require('node:http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const msgs = await fetchJson('http://localhost:3002/api/conversaciones');
  console.log(`TOTAL: ${msgs.length} mensajes\n`);

  // Agrupar por lead
  const byLead = new Map();
  for (const m of msgs) {
    if (!byLead.has(m.lead_id)) byLead.set(m.lead_id, []);
    byLead.get(m.lead_id).push(m);
  }
  console.log(`Leads unicos: ${byLead.size}\n`);

  // Ordenar mensajes de cada lead por timestamp asc
  for (const [lead, arr] of byLead.entries()) {
    arr.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }

  // ==========================================================
  // 1. FAILS de Cami: "no tengo", "no manejo", "no me especializo"
  // ==========================================================
  const NEGATIONS = [
    /no\s+tengo\s+(info|informaci|propied|datos|nada\s+(de|sobre))/i,
    /no\s+(manejo|trabajo|tenemos)\s+(propied|info\s+de|datos\s+de|en\s+)/i,
    /no\s+me\s+especializ/i,
    /(solo|s[óo]lo)\s+(trabajo|trabajamos|me\s+especializ).*bahia/i,
    /no\s+opero\s+en/i,
    /en\s+este\s+momento.*no\s+tengo/i,
    /lamentablemente.*no/i,
  ];
  console.log('=== ❌ FAILS DE CAMI (negaciones detectadas) ===');
  const fails = [];
  for (const m of msgs) {
    if (m.direccion === 'out' && m.agente_que_respondio === 'Vendedor CORE') {
      for (const re of NEGATIONS) {
        if (re.test(m.mensaje || '')) {
          fails.push(m);
          break;
        }
      }
    }
  }
  console.log(`  ${fails.length} mensajes con negacion`);
  fails.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.lead_id} ${m.nombre}] "${(m.mensaje || '').slice(0, 180).replace(/\n/g, ' ')}"`);
  });
  console.log('');

  // ==========================================================
  // 2. ZONAS / BARRIOS mencionados por clientes (mensajes IN)
  // ==========================================================
  console.log('=== 🗺️ ZONAS Y BARRIOS MENCIONADOS POR CLIENTES ===');
  const ZONAS = [
    'centro', 'microcentro', 'palihue', 'universitario', 'parque norte',
    'villa mitre', 'villa belgrano', 'villa don bosco', 'villa harding green',
    'villa rosas', 'patagonia', 'loma paraguaya', 'tiro federal',
    'aguas sajani', 'mar del plata', 'grunbein', 'grünbein',
    'monte hermoso', 'las dunas', 'delfines', 'camarones',
    'pehuen co', 'sierra de la ventana', 'tornquist', 'saldungaray',
    'punta alta', 'villarino', 'sauce grande', 'faro recalada',
    'monte del este', 'av. argentina', 'costanera',
    'don bosco', 'cooperativa obrera', 'kilometro 5', 'km 5',
    'noroeste', 'plaza rivadavia', 'villa harding', 'avellaneda',
  ];
  const CALLES = [
    'alem', 'san martin', 'estomba', 'soler', 'mitre', "o'higgins", 'belgrano',
    'las heras', 'vicente lopez', '12 de octubre', 'italia', 'zelarrayan',
    'donado', 'tucuman', 'brown', 'lavalle', 'colon', 'sarmiento', 'saavedra',
    'rondeau', 'drago', 'chiclana', 'yrigoyen', 'caronti', 'berutti',
    'casanova', 'zapiola', 'florida', 'garibaldi', 'rivadavia', 'moreno',
    'roca', 'pasteur', 'pandeles', 'luzuriaga',
  ];

  const zonaHits = {};
  const calleHits = {};
  for (const m of msgs) {
    if (m.direccion !== 'in' || m.msg_type !== 'text') continue;
    const txt = (m.mensaje || '').toLowerCase();
    for (const z of ZONAS) {
      if (txt.includes(z)) zonaHits[z] = (zonaHits[z] || 0) + 1;
    }
    for (const c of CALLES) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(txt)) calleHits[c] = (calleHits[c] || 0) + 1;
    }
  }

  console.log('  Zonas (top 20 por cliente):');
  Object.entries(zonaHits).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([z, n]) => {
    console.log(`    ${String(n).padStart(3)}  ${z}`);
  });
  console.log('  Calles (top 15):');
  Object.entries(calleHits).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([c, n]) => {
    console.log(`    ${String(n).padStart(3)}  ${c}`);
  });
  console.log('');

  // ==========================================================
  // 3. ERRORES TECNICOS LEAKING al cliente
  // ==========================================================
  console.log('=== ⚠️ ERRORES TECNICOS leaking ===');
  const ERRORS = [
    /RAG_TEMPORALMENTE_LENTO/i,
    /INSTRUCCION:/i,
    /ERROR_RAG/i,
    /SIN_STOCK/i,
    /\[IMAGEN RECIBIDA\]/i,
    /\[CONFIRMADO\]/i,
    /\[POSIBLES\]/i,
    /\[DEBIL\]/i,
    /system.*message/i,
    /undefined|null/i,
  ];
  const errs = [];
  for (const m of msgs) {
    if (m.direccion !== 'out') continue;
    for (const re of ERRORS) {
      if (re.test(m.mensaje || '')) {
        errs.push({ m, re: re.source });
        break;
      }
    }
  }
  console.log(`  ${errs.length} mensajes con leak tecnico al cliente`);
  errs.slice(0, 8).forEach(({ m, re }, i) => {
    console.log(`  ${i + 1}. [/${re}/] [${m.lead_id} ${m.nombre}] "${(m.mensaje || '').slice(0, 200).replace(/\n/g, ' ')}"`);
  });
  console.log('');

  // ==========================================================
  // 4. INTENCIONES MAS COMUNES
  // ==========================================================
  console.log('=== 🎯 INTENCIONES DETECTADAS (clientes) ===');
  const intentCount = {};
  for (const m of msgs) {
    if (m.direccion !== 'in') continue;
    const i = m.intencion_detectada || 'sin_detectar';
    intentCount[i] = (intentCount[i] || 0) + 1;
  }
  Object.entries(intentCount).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
    console.log(`    ${String(n).padStart(3)}  ${k}`);
  });
  console.log('');

  // ==========================================================
  // 5. LEADS QUE PIDIERON HUMANO
  // ==========================================================
  console.log('=== 👤 LEADS que requirieron humana ===');
  const human = msgs.filter(m => m.requiere_humano === true || m.requiere_humano === 'TRUE');
  console.log(`  ${human.length} mensajes flagueados`);
  console.log('');

  console.log('\n=== RESUMEN ===');
  console.log(`Total mensajes:       ${msgs.length}`);
  console.log(`Leads unicos:         ${byLead.size}`);
  console.log(`Fails de Cami:        ${fails.length}`);
  console.log(`Leaks tecnicos:       ${errs.length}`);
  console.log(`Requieren humano:     ${human.length}`);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
