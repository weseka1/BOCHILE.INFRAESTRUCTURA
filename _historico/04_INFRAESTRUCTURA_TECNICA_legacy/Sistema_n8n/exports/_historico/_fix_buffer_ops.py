"""Fix operations en nodos Buffer: getManyRows no existe en esta version.
Insert: sin operation (default). Leer: operation='get' con filter por telefono."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'
BUFFER_DT = '2TMTuWeDQD7jDCpd'

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

for n in w['nodes']:
    if n['name'] == 'Buffer - Insertar Msg':
        # Quitar operation - default es insert
        if 'operation' in n['parameters']:
            del n['parameters']['operation']
        # Asegurar refs correctas: el item llega de Merge Caminos
        n['parameters']['columns']['value'] = {
            'telefono': '={{ $json.telefono }}',
            'mensaje': '={{ $json.mensaje }}',
            'msg_id': '={{ $json.msg_id }}',
            'ts': '={{ $now.toISO() }}'
        }
        print('OK Buffer Insert (default insert)')
    elif n['name'] == 'Buffer - Leer Todos':
        n['parameters'] = {
            'operation': 'get',
            'dataTableId': {'__rl': True, 'mode': 'id', 'value': BUFFER_DT, 'cachedResultName': 'bochile_buffer_msgs'},
            'matchType': 'allConditions',
            'filters': {
                'conditions': [
                    {'keyName': 'telefono', 'keyValue': '={{ $(\"Merge Caminos\").item.json.telefono }}'}
                ]
            },
            'limit': 100
        }
        print('OK Buffer Leer Todos (get with filter)')

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    urllib.request.urlopen(req)
    print('W1 updated')
except urllib.error.HTTPError as e:
    print('upd err:', e.code, e.read()[:300].decode())

for action in ['deactivate', 'activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/{action}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            print(action, r.status)
    except urllib.error.HTTPError as e:
        print(action, 'err', e.code)
