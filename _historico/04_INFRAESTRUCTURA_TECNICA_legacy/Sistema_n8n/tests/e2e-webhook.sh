#!/usr/bin/env bash
# Pruebas E2E del W1 (Chatbot Multi-Agente CORE) via webhook directo.
#
# Manda 5 mensajes simulados al webhook publico de n8n y verifica que cada uno
# llegue al Sheet (pestania conversaciones).
#
# NO necesita Twilio porque pega directo al webhook con el payload simple
# (el W1 acepta ambos formatos: payload Meta/Twilio y payload simple de test).
#
# Uso:
#   bash e2e-webhook.sh                                  # corre todos los tests
#   bash e2e-webhook.sh --base http://localhost:5680     # otro host
#   bash e2e-webhook.sh --wait 45                        # mas espera entre msgs (default 30s)

set -uo pipefail

BASE_URL="http://localhost:5680"
WAIT_SECONDS=30
DASHBOARD_URL="http://localhost:3002"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE_URL="$2"; shift 2 ;;
    --wait) WAIT_SECONDS="$2"; shift 2 ;;
    --dashboard) DASHBOARD_URL="$2"; shift 2 ;;
    *) echo "Flag desconocido: $1"; exit 1 ;;
  esac
done

WEBHOOK="$BASE_URL/webhook/bochile-chat"

echo "============================================="
echo "  Bochile E2E Tests - W1 webhook"
echo "============================================="
echo "  Webhook:   $WEBHOOK"
echo "  Dashboard: $DASHBOARD_URL"
echo "  Wait:      ${WAIT_SECONDS}s entre mensajes (Camila tarda en procesar)"
echo ""

# Cada test es: ID | tel | nombre | mensaje | expectativa_keyword
TESTS=(
  "T01|+5492914900001|Lucas E2E|Hola Camila, busco casa en Bahia Blanca, 3 ambientes, hasta 200 mil USD|casa"
  "T02|+5492914900002|Maria E2E|Quiero alquilar un depto chico cerca del centro|alquil"
  "T03|+5492914900003|Pedro E2E|Tienen algo en Monte Hermoso para invertir? Soy serio comprador|monte"
  "T04|+5492914900004|Ana E2E|Hola, queria saber el precio del lote de avenida Colon 1100|lote"
  "T05|+5492914900005|Jose E2E|Buenas tardes, queria preguntar si tienen propiedades comerciales en venta|comerc"
)

PASS=0
FAIL=0
RESULTS=()

for test in "${TESTS[@]}"; do
  IFS="|" read -r ID TEL NOMBRE MSG EXPECT <<< "$test"
  echo "[$ID] $NOMBRE → $MSG"

  PAYLOAD=$(cat <<EOF
{"from":"$TEL","name":"$NOMBRE","message":"$MSG","channel":"whatsapp"}
EOF
)

  http_code=$(curl -s -o /tmp/e2e-$ID.out -w "%{http_code}" \
    -X POST "$WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" --max-time 5)

  if [[ "$http_code" != "200" ]]; then
    echo "  ❌ webhook HTTP $http_code"
    FAIL=$((FAIL+1))
    RESULTS+=("$ID FAIL webhook")
    continue
  fi

  echo "  → webhook OK, esperando ${WAIT_SECONDS}s para que Camila procese..."
  sleep "$WAIT_SECONDS"

  # Buscar el mensaje en /api/conversaciones
  lead_id="L-${TEL:1}"
  lead_id="${lead_id//\+}"
  found=$(curl -s "$DASHBOARD_URL/api/conversaciones" | \
    node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{ try { const arr = JSON.parse(s); const found = arr.filter(c => (c.telefono+'').includes('$TEL'.replace('+',''))); console.log(found.length); } catch(e) { console.log(0); } })")

  if [[ "$found" -gt 0 ]]; then
    echo "  ✓ $found mensaje(s) en conversaciones para $TEL"
    PASS=$((PASS+1))
    RESULTS+=("$ID PASS ($found msgs)")
  else
    echo "  ❌ no se encontraron mensajes en conversaciones"
    FAIL=$((FAIL+1))
    RESULTS+=("$ID FAIL no-trace")
  fi
done

echo ""
echo "============================================="
echo "  RESUMEN"
echo "============================================="
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo ""
echo "  $PASS pasados / $FAIL fallaron de ${#TESTS[@]} tests"

exit $FAIL
