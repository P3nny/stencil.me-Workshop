#!/bin/bash
# Startet den stencil.me Workshop-Server und öffnet die Übersicht am Laptop.
# Aufruf: im Terminal  ./server/start.sh
# Der Laptop geht nicht in den Ruhezustand, solange das Fenster offen ist.

cd "$(dirname "$0")/.." || exit 1
PORT=8000

# Übersicht im Browser öffnen, sobald der Server bereit ist
(
  for _ in $(seq 1 20); do
    if curl -s -o /dev/null "http://localhost:$PORT/api/status"; then
      xdg-open "http://localhost:$PORT/laptop" >/dev/null 2>&1
      exit 0
    fi
    sleep 0.5
  done
) &

# Mit der KI-Bibliothek, falls eingerichtet (./server/einrichten.sh), sonst ohne
PYTHON=python3
if [ -x "$HOME/.cache/stencilme-venv/bin/python" ]; then
  PYTHON="$HOME/.cache/stencilme-venv/bin/python"
fi

if command -v systemd-inhibit >/dev/null 2>&1; then
  systemd-inhibit --what=sleep:idle --who="stencil.me" --why="Workshop-Server läuft" \
    "$PYTHON" server/server.py --port "$PORT"
else
  "$PYTHON" server/server.py --port "$PORT"
fi

echo
read -r -p "Server beendet. Enter drücken zum Schließen." _
