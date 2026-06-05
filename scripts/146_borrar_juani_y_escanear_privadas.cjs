/**
 * URGENTE: elimina la conversacion de "Juani" (telefono 5492915512515)
 * que contiene charlas internas de WESEKA (escalabilidad, SaaS propia,
 * tercerizar) y NO es un cliente real de Bochile.
 *
 * Despues escanea el sheet `conversaciones` por palabras clave sospechosas
 * y reporta los hits para que Yamil decida que mas borrar.
 */
const path = require('node:path');
const { google } = require(path.join(__dirname, '..', 'apps', 'dashboard-api', 'node_modules', 'googleapis'));

const SHEET_ID = process.env.SHEET_ID || '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4';
const CREDS = path.resolve(__dirname, '..', 'apps', 'dashboard-api', 'credentials', 'service-account.json');

const TELEFONO_OBJETIVO = '5492915512515'; // Juani
const LEAD_ID_OBJETIVO = 'L-2915512515';

// Keywords que NO deberian aparecer en chats de clientes inmobiliarios reales
const KEYWORDS_PRIVADAS = [
  'weseka', 'wseka', 'wsk',
  'saas',
  'escalabilidad', 'tercerizar', 'tercerizo',
  'cierres x dia', 'cierres por dia', 'cierres x día',
  'jet privado', 'euw',
  'apellidos por',
  'desarrollar',
  'tecnologicamente', 'metodicamente', 'metódicamente',
  'psicologicamente', 'psicológicamente',
  'emocionalmente',
];

