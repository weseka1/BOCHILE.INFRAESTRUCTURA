"""W5 Volcar nodes: usar mappingMode=defineBelow con cada columna mapeada
explicitamente como expression. Es el unico formato que funciona en n8n 2.13."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W5 = 'uA4y7AytMBraEiEX'

TABLES = {
    '1 - Volcar leads': ('lead_id', ['lead_id','nombre','telefono','email','canal','operacion','tipo_propiedad','zona_pref','ambientes','presupuesto_min','presupuesto_max','moneda','forma_pago','urgencia','score','etapa','vendedor_asignado','ultima_intencion','notas','creado_en','actualizado_en']),
    '2 - Volcar propiedades': ('prop_id', ['prop_id','titulo','operacion','tipo','direccion','zona','ambientes','banos','superficie_cubierta','superficie_total','precio','moneda','expensas','estado','caracteristicas','tour_360_url','foto_principal','propietario','propietario_telefono','vendedor_a_cargo','publicada','fecha_alta']),
    '3 - Volcar visitas': ('visita_id', ['visita_id','lead_id','prop_id','vendedor_id','vendedor_nombre','cliente_nombre','direccion','fecha','hora','estado','confirmada_cliente','notificada_vendedor','recordatorio_enviado','resultado','observaciones','creada_en']),
    '4 - Volcar contratos': ('contrato_id', ['contrato_id','prop_id','direccion','inquilino_nombre','inquilino_telefono','propietario','monto_actual','moneda','dia_vencimiento','frecuencia_ajuste','indice_ajuste','fecha_inicio','fecha_fin','estado','ultimo_pago','dias_atraso']),
    '5 - Volcar empleados': ('empleado_id', ['empleado_id','nombre','rol','telefono','email','zona_especialidad','calendar_id','activo','visitas_mes','cierres_mes','comisiones_mes']),
    '6 - Volcar matches_pendientes': ('match_id', ['match_id','lead_id','lead_nombre','lead_telefono','criterios_json','creado_en','estado','props_ofrecidas']),
    '7 - Volcar conversaciones': ('msg_id', ['msg_id','lead_id','telefono','canal','direccion','mensaje','intencion_detectada','agente_que_respondio','requiere_humano','timestamp']),
    '8 - Volcar acciones_ia': ('accion_id', ['accion_id','tipo','agente','lead_id','resumen','detalle','resultado','timestamp','tiempo_ahorrado_min']),
}

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

for n in w['nodes']:
    if n['name'] in TABLES:
        key, cols = TABLES[n['name']]
        value_dict = {c: '={{ $json["' + c + '"] }}' for c in cols}
        n['parameters']['columns'] = {
            'mappingMode': 'defineBelow',
            'value': value_dict,
            'matchingColumns': [key],
            'schema': [],
            'attemptToConvertTypes': False,
            'convertFieldsToString': True
        }
        print(f'OK: {n["name"]} ({len(cols)} cols, key={key})')

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
urllib.request.urlopen(req)
print('PUT OK')

for a in ['deactivate','activate']:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W5}/{a}', headers={'X-N8N-API-KEY': KEY}, method='POST')
    try:
        with urllib.request.urlopen(req) as r: print(a, r.status)
    except urllib.error.HTTPError as e: print(a, 'err', e.code)
