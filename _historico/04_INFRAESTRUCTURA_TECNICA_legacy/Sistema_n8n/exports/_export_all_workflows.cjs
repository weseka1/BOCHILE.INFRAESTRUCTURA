#!/usr/bin/env node
/**
 * Exporta TODOS los workflows de Bochile del n8n local a archivos JSON.
 * Se usan para importar al n8n de Render en la migracion a 24/7.
 *
 * Workflows exportados:
 *   W1  aUMQyupnGJ5IWm5e — Chatbot Multi-Agente CORE (Cami)
 *   W2  f1CC972kzNPR8ebi — Recordatorios de Visitas
 *   W3  W327qYVE9SpwQiRi — Match Retroactivo
 *   W4  wrFto5o6Zk02sZty — Cobranza Alquileres
 *   W5  lf3gZgVCD3SdPri4 — Backup Mensual + Reset
 *   Sub 6Dk2umeJDNViv9yb — Bochile RAG Search (sub-workflow)
 *
 * IMPORTANTE: el JSON exportado tiene IDs de credenciales que apuntan al n8n
 * local (ej. OpenAi account = 4mQx97qkHBIhXxu3). Cuando importes en Render,
 * vas a tener que CREAR las credenciales de cero y reasignarlas en cada nodo
 * (n8n lo hace casi automaticamente al importar, te lista los nodos que
 * necesitan credencial).
 *
 * Uso: node _export_all_workflows.cjs
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

const WORKFLOWS = [
  { id: 'aUMQyupnGJ5IWm5e', filename: 'W1_Chatbot_Multi_Agente_CORE_v_render.json' },
  { id: 'f1CC972kzNPR8ebi', filename: 'W2_Recordatorios_Visitas_v_render.json' },
  { id: 'W327qYVE9SpwQiRi', filename: 'W3_Match_Retroactivo_v_render.json' },
  { id: 'wrFto5o6Zk02sZty', filename: 'W4_Cobranza_Alquileres_v_render.json' },
  { id: 'lf3gZgVCD3SdPri4', filename: 'W5_Backup_Mensual_v_render.json' },
  { id: '6Dk2umeJDNViv9yb', filename: 'SUB_Bochile_RAG_Search_v_render.json' },
  { id: '68STmQW3hQg815a1', filename: 'W7_Reactivar_Bot_Pausado_v_render.json' },
];

function req(opts) {
  return new Promise((res, rej) => {
    const r = http.request(opts, (resp) => {
      let d = '';
      resp.on('data', (c) => (d += c));
      resp.on('end', () => res({ status: resp.statusCode, body: d }));
    });
    r.on('error', rej);
    r.end();
  });
}

async function main() {
  const outDir = path.join(__dirname, '_render_export');
  fs.mkdirSync(outDir, { recursive: true });

  let ok = 0;
  let fail = 0;

  for (const wf of WORKFLOWS) {
    try {
      const res = await req({
        host: 'localhost',
        port: 5680,
        path: `/api/v1/workflows/${wf.id}`,
        method: 'GET',
        headers: { 'X-N8N-API-KEY': API_KEY },
      });
      if (res.status !== 200) {
        console.error(`[${wf.id}] FAIL: ${res.status} ${res.body.slice(0, 100)}`);
        fail++;
        continue;
      }
      const data = JSON.parse(res.body);
      // Sanitizar para import: quitar campos read-only que el import rechaza
      const clean = {
        name: data.name,
        nodes: data.nodes,
        connections: data.connections,
        settings: data.settings || { executionOrder: 'v1' },
        staticData: data.staticData ?? null,
      };
      const outPath = path.join(outDir, wf.filename);
      fs.writeFileSync(outPath, JSON.stringify(clean, null, 2));
      const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
      console.log(`✓ ${wf.filename} (${data.nodes.length} nodos, ${sizeKB} KB)`);
      ok++;
    } catch (err) {
      console.error(`[${wf.id}] ERROR: ${err.message}`);
      fail++;
    }
  }

  console.log('');
  console.log(`Listo: ${ok} OK, ${fail} fail. Outputs en ${outDir}`);
  console.log('');
  console.log('Para importar en el n8n de Render:');
  console.log('  1. Abrir https://bochile-n8n.onrender.com (login admin)');
  console.log('  2. Menu de cada workflow → Import from File → seleccionar el JSON');
  console.log('  3. Reasignar credenciales (OpenAI, Google Sheets, Google Drive, respond.io)');
  console.log('  4. Activar el workflow');
  console.log('  5. Repetir para los 6 archivos');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
