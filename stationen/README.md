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
| `beispiele` | nein | Beispielbilder: `{ "bild": "bilder/….svg", "gut": true, "text": "…" }`, mit `"ganz": true` größer und unbeschnitten. Bilder liegen in `stationen/bilder/` |
| `video` | nein | YouTube-Video, lädt erst nach Antippen: `{ "youtube": "<11 Zeichen aus der Adresse>", "titel": "…", "quelle": "…" }` |
| `links` | nein | z. B. Erklärvideo: `{ "text": "…", "url": "…" }`. Ohne `url` wird der Link nicht angezeigt |
| `check` | ja | Was muss erledigt sein, bevor „Station beendet“ geht (siehe unten) |
| `eingaben` | nein | Textfelder: `{ "id": "…", "text": "Frage", "pflicht": true }`. Mit `"aufloesung": "…"` zeigt die App nach „Station beendet“ die richtige Antwort, mit `"ueberschrift": "KI und Ethik"` steht eine Überschrift über der Frage |
| `ankuendigung` | nein | Kasten vor dem Input: Was passiert gleich (z. B. „BodyPix sucht dich“), mit aufklappbarer Erklärung Programm / KI / generative KI |
| `ersatz` | nein | Nur Foto-Station: Porträts bekannter Personen für Kinder ohne Foto-Einwilligung, `{ "id", "name", "bild", "quelle", "seite" }`, Lizenzen in `bilder/ersatz/README.md` |
| `fragen` | ja | am Ende: `ki-typ` („Programm, KI oder generative KI?“) und/oder `sterne` (1–5) |
| `datenschutz` | ja | ein Satz: Was passiert mit den Daten dieser Station? |
| `braucht` | ja | Stationen, die vorher fertig sein müssen, z. B. `["foto"]`. Gibt es eine davon (noch) nicht, zählt sie nicht |
| `hintergruende` | nein | nur Station Hintergrund: `{ "datei": "bilder/hintergruende/….jpg", "titel": "…" }`, Lizenzen in `bilder/hintergruende/README.md` |
| `plaetze` | ja | wie viele Gruppen gleichzeitig an der Station sein können |
| `bonus` | nein | `true`: zählt nicht zu „x von y“ und nicht fürs Puzzle |
| `optional` | nein | `true`: freiwillig (z. B. Claude-Stationen, nur mit Einwilligung). Zählt nicht zu „x von y“, wird nur vorgeschlagen, wenn keine andere Station frei ist |
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

1. nur Stationen, die noch nicht fertig sind und deren `braucht` erfüllt ist (frisch aus dem Speicher, auch wenn ein anderer Tab etwas geändert hat)
2. davon bevorzugt Stationen mit freien Plätzen (der Laptop zählt eingecheckte Gruppen und Gruppen, die gerade dorthin unterwegs sind)
3. Stationen mit `"vorrang": true` (stencil.me, Lasercutter) zuerst, solange sie Platz haben: Alle fangen damit an, damit die Holzplatte schnell voll ist
4. sonst unter den freien eine zufällige (optionale nur, wenn sonst keine frei ist); ist keine frei, die mit den wenigsten Gruppen

Das iPad meldet den Vorschlag an den Laptop (`/api/unterwegs`). Der Platz zählt dann bis zum nächsten Check-in der Gruppe, höchstens 10 Minuten, als besetzt. Ohne Laptop zählt nur Schritt 1, 3 und 4.

Scannt eine Gruppe eine Station, deren `braucht` fehlt, nennt die App, was fehlt, und schlägt eine andere Station vor. Ist eine Station voll, erscheint ein Hinweis mit Vorschlag und dem Knopf „Wir sind trotzdem dran“ (keine Sperre).
