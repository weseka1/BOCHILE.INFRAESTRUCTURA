const http = require('node:http');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
function req(path){return new Promise((res,rej)=>{const r=http.request({host:'localhost',port:5680,path,method:'GET',headers:{'X-N8N-API-KEY':API_KEY}},resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});r.on('error',rej);r.end()})}
(async()=>{
  const r = await req('/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);
  const names = new Set(wf.nodes.map(n => n.name));
  const REFS_RE = /\$\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const broken = [];
  function walk(obj, nodeName, path){
    if(obj == null) return;
    if(typeof obj === 'string'){
      let m;
      const r2 = new RegExp(REFS_RE.source, 'g');
      while((m = r2.exec(obj)) !== null){
        const refName = m[1];
        if(!names.has(refName)){
          broken.push({node: nodeName, refers_to: refName, in_path: path, sample: obj.slice(0,120).replace(/\n/g,' ')});
        }
      }
      return;
    }
    if(typeof obj === 'object'){
      if(Array.isArray(obj)) obj.forEach((v,i) => walk(v, nodeName, path+'['+i+']'));
      else for(const [k,v] of Object.entries(obj)) walk(v, nodeName, path+'.'+k);
    }
  }
  for(const n of wf.nodes) walk(n.parameters, n.name, '');
  if(broken.length === 0) console.log('SIN referencias rotas');
  else { console.log('REFERENCIAS ROTAS:'); broken.forEach(b => console.log('  ['+b.node+'] → "'+b.refers_to+'" | '+b.in_path)); console.log(''); console.log('Samples:'); broken.slice(0,5).forEach(b => console.log('  '+b.sample)); }

  // Wait sin webhookId
  for(const n of wf.nodes){
    if(n.type === 'n8n-nodes-base.wait' && (!n.webhookId || n.webhookId.length < 8)){
      console.log('⚠ Wait sin webhookId valido:', n.name, '| current:', n.webhookId);
    }
  }
})();
