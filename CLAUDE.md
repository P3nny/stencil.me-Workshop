# Workshop: Vom Selfie zum Lasercut-Stempel (stencil.me)

## Worum es geht

Workshop für Jugendliche im Kommunalen Medienzentrum (KOMEZ), Leitung: Patricia Ennenbach.
Thema: Wie KI und Algorithmen digitale Bildbearbeitung verändern. Vom Selfie über Stationen zum Lasercut-Stempel.

- Gruppe: höchstens 26 Schüler:innen = 13 Paare = **13 iPads** (ungerade Zahl: eine Person allein). Alter: 7. bis 11. Klasse, Zeit für den Workshop: 4 Stunden.
- Browser: **Safari als Home-Bildschirm-App** („Zum Home-Bildschirm“, Vollbild, stabilere Speicherung). Chrome auf iOS nutzt ebenfalls die WebKit-Engine und ist nur Fallback. Es gelten dieselben Grenzen (Kamera nur mit HTTPS, Speicherlimits, Alter der iPadOS-Version). TODO: mit dem Medienzentrum klären, ob Safari auf den verwalteten iPads erlaubt ist. Die Seite wird in der Vorbereitung auf jedem iPad einmal aufgerufen und eingerichtet (Kamera-Freigabe, Modelle laden).
- Bisher: laminierte Stationenkarten (PDFs im Repo, `01`–`07`), Kamera/Übertragung per Pairdrop, Canva (privates Konto), Claude im Chat.
- Ziel: **eine zentrale Workshop-App** auf den iPads. Sie führt die Paare durch alle Stationen, prüft den Fortschritt, sammelt Ergebnisse und Antworten. Die laminierten Karten bleiben Ergänzung vor Ort.

## Ziel-Ablauf (Maker-Teil, verbindlich)

Der Maker-Teil ist **vorgegeben**, damit die Kinder weniger Entscheidungen treffen müssen:

1. Foto aufnehmen (in der App)
2. stencil.me-Bildbearbeitung (auf dem Gerät)
3. Ergebnis: **Negativ-Stempel** für den Mr Beam Lasercutter
4. Laser: **2× gravieren** auf A4-Pappelsperrholz (möglichst viele Stempel pro Platte)
5. Mit Linolfarbe zu einer **Postkarte** drucken

Optional, nur wenn Zeit bleibt: Sticker (Cameo/Cricut), Lasercut-Porträt, Positivdruck. Nie vor dem Pflichtweg anbieten.

## Zielgruppe und Ton

- Texte für Jugendliche: kurz, klar, direkt ansprechen (Du), keine Fachwörter ohne Erklärung.
- Pro Schritt eine Handlung, keine Textwände. Jugendliche lesen kaum: Bilder, Icons, kurze Sätze.
- Sprache: Deutsch.

## Begriffe (verbindlich, in App, Karten und Datenschutz.md gleich benutzen)

Drei Stufen, jede mit Beispiel aus dem Workshop:

| Stufe                        | Merksatz                                                                           | Beispiel im Workshop                             |
| ---------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Computerprogramm**         | Feste Regeln, gleiche Eingabe gibt immer gleiche Ausgabe                           | Schwellenwert (Otsu), SVG-Export, Laser          |
| **KI (Bildbearbeitungs-KI)** | Hat aus Beispielen gelernt, erkennt oder verändert dein Bild, erzeugt nichts Neues | BodyPix (Person erkennen), Hintergrund entfernen |
| **Generative KI**            | Erzeugt neue Inhalte, gleicher Prompt gibt jedes Mal etwas anderes                 | KI-Selbstporträt, Claude (Code)                  |

- Deterministisch heißt nicht „keine KI“: BodyPix ist KI und liefert bei gleichem Foto das gleiche Ergebnis.
- An jeder Station steht ein Etikett: Typ (Programm / KI / generativ) und Datenweg (bleibt auf dem iPad / geht an den Workshop-Server / geht an einen Online-Dienst).
- Fragen an die Kinder: „Hast du hier gerade generative KI oder Bildbearbeitungs-KI genutzt?“ und „Wie gut hat dir die Station gefallen?“

