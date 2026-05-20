"""Fix expressions de los nodos Log Mensaje Entrante / Saliente / Registrar Accion IA.
Despues del refactor, las expresiones quedaron apuntando al $json del input (que es el lead)
en vez de los datos correctos (Merge Caminos, Vendedor CORE).
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'

FIX = {
    'Log Mensaje Entrante': {
        'msg_id': "={{ $('Merge Caminos').item.json.msg_id }}",
        'lead_id': "={{ $('Merge Caminos').item.json.lead_id }}",
        'telefono': "={{ $('Merge Caminos').item.json.telefono }}",
        'canal': "={{ $('Merge Caminos').item.json.canal }}",
        'direccion': 'in',
        'mensaje': "={{ $('Merge Caminos').item.json.mensaje }}",
        'intencion_detectada': "={{ $('Merge Caminos').item.json.msg_type }}",
        'agente_que_respondio': 'pending',
        'requiere_humano': '={{ false }}',
        'timestamp': "={{ $('Merge Caminos').item.json.timestamp_iso }}"
    },
    'Log Mensaje Saliente': {
        'msg_id': '={{ "M-" + $now.toMillis() + "-out" }}',
        'lead_id': "={{ $('Merge Caminos').item.json.lead_id }}",
        'telefono': "={{ $('Merge Caminos').item.json.telefono }}",
        'canal': 'whatsapp_twilio',
        'direccion': 'out',
        'mensaje': "={{ $('Vendedor CORE').item.json.output }}",
        'intencion_detectada': 'response',
        'agente_que_respondio': 'Vendedor CORE',
        'requiere_humano': '={{ false }}',
        'timestamp': '={{ $now.toISO() }}'
    },
    'Registrar Accion IA': {
        'accion_id': '={{ "A-" + $now.toMillis() }}',
        'tipo': 'conversacion_atendida',
        'agente': 'Vendedor CORE',
        'lead_id': "={{ $('Merge Caminos').item.json.lead_id }}",
        'resumen': "={{ 'Mensaje ' + ($('Merge Caminos').item.json.msg_type || 'text') + ' atendido via Twilio' }}",
        'detalle': "={{ ($('Vendedor CORE').item.json.output || '').substring(0, 200) }}",
        'resultado': 'ok',
        'timestamp': '={{ $now.toISO() }}',
        'tiempo_ahorrado_min': 4
    }
}

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

for n in w['nodes']:
    if n['name'] in FIX:
        n['parameters']['columns']['value'] = FIX[n['name']]
        print(f'  Fixed expressions: {n["name"]}')

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    with urllib.request.urlopen(req) as r: print(f'\\nPUT {r.status}')
except urllib.error.HTTPError as e:
    print(f'PUT err: {e.code} {e.read()[:300].decode()}')
for a in ['deactivate','activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r: print(a, r.status)
    except urllib.error.HTTPError as e: print(a, 'err', e.code)
