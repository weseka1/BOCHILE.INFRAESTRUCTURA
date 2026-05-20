"""Migracion completa local -> Render n8n.
Setear API_KEY y RENDER_BASE antes de correr.

Flujo:
1. Crea 8 data tables iguales a local (mismos nombres y schemas)
2. Importa los 5 workflows .json
3. Reseed 42 rows iniciales en cada data table
4. Reapunta dataTableIds en workflows a los IDs nuevos
5. Activa W1, W2, W3, W4 (W5 queda pending por OAuth Google)

Pendientes manuales tras este script:
- Conectar credenciales OpenAI + Twilio en Render UI
- Asignarlas a los nodos correspondientes
- Apuntar webhook Twilio Sandbox a https://weseka.onrender.com/webhook/bochile-chat
"""
import json, urllib.request, urllib.error, urllib.parse, sys, os

RENDER_BASE = os.environ.get('RENDER_BASE', 'https://weseka.onrender.com')
API_KEY = os.environ.get('RENDER_N8N_API_KEY', '')  # generar en la UI nueva tras crear admin

if not API_KEY:
    print('ERROR: setear RENDER_N8N_API_KEY env var con la API key generada en la UI Render')
    sys.exit(1)

HEADERS = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}

def api(method, path, body=None):
    url = f'{RENDER_BASE}{path}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500]
        print(f'  HTTP {e.code} {method} {path}: {body}')
        return None

# 1) Crear data tables -----------------------------------------------------
DATATABLE_SCHEMAS = {
    'bochile_leads': [
        {'name':'lead_id','type':'string'},{'name':'nombre','type':'string'},{'name':'telefono','type':'string'},
        {'name':'email','type':'string'},{'name':'canal','type':'string'},{'name':'operacion','type':'string'},
        {'name':'tipo_propiedad','type':'string'},{'name':'zona_pref','type':'string'},{'name':'ambientes','type':'number'},
        {'name':'presupuesto_min','type':'number'},{'name':'presupuesto_max','type':'number'},{'name':'moneda','type':'string'},
        {'name':'forma_pago','type':'string'},{'name':'urgencia','type':'string'},{'name':'score','type':'number'},
        {'name':'etapa','type':'string'},{'name':'vendedor_asignado','type':'string'},{'name':'ultima_intencion','type':'string'},
        {'name':'notas','type':'string'},{'name':'creado_en','type':'date'},{'name':'actualizado_en','type':'date'},
    ],
    'bochile_propiedades': [
        {'name':'prop_id','type':'string'},{'name':'titulo','type':'string'},{'name':'operacion','type':'string'},
        {'name':'tipo','type':'string'},{'name':'direccion','type':'string'},{'name':'zona','type':'string'},
        {'name':'ambientes','type':'number'},{'name':'banos','type':'number'},{'name':'superficie_cubierta','type':'number'},
        {'name':'superficie_total','type':'number'},{'name':'precio','type':'number'},{'name':'moneda','type':'string'},
        {'name':'expensas','type':'number'},{'name':'estado','type':'string'},{'name':'caracteristicas','type':'string'},
        {'name':'tour_360_url','type':'string'},{'name':'foto_principal','type':'string'},{'name':'propietario','type':'string'},
        {'name':'propietario_telefono','type':'string'},{'name':'vendedor_a_cargo','type':'string'},
        {'name':'publicada','type':'boolean'},{'name':'fecha_alta','type':'date'},
    ],
    'bochile_visitas': [
        {'name':'visita_id','type':'string'},{'name':'lead_id','type':'string'},{'name':'prop_id','type':'string'},
        {'name':'vendedor_id','type':'string'},{'name':'vendedor_nombre','type':'string'},{'name':'cliente_nombre','type':'string'},
        {'name':'direccion','type':'string'},{'name':'fecha','type':'date'},{'name':'hora','type':'string'},
        {'name':'estado','type':'string'},{'name':'confirmada_cliente','type':'boolean'},
        {'name':'notificada_vendedor','type':'boolean'},{'name':'recordatorio_enviado','type':'boolean'},
        {'name':'resultado','type':'string'},{'name':'observaciones','type':'string'},{'name':'creada_en','type':'date'},
    ],
    'bochile_contratos': [
        {'name':'contrato_id','type':'string'},{'name':'prop_id','type':'string'},{'name':'direccion','type':'string'},
        {'name':'inquilino_nombre','type':'string'},{'name':'inquilino_telefono','type':'string'},
        {'name':'propietario','type':'string'},{'name':'monto_actual','type':'number'},{'name':'moneda','type':'string'},
        {'name':'dia_vencimiento','type':'number'},{'name':'frecuencia_ajuste','type':'string'},
        {'name':'indice_ajuste','type':'string'},{'name':'fecha_inicio','type':'date'},{'name':'fecha_fin','type':'date'},
        {'name':'estado','type':'string'},{'name':'ultimo_pago','type':'date'},{'name':'dias_atraso','type':'number'},
    ],
    'bochile_empleados': [
        {'name':'empleado_id','type':'string'},{'name':'nombre','type':'string'},{'name':'rol','type':'string'},
        {'name':'telefono','type':'string'},{'name':'email','type':'string'},{'name':'zona_especialidad','type':'string'},
        {'name':'calendar_id','type':'string'},{'name':'activo','type':'boolean'},
        {'name':'visitas_mes','type':'number'},{'name':'cierres_mes','type':'number'},{'name':'comisiones_mes','type':'number'},
    ],
    'bochile_matches_pendientes': [
        {'name':'match_id','type':'string'},{'name':'lead_id','type':'string'},{'name':'lead_nombre','type':'string'},
        {'name':'lead_telefono','type':'string'},{'name':'criterios_json','type':'string'},
        {'name':'creado_en','type':'date'},{'name':'estado','type':'string'},{'name':'props_ofrecidas','type':'string'},
    ],
    'bochile_conversaciones': [
        {'name':'msg_id','type':'string'},{'name':'lead_id','type':'string'},{'name':'telefono','type':'string'},
        {'name':'canal','type':'string'},{'name':'direccion','type':'string'},{'name':'mensaje','type':'string'},
        {'name':'intencion_detectada','type':'string'},{'name':'agente_que_respondio','type':'string'},
        {'name':'requiere_humano','type':'boolean'},{'name':'timestamp','type':'date'},
    ],
    'bochile_acciones_ia': [
        {'name':'accion_id','type':'string'},{'name':'tipo','type':'string'},{'name':'agente','type':'string'},
        {'name':'lead_id','type':'string'},{'name':'resumen','type':'string'},{'name':'detalle','type':'string'},
        {'name':'resultado','type':'string'},{'name':'timestamp','type':'date'},{'name':'tiempo_ahorrado_min','type':'number'},
    ],
    'bochile_buffer_msgs': [
        {'name':'telefono','type':'string'},{'name':'mensaje','type':'string'},
        {'name':'msg_id','type':'string'},{'name':'ts','type':'string'},
    ],
}

