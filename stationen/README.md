# Stationen

Eine Datei pro Station. Inhalt als Daten, nicht im Code: Texte hier ändern, die App übernimmt sie beim nächsten Laden.

`index.json` legt fest, welche Stationen es gibt und in welcher Reihenfolge die Puzzleteile stehen.

## Felder

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | ja | kurzer Name, gleich wie der Dateiname (`foto` → `foto.json`) |
| `titel` | ja | Überschrift in der App |
| `typ` | ja | `programm`, `ki`, `generativ` oder `analog` (Etikett an der Station) |
| `datenweg` | ja | `ipad`, `laptop`, `laptop-video` (Laptop, dazu ein YouTube-Video) oder `online` (Etikett an der Station) |
| `schritte` | ja | höchstens 5, je ein kurzer Satz |
| `beispiele` | nein | Beispielbilder: `{ "bild": "bilder/….svg", "gut": true, "text": "…" }`. Bilder liegen in `stationen/bilder/` |
| `video` | nein | YouTube-Video, lädt erst nach Antippen: `{ "youtube": "<11 Zeichen aus der Adresse>", "titel": "…", "quelle": "…" }` |
| `links` | nein | z. B. Erklärvideo: `{ "text": "…", "url": "…" }`. Ohne `url` wird der Link nicht angezeigt |
| `check` | ja | Was muss erledigt sein, bevor „Station beendet“ geht (siehe unten) |
| `eingaben` | nein | Textfelder: `{ "id": "…", "text": "Frage", "pflicht": true }`. Mit `"aufloesung": "…"` zeigt die App nach „Station beendet“ die richtige Antwort |
| `fragen` | ja | am Ende: `ki-typ` („Programm, KI oder generative KI?“) und/oder `sterne` (1–5) |
| `datenschutz` | ja | ein Satz: Was passiert mit den Daten dieser Station? |
| `braucht` | ja | Stationen, die vorher fertig sein müssen, z. B. `["foto"]`. Gibt es eine davon (noch) nicht, zählt sie nicht |
| `hintergruende` | nein | nur Station Hintergrund: `{ "datei": "bilder/hintergruende/….jpg", "titel": "…" }`, Lizenzen in `bilder/hintergruende/README.md` |
| `plaetze` | ja | wie viele Gruppen gleichzeitig an der Station sein können |
| `bonus` | nein | `true`: zählt nicht zu „x von y“ und nicht fürs Puzzle |
| `mindestFertig` | nein | Bonus geht erst auf, wenn so viele Stationen geschafft sind |

## `check`

| `art` | Bedeutung |
| --- | --- |
| `foto` | Foto aufnehmen. `proPerson: true`: ein Foto pro Person. `hochladen: false`: bleibt auf dem iPad. `personPruefen: true`: KI (BodyPix) prüft, ob eine Person zu sehen ist. `text`: Hinweis |
| `text` | nur die `eingaben` müssen ausgefüllt sein |
| `quiz` | Quiz-Seite (`url`, z. B. `/code-quiz.html`) eingebettet, sie meldet am Ende ihr Ergebnis. Mit `foto` (wie bei `art: foto`) zusätzlich Fotos, z. B. Lieblingswerk |
| `sticker` | wie `stempel`, aber Sticker für den Schneideplotter (nicht gespiegelt), landet auf dem Laptop im Ordner `sticker` |
| `bestaetigung` | „Erledigt“ antippen |
| `stempel` | stencil.me: Schritte pro Person, Schnittrand, Stempel an den Laptop (`app/stationen/stencilme.js`) |
| `koerpererkennung` | Video aufnehmen, BodyPix rechnet live auf dem Video, Regler, Aufgaben (`aufgaben`, mindestens `mindestAufgaben` abhaken), Bild der KI-Ansicht an den Laptop (`app/stationen/koerpererkennung.js`) |
| `pixel-vektor` | Erklärung (`erklaerung`) mit Infografik, Verständnisfragen (`verstaendnis`, alle richtig), dann SVG-Übung im Code-Editor (`app/core/code-editor.js`): `uebung.vorlage` ist der Code mit Lücken `{{id}}` (Startwerte in `luecken`) und Bausteinen `[[id]]` (in `bausteine`), `aufgaben` kommen eine nach der anderen. Der Code geht beim Beenden an den Laptop (`app/stationen/pixel-vektor.js`) |
| `coding-web` | HTML, CSS und JavaScript im Code-Editor (`uebung` wie bei `pixel-vektor`: `vorlage` mit Lücken `{{id}}` und Bausteinen `[[id]]`), Vorschau als echte kleine Webseite (`app/stationen/coding-web.js`) |
| `ki-selbstportraet` | Prompt-Baukasten (`ki.baukasten`, Satz in `ki.satz`), Laptop fragt Claude (`server/ki_bild.py`), höchstens `ki.proGruppe` Bilder, mindestens `ki.mindestBilder` in `ki.mindestStile` Stilen. Ohne KI: `ki.beispiele` (`app/stationen/ki-selbstportraet.js`) |
| `hintergrund` | Hintergrund ändern: Foto freistellen, Hintergrund aus `hintergruende` wählen, Bild an den Laptop (`app/stationen/hintergrund.js`) |

## Nächste Station

Nach „Station beendet“ schlägt die App die nächste Station vor:

1. nur Stationen, die noch nicht fertig sind und deren `braucht` erfüllt ist
2. davon bevorzugt Stationen mit freien Plätzen (der Laptop zählt mit)
3. unter den freien eine zufällige; ist keine frei, die mit den wenigsten Gruppen

Ohne Laptop zählt nur Schritt 1 und 3.
