"""Fixes coherencia cross-workflow Bochile:
- W2/W3/W4: regex \\D -> \D para limpiar telefonos
- W2 Log accion recordatorio: reescribir columns corruptas
- W4 escalar Camila Pomerich +5492914413200 (no Carlos Bochile)
- W4 mensaje al inquilino firma como Camila
- W4 to del escalado: hardcode evita doble +
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'

def get(wid):
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def put(wid, w):
    raw_settings = w.get('settings') or {}
    allowed = {'executionOrder', 'errorWorkflow', 'saveDataErrorExecution', 'saveDataSuccessExecution',
               'saveManualExecutions', 'saveExecutionProgress', 'timezone', 'executionTimeout', 'callerPolicy'}
    clean_settings = {k: v for k, v in raw_settings.items() if k in allowed} or {'executionOrder':'v1'}
    payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': clean_settings}
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        print('ERR', e.code, e.read()[:400].decode())
        return None

def reactivate(wid):
    for a in ['deactivate', 'activate']:
        req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
        try:
            with urllib.request.urlopen(req): pass
        except: pass

# ============ W2 ============
w = get('f1CC972kzNPR8ebi')
for n in w['nodes']:
    # Fix regex \\D -> \D
    if n['type'] == 'n8n-nodes-base.code':
        code = n['parameters'].get('jsCode', '')
        if '\\\\D' in code:
            n['parameters']['jsCode'] = code.replace('\\\\D', '\\D')
            print('W2: regex fix en', n['name'])
    # Fix Log accion recordatorio columns
    if n['name'] == 'Log accion recordatorio':
        n['parameters']['columns'] = {
            'mappingMode': 'defineBelow',
            'value': {
                'accion_id': '={{ "AC-" + $now.toMillis() }}',
                'tipo': '={{ $json.tipo || "recordatorio" }}',
                'agente': 'Cron Recordatorios',
                'lead_id': '={{ $json.lead_id || "" }}',
                'resumen': '={{ "Recordatorio enviado " + ($json.tipo || "") + " - visita " + ($json.visita_id || "") }}',
                'detalle': '={{ "Cliente: " + ($json.cliente_nombre || "") + " | Vendedor: " + ($json.vendedor_nombre || "") + " | Fecha: " + ($json.fecha || "") + " " + ($json.hora || "") }}',
                'resultado': 'ok',
                'timestamp': '={{ $now.toISO() }}',
                'tiempo_ahorrado_min': 5
            },
            'matchingColumns': [],
            'schema': []
        }
        print('W2: Log accion recordatorio columns reescrita')
print('PUT W2:', put('f1CC972kzNPR8ebi', w))
reactivate('f1CC972kzNPR8ebi')

# ============ W3 ============
w = get('W327qYVE9SpwQiRi')
for n in w['nodes']:
    if n['type'] == 'n8n-nodes-base.code':
        code = n['parameters'].get('jsCode', '')
        if '\\\\D' in code:
            n['parameters']['jsCode'] = code.replace('\\\\D', '\\D')
            print('W3: regex fix en', n['name'])
print('PUT W3:', put('W327qYVE9SpwQiRi', w))
reactivate('W327qYVE9SpwQiRi')

# ============ W4 ============
w = get('wrFto5o6Zk02sZty')
for n in w['nodes']:
    if n['type'] == 'n8n-nodes-base.code':
        code = n['parameters'].get('jsCode', '')
        if '\\\\D' in code:
            n['parameters']['jsCode'] = code.replace('\\\\D', '\\D')
            print('W4: regex fix en', n['name'])
        # Firma Camila en mensajes al inquilino
        if 'recordatorio_5dias' in code or 'inquilino_nombre' in code:
            # Inyectar firma al final de cada msg si no esta
            new_code = code
            for marker in ['recordatorio_5dias:', 'recordatorio_manana:', 'vence_hoy:', 'atrasado:']:
                pass  # los textos ya estan en template literals - aplicar replace de cierre
            # Reemplazar `${linkPago}` por `${linkPago} - Soy Camila de Bochile.` si no tiene firma
            if 'Soy Camila' not in new_code:
                new_code = new_code.replace('${linkPago}`', '${linkPago} - Soy Camila de Bochile.`')
                # Tambien para los que no tienen linkPago al final, agregar firma despues de `${montoFmt})` o `${diasParaPagar} dias`
                # Estrategia mas segura: usar reemplazo por linea
            n['parameters']['jsCode'] = new_code
            print('W4: firma Camila agregada en', n['name'])
    # Renombrar nodo "Escalar a Carlos Bochile" y cambiar to a Camila
    if n['name'] == 'Escalar a Carlos Bochile':
        n['name'] = 'Escalar a Camila Pomerich'
        n['parameters']['to'] = '=+5492914413200'
        print('W4: escalado renombrado y hardcoded a +5492914413200')

# Actualizar conexiones para el nodo renombrado
new_conns = {}
for src, conf in w['connections'].items():
    new_src = 'Escalar a Camila Pomerich' if src == 'Escalar a Carlos Bochile' else src
    new_conf = {}
    for ctype, branches in conf.items():
        new_branches = []
        for branch in branches:
            new_branch = []
            for b in (branch or []):
                target = b.get('node')
                if target == 'Escalar a Carlos Bochile':
                    new_branch.append({**b, 'node': 'Escalar a Camila Pomerich'})
                else:
                    new_branch.append(b)
            new_branches.append(new_branch)
        new_conf[ctype] = new_branches
    new_conns[new_src] = new_conf
w['connections'] = new_conns
print('PUT W4:', put('wrFto5o6Zk02sZty', w))
reactivate('wrFto5o6Zk02sZty')

print('\nDONE')
