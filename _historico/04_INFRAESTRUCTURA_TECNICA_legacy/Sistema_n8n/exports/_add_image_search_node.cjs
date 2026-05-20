const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';
function reqp(opts, body){return new Promise((res,rej)=>{const r=http.request(opts,resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});r.on('error',rej);if(body)r.write(body);r.end()})}
function newId(){return 'i-'+Math.random().toString(36).slice(2,10);}
(async()=>{
  const r = await reqp({host:'localhost',port:5680,path:'/api/v1/workflows/aUMQyupnGJ5IWm5e',method:'GET',headers:{'X-N8N-API-KEY':API_KEY}});
  const wf = JSON.parse(r.body);
  fs.mkdirSync('_backups', {recursive: true});
  fs.writeFileSync('_backups/W1_pre_image_search_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json', JSON.stringify(wf,null,2));

  // Borrar nodo si existe (re-ejecucion)
  wf.nodes = wf.nodes.filter(n => n.name !== 'Buscar Por Imagen');

  const vision = wf.nodes.find(n => n.name === 'Imagen - Vision');
  const setN = wf.nodes.find(n => n.name === 'Imagen - Set Mensaje');
  if(!vision || !setN) throw new Error('No encuentro Imagen-Vision o Imagen-Set-Mensaje');

  // Crear el nodo HTTP
  const searchNode = {
    parameters: {
      method: 'POST',
      url: 'http://host.docker.internal:3003/api/search-by-image',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={\n  "image_url": "{{ $(\'Parsear Mensaje\').item.json.media_url }}",\n  "limit": 3\n}',
      options: { response: { response: { neverError: true } } },
    },
    id: newId(),
    name: 'Buscar Por Imagen',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [vision.position[0] + 200, vision.position[1]],
  };
  wf.nodes.push(searchNode);

  // Rewire: Vision → Buscar Por Imagen → Set Mensaje
  wf.connections['Imagen - Vision'] = { main: [[{ node: 'Buscar Por Imagen', type: 'main', index: 0 }]] };
  wf.connections['Buscar Por Imagen'] = { main: [[{ node: 'Imagen - Set Mensaje', type: 'main', index: 0 }]] };

  // Actualizar Set Mensaje para incluir match visual + Vision desc
  setN.parameters.assignments.assignments[0].value = "=[IMAGEN RECIBIDA] {{ $('Imagen - Vision').item.json.content || $('Imagen - Vision').item.json.text || 'foto sin descripcion' }}\n{{ $json.items && $json.items.length > 0 && $json.items[0].score > 0.6 ? '[MATCH_VISUAL_FUERTE] La foto parece coincidir con: ' + $json.items[0].title + ' (' + $json.items[0].url + ') score=' + $json.items[0].score : ($json.items && $json.items.length > 0 ? '[MATCH_VISUAL_DEBIL] Top candidato: ' + $json.items[0].title + ' score=' + $json.items[0].score + ' (puede no ser exacto)' : '[SIN_MATCH_VISUAL]') }}{{ $('Parsear Mensaje').item.json.mensaje_original ? ' | Caption del cliente: ' + $('Parsear Mensaje').item.json.mensaje_original : '' }}";
  console.log('✓ Buscar Por Imagen agregado entre Vision y Set Mensaje');
  console.log('✓ Imagen - Set Mensaje actualizado con info de match visual');

  const allowed = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settings = {executionOrder:'v1'};
  if(wf.settings) for(const k of allowed) if(wf.settings[k] !== undefined) settings[k]=wf.settings[k];
  const put = await reqp({host:'localhost',port:5680,path:'/api/v1/workflows/aUMQyupnGJ5IWm5e',method:'PUT',headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}},JSON.stringify({name:wf.name,nodes:wf.nodes,connections:wf.connections,settings}));
  console.log('PUT:', put.status);
  const act = await reqp({host:'localhost',port:5680,path:'/api/v1/workflows/aUMQyupnGJ5IWm5e/activate',method:'POST',headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}});
  console.log('Activate:', act.status === 200 ? 'OK ACTIVO' : act.body.slice(0,200));
})();
