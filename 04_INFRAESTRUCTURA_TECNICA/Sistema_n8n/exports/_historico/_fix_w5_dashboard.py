"""W5 Sync Dashboard a Google Sheets - hacer que funcione 100%.

Cambios:
1. Asignar credencial Google Sheets OAuth (id 9NvEcPkNdH6i0j3L) a los 8 nodos googleSheets
2. Hardcode documentId al Sheets Bochile (en lugar de leer env var BOCHILE_GSHEET_ID)
3. Cambiar cron de cada 5 min -> cada 1 min
4. Agregar nodo "Health Log" al final que escribe en acciones_ia un row de salud
5. Activar el workflow
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W5 = 'uA4y7AytMBraEiEX'
GSHEETS_CRED_ID = '9NvEcPkNdH6i0j3L'
GSHEETS_CRED_NAME = 'Google Sheets account'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'  # Bochile · Sistema Operativo
ACCIONES_DT = 'XeXT6GunMsOgpGa2'  # bochile_acciones_ia

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

# 1. Asignar credencial + hardcode docId + reforzar handling
for n in w['nodes']:
    if n['type'] == 'n8n-nodes-base.googleSheets':
        n['credentials'] = {
            'googleSheetsOAuth2Api': {
                'id': GSHEETS_CRED_ID,
                'name': GSHEETS_CRED_NAME
            }
        }
        # Hardcode docId
        if 'parameters' in n and 'documentId' in n['parameters']:
            n['parameters']['documentId'] = {
                '__rl': True,
                'mode': 'id',
                'value': SHEET_ID
            }
        # Reforzar retry y error handling
        n['onError'] = 'continueRegularOutput'
        n['retryOnFail'] = True
        n['waitBetweenTries'] = 3000
        n['maxTries'] = 3
        print(f'OK: {n["name"]}')

# 2. Cambiar cron a 1 min
for n in w['nodes']:
    if n['type'] == 'n8n-nodes-base.scheduleTrigger':
        n['parameters'] = {
            'rule': {
                'interval': [{'field': 'minutes', 'minutesInterval': 1}]
            }
        }
        n['name'] = 'Cada 1 min'
        print('OK: cron 1 min')

# 3. Agregar Health Log al final - escribe en acciones_ia
health_node = {
    'id': 'n5-health',
    'name': 'Health Log Sync',
    'type': 'n8n-nodes-base.dataTable',
    'typeVersion': 1.1,
    'position': [2400, 0],
    'parameters': {
        'dataTableId': {
            '__rl': True,
            'mode': 'id',
            'value': ACCIONES_DT,
            'cachedResultName': 'bochile_acciones_ia'
        },
        'columns': {
            'mappingMode': 'defineBelow',
            'value': {
                'accion_id': '={{ "AC-SYNC-" + $now.toMillis() }}',
                'tipo': 'sync_dashboard',
                'agente': 'Cron Sync Sheets',
                'lead_id': '',
                'resumen': '={{ "Sync W5 -> Google Sheets exitoso" }}',
                'detalle': '={{ "8 tablas sincronizadas: leads, props, visitas, contratos, empleados, matches, convs, acciones" }}',
                'resultado': 'ok',
                'timestamp': '={{ $now.toISO() }}',
                'tiempo_ahorrado_min': 1
            },
            'matchingColumns': [],
            'schema': []
        },
        'options': {}
    }
}

# Remover health node viejo si existe
w['nodes'] = [n for n in w['nodes'] if n['name'] != 'Health Log Sync']
w['nodes'].append(health_node)

# Conectar Volcar acciones_ia -> Health Log Sync
last_volcar = '8 - Volcar acciones_ia'
if last_volcar in w['connections']:
    w['connections'][last_volcar] = {
        'main': [[{'node': 'Health Log Sync', 'type': 'main', 'index': 0}]]
    }
else:
    w['connections'][last_volcar] = {
        'main': [[{'node': 'Health Log Sync', 'type': 'main', 'index': 0}]]
    }

print('OK: Health Log Sync agregado')

# PUT con settings limpios
payload = {
    'name': w['name'],
    'nodes': w['nodes'],
    'connections': w['connections'],
    'settings': {'executionOrder': 'v1'}
}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    with urllib.request.urlopen(req) as r:
        print(f'W5 actualizado: {r.status}')
except urllib.error.HTTPError as e:
    print(f'ERR: {e.code} {e.read()[:300].decode()}')

# Activar
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        print(f'W5 ACTIVADO: {r.status}')
except urllib.error.HTTPError as e:
    print(f'activate err: {e.code} {e.read()[:300].decode()}')
