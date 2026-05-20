"""Para test pre-prod: hardcodear el telefono del vendedor a Juani.
En produccion volveremos a $fromAI dinamico."""
import json, urllib.request

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

for n in w['nodes']:
    if n['name'] == 'Avisar Vendedor por WhatsApp Twilio':
        n['parameters']['to'] = '=+5492915512515'
        print('OK: vendedor hardcoded a +5492915512515 (Juani, modo test)')

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
urllib.request.urlopen(req)

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try: urllib.request.urlopen(req); print('reactivado')
except: pass
