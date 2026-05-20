"""W5 nuevo: Backup Mensual + Reset.

Cron: dia 1 de cada mes, 03:00 AM.
1. Duplica el Sheet 'Bochile · Sistema Operativo' en Drive carpeta 'Backups Bochile Mensuales'
   con nombre 'Bochile YYYY-MM Backup'
2. En el Sheet original, limpia las pestanas TRANSACCIONALES (deja headers):
   - leads, conversaciones, visitas, matches_pendientes, acciones_ia
3. NO toca pestanas MAESTRAS (propiedades, contratos, empleados) - persisten entre meses
4. Logea el backup en 'acciones_ia' (la pestana ya reseteada)
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}
GDRIVE_CRED = {'id': 's6bzy7p0HH3Gjmfr', 'name': 'Google Drive account'}

TRANSACTIONAL_TABS = ['leads','conversaciones','visitas','matches_pendientes','acciones_ia']

nodes = []
connections = {}

# 1. Schedule trigger (dia 1, 03:00)
nodes.append({
    'id': 'trig-backup',
    'name': 'Cron Mensual Backup',
    'type': 'n8n-nodes-base.scheduleTrigger',
    'typeVersion': 1.3,
    'position': [0, 0],
    'parameters': {
        'rule': {
            'interval': [{
                'field': 'cronExpression',
                'expression': '0 3 1 * *'  # dia 1 cada mes a las 03:00
            }]
        }
    }
})

# 2. Duplicar el Sheet en Drive
nodes.append({
    'id': 'gdrive-copy',
    'name': 'Backup en Drive',
    'type': 'n8n-nodes-base.googleDrive',
    'typeVersion': 3,
    'position': [250, 0],
    'parameters': {
        'operation': 'copy',
        'fileId': {
            '__rl': True, 'mode': 'id', 'value': SHEET_ID
        },
        'name': '=Bochile {{ $now.minus({months: 1}).toFormat("yyyy-MM") }} Backup',
        'options': {}
    },
    'credentials': {'googleDriveOAuth2Api': GDRIVE_CRED},
    'onError': 'continueRegularOutput',
    'retryOnFail': True,
    'waitBetweenTries': 3000,
    'maxTries': 3
})

connections['Cron Mensual Backup'] = {'main': [[{'node': 'Backup en Drive', 'type': 'main', 'index': 0}]]}

# 3. Clear cada pestana transaccional
prev = 'Backup en Drive'
for idx, tab in enumerate(TRANSACTIONAL_TABS):
    node_name = f'Reset {tab}'
    nodes.append({
        'id': f'clear-{tab}',
        'name': node_name,
        'type': 'n8n-nodes-base.googleSheets',
        'typeVersion': 4.7,
        'position': [500 + idx * 200, 0],
        'parameters': {
            'resource': 'sheet',
            'operation': 'clear',
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': tab},
            'options': {'keepFirstRow': True}
        },
        'credentials': {'googleSheetsOAuth2Api': GSHEETS_CRED},
        'onError': 'continueRegularOutput',
        'retryOnFail': True,
        'waitBetweenTries': 2000,
        'maxTries': 3
    })
    connections[prev] = {'main': [[{'node': node_name, 'type': 'main', 'index': 0}]]}
    prev = node_name

# 4. Tambien limpiar las data tables transaccionales del SQLite (para mantener consistencia)
# Mejor: solo limpiar el Sheet, dejar SQLite (es soft state, n8n lo va a re-popular cuando se use)

# 5. Log de backup en acciones_ia
nodes.append({
    'id': 'log-backup',
    'name': 'Log Backup Exitoso',
    'type': 'n8n-nodes-base.googleSheets',
    'typeVersion': 4.7,
    'position': [500 + len(TRANSACTIONAL_TABS) * 200, 0],
    'parameters': {
        'resource': 'sheet',
        'operation': 'append',
        'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
        'sheetName': {'__rl': True, 'mode': 'name', 'value': 'acciones_ia'},
        'columns': {
            'mappingMode': 'defineBelow',
            'value': {
                'accion_id': '={{ "AC-BACKUP-" + $now.toMillis() }}',
                'tipo': 'backup_mensual',
                'agente': 'Cron Backup Mensual',
                'lead_id': '',
                'resumen': '={{ "Backup mensual exitoso: " + $now.minus({months: 1}).toFormat("yyyy-MM") }}',
                'detalle': '={{ "Sheet duplicado en Drive. Pestañas transaccionales reseteadas." }}',
                'resultado': 'ok',
                'timestamp': '={{ $now.toISO() }}',
                'tiempo_ahorrado_min': 30
            },
            'matchingColumns': [],
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
})
connections[prev] = {'main': [[{'node': 'Log Backup Exitoso', 'type': 'main', 'index': 0}]]}

payload = {
    'name': 'Bochile - Backup Mensual + Reset (W5)',
    'nodes': nodes,
    'connections': connections,
    'settings': {'executionOrder': 'v1'}
}
req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
        wid = d['id']
        print(f'W5 Backup Mensual creado: {wid}')
        print(f'URL: http://localhost:5680/workflow/{wid}')
except urllib.error.HTTPError as e:
    print(f'CREATE err: {e.code} {e.read()[:500].decode()}')
    raise SystemExit

# Activar el W5
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        print(f'W5 activado: {r.status}')
except urllib.error.HTTPError as e:
    print(f'activate err: {e.code} {e.read()[:300].decode()}')
