"""Saca el outputParser del Calificador. El prompt fuerza JSON manualmente."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

# 1. Eliminar el nodo Parser Calificador
w['nodes'] = [n for n in w['nodes'] if n['name'] != 'Parser Calificador']

# 2. En SubAgente Calificador: quitar hasOutputParser y reforzar prompt
PROMPT_CALIFICADOR = """CALIFICADOR Bochile. Tu UNICA tarea: analiza la conversacion del lead y devolve EXCLUSIVAMENTE este JSON (sin markdown, sin texto extra, sin code fences):

{"score":85,"etapa":"Calificado IA","operacion":"venta","tipo":"casa","zona":"Palihue","ambientes":4,"presupuesto_min":250000,"presupuesto_max":300000,"moneda":"USD","forma_pago":"mixto","urgencia":"alta","razon":"Pareja con 2 hijos, presupuesto claro","listo_para_visita":true,"requiere_humano":false}

SCORING:
- 0-40 FRIO: pregunta vaga, "solo mirando".
- 41-70 TIBIO: intencion clara, faltan datos.
- 71-100 CALIENTE: presupuesto+urgencia+zona+tipo+forma_pago definidos.

VALIDOS:
- zona: Palihue|Centro|Universitario|Villa Mitre|Villa Belgrano|Patagonia|Tiro Federal|Villa Don Bosco|Almafuerte|Country
- operacion: venta|alquiler|alquiler_temporario
- tipo: casa|departamento|ph|lote|local|oficina
- moneda: USD|ARS
- urgencia: alta|media|baja
- forma_pago: cash|credito|mixto|vende_otra
- listo_para_visita: true SOLO si score>=70 Y zona Y presupuesto Y tipo

Falta dato: null o "". NO inventes. RESPONDE SOLO EL JSON."""

for n in w['nodes']:
    if n['name'] == 'SubAgente Calificador':
        n['parameters']['hasOutputParser'] = False
        if 'options' not in n['parameters']:
            n['parameters']['options'] = {}
        n['parameters']['options']['systemMessage'] = PROMPT_CALIFICADOR
        print('Calificador actualizado sin parser')

# 3. Quitar la connection del Parser Calificador
if 'Parser Calificador' in w['connections']:
    del w['connections']['Parser Calificador']

clean_settings = {'executionOrder': 'v1'}
payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': clean_settings}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
urllib.request.urlopen(req)
print('OK W1 actualizado')

# Reactivar
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try: urllib.request.urlopen(req); print('OK reactivado')
except: pass
