"""W5 Volcar nodes: refactorizar columns de expression-returning-object a objeto literal.
n8n NO soporta 'columns' como expression; debe ser dict con mappingMode + matchingColumns.
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W5 = 'uA4y7AytMBraEiEX'

# Mapping nodo -> matching column (primary key de cada tabla)
MATCHING = {
    '1 - Volcar leads': 'lead_id',
    '2 - Volcar propiedades': 'prop_id',
    '3 - Volcar visitas': 'visita_id',
    '4 - Volcar contratos': 'contrato_id',
    '5 - Volcar empleados': 'empleado_id',
    '6 - Volcar matches_pendientes': 'match_id',
    '7 - Volcar conversaciones': 'msg_id',
    '8 - Volcar acciones_ia': 'accion_id',
}

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

for n in w['nodes']:
    if n['name'] in MATCHING:
        key = MATCHING[n['name']]
        n['parameters']['columns'] = {
            'mappingMode': 'autoMapInputData',
            'matchingColumns': [key],
            'schema': [],
            'attemptToConvertTypes': False,
            'convertFieldsToString': True
        }
        print(f'OK: {n["name"]} matching={key}')

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
urllib.request.urlopen(req)

for a in ['deactivate','activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r: print(a, r.status)
    except urllib.error.HTTPError as e: print(a, 'err', e.code)