print('--- 1. Crear data tables ---')
new_ids = {}
for name, cols in DATATABLE_SCHEMAS.items():
    body = {'name': name, 'columns': cols}
    res = api('POST', '/api/v1/data-tables', body)
    if res and res.get('id'):
        new_ids[name] = res['id']
        print(f'  {name} -> {res["id"]}')
    else:
        print(f'  ERROR creating {name}')

# 2) Workflows -------------------------------------------------------------
# El mapeo local_id -> new_id permite reapuntar referencias
LOCAL_TO_REMOTE = {
    'UGNAXqPUX0udDRPi': new_ids.get('bochile_leads'),
    'UlHoNXfh9nX5W8vn': new_ids.get('bochile_propiedades'),
    'UJOWnNg9k0BdMMJP': new_ids.get('bochile_visitas'),
    'TSBcE3hUHHvzcrr2': new_ids.get('bochile_contratos'),
    'pfACps5XOWJo7UME': new_ids.get('bochile_empleados'),
    'X1djtSSRbpiiNMTk': new_ids.get('bochile_matches_pendientes'),
    'B5WIk9wqVUH8Z0t8': new_ids.get('bochile_conversaciones'),
    'XeXT6GunMsOgpGa2': new_ids.get('bochile_acciones_ia'),
    '2TMTuWeDQD7jDCpd': new_ids.get('bochile_buffer_msgs'),
}

def remap_workflow(w):
    raw = json.dumps(w)
    for old, new in LOCAL_TO_REMOTE.items():
        if old and new:
            raw = raw.replace(old, new)
    return json.loads(raw)

print('--- 2. Importar workflows ---')
new_wf_ids = {}
for fname in ['W1_Chatbot_Multi_Agente_CORE','W2_Recordatorios_Visitas','W3_Match_Retroactivo','W4_Cobranza_Alquileres','W5_Sync_Dashboard_GSheets']:
    with open(f'{fname}.json','r',encoding='utf-8') as f:
        w = json.load(f)
    w = remap_workflow(w)
    payload = {
        'name': w['name'],
        'nodes': w['nodes'],
        'connections': w['connections'],
        'settings': {'executionOrder':'v1'}
    }
    res = api('POST', '/api/v1/workflows', payload)
    if res and res.get('id'):
        new_wf_ids[fname] = res['id']
        print(f'  {fname} -> {res["id"]}')
    else:
        print(f'  ERROR import {fname}')

