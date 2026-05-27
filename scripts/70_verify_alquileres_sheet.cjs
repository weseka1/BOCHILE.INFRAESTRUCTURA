// Verifica si el mensaje de prueba TEST-ALQ aparece en el endpoint
// /api/conversaciones del dashboard-api. Si si: bypass + log funcionan.

const https = require('node:https');

function get(host, p) {
  return new Promise(r => {
    const buf = [];
    const x = https.request({ host, port: 443, path: p, method: 'GET', timeout: 30000 }, rsp => {
      rsp.on('data', c => buf.push(c));
      rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') }));
    });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    x.end();
  });
}

(async () => {
  const tel = '5492914999777';
  const lead_id = 'L-' + tel.slice(-10);

  console.log(`Buscando conversaciones del lead ${lead_id} en dashboard-api...`);
  const r = await get('bochile-dashboard-api.onrender.com', `/api/conversaciones?lead_id=${lead_id}`);
  console.log(`HTTP ${r.s}`);

  if (r.s !== 200) {
    console.error('Body:', r.b.slice(0, 400));
    process.exit(1);
  }

  let data;
  try { data = JSON.parse(r.b); } catch { data = { raw: r.b }; }
  const rows = Array.isArray(data) ? data : (data.data || data.rows || data.items || []);
  console.log(`Filas devueltas: ${rows.length}`);

  if (rows.length === 0) {
    console.log('\n❌ NO se encontraron conversaciones para ese lead.');
    console.log('Esto significa que el bypass parsea OK pero NO logguea al dashboard-api.');
    console.log('Posibles causas:');
    console.log('  - httpRequest del Code node no llega');
    console.log('  - endpoint POST espera otro shape');
    process.exit(2);
  }

  for (const row of rows.slice(0, 5)) {
    console.log('\n--- Conversacion ---');
    console.log(`  msg_id:    ${row.msg_id || row.id}`);
    console.log(`  direccion: ${row.direccion || row.dir}`);
    console.log(`  canal:     ${row.canal}`);
    console.log(`  mensaje:   ${String(row.mensaje || row.text || '').slice(0, 80)}`);
    console.log(`  timestamp: ${row.timestamp || row.created_at}`);
    console.log(`  channel_id:${row.channel_id || ''}`);
  }

  const alq = rows.filter(row => String(row.channel_id) === '508045' || String(row.canal || '').includes('alquileres'));
  console.log(`\nMensajes detectados como Alquileres: ${alq.length}`);
  if (alq.length > 0) console.log('✅ BYPASS ALQUILERES FUNCIONA END-TO-END');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