## Ist-Zustand des Repos

- `index.html`: stencil.me-Workshop-App (Foto → BodyPix → Schwarz-Weiß → SVG). Eine einzelne, große Datei (ca. 500 KB, Bilddaten eingebettet).
- `code-quiz.html`, `kunst-quiz.html`: eigenständige Quizseiten.
- PDFs: Startpräsentation, Stationenkarten, Künstler:innen, Berufe, Abschluss, QR-Code Kunstquiz.
- `/archiv/` ist in `.gitignore`: dort liegt lokal die `fotobox-karte` (Flask-Queue `fotobox-queue.py`, Plotter-Anbindung) als Vorbild für Foto-Übertragung und Server-Queue. **Nicht ins Repo committen.** Wenn du dort lesen musst, frag nach dem Pfad.
- TF.js, BodyPix-Modell und Schriften liegen lokal in `vendor/` (Versionen und Lizenzen: `vendor/README.md`). `index.html` lädt nichts mehr aus dem Internet.

## Repo-Struktur (Zielbild, bei Bedarf anpassen)

```
index.html            Einstieg der Workshop-App (Anmeldung, Stationsübersicht)
app/core/             gemeinsamer Kern (Foto, Personenerkennung, Schwarz-Weiß, SVG)
app/lasercut-stempel/ Pflichtweg: Negativ-Stempel für den Mr Beam
app/lasercut-portraet/ optional
app/schneideplotter/  optional (Sticker)
stationen/            eine Datei pro Station (Inhalt als Daten, nicht im Code)
vendor/               lokale Kopien aller Bibliotheken und Modelle (BodyPix, TF.js, Schriften)
server/               lokaler Workshop-Server (Python/Flask), siehe unten
docs/                 Entscheidungen, Testprotokolle, Aufbau-Checkliste
Datenschutz.md        Datenschutzinformation für Lehrkräfte, Eltern und Kinder
```

## Aufbau einer Station

Jede Station ist eine Datei in `stationen/` mit festen Feldern:

- `id`, `titel`, `typ` (programm | ki | generativ | analog), `datenweg`
- `schritte`: maximal 5, jeweils ein Satz
- `check`: wie die App prüft, dass die Station absolviert ist (Bestätigung, Foto-Upload, Quiz bestanden)
- `eingaben` (optional): Textantworten, Foto-Upload (z. B. Lieblingskünstlerin, eigener Linoldruck)
- `fragen`: Pflichtfragen „generative oder Bildbearbeitungs-KI?“ und Bewertung (1–5 Sterne)
- `datenschutz`: ein Satz, was mit den Daten dieser Station passiert

Bestehende Stationen (aus `02_stencil.me-Stationen.pdf`) sinngemäß übernehmen: Foto, stencil.me, Kunstprojekt (Cameo), Lasercutter, Schneideplotter, Hintergrund ändern, Körpererkennung, Pixel vs. Vektor, Coding (SVG, HTML/CSS, JavaScript), KI-Selbstporträts, Mit der Hand drucken, Bild-App vibe coden, Code-Erklärung, Künstler:innen, Streetart, Berufe, Kunst- und Code-Quiz.

## Anmeldung und Fortschritt

- Anmeldung **paarweise**, Einzelperson muss ebenfalls möglich sein (ungerade Zahl).
- Datensparsam: Vornamen oder Kürzel/Emoji, keine Nachnamen, keine Mailadressen im Pflichtweg.
- Die App führt durch alle Stationen, zeigt den Fortschritt und schaltet erst nach dem Check weiter.

## Webapp-Regeln