# 3) Reseed (importar de _seed_all.py los datos en cada tabla) -------------
print('--- 3. Seed datos iniciales ---')
SEED_DATA = {
    'bochile_empleados': [
        {'empleado_id':'E-1B','nombre':'Camila Pomerich','rol':'vendedor','telefono':'5492914413200','email':'camila@bochile.com.ar','zona_especialidad':'Palihue, Villa Belgrano, Country','calendar_id':'','activo':True,'visitas_mes':10,'cierres_mes':2,'comisiones_mes':18000000},
        {'empleado_id':'E-2','nombre':'Julieta Mendez','rol':'vendedor','telefono':'5492914402230','email':'julieta@bochile.com.ar','zona_especialidad':'Centro, Universitario','calendar_id':'','activo':True,'visitas_mes':14,'cierres_mes':3,'comisiones_mes':15800000},
        {'empleado_id':'E-3','nombre':'Valentin Soto','rol':'vendedor','telefono':'5492914403341','email':'valentin@bochile.com.ar','zona_especialidad':'Villa Mitre, Villa Don Bosco, Patagonia','calendar_id':'','activo':True,'visitas_mes':11,'cierres_mes':2,'comisiones_mes':10500000},
        {'empleado_id':'E-4','nombre':'Maria Lopez','rol':'admin','telefono':'5492914404452','email':'maria@bochile.com.ar','zona_especialidad':'','calendar_id':'','activo':True,'visitas_mes':0,'cierres_mes':0,'comisiones_mes':0},
    ],
}
# Cargar resto desde _seed_all.py mediante importacion del modulo
try:
    import importlib.util
    spec = importlib.util.spec_from_file_location('seed_all', '_seed_all.py')
    mod = importlib.util.module_from_spec(spec)
    # _seed_all.py se ejecutaria entero. Para evitar side effects (manda HTTP), parchamos urllib.request.
    class DummyResp:
        def __enter__(self): return self
        def __exit__(self,*a): pass
        def read(self): return b'{}'
    import urllib.request as ur
    original = ur.urlopen
    ur.urlopen = lambda *a, **k: DummyResp()
    try:
        spec.loader.exec_module(mod)
    finally:
        ur.urlopen = original
    for var_name in ['props','contratos','leads','visitas','matches','convs','acciones']:
        rows = getattr(mod, var_name, None)
        if rows and isinstance(rows, list):
            table_key = {'props':'bochile_propiedades','contratos':'bochile_contratos','leads':'bochile_leads','visitas':'bochile_visitas','matches':'bochile_matches_pendientes','convs':'bochile_conversaciones','acciones':'bochile_acciones_ia'}[var_name]
            SEED_DATA[table_key] = rows
except Exception as e:
    print(f'  WARN no se pudo cargar _seed_all.py: {e}')

for table_name, rows in SEED_DATA.items():
    dt_id = new_ids.get(table_name)
    if not dt_id:
        print(f'  skip {table_name} (no id)')
        continue
    res = api('POST', f'/api/v1/data-tables/{dt_id}/rows', {'data': rows})
    if res:
        print(f'  {table_name}: {len(rows)} rows inserted')

# 4) Activar workflows W1-W4 (W5 queda inactive, necesita OAuth GSheets)
print('--- 4. Activar workflows ---')
for fname in ['W1_Chatbot_Multi_Agente_CORE','W2_Recordatorios_Visitas','W3_Match_Retroactivo','W4_Cobranza_Alquileres']:
    wid = new_wf_ids.get(fname)
    if not wid: continue
    res = api('POST', f'/api/v1/workflows/{wid}/activate')
    print(f'  {fname} ({wid}): {"ACTIVE" if res is not None else "FAIL"}')

print('\n=== DONE ===')
print('Webhook URL para Twilio:')
print(f'  {RENDER_BASE}/webhook/bochile-chat')
print('\nPendientes manuales en Render UI:')
print('  1. Credentials > New > OpenAI -> pegar API key')
print('  2. Credentials > New > Twilio -> SID + Token')
print('  3. Abrir cada workflow y asignar las creds a los nodos (OpenAI / Twilio)')
print('  4. Twilio Sandbox -> WHEN A MESSAGE COMES IN -> apuntar a la URL de arriba')
