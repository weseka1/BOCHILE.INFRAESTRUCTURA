import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
BASE = 'http://localhost:5680/api/v1'

T = {
  'leads':'UGNAXqPUX0udDRPi','props':'UlHoNXfh9nX5W8vn','visitas':'UJOWnNg9k0BdMMJP',
  'contratos':'TSBcE3hUHHvzcrr2','empleados':'pfACps5XOWJo7UME','matches':'X1djtSSRbpiiNMTk',
  'convs':'B5WIk9wqVUH8Z0t8','acciones':'XeXT6GunMsOgpGa2'
}

def insert(table_id, rows):
    req = urllib.request.Request(
        f'{BASE}/data-tables/{table_id}/rows',
        data=json.dumps({'data': rows}).encode('utf-8'),
        headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as r:
            res = json.loads(r.read())
            return f"OK {len(rows)} filas"
    except urllib.error.HTTPError as e:
        return f"ERROR {e.code}: {e.read().decode()[:200]}"

# Test con 1 fila de empleados
test = [{'empleado_id':'E-TEST','nombre':'Test','rol':'admin','telefono':'5491100000000','email':'test@x.com','zona_especialidad':'','calendar_id':'','activo':True,'visitas_mes':0,'cierres_mes':0,'comisiones_mes':0}]
print('Test empleados:', insert(T['empleados'], test))
