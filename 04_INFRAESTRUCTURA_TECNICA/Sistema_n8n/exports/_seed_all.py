"""Siembra las 8 Data Tables con seed data realista para arrancar."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
BASE = 'http://localhost:5680/api/v1'
T = {'leads':'UGNAXqPUX0udDRPi','props':'UlHoNXfh9nX5W8vn','visitas':'UJOWnNg9k0BdMMJP','contratos':'TSBcE3hUHHvzcrr2','empleados':'pfACps5XOWJo7UME','matches':'X1djtSSRbpiiNMTk','convs':'B5WIk9wqVUH8Z0t8','acciones':'XeXT6GunMsOgpGa2'}

def insert(table_id, rows):
    req = urllib.request.Request(f'{BASE}/data-tables/{table_id}/rows', data=json.dumps({'data': rows}).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            return f"OK {len(rows)} filas"
    except urllib.error.HTTPError as e:
        return f"ERROR {e.code}: {e.read().decode()[:300]}"

# Borrar test
import urllib.parse
def delete_test_empleado():
    req = urllib.request.Request(f'{BASE}/data-tables/{T["empleados"]}/rows?filter='+urllib.parse.quote(json.dumps({"empleado_id":"E-TEST"})), headers={'X-N8N-API-KEY': KEY}, method='DELETE')
    try:
        with urllib.request.urlopen(req) as r: return "OK"
    except: return "skip"
delete_test_empleado()

empleados = [
  {'empleado_id':'E-1','nombre':'Carlos Bochile','rol':'vendedor','telefono':'5492914401120','email':'carlos@bochile.com.ar','zona_especialidad':'Palihue, Villa Belgrano, Country','calendar_id':'','activo':True,'visitas_mes':18,'cierres_mes':3,'comisiones_mes':22400000},
  {'empleado_id':'E-2','nombre':'Julieta Mendez','rol':'vendedor','telefono':'5492914402230','email':'julieta@bochile.com.ar','zona_especialidad':'Centro, Universitario','calendar_id':'','activo':True,'visitas_mes':14,'cierres_mes':3,'comisiones_mes':15800000},
  {'empleado_id':'E-3','nombre':'Valentin Soto','rol':'vendedor','telefono':'5492914403341','email':'valentin@bochile.com.ar','zona_especialidad':'Villa Mitre, Villa Don Bosco, Patagonia','calendar_id':'','activo':True,'visitas_mes':11,'cierres_mes':2,'comisiones_mes':10500000},
  {'empleado_id':'E-4','nombre':'Maria Lopez','rol':'admin','telefono':'5492914404452','email':'maria@bochile.com.ar','zona_especialidad':'','calendar_id':'','activo':True,'visitas_mes':0,'cierres_mes':0,'comisiones_mes':0}
]

propiedades = [
  {'prop_id':'P-001','titulo':'Departamento 2 ambientes a estrenar con balcon','operacion':'venta','tipo':'departamento','direccion':"O'Higgins 234 7B",'zona':'Centro','ambientes':2,'banos':1,'superficie_cubierta':52,'superficie_total':52,'precio':142000,'moneda':'USD','expensas':18000,'estado':'publicada','caracteristicas':'balcon, sum, cochera, a_estrenar','tour_360_url':'https://bochile.com.ar/tour/P-001','foto_principal':'','propietario':'Familia Ortiz','propietario_telefono':'5492914512200','vendedor_a_cargo':'E-2','publicada':True,'fecha_alta':'2026-03-15T00:00:00Z'},
  {'prop_id':'P-002','titulo':'Casa 4 ambientes con quincho y jardin','operacion':'venta','tipo':'casa','direccion':'Brown 1842','zona':'Palihue','ambientes':4,'banos':3,'superficie_cubierta':240,'superficie_total':450,'precio':285000,'moneda':'USD','expensas':0,'estado':'publicada','caracteristicas':'pileta, quincho, jardin, cochera, suite','tour_360_url':'https://bochile.com.ar/tour/P-002','foto_principal':'','propietario':'Familia Schiavi','propietario_telefono':'5492914523310','vendedor_a_cargo':'E-1','publicada':True,'fecha_alta':'2026-02-10T00:00:00Z'},
  {'prop_id':'P-003','titulo':'Monoambiente moderno torre nueva','operacion':'alquiler','tipo':'departamento','direccion':'Alem 1456 4D','zona':'Universitario','ambientes':1,'banos':1,'superficie_cubierta':38,'superficie_total':38,'precio':680000,'moneda':'ARS','expensas':42000,'estado':'publicada','caracteristicas':'amoblado, gimnasio, seguridad','tour_360_url':'https://bochile.com.ar/tour/P-003','foto_principal':'','propietario':'Pablo Iribarne','propietario_telefono':'5492914534421','vendedor_a_cargo':'E-2','publicada':True,'fecha_alta':'2026-04-01T00:00:00Z'},
  {'prop_id':'P-004','titulo':'PH 3 ambientes con patio propio','operacion':'venta','tipo':'ph','direccion':'Sarmiento 542','zona':'Villa Mitre','ambientes':3,'banos':1,'superficie_cubierta':78,'superficie_total':120,'precio':98000,'moneda':'USD','expensas':0,'estado':'publicada','caracteristicas':'patio, reciclado, sin_expensas','tour_360_url':'https://bochile.com.ar/tour/P-004','foto_principal':'','propietario':'Marcos Pellegrini','propietario_telefono':'5492914545532','vendedor_a_cargo':'E-3','publicada':True,'fecha_alta':'2026-01-22T00:00:00Z'},
  {'prop_id':'P-005','titulo':'Casa de diseno con pileta y parque','operacion':'venta','tipo':'casa','direccion':'Ruta 33 km 7 Country','zona':'Villa Belgrano','ambientes':5,'banos':4,'superficie_cubierta':320,'superficie_total':900,'precio':320000,'moneda':'USD','expensas':85000,'estado':'publicada','caracteristicas':'pileta, parque, country, seguridad_24h, diseno','tour_360_url':'https://bochile.com.ar/tour/P-005','foto_principal':'','propietario':'Familia Cabrera','propietario_telefono':'5492914556643','vendedor_a_cargo':'E-1','publicada':True,'fecha_alta':'2026-02-28T00:00:00Z'},
  {'prop_id':'P-006','titulo':'Lote 12x30 apto duplex','operacion':'venta','tipo':'lote','direccion':'Castelli 3210','zona':'Patagonia','ambientes':0,'banos':0,'superficie_cubierta':0,'superficie_total':360,'precio':42000,'moneda':'USD','expensas':0,'estado':'publicada','caracteristicas':'esquina, fot_1.2, servicios','tour_360_url':'https://bochile.com.ar/tour/P-006','foto_principal':'','propietario':'Roberto Genovese','propietario_telefono':'5492914567754','vendedor_a_cargo':'E-3','publicada':True,'fecha_alta':'2026-03-05T00:00:00Z'},
  {'prop_id':'P-007','titulo':'Departamento 3 amb con cochera','operacion':'venta','tipo':'departamento','direccion':'Mitre 890','zona':'Centro','ambientes':3,'banos':2,'superficie_cubierta':85,'superficie_total':85,'precio':165000,'moneda':'USD','expensas':28000,'estado':'publicada','caracteristicas':'cochera, balcon, sum, parrilla','tour_360_url':'https://bochile.com.ar/tour/P-007','foto_principal':'','propietario':'Andrea Coria','propietario_telefono':'5492914578865','vendedor_a_cargo':'E-2','publicada':True,'fecha_alta':'2026-04-10T00:00:00Z'},
  {'prop_id':'P-008','titulo':'Casa familiar 3 amb con jardin','operacion':'venta','tipo':'casa','direccion':'Donado 1245','zona':'Universitario','ambientes':3,'banos':2,'superficie_cubierta':110,'superficie_total':250,'precio':178000,'moneda':'USD','expensas':0,'estado':'publicada','caracteristicas':'jardin, quincho, cochera_doble','tour_360_url':'https://bochile.com.ar/tour/P-008','foto_principal':'','propietario':'Diego Albarracin','propietario_telefono':'5492914589976','vendedor_a_cargo':'E-2','publicada':True,'fecha_alta':'2026-03-20T00:00:00Z'},
  {'prop_id':'P-009','titulo':'Departamento 2 amb frente al mar','operacion':'alquiler_temporario','tipo':'departamento','direccion':'Costanera 156 5C','zona':'Centro','ambientes':2,'banos':1,'superficie_cubierta':55,'superficie_total':55,'precio':1200000,'moneda':'ARS','expensas':35000,'estado':'publicada','caracteristicas':'vista_mar, amoblado, temporario','tour_360_url':'https://bochile.com.ar/tour/P-009','foto_principal':'','propietario':'Familia Larranaga','propietario_telefono':'5492914591087','vendedor_a_cargo':'E-2','publicada':True,'fecha_alta':'2026-04-05T00:00:00Z'},
  {'prop_id':'P-010','titulo':'Local comercial sobre avenida','operacion':'alquiler','tipo':'local','direccion':'Av. Alem 1102','zona':'Centro','ambientes':0,'banos':1,'superficie_cubierta':80,'superficie_total':80,'precio':950000,'moneda':'ARS','expensas':0,'estado':'publicada','caracteristicas':'sobre_avenida, vidriera, parking','tour_360_url':'https://bochile.com.ar/tour/P-010','foto_principal':'','propietario':'Eduardo Pizzo','propietario_telefono':'5492914502198','vendedor_a_cargo':'E-2','publicada':True,'fecha_alta':'2026-02-15T00:00:00Z'}
]

contratos = [
  {'contrato_id':'C-001','prop_id':'P-001','direccion':"O'Higgins 234 7B",'inquilino_nombre':'Romina Calandri','inquilino_telefono':'+5492914421180','propietario':'Familia Ortiz','monto_actual':680000,'moneda':'ARS','dia_vencimiento':5,'frecuencia_ajuste':'cuatrimestral','indice_ajuste':'IPC','fecha_inicio':'2024-05-01T00:00:00Z','fecha_fin':'2026-05-01T00:00:00Z','estado':'activo','ultimo_pago':'2026-04-05T00:00:00Z','dias_atraso':0},
  {'contrato_id':'C-002','prop_id':'P-003','direccion':'Alem 1456 4D','inquilino_nombre':'Florencia Bertola','inquilino_telefono':'+5492914462210','propietario':'Pablo Iribarne','monto_actual':580000,'moneda':'ARS','dia_vencimiento':1,'frecuencia_ajuste':'cuatrimestral','indice_ajuste':'IPC','fecha_inicio':'2024-08-01T00:00:00Z','fecha_fin':'2026-08-01T00:00:00Z','estado':'activo','ultimo_pago':'2026-04-01T00:00:00Z','dias_atraso':3},
  {'contrato_id':'C-003','prop_id':'P-008','direccion':'Donado 1245','inquilino_nombre':'Gaston Iribarne','inquilino_telefono':'+5492914517822','propietario':'Diego Albarracin','monto_actual':920000,'moneda':'ARS','dia_vencimiento':10,'frecuencia_ajuste':'trimestral','indice_ajuste':'ICL','fecha_inicio':'2025-06-10T00:00:00Z','fecha_fin':'2026-06-10T00:00:00Z','estado':'activo','ultimo_pago':'2026-04-10T00:00:00Z','dias_atraso':0},
  {'contrato_id':'C-004','prop_id':'P-004','direccion':'Sarmiento 542','inquilino_nombre':'Mariano Pellegrini','inquilino_telefono':'+5492914552209','propietario':'Familia Schiavi','monto_actual':740000,'moneda':'ARS','dia_vencimiento':3,'frecuencia_ajuste':'cuatrimestral','indice_ajuste':'IPC','fecha_inicio':'2024-09-03T00:00:00Z','fecha_fin':'2026-09-03T00:00:00Z','estado':'activo','ultimo_pago':'2026-04-03T00:00:00Z','dias_atraso':0},
  {'contrato_id':'C-005','prop_id':'P-009','direccion':'Costanera 156 5C','inquilino_nombre':'Familia Larranaga','inquilino_telefono':'+5492914557741','propietario':'Familia Larranaga','monto_actual':1180000,'moneda':'ARS','dia_vencimiento':8,'frecuencia_ajuste':'semestral','indice_ajuste':'IPC','fecha_inicio':'2025-02-08T00:00:00Z','fecha_fin':'2026-08-08T00:00:00Z','estado':'activo','ultimo_pago':'2026-04-08T00:00:00Z','dias_atraso':0},
  {'contrato_id':'C-006','prop_id':'P-007','direccion':'Mitre 890','inquilino_nombre':'Lucia Pelle','inquilino_telefono':'+5492914471208','propietario':'Andrea Coria','monto_actual':820000,'moneda':'ARS','dia_vencimiento':15,'frecuencia_ajuste':'cuatrimestral','indice_ajuste':'IPC','fecha_inicio':'2024-06-15T00:00:00Z','fecha_fin':'2026-06-15T00:00:00Z','estado':'activo','ultimo_pago':'2026-04-15T00:00:00Z','dias_atraso':0}
]

leads = [
  {'lead_id':'L-2914423398','nombre':'Lucas Fernandez','telefono':'+5492914423398','email':'','canal':'whatsapp','operacion':'venta','tipo_propiedad':'casa','zona_pref':'Palihue','ambientes':4,'presupuesto_min':250000,'presupuesto_max':300000,'moneda':'USD','forma_pago':'mixto','urgencia':'alta','score':88,'etapa':'Visita agendada','vendedor_asignado':'E-1','ultima_intencion':'Casa familiar Palihue','notas':'Pareja con 2 hijos. Vende dpto Centro.','creado_en':'2026-04-28T10:42:00Z','actualizado_en':'2026-04-30T15:30:00Z'},
  {'lead_id':'L-2914456712','nombre':'Marcos Genovese','telefono':'+5492914456712','email':'marcos@gmail.com','canal':'referido','operacion':'venta','tipo_propiedad':'casa','zona_pref':'Villa Belgrano','ambientes':5,'presupuesto_min':280000,'presupuesto_max':360000,'moneda':'USD','forma_pago':'cash','urgencia':'alta','score':88,'etapa':'Nuevo','vendedor_asignado':'','ultima_intencion':'Country Belgrano','notas':'Referido por Familia Cabrera. Cash.','creado_en':'2026-04-30T09:15:00Z','actualizado_en':'2026-04-30T09:15:00Z'},
  {'lead_id':'L-2914467823','nombre':'Veronica Rial','telefono':'+5492914467823','email':'','canal':'zonaprop','operacion':'venta','tipo_propiedad':'departamento','zona_pref':'Universitario','ambientes':2,'presupuesto_min':120000,'presupuesto_max':140000,'moneda':'USD','forma_pago':'mixto','urgencia':'media','score':82,'etapa':'Calificado IA','vendedor_asignado':'E-2','ultima_intencion':'Dpto 2 amb cerca UNS','notas':'Cash parcial + credito. Decision 30 dias.','creado_en':'2026-04-29T14:00:00Z','actualizado_en':'2026-04-30T11:00:00Z'},
  {'lead_id':'L-2914478934','nombre':'Pablo Schiavi','telefono':'+5492914478934','email':'','canal':'web','operacion':'venta','tipo_propiedad':'casa','zona_pref':'Palihue','ambientes':4,'presupuesto_min':300000,'presupuesto_max':380000,'moneda':'USD','forma_pago':'vende_otra','urgencia':'alta','score':91,'etapa':'Calificado IA','vendedor_asignado':'E-1','ultima_intencion':'Casa familiar Palihue','notas':'Vende su departamento. Familia 4.','creado_en':'2026-04-28T16:20:00Z','actualizado_en':'2026-04-29T09:30:00Z'},
  {'lead_id':'L-2914490156','nombre':'Sofia Martinez','telefono':'+5492914490156','email':'','canal':'web','operacion':'alquiler','tipo_propiedad':'departamento','zona_pref':'Centro','ambientes':2,'presupuesto_min':500000,'presupuesto_max':700000,'moneda':'ARS','forma_pago':'credito','urgencia':'baja','score':42,'etapa':'En espera de stock','vendedor_asignado':'','ultima_intencion':'Alquiler dpto 2 amb','notas':'Sin urgencia. Esta mirando.','creado_en':'2026-04-30T11:15:00Z','actualizado_en':'2026-04-30T11:20:00Z'},
  {'lead_id':'L-2914501267','nombre':'Andrea Coria','telefono':'+5492914501267','email':'','canal':'zonaprop','operacion':'venta','tipo_propiedad':'departamento','zona_pref':'Centro','ambientes':2,'presupuesto_min':140000,'presupuesto_max':170000,'moneda':'USD','forma_pago':'credito','urgencia':'media','score':73,'etapa':'Visita agendada','vendedor_asignado':'E-2','ultima_intencion':"Visita O'Higgins manana",'notas':'Visita 13 mayo 10:00','creado_en':'2026-04-29T10:00:00Z','actualizado_en':'2026-04-30T17:00:00Z'},
  {'lead_id':'L-2914512378','nombre':'Familia Beltran','telefono':'+5492914512378','email':'','canal':'whatsapp','operacion':'venta','tipo_propiedad':'casa','zona_pref':'Palihue','ambientes':4,'presupuesto_min':260000,'presupuesto_max':320000,'moneda':'USD','forma_pago':'mixto','urgencia':'alta','score':85,'etapa':'Visita agendada','vendedor_asignado':'E-1','ultima_intencion':'2da visita Brown 1842','notas':'Ya visitaron. Cerrando.','creado_en':'2026-04-25T14:00:00Z','actualizado_en':'2026-04-30T13:00:00Z'},
  {'lead_id':'L-2914523489','nombre':'Pareja Ortiz','telefono':'+5492914523489','email':'','canal':'meta_ads','operacion':'venta','tipo_propiedad':'casa','zona_pref':'Palihue','ambientes':4,'presupuesto_min':250000,'presupuesto_max':300000,'moneda':'USD','forma_pago':'mixto','urgencia':'alta','score':87,'etapa':'Negociación','vendedor_asignado':'E-1','ultima_intencion':'Contraoferta 270k','notas':'Hicieron oferta. Esperando.','creado_en':'2026-04-20T09:00:00Z','actualizado_en':'2026-04-30T16:30:00Z'}
]

visitas = [
  {'visita_id':'V-001','lead_id':'L-2914512378','prop_id':'P-002','vendedor_id':'E-1','vendedor_nombre':'Carlos Bochile','cliente_nombre':'Familia Beltran','direccion':'Brown 1842, Palihue','fecha':'2026-05-12T00:00:00Z','hora':'16:30','estado':'agendada','confirmada_cliente':True,'notificada_vendedor':True,'recordatorio_enviado':False,'resultado':'','observaciones':'Segunda visita. Muy interesados.','creada_en':'2026-04-30T11:00:00Z'},
  {'visita_id':'V-002','lead_id':'L-2914501267','prop_id':'P-001','vendedor_id':'E-2','vendedor_nombre':'Julieta Mendez','cliente_nombre':'Andrea Coria','direccion':"O'Higgins 234 7B, Centro",'fecha':'2026-05-13T00:00:00Z','hora':'10:00','estado':'agendada','confirmada_cliente':True,'notificada_vendedor':True,'recordatorio_enviado':False,'resultado':'','observaciones':'Primera visita.','creada_en':'2026-04-30T15:00:00Z'},
  {'visita_id':'V-003','lead_id':'L-2914423398','prop_id':'P-002','vendedor_id':'E-1','vendedor_nombre':'Carlos Bochile','cliente_nombre':'Lucas Fernandez','direccion':'Brown 1842, Palihue','fecha':'2026-05-14T00:00:00Z','hora':'10:30','estado':'agendada','confirmada_cliente':True,'notificada_vendedor':True,'recordatorio_enviado':False,'resultado':'','observaciones':'Pareja con 2 chicos.','creada_en':'2026-04-30T17:00:00Z'}
]

matches = [
  {'match_id':'MP-001','lead_id':'L-2914490156','lead_nombre':'Sofia Martinez','lead_telefono':'+5492914490156','operacion':'alquiler','tipo':'departamento','zona':'Centro','ambientes_min':2,'presupuesto_min':500000,'presupuesto_max':700000,'moneda':'ARS','caracteristicas_must':'amoblado','activo':True,'creado_en':'2026-04-30T11:20:00Z'},
  {'match_id':'MP-002','lead_id':'L-2914456712','lead_nombre':'Marcos Genovese','lead_telefono':'+5492914456712','operacion':'venta','tipo':'casa','zona':'Villa Belgrano','ambientes_min':5,'presupuesto_min':280000,'presupuesto_max':360000,'moneda':'USD','caracteristicas_must':'pileta, parque, seguridad_24h','activo':True,'creado_en':'2026-04-30T09:30:00Z'}
]

acciones = [
  {'accion_id':'A-001','tipo':'conversacion_atendida','agente':'Vendedor CORE','lead_id':'L-2914423398','resumen':'Atendio consulta inicial','detalle':'Lucas consulta casa Palihue. Score 88.','resultado':'ok','tiempo_ahorrado_min':4,'timestamp':'2026-04-30T10:42:30Z'},
  {'accion_id':'A-002','tipo':'lead_calificado','agente':'SubAgente Calificador','lead_id':'L-2914423398','resumen':'Score 88 caliente','detalle':'Pareja 2 hijos. USD 250-300k.','resultado':'ok','tiempo_ahorrado_min':3,'timestamp':'2026-04-30T10:44:30Z'},
  {'accion_id':'A-003','tipo':'visita_agendada','agente':'SubAgente Admin','lead_id':'L-2914423398','resumen':'Visita sabado 10:30','detalle':'Brown 1842 con Carlos.','resultado':'ok','tiempo_ahorrado_min':8,'timestamp':'2026-04-30T10:47:00Z'},
  {'accion_id':'A-004','tipo':'cobranza_alquiler','agente':'Cron Cobranza','lead_id':'','resumen':'Cobro Romina Calandri','detalle':'$680.000 ARS via Mercado Pago.','resultado':'enviado','tiempo_ahorrado_min':5,'timestamp':'2026-04-30T09:12:00Z'},
  {'accion_id':'A-005','tipo':'match_pendiente_guardado','agente':'SubAgente Admin','lead_id':'L-2914490156','resumen':'Match pendiente Sofia','detalle':'Alquiler dpto Centro 2 amb.','resultado':'ok','tiempo_ahorrado_min':5,'timestamp':'2026-04-30T11:22:00Z'},
  {'accion_id':'A-006','tipo':'recordatorio_visita','agente':'Cron Recordatorios','lead_id':'L-2914512378','resumen':'Recordatorio 24h','detalle':'Familia Beltran 16:30 Brown 1842.','resultado':'enviado','tiempo_ahorrado_min':3,'timestamp':'2026-05-11T16:30:00Z'}
]

convs = [
  {'msg_id':'M-001','lead_id':'L-2914423398','telefono':'+5492914423398','canal':'whatsapp','direccion':'in','mensaje':'Hola! Vi un aviso de una casa en Palihue.','intencion_detectada':'consulta','agente_que_respondio':'pending','requiere_humano':False,'timestamp':'2026-04-30T10:42:00Z'},
  {'msg_id':'M-002','lead_id':'L-2914423398','telefono':'+5492914423398','canal':'whatsapp','direccion':'out','mensaje':'Hola Lucas! Soy Camila de Bochile. Es para vivir o como inversion?','intencion_detectada':'saludo','agente_que_respondio':'Vendedor CORE','requiere_humano':False,'timestamp':'2026-04-30T10:42:30Z'},
  {'msg_id':'M-003','lead_id':'L-2914423398','telefono':'+5492914423398','canal':'whatsapp','direccion':'in','mensaje':'Para vivir, somos pareja con 2 nenes','intencion_detectada':'calificacion','agente_que_respondio':'pending','requiere_humano':False,'timestamp':'2026-04-30T10:43:00Z'}
]

results = []
results.append(('empleados', insert(T['empleados'], empleados)))
results.append(('propiedades', insert(T['props'], propiedades)))
results.append(('contratos', insert(T['contratos'], contratos)))
results.append(('leads', insert(T['leads'], leads)))
results.append(('visitas', insert(T['visitas'], visitas)))
results.append(('matches_pendientes', insert(T['matches'], matches)))
results.append(('conversaciones', insert(T['convs'], convs)))
results.append(('acciones_ia', insert(T['acciones'], acciones)))

for name, res in results:
    print(f"{name:25} -> {res}")
