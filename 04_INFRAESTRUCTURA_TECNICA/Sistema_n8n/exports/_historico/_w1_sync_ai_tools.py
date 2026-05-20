"""W1: sync de los datos que los AI Tools (Crear Visita, Guardar Match, Actualizar Lead)
modifican durante la conversacion.

Approach: despues de 'Vendedor CORE' (cuando el agent termino y los tools corrieron),
insertar bulk-sync de las 3 tablas relevantes (visitas, matches_pendientes, leads del cliente actual)
ANTES de 'Log Mensaje Saliente'. Asi el Sheet refleja TODO lo que el bot hizo en ese turno.
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}

DT_VISITAS = 'UJOWnNg9k0BdMMJP'
DT_MATCHES = 'X1djtSSRbpiiNMTk'
DT_LEADS = 'UGNAXqPUX0udDRPi'

COLS_VISITAS = ['visita_id','lead_id','prop_id','vendedor_id','vendedor_nombre','cliente_nombre','direccion','fecha','hora','estado','confirmada_cliente','notificada_vendedor','recordatorio_enviado','resultado','observaciones','creada_en']
COLS_MATCHES = ['match_id','lead_id','lead_nombre','lead_telefono','criterios_json','creado_en','estado','props_ofrecidas']
COLS_LEADS = ['lead_id','nombre','telefono','email','canal','operacion','tipo_propiedad','zona_pref','ambientes','presupuesto_min','presupuesto_max','moneda','forma_pago','urgencia','score','etapa','vendedor_asignado','ultima_intencion','notas','creado_en','actualizado_en']

def make_read(name, dtid, pos):
    return {
        'id': 'aiR-' + name.lower().replace(' ', '-'),
        'name': name,
        'type': 'n8n-nodes-base.dataTable',
        'typeVersion': 1.1,
        'position': pos,
        'parameters': {
            'resource':'row','operation':'get',
            'dataTableId': {'__rl': True, 'mode': 'id', 'value': dtid},
            'returnAll': True
        },
        'alwaysOutputData': True,
        'onError':'continueRegularOutput',
        'retryOnFail': True,'waitBetweenTries': 2000,'maxTries': 3
    }

def make_sheet(name, sheet, cols, matching, pos):
    value_dict = {c: '={{ $json["' + c + '"] }}' for c in cols}
    return {
        'id': 'aiS-' + name.lower().replace(' ', '-'),
        'name': name,
        'type': 'n8n-nodes-base.googleSheets',
        'typeVersion': 4.7,
        'position': pos,
        'parameters': {
            'resource':'sheet','operation':'appendOrUpdate',
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': sheet},
            'columns': {
                'mappingMode':'defineBelow','value': value_dict,
                'matchingColumns': [matching],'schema': [],
                'attemptToConvertTypes': False,'convertFieldsToString': True
            },'options': {}
        },
        'credentials': {'googleSheetsOAuth2Api': GSHEETS_CRED},
        'onError':'continueRegularOutput','retryOnFail': True,
        'waitBetweenTries': 2000,'maxTries': 3
    }

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

# Quitar los nodos sync AI viejos (idempotencia)
sync_ai_names = {'AI - Leer Visitas','AI - Sheet Sync Visitas','AI - Leer Matches','AI - Sheet Sync Matches','AI - Leer Lead Actual','AI - Sheet Sync Lead'}
w['nodes'] = [n for n in w['nodes'] if n['name'] not in sync_ai_names]

# Posiciones a la derecha del Vendedor CORE
core_node = next(n for n in w['nodes'] if n['name'] == 'Vendedor CORE')
cx, cy = core_node['position']
xstart = cx + 250

# 6 nodos: Leer Visitas, Sync Visitas, Leer Matches, Sync Matches, Leer Lead, Sync Lead
new_nodes = [
    make_read('AI - Leer Visitas', DT_VISITAS, [xstart, cy - 200]),
    make_sheet('AI - Sheet Sync Visitas', 'visitas', COLS_VISITAS, 'visita_id', [xstart + 230, cy - 200]),
    make_read('AI - Leer Matches', DT_MATCHES, [xstart + 460, cy - 200]),
    make_sheet('AI - Sheet Sync Matches', 'matches_pendientes', COLS_MATCHES, 'match_id', [xstart + 690, cy - 200]),
    make_read('AI - Leer Lead Actual', DT_LEADS, [xstart + 920, cy - 200]),
    make_sheet('AI - Sheet Sync Lead', 'leads', COLS_LEADS, 'lead_id', [xstart + 1150, cy - 200]),
]
w['nodes'].extend(new_nodes)

# Reconectar: Vendedor CORE -> AI Leer Visitas -> ... -> AI Sheet Sync Lead -> Log Mensaje Saliente
# Primero capturamos donde apuntaba Vendedor CORE (debe ser Log Mensaje Saliente)
core_out = w['connections'].get('Vendedor CORE', {}).get('main', [[]])
# Insertamos la cadena entre medio
chain = ['AI - Leer Visitas','AI - Sheet Sync Visitas','AI - Leer Matches','AI - Sheet Sync Matches','AI - Leer Lead Actual','AI - Sheet Sync Lead']
w['connections']['Vendedor CORE'] = {'main': [[{'node': chain[0], 'type':'main','index':0}]]}
for i in range(len(chain)-1):
    w['connections'][chain[i]] = {'main': [[{'node': chain[i+1],'type':'main','index':0}]]}
# Ultimo de la cadena -> donde antes apuntaba CORE
w['connections'][chain[-1]] = {'main': core_out}

print('Cadena agregada:')
print(f'  Vendedor CORE -> {" -> ".join(chain)} -> [destino original]')

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    with urllib.request.urlopen(req) as r: print(f'\\nW1 PUT: {r.status}')
except urllib.error.HTTPError as e:
    print(f'PUT err: {e.code} {e.read()[:400].decode()}')
    raise SystemExit
for a in ['deactivate','activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r: print(a, r.status)
    except urllib.error.HTTPError as e: print(a, 'err', e.code)
