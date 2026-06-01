// REGLA CRITICA combinada (3 ajustes del cliente):
//
// 1. NO usar "exclusivo" para describir propiedades. Usar
//    "Piso de categoría" o "Casa de categoría".
// 2. Solo recomendar en la ZONA/CIUDAD pedida por el cliente.
//    Excepcion: si es INVERSION, puede recomendar en distintas
//    ciudades (si hay disponible).
// 3. Calificar antes de recomendar: zona + tipo + presupuesto.

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNTk4NGQwMC1hODE4LTRjMWUtOGMzYi02ZDEzM2YwODM3NzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMTRhMjA5NTgtZTE5Zi00YWM2LThlY2QtOWVmZGU5ZjcwNzgwIiwiaWF0IjoxNzc5MjUzODIyLCJleHAiOjE3ODE4MzgwMDB9.kCrbnDhCGLf5-_jq0IhrWxudhKU5noQXFxrI_OzAy_A';
const WF = 'TEdlfSBCc5ENVslp';

function req(m, p, body) {
  return new Promise(r => {
    const d = body ? JSON.stringify(body) : null;
    const h = { 'X-N8N-API-KEY': KEY };
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const buf = [];
    const x = https.request({ host: 'weseka.onrender.com', port: 443, path: p, method: m, headers: h, timeout: 25000 }, rsp => { rsp.on('data', c => buf.push(c)); rsp.on('end', () => r({ s: rsp.statusCode, b: Buffer.concat(buf).toString('utf8') })); });
    x.on('timeout', () => { x.destroy(); r({ s: 0, b: 'TIMEOUT' }); });
    x.on('error', e => r({ s: 0, b: e.message }));
    if (d) x.write(d);
    x.end();
  });
}

const NUEVA_REGLA = [
  '',
  '## CALIFICACION ANTES DE RECOMENDAR (no divagar)',
  '',
  'NUNCA tires propiedades al voleo. Antes de invocar el Matcher,',
  'asegurate de tener al menos 2 de estos 3 datos del cliente:',
  '  - ZONA o CIUDAD (Bahia Blanca, Monte Hermoso, Palihue, centro, etc)',
  '  - TIPO de propiedad (casa, depto, semipiso, ph, terreno, local)',
  '  - PRESUPUESTO aproximado',
  '',
  'Si el cliente dice palabras vagas tipo "premium", "lo lindo", "algo bueno",',
  '"lo mejor", "categoria" SIN especificar zona ni ciudad, NO tires opciones.',
  'PREGUNTA primero:',
  '',
  '  Cliente: "Busco un piso de categoria"',
  '  Cami MAL: tira 3 props de zonas distintas',
  '  Cami BIEN: "Buenas tardes! En qué zona o ciudad te interesa?',
  '              Bahia Blanca o Monte Hermoso? Y para qué presupuesto aproximado?"',
  '',
  '## RECOMENDACIONES COHERENTES (solo la zona/ciudad pedida)',
  '',
  'Cuando muestres opciones, deben ser de la MISMA zona/ciudad pedida por',
  'el cliente. NO mezcles Bahia Blanca + Monte Hermoso ni Palihue + centro',
  'en la misma lista a menos que el cliente diga explicitamente "cualquiera"',
  'o "me da igual donde sea".',
  '',
  'EXCEPCION INVERSION: si el cliente menciona que es para INVERSION (palabras',
  'clave: "inversion", "para invertir", "para alquilar", "rentabilidad", "renta",',
  '"para poner en alquiler", "comprar para alquilar"), AHI SI podes recomendar',
  'opciones en distintas ciudades disponibles, porque al inversor le importa',
  'mas el retorno que la zona puntual. En ese caso decis explicitamente: "como',
  'es para inversion, te paso opciones en distintas ciudades para que veas',
  'cual te conviene por retorno."',
  '',
  '## SI NO HAY MATCH EN LA ZONA PEDIDA',
  '',
  'Decir explicitamente: "en esa zona no tenemos disponible ahora en tu rango.',
  'Te ofrezco opciones cercanas? O esperamos a que entre algo nuevo y te aviso."',
  '',
  'NUNCA pretender que una prop en otra ciudad cumple la zona pedida (excepto',
  'inversion, ver arriba).',
  '',
  '## VOCABULARIO: NUNCA decir "exclusivo" — usar "de categoría"',
  '',
  'Cuando describas una propiedad premium / VIP / lujosa, NUNCA uses la palabra',
  '"exclusivo" en tu descripcion. Usa estas alternativas:',
  '  - Para departamentos/semipisos -> "piso de categoría"',
  '  - Para casas -> "casa de categoría"',
  '  - Para terrenos -> "terreno premium" o "ubicación destacada"',
  '',
  'Ejemplos:',
  '  Cami MAL: "Tenemos un departamento exclusivo en Alem 127"',
  '  Cami BIEN: "Tenemos un piso de categoría en Alem 127"',
  '',
  '  Cami MAL: "Es una casa exclusiva en Palihue"',
  '  Cami BIEN: "Es una casa de categoría en Palihue"',
  '',
  'EXCEPCION: si el TITULO de la propiedad del catalogo dice "Exclusivo X"',
  '(ej "Exclusivo Semipiso en Venta | Alem 127"), podes mostrar ese titulo',
  'tal cual viene del catalogo en tu lista de props, pero al describirla en',
  'tus propias palabras usa "piso de categoría".',
  '',
  '## CERO RECOMENDACIONES INVENTADAS',
  '',
  'TODA propiedad que recomendes DEBE venir del Matcher / [CATALOGO_MATCH].',
  'Si no estas seguro de que la prop existe, NO la recomiendes. JAMAS inventes',
  'direcciones, precios o caracteristicas.',
  ''
].join('\n');

