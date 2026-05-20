"""Sube W2..W5 al n8n local con IDs de tablas locales pre-mapeados."""
import json, urllib.request, urllib.error

KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3YmFlYjNhMy05NDQ0LTQ0YTEtODc1Ny0yZDJiZjYwMTA2YTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYjNkMzY1OWUtNWE1OS00ZTc3LWExMDQtY2U5YmVjNTdlYTNlIiwiaWF0IjoxNzc4NTY0MDU4LCJleHAiOjE3ODExNDY4MDB9.wrlG3rJMYt6MbMeyTebh5P_0qYQ2biM5DPrcTNAZnaE'

T = {
  'leads':'UGNAXqPUX0udDRPi','props':'UlHoNXfh9nX5W8vn','visitas':'UJOWnNg9k0BdMMJP',
  'contratos':'TSBcE3hUHHvzcrr2','empleados':'pfACps5XOWJo7UME','matches':'X1djtSSRbpiiNMTk',
  'convs':'B5WIk9wqVUH8Z0t8','acciones':'XeXT6GunMsOgpGa2'
}

def dt(table_id, name):
    return {'__rl': True, 'mode': 'id', 'value': table_id, 'cachedResultName': name}

# ===== W2 RECORDATORIOS =====
W2_CODE = '''const out = [];
const ahora = new Date();
const visitas = $("Visitas pendientes recordatorio").all();
const vendedores = $("Datos del Vendedor").all();
const leads = $("Datos del Lead").all();
for (let i = 0; i < visitas.length; i++) {
  const v = visitas[i].json;
  const vendedor = vendedores[i] ? vendedores[i].json : {};
  const lead = leads[i] ? leads[i].json : {};
  if (!v.fecha || !v.hora) continue;
  const [hh, mm] = String(v.hora).split(":").map(Number);
  const fechaVisita = new Date(v.fecha + "T00:00:00");
  fechaVisita.setHours(hh || 0, mm || 0, 0, 0);
  const diffMin = (fechaVisita - ahora) / 60000;
  let tipo = null;
  if (diffMin > 1380 && diffMin <= 1500) tipo = "24h";
  else if (diffMin > 30 && diffMin <= 90) tipo = "1h";
  if (!tipo) continue;
  const telCliente = String(lead.telefono || "").replace(/\\\\D/g, "");
  const telVendedor = String(vendedor.telefono || "").replace(/\\\\D/g, "");
  const msgCliente = tipo === "24h" ? `Hola ${v.cliente_nombre}! Visita manana ${v.fecha} a las ${v.hora} hs en ${v.direccion} con ${v.vendedor_nombre}.` : `Hola ${v.cliente_nombre}! En 1 hora te esperamos en ${v.direccion}.`;
  const msgVendedor = tipo === "24h" ? `Manana ${v.hora} hs VISITA con ${v.cliente_nombre} en ${v.direccion}.` : `VISITA EN 1 HORA - ${v.cliente_nombre} - ${v.direccion} - ${v.hora} hs.`;
  out.push({ json: { visita_id: v.visita_id, lead_id: v.lead_id, telefono_cliente: telCliente, telefono_vendedor: telVendedor, msg_cliente: msgCliente, msg_vendedor: msgVendedor, tipo_recordatorio: tipo, cliente_nombre: v.cliente_nombre, vendedor_nombre: v.vendedor_nombre, direccion: v.direccion, fecha: v.fecha, hora: v.hora } });
}
return out;'''

