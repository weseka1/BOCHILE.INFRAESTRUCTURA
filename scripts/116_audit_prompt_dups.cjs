// Audita el systemMessage del CORE: detecta duplicaciones, separadores
// decorativos, y bloques que pueden consolidarse. NO modifica nada -
// solo reporta para que el humano apruebe el refactor.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function api(p) { return new Promise(r => { const buf=[]; const x=https.request({host:'weseka.onrender.com',port:443,path:p,method:'GET',headers:{'X-N8N-API-KEY':KEY},timeout:25000},rsp=>{rsp.on('data',c=>buf.push(c));rsp.on('end',()=>r(JSON.parse(Buffer.concat(buf).toString())));});x.on('error',e=>r(null));x.end();}); }

(async () => {
  const w = await api('/api/v1/workflows/' + WF);
  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  const sm = String(core?.parameters?.options?.systemMessage || '');

  // Dump completo a archivo para revisar
  const outFile = path.resolve(__dirname, '_sm_actual.md');
  fs.writeFileSync(outFile, sm);
  console.log('Dump completo en:', outFile);
  console.log('Tamano:', sm.length, 'chars, ~', Math.round(sm.length / 4), 'tokens');

  // Detectar separadores decorativos (lineas con solo = + espacios)
  const lines = sm.split('\n');
  const decorativos = lines.filter(l => /^#\s*=+\s*$/.test(l)).length;
  console.log('Separadores decorativos "# ====":', decorativos);

  // Buscar duplicaciones de regla
  const dupChecks = [
    { name: 'Regla anti-alucinacion/inventar datos', re: /(NUNCA inventes|NUNCA inventas|JAMAS inventes|JAMAS inventas)/gi },
    { name: 'Bot NO agenda visitas', re: /(no agendas|NUNCA agendes|NO AGENDAS)/gi },
    { name: 'Dormitorios vs Ambientes', re: /(dormitorios.*ambientes|ambientes.*dormitorios|dorm.*\\+\\s*2|N\\+2)/gi },
    { name: 'Auto-correccion', re: /(auto.correccion|auto-correccion|tenes razon, perdon)/gi },
    { name: 'Sin signos ¿¡ apertura', re: /(¿|¡|signos.*apertura|sin apertura)/gi },
    { name: 'Camila te contacta (generico)', re: /(le aviso a Camila|Camila se va a contactar|que se contacte con vos)/gi },
    { name: 'Estilo natural / no robot', re: /(estilo natural|no como robot|whatsapp argentino)/gi },
  ];
  console.log('\n=== Conteos de menciones (alto = duplicacion) ===');
  for (const c of dupChecks) {
    const matches = (sm.match(c.re) || []).length;
    console.log('  '+c.name.padEnd(40)+': '+matches+' menciones');
  }

  // Listar todos los H1
  console.log('\n=== H1 headers ===');
  const h1s = lines.map((l, i) => ({ l, i })).filter(x => /^#\s+[^#=]/.test(x.l));
  for (const h of h1s) console.log('  L'+(h.i+1).toString().padStart(4)+': '+h.l.slice(0, 80));
})();
