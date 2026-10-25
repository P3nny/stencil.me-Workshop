# Notfallkarte

Ausdrucken und neben den Laptop legen. Ruhig bleiben: Es gibt immer einen Plan B.

| Wenn … | dann … |
| --- | --- |
| iPads finden die Seite auf dem Laptop nicht | Laptop im richtigen WLAN? Terminal-Fenster mit dem Server offen? Sonst `./server/start.sh` neu starten. Hilft das nicht: **Plan B**, Netlify-QR-Code zeigen |
| iPad zeigt „… noch nicht beim Laptop“ | Nichts tun: Alles ist auf dem iPad gespeichert, die App sendet von selbst nach, sobald der Laptop wieder erreichbar ist |
| Laptop-Seite zeigt pinken Neustart-Hinweis | Terminal: Server mit Strg+C beenden, `./server/start.sh` neu starten. Die iPads arbeiten weiter |
| Claude-Stationen: „KI nicht erreichbar“ | Die Stationen zeigen Beispiele und lassen sich trotzdem beenden. Sie sind optional: Gruppe zu einer anderen Station schicken |
| Puzzle oder Zähler stimmt nicht | Zur Startseite wechseln oder die Station neu laden. Nichts löschen |
| App hängt oder stürzt ab | App schließen und neu öffnen. Der letzte Stand ist auf dem iPad gespeichert. Hilft das nicht: laminierte Karte, Foto per Pairdrop (**Plan C**) |
| Kind ohne Foto-Einwilligung sieht trotzdem die Kamera | Laptop-Seite: In der Gruppen-Tabelle „📷 Name: Foto ok“ antippen (wird gelb), dann Foto-Station neu laden. Ohne Laptop (Plan B/C): kein Foto, Porträt aus `stationen/bilder/ersatz/` nehmen |
| Foto ohne Person / nur Hintergrund | Neues Foto machen: Gesicht groß, heller Hintergrund |
| Laptop aus oder Akku leer | Netzteil, dann `./server/start.sh`. Bis dahin arbeiten die iPads weiter, die Stempel werden automatisch nachgesendet |
| Mr Beam nicht erreichbar | Stempel auf dem Laptop sammeln, auf USB-Stick, später lasern. Drucken mit Beispielstempeln, falls vorhanden |
| Gar nichts geht | Workshop mit laminierten Karten wie früher (**Plan C**) |

## Adressen

- Plan A (Laptop): `http://__________:8000`
- Plan B (Netlify): `https://stencilme-workshop.netlify.app`
- Mr Beam: `http://__________`

## Versteckte Funktionen (für die Leitung)

- stencil.me direkt (ohne Stationen): `http://__________:8000/stencil.html`
- `?extras` an diese Adresse hängen: Bild (Positiv) und Sticker, nur wenn Zeit bleibt. Beispiel: `http://__________:8000/stencil.html?extras`
- `?test`: in `stencil.html` Knopf „Test-Foto verwenden“, in den Stationen „Test-Gruppe anlegen“ und „Alles zurücksetzen“
