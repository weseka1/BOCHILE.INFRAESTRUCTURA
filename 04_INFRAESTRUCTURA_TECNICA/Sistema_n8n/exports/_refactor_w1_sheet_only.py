"""REFACTOR TOTAL W1: SQLite OUT - Sheet IN.

Cambios:
- Borra TODOS los nodos dataTable (lectura y escritura)
- Borra los nodos AI - Sheet Sync que agregamos despues del Agent (bulk-sync)
- Renombra los Sheet Sync existentes para tomar el rol del original
- Crea Buscar Lead Existente con googleSheets lookup
- Cambia AI Tools de dataTableTool -> googleSheetsTool
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

# === 1. Eliminar nodos a borrar ===
TO_DELETE = {
    # Bulk-sync post-agent (ya no se necesitan, AI Tools escriben directo)
    'AI - Leer Visitas','AI - Sheet Sync Visitas',
    'AI - Leer Matches','AI - Sheet Sync Matches',
    'AI - Leer Lead Actual','AI - Sheet Sync Lead',
    # Originales dataTable (los Sheet Sync existentes los reemplazan)
    'Upsert Lead CRM','Log Mensaje Entrante','Log Mensaje Saliente','Registrar Accion IA',
    'Buscar Lead Existente',  # se recreará como googleSheets
}
w['nodes'] = [n for n in w['nodes'] if n['name'] not in TO_DELETE]
print(f'Borrados {len(TO_DELETE)} nodos')

# === 2. Renombrar Sheet Sync existentes ===
RENAME = {
    'Sheet Sync Lead': 'Upsert Lead CRM',
    'Sheet Sync Msg Entrante': 'Log Mensaje Entrante',
    'Sheet Sync Msg Saliente': 'Log Mensaje Saliente',
    'Sheet Sync Accion': 'Registrar Accion IA',
}
for n in w['nodes']:
    if n['name'] in RENAME:
        old = n['name']
        n['name'] = RENAME[old]
        print(f'  Renombrado: {old} -> {n["name"]}')

# === 3. Crear Buscar Lead Existente (googleSheets lookup) ===
buscar_pos = [2400, 800]  # estimado segun layout
nodes_pos = {n['name']: n['position'] for n in w['nodes']}
if 'Merge Caminos' in nodes_pos:
    mp = nodes_pos['Merge Caminos']
    buscar_pos = [mp[0] + 220, mp[1]]

buscar_node = {
    'id': 'gs-buscar-lead',
    'name': 'Buscar Lead Existente',
    'type': 'n8n-nodes-base.googleSheets',
    'typeVersion': 4.7,
    'position': buscar_pos,
    'parameters': {
        'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
        'sheetName': {'__rl': True, 'mode': 'name', 'value': 'leads'},
        'filtersUI': {
            'values': [{'lookupColumn': 'lead_id', 'lookupValue': '={{ $json.lead_id }}'}]
        },
        'options': {'returnFirstMatch': True}
    },
    'credentials': {'googleSheetsOAuth2Api': GSHEETS_CRED},
    'onError': 'continueRegularOutput',
    'retryOnFail': True,
    'waitBetweenTries': 2000,
    'maxTries': 3,
    'alwaysOutputData': True
}
w['nodes'].append(buscar_node)
print('Creado: Buscar Lead Existente (googleSheets)')

# === 4. Convertir AI Tools a googleSheetsTool ===
# Tabla -> (pestaña sheet, columnas para AI Tool)
AI_TOOLS = {
    'Leer Catalogo Propiedades': {
        'operation': 'read',
        'sheet': 'propiedades',
        'description': 'CATALOGO. Devuelve TODAS las propiedades publicadas. Filtra despues por criterios.',
    },
    'Leer Vendedores Activos': {
        'operation': 'read',
        'sheet': 'empleados',
        'description': 'VENDEDORES. Devuelve todos los empleados activos.',
    },
    'Crear Visita en CRM': {
        'operation': 'append',
        'sheet': 'visitas',
        'description': 'CREAR VISITA. Insertar nueva visita agendada en la tabla visitas.',
        'columns': {
            'visita_id': '={{ "V-" + $now.toMillis() }}',
            'lead_id': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('lead_id', 'L-XXX', 'string') }}",
            'prop_id': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('prop_id', 'P-XXX', 'string') }}",
            'vendedor_id': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('vendedor_id', 'E-X', 'string') }}",
            'vendedor_nombre': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('vendedor_nombre', 'nombre', 'string') }}",
            'cliente_nombre': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('cliente_nombre', 'nombre', 'string') }}",
            'direccion': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('direccion', 'dir', 'string') }}",
            'fecha': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('fecha', 'YYYY-MM-DD', 'string') }}",
            'hora': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('hora', 'HH:MM', 'string') }}",
            'estado': 'agendada',
            'confirmada_cliente': '={{ true }}',
            'notificada_vendedor': '={{ true }}',
            'recordatorio_enviado': '={{ false }}',
            'observaciones': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('observaciones', 'notas', 'string') }}",
            'creada_en': '={{ $now.toISO() }}'
        }
    },
    'Guardar Match Pendiente': {
        'operation': 'append',
        'sheet': 'matches_pendientes',
        'description': 'GUARDAR MATCH. Insertar match pendiente cuando no hay stock para el lead.',
        'columns': {
            'match_id': '={{ "MP-" + $now.toMillis() }}',
            'lead_id': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('lead_id', 'L-XXX', 'string') }}",
            'lead_nombre': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('lead_nombre', 'nombre', 'string') }}",
            'lead_telefono': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('lead_telefono', '+54...', 'string') }}",
            'criterios_json': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('criterios_json', 'JSON criterios', 'string') }}",
            'creado_en': '={{ $now.toISO() }}',
            'estado': 'activo',
            'props_ofrecidas': ''
        }
    },
    'Actualizar Lead CRM': {
        'operation': 'update',
        'sheet': 'leads',
        'description': 'ACTUALIZAR LEAD. Actualizar campos (etapa, score, vendedor_asignado, etc) del lead actual.',
        'matching': 'lead_id',
        'columns': {
            'lead_id': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('lead_id', 'L-XXX', 'string') }}",
            'etapa': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('etapa', 'Nuevo/Calificado IA/Visita agendada/En espera de stock/Negociación', 'string') }}",
            'score': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('score', '0-100', 'number') }}",
            'vendedor_asignado': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('vendedor_asignado', 'E-X', 'string') }}",
            'operacion': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('operacion', 'venta/alquiler', 'string') }}",
            'tipo_propiedad': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('tipo_propiedad', 'casa/departamento/...', 'string') }}",
            'zona_pref': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('zona_pref', 'Palihue/...', 'string') }}",
            'ambientes': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('ambientes', '0-10', 'number') }}",
            'presupuesto_min': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('presupuesto_min', '0', 'number') }}",
            'presupuesto_max': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('presupuesto_max', '0', 'number') }}",
            'moneda': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('moneda', 'USD/ARS', 'string') }}",
            'forma_pago': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('forma_pago', 'cash/credito/mixto/vende_otra', 'string') }}",
            'urgencia': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('urgencia', 'alta/media/baja', 'string') }}",
            'ultima_intencion': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('ultima_intencion', 'resumen', 'string') }}",
            'notas': "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('notas', 'notas', 'string') }}",
            'actualizado_en': '={{ $now.toISO() }}'
        }
    }
}

for n in w['nodes']:
    if n['name'] in AI_TOOLS:
        cfg = AI_TOOLS[n['name']]
        op = cfg['operation']
        n['type'] = 'n8n-nodes-base.googleSheetsTool'
        n['typeVersion'] = 4.7
        n['credentials'] = {'googleSheetsOAuth2Api': GSHEETS_CRED}
        n['onError'] = 'continueRegularOutput'
        n['retryOnFail'] = True
        n['waitBetweenTries'] = 2000
        n['maxTries'] = 3

        params = {
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': cfg['sheet']},
        }
        if op == 'read':
            params['operation'] = 'read'
            params['options'] = {}
        elif op == 'append':
            params['operation'] = 'append'
            params['columns'] = {
                'mappingMode': 'defineBelow',
                'value': cfg['columns'],
                'matchingColumns': [],
                'schema': [],
                'attemptToConvertTypes': False,
                'convertFieldsToString': True
            }
            params['options'] = {}
        elif op == 'update':
            params['operation'] = 'update'
            params['columns'] = {
                'mappingMode': 'defineBelow',
                'value': cfg['columns'],
                'matchingColumns': [cfg['matching']],
                'schema': [],
                'attemptToConvertTypes': False,
                'convertFieldsToString': True
            }
            params['options'] = {}
        n['parameters'] = params
        # Description del tool (lo que ve el LLM)
        n['parameters']['descriptionType'] = 'manual'
        n['parameters']['toolDescription'] = cfg['description']
        print(f'AI Tool convertido: {n["name"]} -> googleSheetsTool ({op} {cfg["sheet"]})')

# === 5. Reconectar el flow ===
# Estructura objetivo:
# ... Merge Caminos -> Buscar Lead Existente -> Upsert Lead CRM (gsheets) -> Log Mensaje Entrante -> Vendedor CORE -> Log Mensaje Saliente -> Registrar Accion IA -> Responder al Cliente Twilio -> OK al Webhook

# Eliminar conexiones huerfanas
new_conns = {}
for src, conf in w['connections'].items():
    if src in TO_DELETE: continue
    new_src = RENAME.get(src, src)
    new_conf = {}
    for ctype, branches in conf.items():
        new_branches = []
        for branch in branches:
            new_branch = []
            for b in (branch or []):
                target = b.get('node')
                if target in TO_DELETE: continue
                new_target = RENAME.get(target, target)
                new_branch.append({**b, 'node': new_target})
            new_branches.append(new_branch)
        new_conf[ctype] = new_branches
    new_conns[new_src] = new_conf

# Definir explicitamente la cadena principal:
chain = [
    ('Merge Caminos', 'Buscar Lead Existente', 'main'),
    ('Buscar Lead Existente', 'Upsert Lead CRM', 'main'),
    ('Upsert Lead CRM', 'Log Mensaje Entrante', 'main'),
    ('Log Mensaje Entrante', 'Vendedor CORE', 'main'),
    ('Vendedor CORE', 'Log Mensaje Saliente', 'main'),
    ('Log Mensaje Saliente', 'Registrar Accion IA', 'main'),
    ('Registrar Accion IA', 'Responder al Cliente Twilio', 'main'),
    ('Responder al Cliente Twilio', 'OK al Webhook', 'main'),
]
for src, tgt, ctype in chain:
    new_conns[src] = {'main': [[{'node': tgt, 'type':'main','index':0}]]}

# Las conexiones AI tool -> Vendedor CORE deben mantenerse
# Verificar que cada AI Tool sigue conectado como ai_tool al Vendedor CORE
for ai_name in AI_TOOLS.keys():
    if ai_name not in new_conns:
        new_conns[ai_name] = {}
    new_conns[ai_name]['ai_tool'] = [[{'node': 'Vendedor CORE', 'type':'ai_tool','index':0}]]

w['connections'] = new_conns

# === 6. PUT y activar ===
payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
try:
    with urllib.request.urlopen(req) as r: print(f'\\nW1 PUT OK: {r.status}')
except urllib.error.HTTPError as e:
    print(f'PUT err: {e.code} {e.read()[:500].decode()}')
    raise SystemExit

for a in ['deactivate','activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r: print(a, r.status)
    except urllib.error.HTTPError as e: print(a, 'err', e.code)
