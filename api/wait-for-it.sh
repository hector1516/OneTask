#!/bin/sh
# wait-for-it.sh — espera a MySQL antes de arrancar el API.
# Uso: ./wait-for-it.sh host:port --timeout=120 -- <cmd>
set -e
HOSTPORT="$1"
shift
TIMEOUT=60
CMD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --timeout=*) TIMEOUT="${1#--timeout=}"; shift ;;
    --) shift; CMD="$*"; break ;;
    *) shift ;;
  esac
done
HOST="${HOSTPORT%%:*}"
PORT="${HOSTPORT##*:}"
echo "wait-for-it: esperando $HOST:$PORT (timeout ${TIMEOUT}s)..."
i=0
while ! (echo > "/dev/tcp/$HOST/$PORT") >/dev/null 2>&1; do
  # /dev/tcp no existe en sh minimalista; fallback a node
  if node -e "require('net').connect({host:'$HOST',port:$PORT},()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  i=$((i+1))
  if [ "$i" -ge "$TIMEOUT" ]; then
    echo "wait-for-it: timeout esperando $HOST:$PORT" >&2
    exit 1
  fi
  sleep 1
done
echo "wait-for-it: $HOST:$PORT disponible."
exec sh -c "$CMD"
