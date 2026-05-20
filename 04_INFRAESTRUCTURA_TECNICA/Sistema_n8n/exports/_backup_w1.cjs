// Backup del workflow W1 a disco. Crea timestamp + LATEST.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

function req(p){return new Promise((res,rej)=>{const r=http.request({host:'localhost',port:5680,path:p,method:'GET',headers:{'X-N8N-API-KEY':API_KEY}},resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});r.on('error',rej);r.end()})}

const BACKUP_DIR = 'C:/Users/46094/Desktop/WESEKA_IA_STRUCTURE/01_CLIENTES/Bochile/04_INFRAESTRUCTURA_TECNICA/Sistema_n8n/backups';

(async()=>{
  const r = await req('/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const dated = path.join(BACKUP_DIR, `W1_${ts}.json`);
  const latest = path.join(BACKUP_DIR, 'W1_LATEST.json');
  fs.writeFileSync(dated, JSON.stringify(wf, null, 2));
  fs.writeFileSync(latest, JSON.stringify(wf, null, 2));
  console.log('Backup OK:', dated);
  console.log('Latest OK:', latest);
})();
