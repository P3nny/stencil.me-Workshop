# Notfallkarte

Ausdrucken und neben den Laptop legen. Ruhig bleiben: Es gibt immer einen Plan B.

| Wenn … | dann … |
| --- | --- |
| iPads finden die Seite auf dem Laptop nicht | Laptop im richtigen WLAN? Terminal-Fenster mit dem Server offen? Sonst `./server/start.sh` neu starten. Hilft das nicht: **Plan B**, Netlify-QR-Code zeigen |
| „An Laptop senden“ klappt nicht | Stempel ist auf dem iPad gespeichert. Später nochmal senden oder **„Teilen“** → Pairdrop |
| App hängt oder stürzt ab | App schließen und neu öffnen. Der letzte Stand ist auf dem iPad gespeichert. Hilft das nicht: laminierte Karte, Foto per Pairdrop (**Plan C**) |
| Foto ohne Person / nur Hintergrund | Neues Foto machen: Gesicht groß, heller Hintergrund |
| Laptop aus oder Akku leer | Netzteil, dann `./server/start.sh`. Bis dahin arbeiten die iPads weiter, die Stempel werden automatisch nachgesendet |
| Mr Beam nicht erreichbar | Stempel auf dem Laptop sammeln, auf USB-Stick, später lasern. Drucken mit Beispielstempeln, falls vorhanden |
| Gar nichts geht | Workshop mit laminierten Karten wie früher (**Plan C**) |

## Adressen

- Plan A (Laptop): `http://__________:8000`
- Plan B (Netlify): `https://stencilme-workshop.netlify.app`
- Mr Beam: `http://__________`

## Versteckte Funktionen (für die Leitung)

- `?extras` an die Adresse hängen: Bild (Positiv) und Sticker, nur wenn Zeit bleibt. Beispiel: `http://__________:8000/?extras`
- `?test`: Knopf „Test-Foto verwenden“ zum Ausprobieren ohne Kamera
