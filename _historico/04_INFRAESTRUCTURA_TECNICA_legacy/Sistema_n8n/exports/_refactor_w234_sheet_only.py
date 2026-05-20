"""REFACTOR W2/W3/W4: SQLite OUT - Sheet IN.

Cambios:
- Borra todos los nodos dataTable (lectura/escritura)
- Borra los nodos Sheet Sync redundantes que agregamos antes
- Reemplaza por googleSheets directos (read/append/update)
- Mantiene la logica de crons y el flujo
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}

# ============ DEFINICIONES POR WORKFLOW ============

W2 = {
    'id': 'f1CC972kzNPR8ebi',
    # nodos: nombre -> {operation, sheet, [matching], [columns/filters]}
    'nodes_to_replace': {
        'Visitas pendientes recordatorio': {
            'operation': 'read', 'sheet': 'visitas'
        },
        'Datos del Vendedor': {
            'operation': 'read', 'sheet': 'empleados',
            'filter_col': 'empleado_id', 'filter_val': '={{ $json.vendedor_id }}'
        },
        'Datos del Lead': {
            'operation': 'read', 'sheet': 'leads',
            'filter_col': 'lead_id', 'filter_val': '={{ $json.lead_id }}'
        },
        'Marcar recordatorio enviado': {
            'operation': 'update', 'sheet': 'visitas', 'matching': 'visita_id',
            'columns': {
                'visita_id': '={{ $json.visita_id }}',
                'recordatorio_enviado': '={{ true }}'
            }
        },
        'Log accion recordatorio': {
            'operation': 'append', 'sheet': 'acciones_ia',
            'columns': {
                'accion_id': '={{ "AC-" + $now.toMillis() }}',
                'tipo': '={{ $json.tipo || "recordatorio" }}',
                'agente': 'Cron Recordatorios',
                'lead_id': '={{ $json.lead_id || "" }}',
                'resumen': '={{ "Recordatorio enviado " + ($json.tipo || "") + " - visita " + ($json.visita_id || "") }}',
                'detalle': '={{ "Cliente: " + ($json.cliente_nombre || "") + " | Vendedor: " + ($json.vendedor_nombre || "") + " | Fecha: " + ($json.fecha || "") + " " + ($json.hora || "") }}',
                'resultado': 'ok',
                'timestamp': '={{ $now.toISO() }}',
                'tiempo_ahorrado_min': 5
            }
        }
    },
    'nodes_to_delete': ['Sheet Sync Visita','Sheet Sync Accion W2']
}

W3 = {
    'id': 'W327qYVE9SpwQiRi',
    'nodes_to_replace': {
        'Propiedades publicadas recientes': {'operation': 'read', 'sheet': 'propiedades'},
        'Matches pendientes activos': {'operation': 'read', 'sheet': 'matches_pendientes',
            'filter_col': 'estado', 'filter_val': 'activo'},
        'Desactivar match': {
            'operation': 'update', 'sheet': 'matches_pendientes', 'matching': 'match_id',
            'columns': {
                'match_id': '={{ $json.match_id }}',
                'estado': 'ofrecido',
                'props_ofrecidas': '={{ $json.props_ofrecidas }}'
            }
        },
        'Lead vuelve a Calificado IA': {
            'operation': 'update', 'sheet': 'leads', 'matching': 'lead_id',
            'columns': {
                'lead_id': '={{ $json.lead_id }}',
                'etapa': 'Calificado IA',
                'actualizado_en': '={{ $now.toISO() }}'
            }
        },
        'Marcar prop como ofrecida': {
            'operation': 'update', 'sheet': 'propiedades', 'matching': 'prop_id',
            'columns': {
                'prop_id': '={{ $json.prop_id }}',
                'estado': 'ofrecida'
            }
        },
        'Log Match Retroactivo': {
            'operation': 'append', 'sheet': 'acciones_ia',
            'columns': {
                'accion_id': '={{ "AC-" + $now.toMillis() }}',
                'tipo': 'match_retroactivo',
                'agente': 'Cron Matcher',
                'lead_id': '={{ $json.lead_id || "" }}',
                'resumen': '={{ "Match retroactivo: " + ($json.lead_nombre || "") + " <- " + ($json.prop_id || "") }}',
                'detalle': '={{ "Prop ofrecida: " + ($json.prop_id || "") + " - " + ($json.prop_titulo || "") }}',
                'resultado': 'ok',
                'timestamp': '={{ $now.toISO() }}',
                'tiempo_ahorrado_min': 10
            }
        }
    },
    'nodes_to_delete': ['Sheet Sync Match','Sheet Sync Lead W3','Sheet Sync Prop','Sheet Sync Accion W3']
}

W4 = {
    'id': 'wrFto5o6Zk02sZty',
    'nodes_to_replace': {
        'Contratos activos': {
            'operation': 'read', 'sheet': 'contratos',
            'filter_col': 'estado', 'filter_val': 'activo'
        },
        'Actualizar contrato': {
            'operation': 'update', 'sheet': 'contratos', 'matching': 'contrato_id',
            'columns': {
                'contrato_id': '={{ $json.contrato_id }}',
                'dias_atraso': '={{ $json.dias_atraso }}',
                'estado': '={{ $json.estado }}'
            }
        },
        'Log accion cobranza': {
            'operation': 'append', 'sheet': 'acciones_ia',
            'columns': {
                'accion_id': '={{ "AC-" + $now.toMillis() }}',
                'tipo': 'cobranza_alquiler',
                'agente': 'Cron Cobranza',
                'lead_id': '',
                'resumen': '={{ "Cobranza: " + ($json.tipo || "") + " contrato " + ($json.contrato_id || "") }}',
                'detalle': '={{ "Inquilino: " + ($json.inquilino_nombre || "") + " | Atraso: " + ($json.dias_atraso || 0) + " dias" }}',
                'resultado': 'ok',
                'timestamp': '={{ $now.toISO() }}',
                'tiempo_ahorrado_min': 5
            }
        }
    },
    'nodes_to_delete': ['Sheet Sync Contrato','Sheet Sync Accion W4']
}

def build_gsheets_params(cfg):
    p = {
        'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
        'sheetName': {'__rl': True, 'mode': 'name', 'value': cfg['sheet']},
    }
    op = cfg['operation']
    if op == 'read':
        p['operation'] = 'read'
        if 'filter_col' in cfg:
            p['filtersUI'] = {'values': [{'lookupColumn': cfg['filter_col'], 'lookupValue': cfg['filter_val']}]}
            p['options'] = {}
        else:
            p['options'] = {}
    elif op == 'append':
        p['operation'] = 'append'
        p['columns'] = {
            'mappingMode': 'defineBelow','value': cfg['columns'],
            'matchingColumns': [], 'schema': [],
            'attemptToConvertTypes': False, 'convertFieldsToString': True
        }
        p['options'] = {}
    elif op == 'update':
        p['operation'] = 'update'
        p['columns'] = {
            'mappingMode': 'defineBelow','value': cfg['columns'],
            'matchingColumns': [cfg['matching']], 'schema': [],
            'attemptToConvertTypes': False, 'convertFieldsToString': True
        }
        p['options'] = {}
    return p

def refactor(w_def):
    wid = w_def['id']
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req) as r:
        w = json.loads(r.read())

    # Borrar nodos sync redundantes
    to_del = set(w_def['nodes_to_delete'])
    w['nodes'] = [n for n in w['nodes'] if n['name'] not in to_del]

    # Reemplazar tipo de cada dataTable por googleSheets
    for n in w['nodes']:
        if n['name'] in w_def['nodes_to_replace']:
            cfg = w_def['nodes_to_replace'][n['name']]
            n['type'] = 'n8n-nodes-base.googleSheets'
            n['typeVersion'] = 4.7
            n['credentials'] = {'googleSheetsOAuth2Api': GSHEETS_CRED}
            n['onError'] = 'continueRegularOutput'
            n['retryOnFail'] = True
            n['waitBetweenTries'] = 2000
            n['maxTries'] = 3
            n['parameters'] = build_gsheets_params(cfg)
            print(f'  {n["name"]} -> googleSheets {cfg["operation"]} {cfg["sheet"]}')

    # Reconectar: eliminar referencias a los nodos borrados
    new_conns = {}
    for src, conf in w['connections'].items():
        if src in to_del: continue
        new_conf = {}
        for ctype, branches in conf.items():
            new_branches = []
            for branch in branches:
                new_branch = [b for b in (branch or []) if b.get('node') not in to_del]
                new_branches.append(new_branch)
            new_conf[ctype] = new_branches
        new_conns[src] = new_conf
    w['connections'] = new_conns

    payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
    try:
        with urllib.request.urlopen(req) as r: print(f'  PUT OK {r.status}')
    except urllib.error.HTTPError as e:
        print(f'  PUT err {e.code}: {e.read()[:300].decode()}')
        return
    for a in ['deactivate','activate']:
        req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
        try: urllib.request.urlopen(req)
        except: pass

for w_def, tag in [(W2,'W2 Recordatorios'),(W3,'W3 Match Retroactivo'),(W4,'W4 Cobranza')]:
    print(f'\\n=== {tag} ===')
    refactor(w_def)

print('\\nREFACTOR COMPLETO')
