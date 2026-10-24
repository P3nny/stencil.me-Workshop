# Stationen

Eine Datei pro Station. Inhalt als Daten, nicht im Code: Texte hier ändern, die App übernimmt sie beim nächsten Laden.

`index.json` legt fest, welche Stationen es gibt und in welcher Reihenfolge die Puzzleteile stehen.

## Felder

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | ja | kurzer Name, gleich wie der Dateiname (`foto` → `foto.json`) |
| `titel` | ja | Überschrift in der App |
| `typ` | ja | `programm`, `ki`, `generativ` oder `analog` (Etikett an der Station) |
| `datenweg` | ja | `ipad`, `laptop` oder `online` (Etikett an der Station) |
| `schritte` | ja | höchstens 5, je ein kurzer Satz |
| `links` | nein | z. B. Erklärvideo: `{ "text": "…", "url": "…" }`. Ohne `url` wird der Link nicht angezeigt |
| `check` | ja | Was muss erledigt sein, bevor „Station beendet“ geht (siehe unten) |
| `eingaben` | nein | Textfelder: `{ "id": "…", "text": "Frage", "pflicht": true }` |
| `fragen` | ja | am Ende: `ki-typ` („Programm, KI oder generative KI?“) und/oder `sterne` (1–5) |
| `datenschutz` | ja | ein Satz: Was passiert mit den Daten dieser Station? |
| `braucht` | ja | Stationen, die vorher fertig sein müssen, z. B. `["foto"]` |
| `plaetze` | ja | wie viele Gruppen gleichzeitig an der Station sein können |

## `check`

| `art` | Bedeutung |
| --- | --- |
| `foto` | Foto aufnehmen. `proPerson: true`: ein Foto pro Person. `hochladen: false`: bleibt auf dem iPad. `text`: Hinweis |
| `text` | nur die `eingaben` müssen ausgefüllt sein |
| `quiz` | Quiz öffnen (`url`), danach „Quiz geschafft“ antippen |
| `bestaetigung` | „Erledigt“ antippen |
| `stempel`, `greenscreen` | eigene Seite, wird in Screen 3 bzw. 5 gebaut. Bis dahin: „Erledigt“ antippen |

## Nächste Station

Nach „Station beendet“ schlägt die App die nächste Station vor:

1. nur Stationen, die noch nicht fertig sind und deren `braucht` erfüllt ist
2. davon bevorzugt Stationen mit freien Plätzen (der Laptop zählt mit)
3. unter den freien eine zufällige; ist keine frei, die mit den wenigsten Gruppen

Ohne Laptop zählt nur Schritt 1 und 3.
