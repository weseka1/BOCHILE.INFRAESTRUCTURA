"""Parser fix: mantener el 9 argentino para WhatsApp. El sandbox de Twilio
requiere el mismo numero con el que el usuario se unio (con 9 movil)."""
import json, urllib.request

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'
W1 = 'aUMQyupnGJ5IWm5e'

NEW_PARSER = r"""const body = $input.first().json.body || $input.first().json;
const from_raw = body.From || body.from || '';
const profile = body.ProfileName || body.profileName || 'Desconocido';
const text_body = body.Body || body.body || '';
const num_media = parseInt(body.NumMedia || body.numMedia || '0', 10);
const media_url = body.MediaUrl0 || body.mediaUrl0 || '';
const media_type = body.MediaContentType0 || body.mediaContentType0 || '';

const from = from_raw.replace('whatsapp:', '');

let msg_type = 'text';
let mensaje_original = text_body;
if (num_media > 0 && media_url) {
  if (media_type.startsWith('audio/')) msg_type = 'audio';
  else if (media_type.startsWith('image/')) msg_type = 'image';
  else { msg_type = 'document'; mensaje_original = text_body || '[adjunto recibido]'; }
}

if (!from || (!text_body && !media_url)) {
  return [{ json: { skip: true, reason: 'payload_invalido' } }];
}

const digits_only = from.replace(/\D/g, '');

return [{ json: {
  telefono: from,
  telefono_twilio: from,
  nombre: profile,
  mensaje_original: mensaje_original,
  msg_type: msg_type,
  media_url: media_url,
  media_type: media_type,
  canal: 'whatsapp_twilio',
  lead_id: 'L-' + digits_only.slice(-10),
  msg_id: 'M-' + Date.now(),
  timestamp_iso: new Date().toISOString(),
  skip: false
}}];"""

req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', headers={'X-N8N-API-KEY': KEY})
with urllib.request.urlopen(req) as r:
    w = json.loads(r.read())

for n in w['nodes']:
    if n['name'] == 'Parsear Mensaje':
        n['parameters']['jsCode'] = NEW_PARSER

payload = {'name': w['name'], 'nodes': w['nodes'], 'connections': w['connections'], 'settings': {'executionOrder':'v1'}}
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}', data=json.dumps(payload).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='PUT')
urllib.request.urlopen(req)
print('OK parser: telefono_twilio = from (con 9, igual al sandbox join)')

# Reactivar
req = urllib.request.Request(f'http://localhost:5680/api/v1/workflows/{W1}/activate', headers={'X-N8N-API-KEY': KEY}, method='POST')
try: urllib.request.urlopen(req); print('reactivado')
except: pass
