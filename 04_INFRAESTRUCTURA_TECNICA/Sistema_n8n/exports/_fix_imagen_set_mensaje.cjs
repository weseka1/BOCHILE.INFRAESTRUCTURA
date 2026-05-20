// Fix: Imagen - Set Mensaje tiene una expresion inline con paréntesis/comillas
// anidadas que rompe el parser de n8n. La solucion es mover la logica a un Code node.
//
// Nuevo flujo: Buscar Por Imagen -> Formatear Match CLIP -> Imagen - Set Mensaje
const http = require('node:http');
const crypto = require('node:crypto');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE';

function req(method, path, body){
  return new Promise((res,rej)=>{
    const data = body ? JSON.stringify(body) : null;
    const opts = {host:'localhost',port:5680,path,method,headers:{'X-N8N-API-KEY':API_KEY,'Content-Type':'application/json'}};
    if(data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, resp=>{let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({status:resp.statusCode,body:d}))});
    r.on('error',rej);
    if(data) r.write(data);
    r.end();
  });
}

(async()=>{
  const r = await req('GET', '/api/v1/workflows/aUMQyupnGJ5IWm5e');
  const wf = JSON.parse(r.body);

  const buscarImg = wf.nodes.find(n => n.name === 'Buscar Por Imagen');
  const setMsg = wf.nodes.find(n => n.name === 'Imagen - Set Mensaje');

  // Si no existe el formatter, crearlo
  let formatter = wf.nodes.find(n => n.name === 'Formatear Match CLIP');
  if (!formatter) {
    formatter = {
      parameters: {
        jsCode: [
          '// Recibe output de Buscar Por Imagen ({ mode, count, items: [{ prop_id, score, title, url, address }] })',
          '// Tambien tiene acceso a Imagen - Vision (descripcion) y Parsear Mensaje (caption).',
          'const inp = $input.first().json || {};',
          'const items = Array.isArray(inp.items) ? inp.items : [];',
          'const top = items[0] || null;',
          '',
          '// Descripcion vision',
          'let visionDesc = "";',
          'try { visionDesc = $("Imagen - Vision").first().json.content || $("Imagen - Vision").first().json.text || ""; } catch(e) {}',
          '',
          '// Caption del cliente',
          'let caption = "";',
          'try { caption = $("Parsear Mensaje").first().json.mensaje_original || ""; } catch(e) {}',
          '',
          '// Construir bloque CLIP segun thresholds',
          'let clipBlock = "[SIN_MATCH_VISUAL] No hay similitud visual con catalogo. Pedi direccion.";',
          'if (top) {',
          '  const sc = Number(top.score || 0);',
          '  if (sc >= 0.95) {',
          '    clipBlock = "[CONFIRMADO_VISUAL] Esta foto corresponde a: " + top.title + " (" + top.url + "). Score CLIP=" + sc.toFixed(3) + ". Es segura, podes confirmar sin pedir direccion.";',
          '  } else if (sc >= 0.88) {',
          '    clipBlock = "[POSIBLE_MATCH] Top candidato: " + top.title + " (" + top.url + ") score=" + sc.toFixed(3) + ". Pedile al cliente que confirme la direccion antes de avanzar.";',
          '  } else if (items.length > 0) {',
          '    const tops = items.slice(0, 3).map(function(it, i) {',
          '      return (i+1) + ") " + it.title + " score=" + Number(it.score || 0).toFixed(3);',
          '    }).join(" | ");',
          '    clipBlock = "[MATCH_DEBIL] Top 3 candidatos: " + tops + ". PEDI direccion al cliente.";',
          '  }',
          '}',
          '',
          'const captionBlock = caption ? ("\\n\\n[CAPTION] " + caption) : "";',
          'const mensaje = "[IMAGEN RECIBIDA - VISION] " + (visionDesc || "sin descripcion") + "\\n\\n" + clipBlock + captionBlock;',
          '',
          'return [{ json: { mensaje: mensaje } }];'
        ].join('\n')
      },
      name: 'Formatear Match CLIP',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [buscarImg.position[0] + 220, buscarImg.position[1]],
      id: crypto.randomUUID()
    };
    wf.nodes.push(formatter);
  }

  // Reconectar: Buscar Por Imagen -> Formatear Match CLIP -> Imagen - Set Mensaje
  wf.connections['Buscar Por Imagen'] = {
    main: [[{ node: 'Formatear Match CLIP', type: 'main', index: 0 }]]
  };
  wf.connections['Formatear Match CLIP'] = {
    main: [[{ node: 'Imagen - Set Mensaje', type: 'main', index: 0 }]]
  };

  // Simplificar Imagen - Set Mensaje: tomar el mensaje ya armado
  setMsg.parameters = {
    assignments: {
      assignments: [
        { id: 'a1', name: 'mensaje', value: "={{ $('Formatear Match CLIP').item.json.mensaje }}", type: 'string' }
      ]
    },
    includeOtherFields: true,
    options: {}
  };

  // PUT
  const ALLOWED = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const settingsClean = {};
  if (wf.settings) for (const k of ALLOWED) if (wf.settings[k] !== undefined) settingsClean[k] = wf.settings[k];
  const clean = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: settingsClean };
  const upd = await req('PUT', '/api/v1/workflows/aUMQyupnGJ5IWm5e', clean);
  console.log('PUT:', upd.status);
  if (upd.status !== 200) { console.log('Body:', upd.body.slice(0,800)); process.exit(1); }
  const act = await req('POST', '/api/v1/workflows/aUMQyupnGJ5IWm5e/activate');
  console.log('Activate:', act.status);

  console.log('\nFlujo final: Buscar Por Imagen -> Formatear Match CLIP -> Imagen - Set Mensaje');
})();
