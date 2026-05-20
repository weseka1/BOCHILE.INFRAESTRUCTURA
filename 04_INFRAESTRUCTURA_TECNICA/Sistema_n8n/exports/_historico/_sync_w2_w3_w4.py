"""W2/W3/W4 sync-por-evento -> Google Sheet.

Despues de cada nodo dataTable que ESCRIBA (insert/update), agregar un nodo
googleSheets que upsertea la misma fila al Sheet.
"""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
SHEET_ID = '1YChe5KTSiZzeqmdVOaU29k1LfJKY3JXXDDEQiwgeTy4'
GSHEETS_CRED = {'id': '9NvEcPkNdH6i0j3L', 'name': 'Google Sheets account'}

COLUMNS = {
    'visitas': (['visita_id','lead_id','prop_id','vendedor_id','vendedor_nombre','cliente_nombre','direccion','fecha','hora','estado','confirmada_cliente','notificada_vendedor','recordatorio_enviado','resultado','observaciones','creada_en'], 'visita_id'),
    'acciones_ia': (['accion_id','tipo','agente','lead_id','resumen','detalle','resultado','timestamp','tiempo_ahorrado_min'], 'accion_id'),
    'matches_pendientes': (['match_id','lead_id','lead_nombre','lead_telefono','criterios_json','creado_en','estado','props_ofrecidas'], 'match_id'),
    'leads': (['lead_id','nombre','telefono','email','canal','operacion','tipo_propiedad','zona_pref','ambientes','presupuesto_min','presupuesto_max','moneda','forma_pago','urgencia','score','etapa','vendedor_asignado','ultima_intencion','notas','creado_en','actualizado_en'], 'lead_id'),
    'propiedades': (['prop_id','titulo','operacion','tipo','direccion','zona','ambientes','banos','superficie_cubierta','superficie_total','precio','moneda','expensas','estado','caracteristicas','tour_360_url','foto_principal','propietario','propietario_telefono','vendedor_a_cargo','publicada','fecha_alta'], 'prop_id'),
    'contratos': (['contrato_id','prop_id','direccion','inquilino_nombre','inquilino_telefono','propietario','monto_actual','moneda','dia_vencimiento','frecuencia_ajuste','indice_ajuste','fecha_inicio','fecha_fin','estado','ultimo_pago','dias_atraso'], 'contrato_id'),
}

def make_sheet_node(name, sheet, pos):
    cols, matching = COLUMNS[sheet]
    value_dict = {c: '={{ $json["' + c + '"] }}' for c in cols}
    return {
        'id': 'sheet-' + name.lower().replace(' ', '-'),
        'name': name,
        'type': 'n8n-nodes-base.googleSheets',
        'typeVersion': 4.7,
        'position': pos,
        'parameters': {
            'resource': 'sheet','operation': 'appendOrUpdate',
            'documentId': {'__rl': True, 'mode': 'id', 'value': SHEET_ID},
            'sheetName': {'__rl': True, 'mode': 'name', 'value': sheet},
            'columns': {
                'mappingMode': 'defineBelow','value': value_dict,
                'matchingColumns': [matching],'schema': [],
                'attemptToConvertTypes': False,'convertFieldsToString': True
            },'options': {}
        },
        'credentials': {'googleSheetsOAuth2Api': GSHEETS_CRED},
        'onError': 'continueRegularOutput','retryOnFail': True,
        'waitBetweenTries': 2000,'maxTries': 3
    }

# Mapping: (workflow_id, nombre_workflow_tag) -> [(src_node, sync_name, sheet)]
SYNC_PLAN = {
    'f1CC972kzNPR8ebi': [  # W2
        ('Marcar recordatorio enviado', 'Sheet Sync Visita', 'visitas'),
        ('Log accion recordatorio', 'Sheet Sync Accion W2', 'acciones_ia'),
    ],
    'W327qYVE9SpwQiRi': [  # W3
        ('Desactivar match', 'Sheet Sync Match', 'matches_pendientes'),
        ('Lead vuelve a Calificado IA', 'Sheet Sync Lead W3', 'leads'),
        ('Marcar prop como ofrecida', 'Sheet Sync Prop', 'propiedades'),
        ('Log Match Retroactivo', 'Sheet Sync Accion W3', 'acciones_ia'),
    ],
    'wrFto5o6Zk02sZty': [  # W4
        ('Actualizar contrato', 'Sheet Sync Contrato', 'contratos'),
        ('Log accion cobranza', 'Sheet Sync Accion W4', 'acciones_ia'),
    ],
}

for wid, plan in SYNC_PLAN.items():
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req) as r:
        w = json.loads(r.read())

    # Remover sync viejos
    new_names = {sync for _, sync, _ in plan}
    w['nodes'] = [n for n in w['nodes'] if n['name'] not in new_names]

    for src_name, sync_name, sheet in plan:
        src = next((n for n in w['nodes'] if n['name'] == src_name), None)
        if not src:
            print(f'WARN {wid}: no encontre {src_name}'); continue
        pos = [src['position'][0], src['position'][1] + 180]
        w['nodes'].append(make_sheet_node(sync_name, sheet, pos))
        old_main = w['connections'].get(src_name, {}).get('main', [[]])
        w['connections'][sync_name] = {'main': old_main}
        w['connections'][src_name] = {'main': [[{'node': sync_name, 'type':'main','index':0}]]}
        print(f'  {wid[:5]}: {src_name} -> {sync_name}')

    raw_settings = w.get('settings') or {}
    allowed = {'executionOrder','errorWorkflow','saveDataErrorExecution','saveDataSuccessExecution','saveManualExecutions','saveExecutionProgress','timezone','executionTimeout','callerPolicy'}
    clean_settings = {k: v for k, v in raw_settings.items() if k in allowed} or {'executionOrder':'v1'}
    payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': clean_settings}
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', data=json.dumps(payload).encode(), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
    try:
        urllib.request.urlopen(req); print(f'  PUT {wid[:5]} OK')
    except urllib.error.HTTPError as e:
        print(f'  PUT {wid[:5]} err: {e.code} {e.read()[:300].decode()}')
    for a in ['deactivate','activate']:
        req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
        try: urllib.request.urlopen(req)
        except: pass
    print(f'  {wid[:5]} reactivado\\n')
