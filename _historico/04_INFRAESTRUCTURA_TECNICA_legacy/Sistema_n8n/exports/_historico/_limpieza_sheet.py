"""Crear workflow temporal 'WESEKA - Limpieza Sheet Bochile' y ejecutarlo.
Borra todas las filas del Sheet (excepto headers) y vuelca los rows REALES
de las 8 data tables.
"""
import json, urllib.request, urllib.error, time

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}

TABLES = [
    ('leads', 'UGNAXqPUX0udDRPi'),
    ('propiedades', 'UlHoNXfh9nX5W8vn'),
    ('visitas', 'UJOWnNg9k0BdMMJP'),
    ('contratos', 'TSBcE3hUHHvzcrr2'),
    ('empleados', 'pfACps5XOWJo7UME'),
    ('matches_pendientes', 'X1djtSSRbpiiNMTk'),
    ('conversaciones', 'B5WIk9wqVUH8Z0t8'),
    ('acciones_ia', 'XeXT6GunMsOgpGa2'),
]

MATCHING = {
    'leads':'lead_id','propiedades':'prop_id','visitas':'visita_id',
    'contratos':'contrato_id','empleados':'empleado_id',
    'matches_pendientes':'match_id','conversaciones':'msg_id','acciones_ia':'accion_id'
}

COLUMNS = {
    'leads': ['lead_id','nombre','telefono','email','canal','operacion','tipo_propiedad','zona_pref','ambientes','presupuesto_min','presupuesto_max','moneda','forma_pago','urgencia','score','etapa','vendedor_asignado','ultima_intencion','notas','creado_en','actualizado_en'],
    'propiedades': ['prop_id','titulo','operacion','tipo','direccion','zona','ambientes','banos','superficie_cubierta','superficie_total','precio','moneda','expensas','estado','caracteristicas','tour_360_url','foto_principal','propietario','propietario_telefono','vendedor_a_cargo','publicada','fecha_alta'],
    'visitas': ['visita_id','lead_id','prop_id','vendedor_id','vendedor_nombre','cliente_nombre','direccion','fecha','hora','estado','confirmada_cliente','notificada_vendedor','recordatorio_enviado','resultado','observaciones','creada_en'],
    'contratos': ['contrato_id','prop_id','direccion','inquilino_nombre','inquilino_telefono','propietario','monto_actual','moneda','dia_vencimiento','frecuencia_ajuste','indice_ajuste','fecha_inicio','fecha_fin','estado','ultimo_pago','dias_atraso'],
    'empleados': ['empleado_id','nombre','rol','telefono','email','zona_especialidad','calendar_id','activo','visitas_mes','cierres_mes','comisiones_mes'],
    'matches_pendientes': ['match_id','lead_id','lead_nombre','lead_telefono','criterios_json','creado_en','estado','props_ofrecidas'],
    'conversaciones': ['msg_id','lead_id','telefono','canal','direccion','mensaje','intencion_detectada','agente_que_respondio','requiere_humano','timestamp'],
    'acciones_ia': ['accion_id','tipo','agente','lead_id','resumen','detalle','resultado','timestamp','tiempo_ahorrado_min'],
}

nodes = []
connections = {}

# Trigger manual
nodes.append({
    'id': 'trig-manual',
    'name': 'Manual Trigger',
    'type': 'n8n-nodes-base.manualTrigger',
    'typeVersion': 1,
    'position': [0, 0],
    'parameters': {}
})

prev_name = 'Manual Trigger'
y = 0

for idx, (tab, dtid) in enumerate(TABLES):
    y_pos = idx * 200
    # 1) Clear sheet (deja headers)
    clear_name = f'CLEAR {tab}'
    nodes.append({
        'id': f'clear-{tab}',
        'name': clear_name,
        'type': 'n8n-nodes-base.googleSheets',
        'typeVersion': 4.7,
        'position': [300, y_pos],
        'parameters': {
            'resource': 'sheet',
            'operation': 'clear',
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': tab},
            'options': {'keepFirstRow': True}
        },
        'credentials': {'googleSheetsOAuth2Api': GSHEETS_CRED},
        'onError': 'continueRegularOutput'
    })
    # 2) Read data table
    read_name = f'READ {tab}'
    nodes.append({
        'id': f'read-{tab}',
        'name': read_name,
        'type': 'n8n-nodes-base.dataTable',
        'typeVersion': 1.1,
        'position': [550, y_pos],
        'parameters': {
            'resource':'row','operation': 'get',
            'dataTableId': {'__rl': True, 'mode': 'id', 'value': dtid},
            'returnAll': True
        },
        'alwaysOutputData': True
    })
    # 3) Append to sheet
    cols = COLUMNS[tab]
    value_dict = {c: '={{ $json["' + c + '"] }}' for c in cols}
    append_name = f'APPEND {tab}'
    nodes.append({
        'id': f'app-{tab}',
        'name': append_name,
        'type': 'n8n-nodes-base.googleSheets',
        'typeVersion': 4.7,
        'position': [800, y_pos],
        'parameters': {
            'resource': 'sheet',
            'operation': 'append',
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': tab},
            'columns': {
                'mappingMode': 'defineBelow',
                'value': value_dict,
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

    # Conexiones encadenadas: prev -> clear -> read -> append -> (next prev)
    connections[prev_name] = {'main': [[{'node': clear_name, 'type':'main', 'index':0}]]}
    connections[clear_name] = {'main': [[{'node': read_name, 'type':'main', 'index':0}]]}
    connections[read_name] = {'main': [[{'node': append_name, 'type':'main', 'index':0}]]}
    prev_name = append_name

# Crear workflow
payload = {
    'name': 'WESEKA - Limpieza Sheet Bochile (TEMP)',
    'nodes': nodes,
    'connections': connections,
    'settings': {'executionOrder': 'v1'}
}
req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read())
        wid = d['id']
        print(f'Workflow temporal creado: {wid}')
except urllib.error.HTTPError as e:
    print('CREATE err:', e.code, e.read()[:500].decode())
    raise SystemExit

print(f'\\nWorkflow listo en localhost:5680/workflow/{wid}')
print('Ejecutalo manualmente desde la UI -> "Execute workflow"')
print(f'\\nWorkflow ID: {wid}')