- Reines HTML/CSS/JS, keine Frameworks, kein Build-Tool, **keine externen CDNs, Schriften oder Tracker**. Alles liegt lokal in `vendor/`.
- Muss mit Touch auf älteren Schul-iPads laufen (TODO: iOS-/iPadOS-Version und Modell klären). Bis dahin vorsichtig mit neuer Syntax (`?.`, `??`, Top-Level-await) und neuen Web-APIs.
- **Stabilität vor Funktion:** Die App ist auf den iPads im Medienzentrum mehrfach abgestürzt, u. a. bei einem Foto ohne Person (0 % erkannt). Maßnahmen: Bilder vor der Verarbeitung auf höchstens 1024 px verkleinern, BodyPix mit `internalResolution: "medium"`, leere Maske abfangen (Fallback aufs ganze Bild), Fehler anzeigen statt abstürzen.
- **Offline-first:** Jeder Zwischenstand (Anmeldung, Antworten, Fotos, Ergebnisse) wird sofort lokal in IndexedDB gespeichert. Der Upload zum Server läuft über eine Warteschlange („Outbox“) mit Wiederholung und eindeutiger ID pro Eintrag, damit nichts verloren geht und nichts doppelt ankommt. Die App zeigt klar: „gesichert auf dem iPad / gesichert auf dem Server“.
- Die App muss auch ohne Server benutzbar bleiben (Server-Ausfall darf den Workshop nicht stoppen).
- Service Worker nur in Safari einplanen (dort seit iOS 11.3 verfügbar) und erst nach Test auf einem echten iPad darauf verlassen. Unabhängig davon gilt: Seite in der Vorbereitung laden, offen lassen, nicht neu laden, Zwischenstände in IndexedDB. Neuladen offline darf nicht nötig sein. In Chrome auf iOS keine Service Worker voraussetzen.
- Lastgrenze: 13 iPads gleichzeitig am Server, ca. 13 Stempel pro Workshop (ein bis zwei A4-Platten).
- Rechenarbeit (Bildverarbeitung, Personenerkennung) findet **auf dem iPad** statt. Der Server nimmt Ergebnisse nur entgegen.

## Datenschutz (nicht verhandelbar)

- Fotos von Jugendlichen werden zuerst nur auf dem Gerät verarbeitet. Zum lokalen Server geht nur, was für Laser und Ergebnis-Mappe nötig ist (Stempel-Datei, vom Kind hochgeladene Ergebnisse).
- **Kein Foto und kein Prompt eines Kindes geht an einen Online-Dienst**, ohne dass es in `Datenschutz.md` steht und Einwilligungen vorliegen. Das gilt auch für KI-Funktionen.
- Der Workshop-Server ist Patricias Laptop im KOMEZ-WLAN und nimmt nur Stempel-Dateien an. Er gibt nichts an Online-Dienste weiter.
- Daten werden nach dem Workshop gelöscht. Abgabe der Ergebnisse als ZIP (USB-Stick an die Lehrkraft, Weg noch zu prüfen).
- `/archiv/Datenschutz.md` ist ein Pflicht-Ergebnis: kindgerecht verständlich, geht vorab an Lehrkräfte und Erziehungsberechtigte, Kinder sollen es selbst lesen, verstehen und hinterfragen können. Es erklärt den Datenweg pro Station und den Unterschied Programm / KI / generative KI. Bei jeder Änderung an Datenflüssen aktualisieren. Bis zum eigenen Datenschutz-Schritt (Roadmap 7) werden die Punkte in `docs/datenschutz-notizen.md` gesammelt, `Datenschutz.md` bleibt solange unverändert.
- Beim Bau neuer Funktionen immer fragen: Wohin gehen die Daten? Wie lange bleiben sie? Wer kann sie sehen?

## Lokaler Server und Lasercut

