#!/bin/bash
# Richtet einmalig die KI für die Station „Selbstporträts mit KI neu erschaffen“ ein.
# Aufruf: im Terminal  ./server/einrichten.sh   (braucht Internet)
# Danach startet ./server/start.sh den Server automatisch mit der KI.

cd "$(dirname "$0")/.." || exit 1
VENV="$HOME/.cache/stencilme-venv"

python3 -m venv "$VENV" || exit 1
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r server/requirements.txt || exit 1
echo "Bibliothek installiert."

if [ ! -s "$HOME/.config/stencilme/anthropic-key" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo
  echo "Noch kein API-Schlüssel. Schlüssel aus der Claude Console einfügen (unsichtbar), dann Enter:"
  mkdir -p "$HOME/.config/stencilme"
  read -rs k
  printf '%s' "$k" > "$HOME/.config/stencilme/anthropic-key"
  unset k
  chmod 600 "$HOME/.config/stencilme/anthropic-key"
  echo "Schlüssel gespeichert in ~/.config/stencilme/anthropic-key"
fi
echo "Fertig. Server starten mit ./server/start.sh"
