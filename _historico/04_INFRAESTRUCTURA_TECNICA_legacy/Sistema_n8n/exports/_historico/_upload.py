import json, base64, urllib.request, urllib.error, sys

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
TABLE_IDS = {'bochile_leads':'UGNAXqPUX0udDRPi','bochile_propiedades':'UlHoNXfh9nX5W8vn','bochile_visitas':'UJOWnNg9k0BdMMJP','bochile_contratos':'TSBcE3hUHHvzcrr2','bochile_empleados':'pfACps5XOWJo7UME','bochile_matches_pendientes':'X1djtSSRbpiiNMTk','bochile_conversaciones':'B5WIk9wqVUH8Z0t8','bochile_acciones_ia':'XeXT6GunMsOgpGa2'}

def remap(obj):
    if isinstance(obj, dict):
        if obj.get('__rl') and 'cachedResultName' in obj:
            n = obj.get('cachedResultName','')
            if n in TABLE_IDS:
                obj['mode'] = 'id'
                obj['value'] = TABLE_IDS[n]
        for v in obj.values(): remap(v)
    elif isinstance(obj, list):
        for v in obj: remap(v)

def upload(filename):
    with open(filename,'r',encoding='utf-8') as f:
        wf = json.load(f)
    remap(wf)
    payload = {'name': wf['name'],'nodes': wf['nodes'],'connections': wf['connections'],'settings': wf.get('settings',{'executionOrder':'v1'})}
    req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            res = json.loads(r.read())
            print(f"OK {filename}: {res.get('id')} | {res.get('name')}")
    except urllib.error.HTTPError as e:
        print(f"ERROR {filename}: {e.code} {e.read().decode()[:500]}")

if __name__ == '__main__':
    upload(sys.argv[1])