- Der Server sammelt die Werke der Kinder (Foto-Ergebnis, Stempel-Datei, Antworten) pro Paar und nimmt sie auch nachträglich entgegen. Am Ende entsteht ein ZIP pro Paar bzw. gesamt.
- Lasercut-Warteschlange: Stempel werden automatisch auf einer A4-Pappelsperrholz-Platte angeordnet (Ziel: Platte möglichst schnell füllen), dann als ein Auftrag an den Mr Beam geschickt, 2× gravieren.
- Statusmeldungen an die Paare: „Laser startet“, „Laser fertig“, „Bitte Stempel abholen“.
- Als mögliches Vorbild für Upload und Queue dient `archiv/00_fotobox-karte` (lokal).
- Ob der Server auf dem Windows-Rechner (verbunden über find.mrbeam) oder dem Ubuntu-Rechner läuft, ist **offen** (siehe unten).

## Entscheidungen (Stand: Schritt 0)

Details, Netzplan und Testprotokoll stehen in `docs/entscheidungen.md`. Neue Entscheidungen dort festhalten.

Grundsatz: **Jede Ausbaustufe muss den Workshop allein tragen**, die alte Stufe (Karten, Pairdrop) bleibt Rückfallebene. So wenig Technik wie möglich, bedienbar ohne Netzwerkwissen. Notfallplan: `docs/notfallkarte.md`.

1. Server: **Ubuntu-Laptop**, kleiner Python-Server, Startskript mit QR-Code (entschieden).
2. Netz: **KOMEZ-WLAN, kein eigener Router** (vorgeschlagen, 5-Minuten-Test vor Ort ausstehend).
   - Plan A: Laptop liefert App über `http://<IP>:8000`, Foto per `<input capture>` (kein HTTPS nötig), Upload an den Laptop.
   - Plan B: dieselbe App von Netlify, Stempel per „Teilen“.
   - Plan C: Karten und Pairdrop wie früher.
3. Laser: **Handarbeit** in der Mr-Beam-Oberfläche, keine automatische Anbindung vor dem nächsten Workshop.

Zurückgestellt (nach dem Workshop, nur bei Bedarf): eigener Router, HTTPS mit `workshop.datenhandlung.de` (`docs/https-einrichten.md`, INWX-Zugangsdaten nie ins Repo), Laser-Queue.

Noch offen:

4. Wie kommen die Dateien zu den Kindern? ZIP auf USB-Stick an die Lehrkraft ist der aktuelle Plan, Alternativen prüfen.
5. Claude-Station in der App: API-Zugang hinterlegen, Interaktion auf die vorgegebene Aufgabe begrenzen. Eigenes Unterprojekt. Ein API-Schlüssel mit Ausgabenlimit ist etwas anderes als das Claude-Konto der CLI. Nutzungsbedingungen prüfen.
6. Canva und KI-Selbstporträt: ersetzen, ohne das private Canva-Konto. Hintergrund-Tausch lokal mit BodyPix. Generative Bilder nur mit geprüftem Datenschutz, möglichst ohne Foto der Kinder (nur Prompt aus Baukasten).
7. Gilt die frühere Idee mit Erklärer-/Macher-Rotation noch, oder durchlaufen Paare die Stationen frei?

## Roadmap (Schritt für Schritt, ein Schritt pro Branch)

### Ziel ganz oben: `index.html` aufräumen und aufteilen

Der erste Auftrag vor allen neuen Funktionen:

1. `index.html` **kritisch reviewen** (Größe ca. 500 KB, alles in einer Datei, drei Ausgabewege vermischt).
2. **Alten Code identifizieren und löschen**, den der Workshop nicht mehr braucht. Kandidaten (nur nach Rücksprache löschen): Schraffur (Hatch-Fill) und Cricut-Stiftlogik, doppelte Positiv/Negativ-Varianten außerhalb des Pflichtwegs, ungenutzte Regler, tote Funktionen, Demo-Foto.
3. **Aufteilen in getrennte Stationen** mit gemeinsamem Kern:
   - `lasercut-stempel`: Pflichtweg, Negativ-Stempel für den Mr Beam
   - `lasercut-portraet`: optional
   - `schneideplotter`: optional (Sticker)
   - gemeinsam (`app/core`): Foto, Verkleinern, Personenerkennung, Schwarz-Weiß, Bereinigen, SVG-Grundfunktionen. Eine Stelle, kein Copy-and-paste zwischen Stationen.
