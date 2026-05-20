"""W1 sync por evento -> Google Sheet.

Despues de cada nodo dataTable regular agregar un nodo googleSheets que
upsertea la misma fila a la pestana correspondiente del Sheet.

Cobertura FASE 1 (escrituras regulares, no AI Tools):
- Upsert Lead CRM     -> Sheet[leads]
- Log Mensaje Entrante -> Sheet[conversaciones]
- Log Mensaje Saliente -> Sheet[conversaciones]
- Registrar Accion IA  -> Sheet[acciones_ia]
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}

# Definiciones: tabla -> pestaña Sheet + columnas + matching key
SYNC_DEFS = {
    'leads': {
        'matching': 'lead_id',
        'cols': ['lead_id','nombre','telefono','email','canal','operacion','tipo_propiedad','zona_pref','ambientes','presupuesto_min','presupuesto_max','moneda','forma_pago','urgencia','score','etapa','vendedor_asignado','ultima_intencion','notas','creado_en','actualizado_en']
    },
    'conversaciones': {
        'matching': 'msg_id',
        'cols': ['msg_id','lead_id','telefono','canal','direccion','mensaje','intencion_detectada','agente_que_respondio','requiere_humano','timestamp']
    },
    'acciones_ia': {
        'matching': 'accion_id',
        'cols': ['accion_id','tipo','agente','lead_id','resumen','detalle','resultado','timestamp','tiempo_ahorrado_min']
    }
}

def make_sheet_node(name, sheet_name, defs, pos):
    cols = defs['cols']
    matching = defs['matching']
    value_dict = {c: '={{ $json["' + c + '"] }}' for c in cols}
    return {
        'id': 'sheet-' + name.lower().replace(' ', '-'),
        'name': name,
        'type': 'n8n-nodes-base.googleSheets',
        'typeVersion': 4.7,
        'position': pos,
        'parameters': {
            'resource': 'sheet',
            'operation': 'appendOrUpdate',
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': sheet_name},
            'columns': {
                'mappingMode': 'defineBelow',
                'value': value_dict,
                'matchingColumns': [matching],
                'schema': [],
                'attemptToConvertTypes': False,
                'convertFieldsToString': True
            },
            'options': {}
        },
        'credentials': {'googleSheetsOAuth2Api': GSHEETS_CRED},
        'onError': 'continueRegularOutput',
        'retryOnFail': True,
        'waitBetweenTries': 2000,
        'maxTries': 3
    }

# Mapping: nodo origen -> (nombre del sync node, pestaña, defs)
SYNC_MAP = {
    'Upsert Lead CRM': ('Sheet Sync Lead', 'leads', SYNC_DEFS['leads']),
    'Log Mensaje Entrante': ('Sheet Sync Msg Entrante', 'conversaciones', SYNC_DEFS['conversaciones']),
    'Log Mensaje Saliente': ('Sheet Sync Msg Saliente', 'conversaciones', SYNC_DEFS['conversaciones']),
    'Registrar Accion IA': ('Sheet Sync Accion', 'acciones_ia', SYNC_DEFS['acciones_ia']),
}

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

# Quitar nodos sync viejos si existen (idempotencia)
to_remove = {n_name for n_name, _, _ in [(v[0], None, None) for v in SYNC_MAP.values()]}
to_remove = {v[0] for v in SYNC_MAP.values()}
w['nodes'] = [n for n in w['nodes'] if n['name'] not in to_remove]

# Para cada nodo en SYNC_MAP, insertar el sync node DESPUES con misma conexion
for src_name, (sync_name, sheet, defs) in SYNC_MAP.items():
    src_node = next((n for n in w['nodes'] if n['name'] == src_name), None)
    if not src_node:
        print(f'WARN no encontre {src_name}')
        continue
    pos = [src_node['position'][0], src_node['position'][1] + 180]
    new_node = make_sheet_node(sync_name, sheet, defs, pos)
    w['nodes'].append(new_node)
    print(f'OK nodo {sync_name} agregado')

    # Insertar la conexion: src -> [next existing] + src -> sync_name (sync paralelo)
    # Mejor: src -> sync_name (sync corre primero, output OK incluso si falla) -> next
    if src_name in w['connections']:
        old_main = w['connections'][src_name].get('main', [[]])
        # Pasar las conexiones existentes a sync_name (sync se vuelve intermedio)
        w['connections'][sync_name] = {'main': old_main}
        w['connections'][src_name] = {'main': [[{'node': sync_name, 'type': 'main', 'index': 0}]]}
    else:
        w['connections'][src_name] = {'main': [[{'node': sync_name, 'type': 'main', 'index': 0}]]}

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    with urllib.request.urlopen(req) as r:
        print(f'\\nW1 PUT OK: {r.status}')
except urllib.error.HTTPError as e:
    print(f'PUT err: {e.code} {e.read()[:300].decode()}')
    raise SystemExit

for a in ['deactivate','activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r: print(a, r.status)
    except urllib.error.HTTPError as e: print(a, 'err', e.code)
