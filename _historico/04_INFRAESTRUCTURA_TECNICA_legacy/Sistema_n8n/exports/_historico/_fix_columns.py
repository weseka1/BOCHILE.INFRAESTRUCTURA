"""Refactorizar columns de TODOS los nodos dataTable: en lugar de expression que devuelve objeto,
usar columns como objeto JSON con cada value individualmente como expression."""
import json, urllib.request, urllib.error, re

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'

def to_struct_columns(expr_string):
    if not isinstance(expr_string, str) or not expr_string.startswith('={{'):
        return expr_string
    m = re.search(r'"value":\s*\{\s*(.+?)\s*\}\s*,\s*"matchingColumns"', expr_string, re.DOTALL)
    if not m:
        return expr_string
    pairs_raw = m.group(1)
    mc_m = re.search(r'"matchingColumns":\s*\[(.*?)\]', expr_string)
    matching = []
    if mc_m:
        matching = [s.strip().strip('"\'') for s in mc_m.group(1).split(',') if s.strip()]

    value_obj = {}
    i = 0
    backslash = chr(92)
    while i < len(pairs_raw):
        key_m = re.match(r'\s*"([^"]+)"\s*:\s*', pairs_raw[i:])
        if not key_m:
            break
        key = key_m.group(1)
        i += key_m.end()
        depth = 0
        j = i
        in_str = False
        in_str_char = ''
        while j < len(pairs_raw):
            ch = pairs_raw[j]
            if in_str:
                prev = pairs_raw[j-1] if j > 0 else ''
                if ch == in_str_char and prev != backslash:
                    in_str = False
            elif ch == '"' or ch == "'":
                in_str = True
                in_str_char = ch
            elif ch in '({[':
                depth += 1
            elif ch in ')}]':
                depth -= 1
            elif ch == ',' and depth == 0:
                break
            j += 1
        val_expr = pairs_raw[i:j].strip()
        if len(val_expr) >= 2 and val_expr[0] == '"' and val_expr[-1] == '"' and val_expr[1:-1].count('"') == 0:
            value_obj[key] = val_expr[1:-1]
        else:
            value_obj[key] = '={{ ' + val_expr + ' }}'
        i = j + 1

    return {
        'mappingMode': 'defineBelow',
        'value': value_obj,
        'matchingColumns': matching,
        'schema': []
    }

WORKFLOWS = [
    ('W1', 'aUMQyupnGJ5IWm5e'),
    ('W2', 'f1CC972kzNPR8ebi'),
    ('W3', 'W327qYVE9SpwQiRi'),
    ('W4', 'wrFto5o6Zk02sZty'),
]

for tag, wid in WORKFLOWS:
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', headers={'X-N8N-API-KEY': KEY})
    with urllib.request.urlopen(req) as r:
        w = json.loads(r.read())

    changes = 0
    for n in w['nodes']:
        params = n.get('parameters', {})
        cols = params.get('columns')
        if isinstance(cols, str) and cols.startswith('={{'):
            new_cols = to_struct_columns(cols)
            if isinstance(new_cols, dict):
                params['columns'] = new_cols
                changes += 1

    clean_settings = {'executionOrder': 'v1'}
    payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': clean_settings}
    req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{wid}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
    try:
        urllib.request.urlopen(req)
        print(f'{tag}: {changes} columns refactored, updated OK')
    except urllib.error.HTTPError as e:
        print(f'{tag}: ERROR {e.code}: {e.read().decode()[:300]}')

# Reactivar W1
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/aUMQyupnGJ5IWm5e/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try:
    urllib.request.urlopen(req)
    print('W1 reactivado')
except: pass