4. Vor dem Löschen oder Verschieben: Liste der Funktionen mit Einschätzung (behalten, verschieben, löschen) vorlegen und auf Freigabe warten. Danach in kleinen Commits umbauen. Nach jedem Schritt prüfen, dass der Pflichtweg weiter funktioniert.

Patricia möchte durch die Entwicklung geführt werden. Immer nur den aktuellen Schritt bearbeiten, am Ende Ergebnis und nächsten Schritt vorschlagen.

**Bis zum nächsten Workshop (< 4 Wochen, Stand 23.10.2026) gilt diese Reihenfolge, der Rest danach:**

- a) 5-Minuten-Test im KOMEZ (`docs/aufbau-checkliste.md`), Fragen ans KOMEZ.
- b) Schritt 2 **Stabilität**, gezielt in `index.html`, ohne großes Aufteilen.
- c) **Minimaler Upload**: Server + Startskript mit QR-Code. In der App: „Stempel speichern“, „An Laptop senden“, „Teilen“.
- d) Testlauf im KOMEZ spätestens eine Woche vorher.

0. **Infrastruktur klären**: erledigt, siehe `docs/entscheidungen.md`.
1. **`index.html` reviewen, aufräumen, aufteilen** (siehe Ziel ganz oben): Funktionsliste mit Empfehlung, Freigabe, dann in Stationen `lasercut-stempel`, `lasercut-portraet`, `schneideplotter` plus gemeinsamem Kern zerlegen.
2. **Stabilität auf alten iPads**: Bibliotheken lokal einbinden, Crash bei leerer Maske beheben, Bildgröße begrenzen, Test auf echten Geräten (Safari, danach Chrome als Fallback), Optimierungen aus `archiv/fotobox-karte` prüfen.
3. **Offline-first-Grundgerüst**: Anmeldung (Paar/Einzelperson), IndexedDB, Outbox, Server-Endpunkte, Synchronisationsanzeige.
4. **Pflichtweg Negativ-Stempel**: Foto in der App, „letztes Foto verwenden“ statt Testfoto, Stempel-Datei für Mr Beam, Übergabe an den Server.
5. **Laser-Queue**: Anordnen auf A4-Platte, Auftrag an Mr Beam, 2× gravieren, Statusmeldungen an die Kinder.
6. **Stationen in der App**: Inhalte als Daten, Check pro Station, Antworten und Foto-Uploads, Fragen zu KI-Typ und Bewertung.
7. **Datenschutz.md** und Etiketten an den Stationen, Kartenspiel „Programm / KI / generativ“.
8. **Abschluss**: ZIP-Export, Abgabe an die Lehrkraft, Löschkonzept.
9. **Claude-Station** (Unterprojekt) und Ersatz für Canva.
10. **Optionale Wege**: Sticker, Lasercut-Porträt, Positivdruck.

## Arbeitsweise mit Claude

- Immer auf einem Feature-Branch arbeiten, nie direkt auf `main`.
- Kleine, thematisch saubere Commits mit englischer Commit-Message. Gitmoji verwenden: https://gitmoji.dev/
- Vor größeren Änderungen erst einen Plan vorlegen.
- Bestehende Stationen im Stil und Aufbau beibehalten.
- Wenn Informationen fehlen (z. B. Lasercutter-Modell, Materialstärke, iPad-Modelle), nachfragen statt raten.
- Nie `git push` ohne Rückfrage.
- Antworten an Patricia kurz halten, Stichpunkte statt Fließtext, eine Empfehlung statt mehrerer Varianten.
- Änderungen an `index.html` vorsichtig: Datei ist groß, mit gezielten Edits arbeiten, nicht komplett neu schreiben.
- Jede Änderung testen (Desktop-Safari/WebKit, danach echtes iPad). Was nicht getestet wurde, ausdrücklich so benennen.
