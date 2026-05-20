"""1) Batch debounce 30s para mensajes cortitos consecutivos.
   2) Reforzar prompt Admin para incluir telefono cliente en notif vendedor."""
import json, urllib.request

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'
BUFFER_DT = 'SD2NdIwb21OIrAuZ'

# === BUFFER CHECK code ===
BUFFER_CHECK_CODE = r"""
// Lee TODOS los msgs del buffer del telefono del item actual
// Si yo NO soy el ultimo (max ts) -> skip
// Si yo SOY el ultimo -> consolido los msgs de los ultimos 60s en un solo texto
const item = $input.first().json;
const myTel = item.telefono;
const myMsgId = item.msg_id;
const myTs = item.ts;

const allRows = $('Buffer - Leer Todos').first().json.data || $('Buffer - Leer Todos').all().map(x => x.json);
const rows = Array.isArray(allRows) ? allRows : (allRows.data || []);
const mine = rows.filter(r => r.telefono === myTel);
mine.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));

if (mine.length === 0) return [item];

const last = mine[mine.length - 1];
if (last.msg_id !== myMsgId) {
  return [{ skip: true, reason: 'no_soy_ultimo_del_lote' }];
}

const cutoff = new Date(new Date(myTs).getTime() - 60000).toISOString();
const recientes = mine.filter(r => (r.ts || '') >= cutoff);
const consolidado = recientes.map(r => r.mensaje).filter(Boolean).join('\n');
return [{ ...item, mensaje: consolidado || item.mensaje, batched_count: recientes.length }];
"""

# === PROMPT ADMIN actualizado con telefono cliente ===
ADMIN_PROMPT = """ADMIN Bochile. Unico que escribe CRM y notifica vendedor.

A) AGENDAR:
1. 'Leer Vendedores Activos' -> elegir por zona_especialidad (sin match: menos visitas_mes).
2. 'Crear Visita en CRM'.
3. 'Avisar Vendedor por WhatsApp Twilio' con mensaje EXACTO formato:
   "VISITA AGENDADA. Cliente: [NOMBRE] (tel +54...). Dia: [DD/MM] [HH:MM]. Direccion: [DIRECCION]. Prop: [P-XXX]. Score: XX. Presupuesto: USD/ARS XXX. Zona: XXX. Tour: <url>. Notas: ..."
   IMPORTANTE: SIEMPRE incluir el telefono del cliente con prefijo +54 para que el vendedor pueda contactarlo.
4. 'Actualizar Lead CRM' etapa='Visita agendada'.

B) GUARDAR MATCH PENDIENTE: 'Guardar Match Pendiente' + 'Actualizar Lead CRM' etapa='En espera de stock'.
C) ACTUALIZAR LEAD: 'Actualizar Lead CRM'.

REGLAS:
- NUNCA agendes sin fecha+hora confirmadas.
- WhatsApp Twilio: telefonos con prefijo +54 (sin 'whatsapp:').
- El telefono del CLIENTE en la notificacion al vendedor: SIEMPRE incluirlo, formato +54XXXXXXXXXXX.
- requiere_humano=true -> solo update CRM con nota.

Devolve resumen plano."""

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

# 1. Reforzar Admin prompt
for n in w['nodes']:
    if n['name'] == 'SubAgente Administrativo':
        n['parameters']['options']['systemMessage'] = ADMIN_PROMPT
        print('OK Admin prompt actualizado con telefono cliente')

# 2. Encontrar posiciones para nuevos nodos
mc_node = next((n for n in w['nodes'] if n['name'] == 'Merge Caminos'), None)
bl_node = next((n for n in w['nodes'] if n['name'] == 'Buscar Lead Existente'), None)
mc_x, mc_y = mc_node['position']
bl_x, bl_y = bl_node['position']