(async () => {
  const r = await req('GET', '/api/v1/workflows/' + WF);
  const w = JSON.parse(r.b);

  const bkpDir = path.resolve(__dirname, '_workflow_backups');
  if (!fs.existsSync(bkpDir)) fs.mkdirSync(bkpDir, { recursive: true });
  fs.writeFileSync(path.join(bkpDir, WF + '_pre_categoria_zona_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify(w, null, 2));

  const core = w.nodes.find(n => n.name === 'Vendedor CORE');
  let sm = String(core.parameters.options.systemMessage || '');

  if (sm.includes('## CALIFICACION ANTES DE RECOMENDAR')) {
    console.log('Regla ya estaba inyectada, reemplazo el bloque completo');
    // Buscar y reemplazar el bloque existente
    const start = sm.indexOf('## CALIFICACION ANTES DE RECOMENDAR');
    // Buscar el final del bloque (proximo "# " o "##" major a otro nivel - basicamente el siguiente header)
    const end = sm.indexOf('\n# ', start);
    const oldLen = end > 0 ? end - start : sm.length - start;
    sm = sm.slice(0, start) + NUEVA_REGLA.trim() + '\n' + (end > 0 ? sm.slice(end) : '');
    console.log('Bloque viejo reemplazado (era ' + oldLen + ' chars)');
  } else {
    // Insertar despues de PUNTUACION ESTRICTA
    const punctIdx = sm.indexOf('## PUNTUACION ESTRICTA');
    if (punctIdx >= 0) {
      const nextH = sm.indexOf('\n# ', punctIdx);
      if (nextH >= 0) {
        sm = sm.slice(0, nextH) + NUEVA_REGLA + sm.slice(nextH);
        console.log('Regla CALIFICACION + COHERENCIA ZONAS + CATEGORIA inyectada');
      } else {
        sm += NUEVA_REGLA;
      }
    }
  }

  core.parameters.options.systemMessage = sm;

  const A = ['saveExecutionProgress','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','executionTimeout','errorWorkflow','timezone','executionOrder'];
  const s = {};
  if (w.settings) for (const k of A) if (w.settings[k] !== undefined) s[k] = w.settings[k];
  if (!s.executionOrder) s.executionOrder = 'v1';
  s.timezone = 'America/Argentina/Buenos_Aires';

  const upd = await req('PUT', '/api/v1/workflows/' + WF, { name: w.name, nodes: w.nodes, connections: w.connections, settings: s });
  console.log('PUT:', upd.s);
  const act = await req('POST', '/api/v1/workflows/' + WF + '/activate');
  console.log('Activate:', act.s);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