W2 = {
  "name": "Bochile - Recordatorios de Visitas (cron)",
  "nodes": [
    {"id":"n2-1","name":"Cada hora","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.3,"position":[0,0],"parameters":{"rule":{"interval":[{"field":"hours","hoursInterval":1}]}}},
    {"id":"n2-2","name":"Visitas pendientes recordatorio","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[224,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['visitas'],'bochile_visitas'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"estado","condition":"eq","keyValue":"agendada"},{"keyName":"recordatorio_enviado","condition":"eq","keyValue":"false"}]},"returnAll":True},"alwaysOutputData":True},
    {"id":"n2-3","name":"Datos del Vendedor","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[448,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['empleados'],'bochile_empleados'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"empleado_id","condition":"eq","keyValue":"={{ $json.vendedor_id }}"}]},"returnAll":False,"limit":1},"alwaysOutputData":True},
    {"id":"n2-4","name":"Datos del Lead","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[672,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $(\"Visitas pendientes recordatorio\").item.json.lead_id }}"}]},"returnAll":False,"limit":1},"alwaysOutputData":True},
    {"id":"n2-5","name":"Filtrar y armar mensajes","type":"n8n-nodes-base.code","typeVersion":2,"position":[896,0],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":W2_CODE}},
    {"id":"n2-6","name":"WhatsApp Cliente","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[1120,0],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $json.telefono_cliente }}","messageType":"text","textBody":"={{ $json.msg_cliente }}"}},
    {"id":"n2-7","name":"WhatsApp Vendedor","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[1344,0],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $(\"Filtrar y armar mensajes\").item.json.telefono_vendedor }}","messageType":"text","textBody":"={{ $(\"Filtrar y armar mensajes\").item.json.msg_vendedor }}"}},
    {"id":"n2-8","name":"Marcar recordatorio enviado","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1568,0],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['visitas'],'bochile_visitas'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"visita_id","condition":"eq","keyValue":"={{ $(\"Filtrar y armar mensajes\").item.json.visita_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"recordatorio_enviado\": true, \"notificada_vendedor\": true }, \"matchingColumns\": [\"visita_id\"], \"schema\": [] }) }}"}},
    {"id":"n2-9","name":"Log accion recordatorio","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1792,0],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['acciones'],'bochile_acciones_ia'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"accion_id\": \"A-\" + $now.toMillis(), \"tipo\": \"recordatorio_visita\", \"agente\": \"Cron Recordatorios\", \"lead_id\": $(\"Filtrar y armar mensajes\").item.json.lead_id, \"resumen\": \"Recordatorio \" + $(\"Filtrar y armar mensajes\").item.json.tipo_recordatorio + \" enviado\", \"detalle\": \"V \" + $(\"Filtrar y armar mensajes\").item.json.visita_id, \"resultado\": \"enviado\", \"tiempo_ahorrado_min\": 3, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}}
  ],
  "connections": {
    "Cada hora":{"main":[[{"node":"Visitas pendientes recordatorio","type":"main","index":0}]]},
    "Visitas pendientes recordatorio":{"main":[[{"node":"Datos del Vendedor","type":"main","index":0}]]},
    "Datos del Vendedor":{"main":[[{"node":"Datos del Lead","type":"main","index":0}]]},
    "Datos del Lead":{"main":[[{"node":"Filtrar y armar mensajes","type":"main","index":0}]]},
    "Filtrar y armar mensajes":{"main":[[{"node":"WhatsApp Cliente","type":"main","index":0}]]},
    "WhatsApp Cliente":{"main":[[{"node":"WhatsApp Vendedor","type":"main","index":0}]]},
    "WhatsApp Vendedor":{"main":[[{"node":"Marcar recordatorio enviado","type":"main","index":0}]]},
    "Marcar recordatorio enviado":{"main":[[{"node":"Log accion recordatorio","type":"main","index":0}]]}
  },
  "settings": {"executionOrder":"v1"}
}

# ===== W3 MATCH RETROACTIVO =====
W3_CODE = '''const props = $("Propiedades publicadas recientes").all().map(i => i.json);
const matches = $("Matches pendientes activos").all().map(i => i.json);
const out = [];
for (const p of props) {
  for (const m of matches) {
    if (p.operacion !== m.operacion) continue;
    if (p.tipo !== m.tipo) continue;
    if (m.zona && p.zona && m.zona.toLowerCase() !== p.zona.toLowerCase()) continue;
    if (p.moneda !== m.moneda) continue;
    if (m.ambientes_min && p.ambientes < m.ambientes_min) continue;
    if (m.presupuesto_max && p.precio > m.presupuesto_max * 1.05) continue;
    if (m.presupuesto_min && p.precio < m.presupuesto_min * 0.9) continue;
    let scoreMatch = 60;
    if (p.zona && m.zona && p.zona.toLowerCase() === m.zona.toLowerCase()) scoreMatch += 15;
    if (p.precio <= m.presupuesto_max) scoreMatch += 10;
    if (p.ambientes >= (m.ambientes_min || 0)) scoreMatch += 5;
    const telefono = String(m.lead_telefono || "").replace(/\\\\D/g, "");
    const monedaSimbolo = p.moneda === "USD" ? "USD" : "$";
    const mensaje = `Hola ${m.lead_nombre}! Soy Camila de Bochile. Justo ingreso: ${p.titulo} en ${p.direccion}, ${monedaSimbolo} ${Number(p.precio).toLocaleString("es-AR")}. Tour: ${p.tour_360_url || ""}. La queres ver?`;
    out.push({ json: { match_id: m.match_id, prop_id: p.prop_id, lead_id: m.lead_id, lead_nombre: m.lead_nombre, telefono, mensaje, score_match: scoreMatch, titulo: p.titulo } });
  }
}
return out;'''

W3 = {
  "name": "Bochile - Match Retroactivo (cron)",
  "nodes": [
    {"id":"n3-1","name":"Cada 15 min","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.3,"position":[0,0],"parameters":{"rule":{"interval":[{"field":"minutes","minutesInterval":15}]}}},
    {"id":"n3-2","name":"Propiedades publicadas recientes","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[224,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['props'],'bochile_propiedades'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"publicada","condition":"eq","keyValue":"true"},{"keyName":"estado","condition":"eq","keyValue":"nueva"}]},"returnAll":True},"alwaysOutputData":True},
    {"id":"n3-3","name":"Matches pendientes activos","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[448,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['matches'],'bochile_matches_pendientes'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"activo","condition":"eq","keyValue":"true"}]},"returnAll":True},"alwaysOutputData":True},
    {"id":"n3-4","name":"Cruzar prop x match","type":"n8n-nodes-base.code","typeVersion":2,"position":[672,0],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":W3_CODE}},
    {"id":"n3-5","name":"WhatsApp Aviso al Lead","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[896,0],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $json.telefono }}","messageType":"text","textBody":"={{ $json.mensaje }}"}},
    {"id":"n3-6","name":"Desactivar match","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1120,0],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['matches'],'bochile_matches_pendientes'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"match_id","condition":"eq","keyValue":"={{ $(\"Cruzar prop x match\").item.json.match_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"activo\": false }, \"matchingColumns\": [\"match_id\"], \"schema\": [] }) }}"}},
    {"id":"n3-7","name":"Lead vuelve a Calificado IA","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1344,0],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['leads'],'bochile_leads'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"lead_id","condition":"eq","keyValue":"={{ $(\"Cruzar prop x match\").item.json.lead_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"etapa\": \"Calificado IA\", \"actualizado_en\": $now.toISO() }, \"matchingColumns\": [\"lead_id\"], \"schema\": [] }) }}"}},
    {"id":"n3-8","name":"Marcar prop como ofrecida","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1568,0],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['props'],'bochile_propiedades'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"prop_id","condition":"eq","keyValue":"={{ $(\"Cruzar prop x match\").item.json.prop_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"estado\": \"ofrecida\" }, \"matchingColumns\": [\"prop_id\"], \"schema\": [] }) }}"}},
    {"id":"n3-9","name":"Log Match Retroactivo","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1792,0],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['acciones'],'bochile_acciones_ia'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"accion_id\": \"A-\" + $now.toMillis(), \"tipo\": \"match_retroactivo\", \"agente\": \"Cron Matcher\", \"lead_id\": $(\"Cruzar prop x match\").item.json.lead_id, \"resumen\": \"Match notificado\", \"detalle\": \"Prop \" + $(\"Cruzar prop x match\").item.json.prop_id, \"resultado\": \"notificado\", \"tiempo_ahorrado_min\": 15, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}}
  ],
  "connections": {
    "Cada 15 min":{"main":[[{"node":"Propiedades publicadas recientes","type":"main","index":0}]]},
    "Propiedades publicadas recientes":{"main":[[{"node":"Matches pendientes activos","type":"main","index":0}]]},
    "Matches pendientes activos":{"main":[[{"node":"Cruzar prop x match","type":"main","index":0}]]},
    "Cruzar prop x match":{"main":[[{"node":"WhatsApp Aviso al Lead","type":"main","index":0}]]},
    "WhatsApp Aviso al Lead":{"main":[[{"node":"Desactivar match","type":"main","index":0}]]},
    "Desactivar match":{"main":[[{"node":"Lead vuelve a Calificado IA","type":"main","index":0}]]},
    "Lead vuelve a Calificado IA":{"main":[[{"node":"Marcar prop como ofrecida","type":"main","index":0}]]},
    "Marcar prop como ofrecida":{"main":[[{"node":"Log Match Retroactivo","type":"main","index":0}]]}
  },
  "settings": {"executionOrder":"v1"}
}

# ===== W4 COBRANZA =====
W4_CODE = '''const hoy = new Date();
const diaHoy = hoy.getDate();
const out = [];
for (const item of $input.all()) {
  const c = item.json;
  const diaV = Number(c.dia_vencimiento || 0);
  let accion = null;
  let diasParaPagar = 0;
  if (diaHoy === diaV - 5) accion = "recordatorio_5dias";
  else if (diaHoy === diaV - 1) accion = "recordatorio_manana";
  else if (diaHoy === diaV) accion = "vence_hoy";
  else if (diaHoy > diaV) { accion = "atrasado"; diasParaPagar = diaHoy - diaV; }
  if (!accion) continue;
  const moneda = c.moneda || "ARS";
  const monto = Number(c.monto_actual || 0);
  const monedaSimbolo = moneda === "USD" ? "USD" : "$";
  const montoFmt = monedaSimbolo + " " + monto.toLocaleString("es-AR");
  const tel = String(c.inquilino_telefono || "").replace(/\\\\D/g, "");
  const linkPago = `https://bochile.com.ar/pagar/${c.contrato_id}`;
  let mensaje;
  if (accion === "recordatorio_5dias") mensaje = `Hola ${c.inquilino_nombre}! El ${diaV} vence el alquiler de ${c.direccion} (${montoFmt}). ${linkPago}`;
  else if (accion === "recordatorio_manana") mensaje = `Hola ${c.inquilino_nombre}! Manana vence el alquiler de ${c.direccion} por ${montoFmt}. ${linkPago}`;
  else if (accion === "vence_hoy") mensaje = `Hola ${c.inquilino_nombre}! Hoy vence el alquiler de ${c.direccion} (${montoFmt}). ${linkPago}`;
  else mensaje = `Hola ${c.inquilino_nombre}, atraso ${diasParaPagar} dias (${montoFmt}). ${linkPago}`;
  out.push({ json: { contrato_id: c.contrato_id, accion, tel, mensaje, monto, moneda, direccion: c.direccion, inquilino_nombre: c.inquilino_nombre, dias_atraso: diasParaPagar, escalar: accion === "atrasado" && diasParaPagar >= 3 } });
}
return out;'''

W4 = {
  "name": "Bochile - Cobranza Alquileres (cron diario)",
  "nodes": [
    {"id":"n4-1","name":"Diario 9:00","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.3,"position":[0,0],"parameters":{"rule":{"interval":[{"field":"days","daysInterval":1,"triggerAtHour":9,"triggerAtMinute":0}]}}},
    {"id":"n4-2","name":"Contratos activos","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[224,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T['contratos'],'bochile_contratos'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"estado","condition":"eq","keyValue":"activo"}]},"returnAll":True},"alwaysOutputData":True},
    {"id":"n4-3","name":"Evaluar cada contrato","type":"n8n-nodes-base.code","typeVersion":2,"position":[448,0],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":W4_CODE}},
    {"id":"n4-4","name":"WhatsApp Inquilino","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[672,0],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $json.tel }}","messageType":"text","textBody":"={{ $json.mensaje }}"}},
    {"id":"n4-5","name":"Actualizar contrato","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[896,0],"parameters":{"resource":"row","operation":"update","dataTableId":dt(T['contratos'],'bochile_contratos'),"matchType":"allConditions","filters":{"conditions":[{"keyName":"contrato_id","condition":"eq","keyValue":"={{ $(\"Evaluar cada contrato\").item.json.contrato_id }}"}]},"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"dias_atraso\": $(\"Evaluar cada contrato\").item.json.dias_atraso, \"estado\": $(\"Evaluar cada contrato\").item.json.dias_atraso > 7 ? \"moroso\" : \"activo\" }, \"matchingColumns\": [\"contrato_id\"], \"schema\": [] }) }}"}},
    {"id":"n4-6","name":"Log accion cobranza","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1120,0],"parameters":{"resource":"row","operation":"insert","dataTableId":dt(T['acciones'],'bochile_acciones_ia'),"columns":"={{ ({ \"mappingMode\": \"defineBelow\", \"value\": { \"accion_id\": \"A-\" + $now.toMillis(), \"tipo\": \"cobranza_alquiler\", \"agente\": \"Cron Cobranza\", \"lead_id\": \"\", \"resumen\": \"Cobranza \" + $(\"Evaluar cada contrato\").item.json.accion, \"detalle\": \"Contrato \" + $(\"Evaluar cada contrato\").item.json.contrato_id, \"resultado\": $(\"Evaluar cada contrato\").item.json.escalar ? \"escalado\" : \"enviado\", \"tiempo_ahorrado_min\": 5, \"timestamp\": $now.toISO() }, \"matchingColumns\": [], \"schema\": [] }) }}"}},
    {"id":"n4-7","name":"Escalar a Bochile?","type":"n8n-nodes-base.if","typeVersion":2.3,"position":[1344,0],"parameters":{"conditions":{"options":{"caseSensitive":True,"leftValue":"","typeValidation":"strict"},"combinator":"and","conditions":[{"id":"c1","leftValue":"={{ $(\"Evaluar cada contrato\").item.json.escalar }}","rightValue":"","operator":{"type":"boolean","operation":"true","singleValue":True}}]}}},
    {"id":"n4-8","name":"Escalar a Carlos Bochile","type":"n8n-nodes-base.whatsApp","typeVersion":1.1,"position":[1568,0],"parameters":{"resource":"message","operation":"send","phoneNumberId":"={{ $env.BOCHILE_WA_PHONE_ID }}","recipientPhoneNumber":"={{ $env.BOCHILE_CARLOS_TEL }}","messageType":"text","textBody":"=ATRASO {{ $(\"Evaluar cada contrato\").item.json.dias_atraso }} DIAS - {{ $(\"Evaluar cada contrato\").item.json.contrato_id }} - {{ $(\"Evaluar cada contrato\").item.json.inquilino_nombre }}. Requiere decision humana."}}
  ],
  "connections": {
    "Diario 9:00":{"main":[[{"node":"Contratos activos","type":"main","index":0}]]},
    "Contratos activos":{"main":[[{"node":"Evaluar cada contrato","type":"main","index":0}]]},
    "Evaluar cada contrato":{"main":[[{"node":"WhatsApp Inquilino","type":"main","index":0}]]},
    "WhatsApp Inquilino":{"main":[[{"node":"Actualizar contrato","type":"main","index":0}]]},
    "Actualizar contrato":{"main":[[{"node":"Log accion cobranza","type":"main","index":0}]]},
    "Log accion cobranza":{"main":[[{"node":"Escalar a Bochile?","type":"main","index":0}]]},
    "Escalar a Bochile?":{"main":[[{"node":"Escalar a Carlos Bochile","type":"main","index":0}]]}
  },
  "settings": {"executionOrder":"v1"}
}

# ===== W5 SYNC DASHBOARD =====
def sync_pair(idx, x_pos, tbl_key, tbl_name, sheet_name, match_col):
    return [
        {"id":f"n5-r{idx}","name":f"{idx} - Leer {sheet_name}","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[x_pos,0],"parameters":{"resource":"row","operation":"get","dataTableId":dt(T[tbl_key],tbl_name),"returnAll":True},"alwaysOutputData":True},
        {"id":f"n5-w{idx}","name":f"{idx} - Volcar {sheet_name}","type":"n8n-nodes-base.googleSheets","typeVersion":4.7,"position":[x_pos+224,0],"parameters":{"resource":"sheet","operation":"appendOrUpdate","documentId":{"__rl":True,"mode":"id","value":"={{ $env.BOCHILE_GSHEET_ID }}"},"sheetName":{"__rl":True,"mode":"name","value":sheet_name},"columns":"={{ ({ \"mappingMode\": \"autoMapInputData\", \"value\": $json, \"matchingColumns\": [\""+match_col+"\"], \"schema\": [] }) }}","options":{"handlingExtraData":"insertInNewColumn"}}}
    ]

w5_pairs = [
    (1, 224, 'leads', 'bochile_leads', 'leads', 'lead_id'),
    (2, 672, 'props', 'bochile_propiedades', 'propiedades', 'prop_id'),
    (3, 1120, 'visitas', 'bochile_visitas', 'visitas', 'visita_id'),
    (4, 1568, 'contratos', 'bochile_contratos', 'contratos', 'contrato_id'),
    (5, 2016, 'empleados', 'bochile_empleados', 'empleados', 'empleado_id'),
    (6, 2464, 'matches', 'bochile_matches_pendientes', 'matches_pendientes', 'match_id'),
    (7, 2912, 'convs', 'bochile_conversaciones', 'conversaciones', 'msg_id'),
    (8, 3360, 'acciones', 'bochile_acciones_ia', 'acciones_ia', 'accion_id')
]

W5_nodes = [{"id":"n5-trig","name":"Cada 5 min","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.3,"position":[0,0],"parameters":{"rule":{"interval":[{"field":"minutes","minutesInterval":5}]}}}]
W5_conns = {"Cada 5 min":{"main":[[{"node":"1 - Leer leads","type":"main","index":0}]]}}

for p in w5_pairs:
    nodes = sync_pair(*p)
    W5_nodes.extend(nodes)
    W5_conns[f"{p[0]} - Leer {p[4]}"] = {"main":[[{"node":f"{p[0]} - Volcar {p[4]}","type":"main","index":0}]]}
    if p[0] < 8:
        next_p = w5_pairs[p[0]]
        W5_conns[f"{p[0]} - Volcar {p[4]}"] = {"main":[[{"node":f"{next_p[0]} - Leer {next_p[4]}","type":"main","index":0}]]}

W5 = {"name": "Bochile - Sync Dashboard a Google Sheets","nodes": W5_nodes,"connections": W5_conns,"settings": {"executionOrder":"v1"}}

# ===== UPLOAD =====
def upload(wf, tag):
    req = urllib.request.Request('http://localhost:5680/api/v1/workflows', data=json.dumps(wf).encode('utf-8'), headers={'X-N8N-API-KEY': KEY, 'Content-Type':'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as r:
            res = json.loads(r.read())
            print(f"OK {tag}: {res.get('id')} | {res.get('name')}")
    except urllib.error.HTTPError as e:
        print(f"ERROR {tag}: {e.code} {e.read().decode()[:500]}")

upload(W2, 'W2')
upload(W3, 'W3')
upload(W4, 'W4')
upload(W5, 'W5')