# 3. Crear nodos: Buffer Insert -> Wait -> Buffer Leer Todos -> Buffer Check
new_nodes = [
    {
        'id': 'buffer-insert-001',
        'name': 'Buffer - Insertar Msg',
        'type': 'n8n-nodes-base.dataTable',
        'typeVersion': 1.1,
        'position': [mc_x + 200, mc_y],
        'parameters': {
            'operation': 'insert',
            'dataTableId': {'__rl': True, 'mode': 'id', 'value': BUFFER_DT, 'cachedResultName': 'bochile_buffer_msgs'},
            'columns': {
                'mappingMode': 'defineBelow',
                'value': {
                    'telefono': '={{ $json.telefono }}',
                    'mensaje': '={{ $json.mensaje }}',
                    'msg_id': '={{ $json.msg_id }}',
                    'ts': '={{ $now.toISO() }}'
                },
                'matchingColumns': [],
                'schema': []
            },
            'options': {}
        }
    },
    {
        'id': 'wait-30s-001',
        'name': 'Wait 30s',
        'type': 'n8n-nodes-base.wait',
        'typeVersion': 1.1,
        'position': [mc_x + 400, mc_y],
        'parameters': {
            'amount': 30,
            'unit': 'seconds'
        },
        'webhookId': 'bochile-wait-30s'
    },
    {
        'id': 'buffer-leer-001',
        'name': 'Buffer - Leer Todos',
        'type': 'n8n-nodes-base.dataTable',
        'typeVersion': 1.1,
        'position': [mc_x + 600, mc_y],
        'parameters': {
            'operation': 'getManyRows',
            'dataTableId': {'__rl': True, 'mode': 'id', 'value': BUFFER_DT, 'cachedResultName': 'bochile_buffer_msgs'},
            'filters': {'conditions': []},
            'options': {}
        }
    },
    {
        'id': 'buffer-check-001',
        'name': 'Buffer - Soy Ultimo?',
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': [mc_x + 800, mc_y],
        'parameters': {
            'mode': 'runOnceForAllItems',
            'language': 'javaScript',
            'jsCode': r"""// Lee el item original via expression $('Merge Caminos') y la lista del buffer
const me = $('Merge Caminos').first().json;
const myTel = me.telefono;
const myMsgId = me.msg_id;
const myTs = me.timestamp_iso;

// $input.all() trae las filas del buffer (Buffer - Leer Todos)
const allRows = $input.all().map(x => x.json);
const mine = allRows.filter(r => r && r.telefono === myTel);
mine.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));

if (mine.length === 0) {
  return [{ json: { ...me, batched_count: 1 } }];
}

const last = mine[mine.length - 1];
if (last.msg_id !== myMsgId) {
  // No soy el ultimo: skip silencioso
  return [];
}

// Soy el ultimo: consolido los msgs de los ultimos 60s
const cutoff = new Date(new Date(myTs).getTime() - 60000).toISOString();
const recientes = mine.filter(r => (r.ts || '') >= cutoff);
const consolidado = recientes.map(r => r.mensaje).filter(Boolean).join('\n');

return [{ json: { ...me, mensaje: consolidado || me.mensaje, batched_count: recientes.length } }];
"""
        }
    }
]

# Remover si ya existian (para idempotencia)
existing_names = {n['name'] for n in new_nodes}
w['nodes'] = [n for n in w['nodes'] if n['name'] not in existing_names]
w['nodes'].extend(new_nodes)

# 4. Reconectar: Merge Caminos -> Buffer Insertar -> Wait -> Buffer Leer -> Buffer Check -> Buscar Lead
# Borrar conn vieja Merge -> Buscar Lead
if 'Merge Caminos' in w['connections']:
    main = w['connections']['Merge Caminos'].get('main', [])
    new_main = []
    for branch in main:
        new_branch = [b for b in (branch or []) if b['node'] != 'Buscar Lead Existente']
        new_main.append(new_branch)
    w['connections']['Merge Caminos']['main'] = new_main

w['connections'].setdefault('Merge Caminos', {'main': [[]]})
w['connections']['Merge Caminos']['main'] = [[{'node': 'Buffer - Insertar Msg', 'type': 'main', 'index': 0}]]
w['connections']['Buffer - Insertar Msg'] = {'main': [[{'node': 'Wait 30s', 'type': 'main', 'index': 0}]]}
w['connections']['Wait 30s'] = {'main': [[{'node': 'Buffer - Leer Todos', 'type': 'main', 'index': 0}]]}
w['connections']['Buffer - Leer Todos'] = {'main': [[{'node': 'Buffer - Soy Ultimo?', 'type': 'main', 'index': 0}]]}
w['connections']['Buffer - Soy Ultimo?'] = {'main': [[{'node': 'Buscar Lead Existente', 'type': 'main', 'index': 0}]]}

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    with urllib.request.urlopen(req) as r:
        print('OK W1 actualizado con batch 30s')
except urllib.error.HTTPError as e:
    print('ERR:', e.code, e.read().decode()[:500])

# Reactivar
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try: urllib.request.urlopen(req); print('reactivado')
except: pass