function colToLetter(n) {
  let s = '';
  while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  // 1. Necesito sheet metadata para obtener sheetId (numero interno) de cada tab.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheetByName = {};
  for (const s of meta.data.sheets) {
    sheetByName[s.properties.title] = s.properties.sheetId;
  }

  // === A. CONVERSACIONES ===
  const convRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'conversaciones!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const convRows = convRes.data.values || [];
  const convHeaders = convRows[0].map(h => String(h).trim());
  const colTel = convHeaders.indexOf('telefono');
  const colLeadId = convHeaders.indexOf('lead_id');
  const colMsg = Math.max(convHeaders.indexOf('mensaje'), convHeaders.indexOf('texto'), convHeaders.indexOf('contenido'));

  console.log(`Sheet conversaciones: ${convRows.length - 1} filas, headers: ${convHeaders.join(' | ')}`);
  console.log(`  col telefono: ${colTel}, col lead_id: ${colLeadId}, col mensaje: ${colMsg}`);

  // Filas a eliminar: telefono o lead_id objetivo
  const filasJuani = [];
  // Hits por keyword (para reportar)
  const hitsKeyword = [];

  for (let i = 1; i < convRows.length; i++) {
    const row = convRows[i];
    const tel = String(row[colTel] || '').trim();
    const lid = String(row[colLeadId] || '').trim();
    const msg = String(row[colMsg] || '').toLowerCase();

    if (tel === TELEFONO_OBJETIVO || lid === LEAD_ID_OBJETIVO) {
      filasJuani.push({ i, tel, lid, msg: msg.slice(0, 80) });
      continue; // ya marcada para borrar
    }

    for (const kw of KEYWORDS_PRIVADAS) {
      if (msg.includes(kw)) {
        hitsKeyword.push({ i, tel, lid, kw, msg: msg.slice(0, 100) });
        break;
      }
    }
  }

  console.log(`\n--- A1. JUANI (${TELEFONO_OBJETIVO}): ${filasJuani.length} filas a eliminar`);
  for (const f of filasJuani.slice(0, 5)) console.log(`  row ${f.i + 1}: ${f.msg}`);
  if (filasJuani.length > 5) console.log(`  ... (${filasJuani.length - 5} mas)`);

  console.log(`\n--- A2. OTRAS conversaciones con keywords sospechosas: ${hitsKeyword.length} filas`);
  // Agrupar por telefono+keyword
  const porTel = {};
  for (const h of hitsKeyword) {
    const k = `${h.tel || h.lid || '?'}`;
    if (!porTel[k]) porTel[k] = { tel: h.tel, lid: h.lid, kws: new Set(), count: 0, sample: '' };
    porTel[k].kws.add(h.kw);
    porTel[k].count++;
    if (!porTel[k].sample) porTel[k].sample = h.msg;
  }
  console.log('\n  Resumen por telefono/lead:');
  console.log('  ' + 'tel/lead'.padEnd(20) + ' | ' + 'msgs'.padStart(5) + ' | ' + 'keywords'.padEnd(40) + ' | sample');
  console.log('  ' + '-'.repeat(20) + '-+-' + '-'.repeat(5) + '-+-' + '-'.repeat(40) + '-+' + '-'.repeat(40));
  for (const k in porTel) {
    const p = porTel[k];
    console.log('  ' + (p.tel || p.lid).padEnd(20) + ' | ' + String(p.count).padStart(5) + ' | ' + [...p.kws].join(',').padEnd(40) + ' | ' + p.sample);
  }

  // === B. LEADS ===
  const leadsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'leads!A:Z',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const leadsRows = leadsRes.data.values || [];
  const leadsHeaders = leadsRows[0].map(h => String(h).trim());
  const lColTel = leadsHeaders.indexOf('telefono');
  const lColId = leadsHeaders.indexOf('lead_id');
  const filasJuaniLeads = [];
  for (let i = 1; i < leadsRows.length; i++) {
    const tel = String(leadsRows[i][lColTel] || '').trim();
    const lid = String(leadsRows[i][lColId] || '').trim();
    if (tel === TELEFONO_OBJETIVO || lid === LEAD_ID_OBJETIVO) {
      filasJuaniLeads.push({ i, tel, lid, nombre: leadsRows[i][leadsHeaders.indexOf('nombre')] });
    }
  }
  console.log(`\n--- B. LEADS de Juani: ${filasJuaniLeads.length} filas a eliminar`);
  for (const f of filasJuaniLeads) console.log(`  row ${f.i + 1}: ${f.lid} - ${f.nombre}`);

  // === EJECUTAR ELIMINACION (solo Juani, lo demas se reporta) ===
  // Hago batchUpdate de DeleteDimensionRequest. IMPORTANTE eliminar de mayor a menor
  // indice para que no se recalculen los indices.
  const requests = [];
  const conversacionesSheetId = sheetByName['conversaciones'];
  const leadsSheetId = sheetByName['leads'];

  // Conversaciones - eliminar de abajo hacia arriba
  const idxsConv = filasJuani.map(f => f.i).sort((a, b) => b - a);
  for (const i of idxsConv) {
    requests.push({
      deleteDimension: {
        range: {
          sheetId: conversacionesSheetId,
          dimension: 'ROWS',
          startIndex: i,        // 0-indexed
          endIndex: i + 1,
        },
      },
    });
  }
  // Leads
  const idxsLeads = filasJuaniLeads.map(f => f.i).sort((a, b) => b - a);
  for (const i of idxsLeads) {
    requests.push({
      deleteDimension: {
        range: {
          sheetId: leadsSheetId,
          dimension: 'ROWS',
          startIndex: i,
          endIndex: i + 1,
        },
      },
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests },
    });
    console.log(`\nOK - eliminadas ${filasJuani.length} filas de conversaciones + ${filasJuaniLeads.length} de leads (Juani / ${TELEFONO_OBJETIVO})`);
  } else {
    console.log('\nNo encontre filas de Juani para eliminar.');
  }

  if (hitsKeyword.length > 0) {
    console.log('\n*** ATENCION: hay otras conversaciones con keywords sospechosas (ver lista arriba) ***');
    console.log('*** Revisar y eliminar manualmente si tambien son privadas. ***');
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
