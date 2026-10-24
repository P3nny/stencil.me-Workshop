# Screens der Workshop-App

Arbeitsplan für den Bau der Stationen-App. Patricia beschreibt jeden Screen, Claude ergänzt Hinweise (*kursiv*) und baut nach Freigabe. Ein Screen pro Branch. Ziel: Test vor Ort am **02.11.2026**.

## Grundprinzip

- Patricia gibt zu Beginn auf der Laptop-Seite die Anzahl der Schüler:innen ein. Anzahl und Reihenfolge der Stationen kommen aus den Daten in `stationen/`.
- Fortschritt: „x von y Stationen“. Oben setzt sich pro abgeschlossener Station ein Puzzleteil des stencil.me-Porträts zusammen, bei Paaren zwei Porträts.
- Ablauf jeder Station: QR-Code scannen (Check-in) → Station bearbeiten → **Input** (Bild-Upload, Text oder Quiz) → „Station beendet“ → „Wie hat dir die Station gefallen?“
- Check-in und „beendet“ gehen an den Laptop. Er weiß so, welche Stationen besetzt sind.
- Das Paar behält sein iPad für alle Stationen. Alles wird zuerst auf dem iPad gespeichert (IndexedDB).

## Leistung auf alten iPads (24.10.)

- Jede Station ist eine eigene Seite: Beim Wechsel gibt das iPad den Speicher der vorigen Station frei
- BodyPix wird nur auf Stationen geladen, die es brauchen. Grafikspeicher wird sofort freigegeben (`WEBGL_DELETE_TEXTURE_THRESHOLD = 0`)
- Foto-Prüfung rechnet auf 400 px, „Hintergrund ändern“ auf 640 px, die Stempel-Station bleibt bei voller Qualität (Hauptergebnis)
- Körpererkennung (Video): leichtes Modell (MobileNet 0.50), Bild 320 px, Auflösung startet auf „grob“, höchstens 6 Bilder pro Sekunde, Pause wenn Video angehalten oder Tab im Hintergrund. Unter 1,5 Bildern pro Sekunde stellt die App selbst auf „grob“
- Schnittrand: Suche durch Halbieren (höchstens 4 statt 12 Rechnungen)
- Messung mit gebremster CPU: `tests/leistung-test.js` (nur Chromium, nur zum Vergleichen). Bei 4-fach: Foto-Prüfung 4,2 → 3,1 s, Freistellen 4,5 → 3,4 s, Video 2,9 → 6 Bilder/s. *Die Grafikeinheit bremst der Test nicht: Echte Werte liefert erst ein altes iPad (02.11.)*

## Reihenfolge der Stationen

- Fest: Check-in → Foto → stencil.me → Laser.
- **Offen:** 26 Jugendliche gleichzeitig am Laser sind zu viel. Sie sollen nacheinander ankommen. Auch andere Stationen bauen aufeinander auf.
- *Vorschlag:* Jede Station bekommt in den Daten `braucht: [...]` (Voraussetzungen) und `plaetze` (wie viele Paare gleichzeitig). Die App weist nur Stationen zu, deren Voraussetzungen erfüllt sind und die noch Platz haben.

## Gerüst (gebaut, Branch `feature/geruest`)

- Stationen als Dateien in `stationen/` (Format: [stationen/README.md](../stationen/README.md)). Bisher: Foto, Bild bearbeiten, Lasercutter, Greenscreen
- Allgemeine Stationsseite `app/station.html?id=<station>`: Das ist die Adresse für den QR-Code an jeder Station
  - Kopfleiste: Puzzle pro Person, „x von y Stationen geschafft“, „Gesichert auf dem iPad / auf dem Laptop“
  - Check-in beim Öffnen, Schritte, Foto/Texteingaben, „Station beendet“ erst, wenn alles erledigt ist
  - Abschluss: KI-Frage (das Typ-Etikett erscheint erst nach der Antwort als Auflösung) und Sterne
  - Danach: Vorschlag für die nächste Station (Voraussetzungen + freie Plätze)
- Laptop-Seite: Anzahl Schüler:innen, Tabelle der Gruppen (gerade an, geschafft, Fotos), „Alle Daten löschen“
- Zum Ausprobieren ohne Anmeldung: `?test` an die Adresse hängen → „Test-Gruppe anlegen“, „Alles zurücksetzen“
- Alles läuft im normalen Safari, ohne Home-Bildschirm (entschieden 24.10.). Start: ein QR-Code in der Startpräsentation. An jeder Station: QR-Code öffnet einen neuen Safari-Tab mit demselben Speicher.

## Screen 1: Check-in (Startseite) — gebaut, Branch `feature/screen-1`

- Adresse: `/` (Startseite). Die bisherige stencil.me-App liegt jetzt unter `/stencil.html`
- Ablauf: „Los geht's“ → „Allein oder zu zweit?“ → Vornamen/Spitznamen → „Hallo …!“ → Zur Foto-Station
- Wer die Startseite nochmal öffnet, sieht den Stand und kommt zurück zur aktuellen Station
- „Andere Gruppe? Neu anmelden“ löscht vorher alle Fotos und Antworten auf dem iPad

Beschreibung von Patricia:

- Startseite wie `stencilme.netlify.app`, Knopf „Los geht's“
- Allein oder zu zweit? Namen oder Nicknames eingeben
- Weiter geht es immer mit dem Foto: „Macht nacheinander ein Foto von euch“ (allein: „Mach ein Foto von dir“)

## Screen 2: Foto machen — gebaut, Branch `feature/screen-2`

- Selfie-Kamera vorne, jede Person fotografiert sich selbst (Patricia, 24.10.)
- Vier Beispielbilder (Zeichnungen in `stationen/bilder/`): gut, zu weit weg, unruhiger Hintergrund, Gegenlicht. *Können durch echte Fotos ersetzt werden (gleicher Dateiname oder Eintrag in `foto.json` ändern).*
- Nach jedem Foto prüft die KI (BodyPix, auf dem iPad), ob eine Person zu sehen ist:
  - erkannt → ✓, sehr klein im Bild → Tipp „näher ran“
  - keine Person → Station gesperrt, „Neues Foto“ oder „Trotzdem nehmen“
  - KI zu langsam oder Fehler (nach 30 s) → Foto gilt trotzdem, der Workshop hängt nicht
- Typ der Station jetzt `ki` (wegen der Prüfung)

Beschreibung von Patricia:

- Jede Person macht ein Foto (vor Packpapier, Ringlicht)
- Tipps: Kopf- oder Schulterporträt, Hintergrund nur Packpapier. Überlegt euch einen Ausdruck und eine Pose: Was soll euer Porträt sagen?
- Die App zeigt ein Porträt pro Person
- Input: Selbstporträt ist aufgenommen und gespeichert
- Das Rohfoto **bleibt auf dem iPad**

## Screen 3: Bild bearbeiten (stencil.me) — gebaut, Branch `feature/screen-3`

- Pro Person nacheinander fünf Bilder: Foto → Schwarz-Weiß → KI findet dich (Person pink) → Otsu-Schwelle → Stempel (gespiegelt). Jedes mit Etikett Programm/KI
- Alles automatisch. Einstellbar nur der rote Schnittrand (2–15 mm). Die App wählt den kleinsten Rand, bei dem der Stempel in einem Stück bleibt. Zerfällt er, gibt es eine Warnung und „Abschicken“ ist gesperrt
- „Stempel an den Laptop schicken“ pro Person. Der Stempel landet bei den anderen Stempeln auf der Laptop-Seite (Name = Vorname/Spitzname). Ändert ein Kind danach den Rand: „Geänderten Stempel neu schicken“ (dann liegen zwei Versionen auf dem Laptop, die neuere oben)
- Frage „Was bedeuten die Farben Rot, Blau und Weiß?“, Auflösung im Abschluss
- Puzzle in der Kopfleiste zeigt ab jetzt das Schwarz-Weiß-Porträt
- Rechenkern in `app/core/stempel.js` (aus `stencil.html` übernommen). `stencil.html` bleibt bis nach dem 02.11. unverändert als Rückfallebene. *Danach: `stencil.html` auf den Kern umstellen, damit es den Code nur einmal gibt*

Beschreibung von Patricia:

- Nimmt die Fotos aus Screen 2 und die Namen aus Screen 1
- Jeder Schritt ist sichtbar: Rohbild → Schwarz-Weiß → BodyPix → Otsu → Stempel
- Frage: „Was bedeuten die Farben?“ (Texteingabe)
- Input: Der fertige Stempel geht an den Laptop
- *Die Bildverarbeitung kommt nach `app/core/`. Die vorhandene Outbox aus `stencil.html` wird durch `app/core/outbox.js` ersetzt.*

## Screen 4: Lasercutter — gebaut, Branch `feature/screen-4`

- Station: Schritte, Erklärvideo „Wie funktioniert ein Laser Cutter?“ (Coding For Tomorrow, Link von der alten Stationenkarte) direkt eingebettet, lädt erst nach „▶ Video laden“ (Zwei-Klick, `youtube-nocookie.com`), Frage + Antwort an Penny, Foto vom Laser (geht an den Laptop)
- Laptop-Seite, Bereich „A4-Platte für den Mr Beam“: Stempel anhaken → „Platte zusammenstellen“ → Vorschau → „Platte herunterladen (SVG)“
  - 5 mm Rand, 3 mm Abstand (Patricia, 24.10.). Bei ca. 45 × 52 mm passen 20 Stempel auf eine Platte
  - Wer zuerst fertig war, kommt zuerst auf die Platte. Was nicht passt, steht als „nächste Platte“ da
  - Nach dem Download sind die Stempel grau und nicht mehr angehakt. Einzelne Stempel: nur diesen anhaken
  - In der Mr-Beam-Oberfläche: Gravur (Blau) 2 Durchgänge, Schnitt (Rot). *Am 02.11. testen, ob BeamOS die zusammengesetzte Datei richtig liest*

Beschreibung von Patricia:

- „Geht zu Penny am Lasercutter“. Zusehen beim Positionieren, den Laser anschauen, Erklärvideo (Link)
- Eingabe: eine Frage an die Person am Laser, dazu die Antwort
- Input: Foto vom Lasercutter
- Für Penny: Die Laptop-Seite ordnet die Stempel auf einer A4-SVG an. Ist die Platte voll, wird sie heruntergeladen und in der Mr-Beam-Oberfläche geöffnet. Einzelne Stempel gehen weiterhin.

## Screen 5: Hintergrund ändern (vorher „Greenscreen“) — gebaut, Branch `feature/screen-5`

- Neuer Name „Hintergrund ändern“ (wie auf der alten Karte), ID `hintergrund` (Patricia, 24.10.)
- Pro Person: KI stellt das Foto frei (Karomuster = durchsichtig), Hintergrund aus sechs gemeinfreien Bildern wählen, „Bild an den Laptop schicken“. Erst wenn beide Bilder abgeschickt sind, geht „Station beendet“
- Hintergründe (Public Domain, Lizenzen in `stationen/bilder/hintergruende/README.md`): Erdaufgang (NASA), Die große Welle (Hokusai), Sternennacht (van Gogh), Dschungel mit Tiger (Rousseau), Komposition 8 (Kandinsky), Tausende Galaxien (Hubble)
- Freiwillige Frage „Wo hat die KI beim Freistellen Fehler gemacht?“ (heller Rand um die Person ist so ein Fehler)
- Kommt nach der Körpererkennung: `braucht: ["foto", "koerpererkennung"]`. Solange es die Station Körpererkennung nicht gibt, zählt nur das Foto
- Findet die KI keine Person: Hinweis, Station kann trotzdem beendet werden

Beschreibung von Patricia:

- Das Rohfoto wird auf dem iPad freigestellt (BodyPix)
- Die Jugendlichen wählen einen Hintergrund aus festen, gemeinfreien Bildern
- Canva fällt weg, dafür gibt es eine eigene Seite (HTML, CSS, JavaScript)
- *Offen: Input = Bild mit Hintergrund. Nur auf dem iPad speichern oder an den Laptop senden?*

## Screen 6: Körpererkennung testen — gebaut, Branch `feature/screen-6`

- Live-Kamera geht nur mit HTTPS, der Laptop hat HTTP. Darum (Patricia, 24.10.): kurzes Video (5–10 s) mit der Kamera-App aufnehmen, die App spielt es in Schleife ab und BodyPix rechnet Bild für Bild. Tippen = Pause
- Ansichten: Person (pink), Körperteile (farbig), Hintergrund unscharf. Regler: Auflösung grob/mittel/genau, Schwelle, Deckkraft. Anzeige „x Bilder pro Sekunde“
- 8 Aufgaben zum Abhaken (Gegenstand, Seite, Hand, Kapuze, Foto auf dem Handy, Schwelle, Auflösung, linker Arm), mindestens 3
- „Bild der KI-Ansicht speichern“: Video-Bild mit KI-Farben darüber (mit Gesicht, Patricia, 24.10.) → Laptop
- Pflicht: zwei Ethik-Fragen von der alten Karte (gleich gut erkannt? Folgen bei Bewerbung/Überwachung?)
- Läuft ein Video nicht (Format, Speicher), kommt nach 30 s ein Hinweis
- *Ungetestet: Video vom iPad (.mov) in Safari. Der Test am Rechner läuft nur in Chromium mit echtem Bild*

## Screen 7: Pixel vs. Vektor (mit SVG Kreis, Dreieck, Stern) — gebaut, Branch `feature/screen-7`

- Für die Gruppe gemeinsam (nicht pro Person)
- Teil 1: Text, Merkhilfe, „Bezug zu stencil.me“ und Infografik aus `02_stencil.me-Stationen.pdf` (Seite 11, ausgeschnitten nach `stationen/bilder/pixel-vektor/infografik.png`)
- 3 Verständnisfragen mit Rückmeldung (falsch: „Noch nicht, schaut nochmal oben“), erst wenn alle richtig sind, erscheint Teil 2
- Teil 2: SVG-Editor in der App (wie w3schools, PDF Seite 12 und 13), Ergebnis sofort daneben. Die App prüft: Kreisfarbe geändert (gültige Farbe?), Radius geändert, Dreieck (3 Punkte), Stern (10 Punkte), Bonus zweiter Stern in anderer Farbe. Hinweise bei typischen Fehlern, auch bei fehlenden Zeichen
- „Hilfe: Baustein einfügen“ für Dreieck und Stern. *Patricia: Soll es die Hilfe geben, oder sollen die Kinder alles abtippen?*
- Typografische Anführungszeichen der iPad-Tastatur („ “) werden erkannt und beim Speichern zu geraden " gemacht
- Der Code geht beim Beenden an den Laptop (`antworten.svg-code` in den Ereignissen der Gruppe). *Später (Roadmap 8, ZIP): als `.svg`/`.html`-Datei in die Ergebnis-Mappe*

## Code-Editor für iPads (24.10., Patricia: A+B+C+D)

Gilt für Pixel vs. Vektor und Coding (`app/core/code-editor.js`). Im KOMEZ gibt es keine Tastaturen, alles muss mit der Bildschirm-Tastatur gehen.
- **Lückentext:** Code ist zu sehen, ändern lassen sich nur die hellen Felder. Neue Teile kommen per „Baustein einfügen“ an die richtige Stelle (ein Platzhalter zeigt, wo)
- **Eine Aufgabe nach der anderen:** Punkte 1, 2, 3 … oben, die aktuelle Lücke ist pink markiert, „Zur Lücke“ springt hin
- **Tastatur offen:** Editor füllt den sichtbaren Bereich: Aufgabe und kleine Vorschau oben, Code in der Mitte, Zeichenleiste (`< > / " = { } ; : ( ) ' #`) direkt über der Tastatur, „Tastatur zu“. Am Rechner zum Ansehen: `&tastatur` an die Adresse
- **Profi-Modus:** ganzen Code frei bearbeiten (zurück zum Lückentext setzt die Profi-Änderungen zurück)
- *Ungetestet auf echtem iPad: wie sich der Bereich über der Tastatur verhält (iPadOS meldet ihn über `visualViewport`)*

## Screen 8: Coding: HTML, CSS und JavaScript — gebaut, Branch `feature/editor`

- Übungen von den Karten (Seite 14, 15): Überschrift in eure Namen, Absatz ändern, `<style>` mit Farben, andere Farben, Button mit `alert`, eigene Nachricht, auf den Button klicken. Bonus: Beschriftung des Buttons
- Vorschau ist eine echte kleine Webseite in einem abgeschirmten Rahmen: `alert` funktioniert, der Code der Kinder kommt nicht an die App-Daten
- Hinweise bei typischen Fehlern: unbekannte Farbe, fehlende Klammer im CSS, `'` mitten in der Nachricht
- Pflichtfrage „Welcher Baustein sorgt dafür, dass ein Regler sofort das Bild verändert?“, Auflösung (JavaScript) im Abschluss
- Code geht beim Beenden an den Laptop (`antworten.html-code`)

## Screen 9: Selbstporträts mit KI neu erschaffen — gebaut, Branch `feature/screen-9`

- Ersetzt Canva AI. Prompt-Baukasten (keine freie Eingabe): Kunststil (Frida Kahlo, van Gogh, Pop-Art, Streetart, Comic, Aquarell), Person, Alter, Augen, Haarfarbe, Haare, Brille, Hintergrund. Der fertige Satz steht groß darüber
- „Bild erzeugen“: Das iPad schickt nur die Auswahl an den Laptop, der Laptop baut den Prompt und fragt Claude (Haiku 5.5). Claude zeichnet ein SVG (ca. 15 s, ca. 0,2 Cent pro Bild)
- Höchstens 6 Bilder pro Gruppe, 150 pro Tag. Pflicht: 2 Bilder in 2 Kunststilen
- Pflichtfragen von den Karten (Seite 16, 17): Unterschied zu stencil.me (mit Auflösung) und KI-Ethik
- Ohne Laptop, Internet oder Schlüssel: drei vorher erzeugte Beispiele (`stationen/bilder/ki-beispiele/`), Station lässt sich trotzdem beenden
- Laptop-Seite zeigt Modell, Anzahl Bilder heute und Kosten bisher
- Einrichtung: `./server/einrichten.sh` (einmalig, installiert das Anthropic-SDK und fragt den API-Schlüssel ab), `./server/start.sh` nutzt es dann automatisch
- Modell wechseln: `STENCILME_KI_MODELL=claude-sonnet-5-5 ./server/start.sh`

## Screen 10 und 11: Mit der Hand drucken — gebaut, Branch `feature/screen-10-11`

- **10 Linolplatten** (`druck-linol`): jede Person druckt eine Postkarte mit einer fertigen Linolplatte. Schritte von der Karte (Seite 18), Beispielbild der Postkarte aus dem PDF
- **11 Lasercut-Stempel** (`druck-stempel`): erst nach dem Lasercutter frei. Stempel abholen, einfärben, Postkarte drucken (Pflichtweg Schritt 5). Freiwillige Frage „Wo ist die Farbe gelandet?“ mit Auflösung
- Beide: ein Foto der Postkarte pro Person (Rückkamera), geht an den Laptop. Freiwillige Frage „Warum spiegelverkehrt?“ mit Auflösung
- *Die App weiß nicht, ob der Stempel schon gelasert ist (keine Laser-Queue). Kommen Kinder zu früh, schickt Penny sie zu einer anderen Station*

## Screen 13, 14, 15 — gebaut, Branch `feature/screen-13-15`

- **13 Code-Erklärung interaktiv** (`code-quiz`): `code-quiz.html` eingebettet, erst nach „Bild bearbeiten“. Das Quiz meldet am Ende „x von 9 richtig“, dann ist die Station abgehakt. Vier Häppchen an den heutigen Code angepasst: Foto (verkleinern statt FileReader), BodyPix laden (`.then`, Modell vom Laptop statt aus dem Internet), Maske (Schwelle 0.4), Spiegeln (immer gespiegelt, kein Haken mehr), evenodd (Stempel statt Positiv-Modus). Grauwert, Otsu, despeckle, Konturen stimmen weiter
- **14 Kunst-Quiz** (`kunst-quiz`): `kunst-quiz.html` eingebettet, dazu ein Foto pro Person vom Lieblings-Streetart-Werk (geht an den Laptop), freiwillig „Warum?“. QR-Code der Station neben die Künstler:innen-Bilder kleben
- **15 Bonus: Sticker** (`sticker`): einzige Bonus-Station. Geht auf ab 8 geschafften Stationen, darunter Foto, Bild bearbeiten, Lasercutter, Stempel drucken. Zählt nicht zu „x von y“. Gleiche fünf Schritte wie „Bild bearbeiten“, am Ende Sticker für den Schneideplotter (schwarze Silhouette = Folie, roter Schnitt, nicht gespiegelt, wie `buildPlotterSvg` in `stencil.html` ohne Schraffur). Landet auf dem Laptop im eigenen Ordner `server/daten/sticker`, Laptop-Seite zeigt sie mit „Herunterladen“
- Station 9 geändert (Patricia, 24.10.): nach 2 Bildern weiter, egal welcher Stil. Hinweis „Noch 1 Bild …“

## Laptop-Ausbau (ab 24.10. abends, Branches `feature/laptop-ausbau`, `feature/nachrichten`, …)

- KI-Selbstporträt mit Sonnet 5.5 (siehe `docs/entscheidungen.md` Punkt 5)
- Abschluss jeder Station: erst Auflösungen, dann „Was hast du genutzt?“ (neu: „Ohne Computer“), dann Sterne
- Alle Fotos gehen an den Laptop, auch das Ausgangsfoto und verworfene Versuche
- **Laptop-Seite neu gegliedert** (`server/bogen.js`): zwei gleich aufgebaute Bereiche
  - „Stempel → A4-Holzplatte für den Mr Beam“: anhaken, „Platte zusammenstellen“, „Platte herunterladen (SVG)“ (5 mm Rand, 3 mm Abstand)
  - „Sticker → A4-Stickerfolie für die Cameo“: anhaken, „Folie zusammenstellen“ (8 mm Rand, 4 mm Abstand), „An den Plotter schicken“ oder „Nur herunterladen“
  - je ein Verlauf mit Nachrichten-Knöpfen
- **Plotter** (`server/plotter.py`, Vorbild `archiv/00_fotobox-karte/fotobox-queue.py`): Sticker im Fotobox-Format (Gruppe `zeichnen-stift`: Schraffur 1,2 mm + Umriss; Gruppe `schneiden-rot`: Messer). Laptop-Seite führt durch die Schritte: Folie + Stift einlegen → „Zeichnen starten“ → „Stift raus, Messer rein“ → „Schneiden starten“ → „FERTIG“. Gleiche Einstellungen wie die Fotobox (Stift Druck 5/Tempo 5, Messer Autoblade Tiefe 4, Druck 14, Tempo 3, 2 Durchgänge), änderbar per Umgebungsvariable. `STENCILME_PLOTTER_TEST=1`: Testlauf ohne Plotter. *Mit echter Cameo noch nicht getestet*
- **Nachrichten an die Gruppen:** Stempel und Sticker tragen die Gruppen-ID im Dateinamen. Laptop-Seite → „Letzte Platten“: pro Platte „📣 Wird gelasert“ und „📣 Fertig, abholen“. Jede Gruppe bekommt eine eigene Nachricht mit ihren Namen, die iPads zeigen sie oben an (Abfrage alle 15 s), „OK“ blendet sie aus

## Station 12: Bild-App vibe coden — gebaut, Branch `feature/vibe-coding`

- Ersetzt die Betreuungsperson: Lückentext statt freiem Auftrag. Auswahl: Effekt (Warhol, Pixel-Art, Farben verrückt, Comic, Schablone), Farben, Regler. Frei nur App-Name und Knopf-Text (höchstens 24 Zeichen, nur Buchstaben, Zahlen, Satzzeichen, Laptop prüft nochmal und setzt sie in Anführungszeichen)
- Laptop baut den Auftrag, Claude (Sonnet) schreibt eine HTML-App, der Code erscheint live auf dem iPad (`server/ki_app.py`, Streaming). Test 24.10.: 41 s, ca. 6 Cent
- Die App läuft abgeschottet: `sandbox="allow-scripts"` (eigener Ursprung, kein Zugriff auf App-Daten, keine Navigation), CSP ohne Netz, vorher werden alle Adressen nach außen entfernt. Geprüft: fetch, Navigation, Speicher werden blockiert
- „📷 Euer Foto in die App schicken“: Ausgangsfoto geht nur per postMessage in die abgeschottete App, nicht zu Claude
- Höchstens 3 Apps pro Gruppe, 60 pro Tag. Gespeichert bei der Gruppe (`vibe-coding_*.html`). Ohne KI: Beispiel-App `stationen/bilder/ki-beispiele/app-warhol.html`
- Pflicht: Ethik-Frage zur Altersgrenze (angepasst: Claude.ai ab 18, hier über Pennys Workshop-Zugang mit Sicherheitsregeln), freiwillig: Vergleich mit der stencil.me-Pipeline (mit Auflösung)
- **Anthropic-Regeln für Minderjährige** (support.claude.com, „Guidelines for organizations serving minors“) gelten für Station 9 und 12: Schutzmaßnahmen, Datenschutzrecht einhalten, öffentliche Erklärung, Hinweis „ihr sprecht mit einer KI“ → in `Datenschutz.md`
- Laptop-Seite: kleinere Karten (Liste scrollt ab ca. 20), Gruppen-Tabelle zählt Bonus nicht mit

## Feedback, Auswertung, Bonus 2 (24.10.)

- **Feedbackbogen** (`feedback`, Fragen aus `07_stencil.me - Abschluss.pdf`): jede Person einzeln: Lieblingsstation (Auswahl aus den geschafften), ein Wort, „beim nächsten Mal anders“, freiwillig „am meisten überrascht“. Geht nach Bonus 1 auf, oder für alle über den Laptop-Knopf „Feedbackbogen für alle freigeben“ (`freigaben` in den Einstellungen). Zählt nicht zu „x von y“
- **Bonus 2 Lasercut-Porträt** (`portraet`): nach Sticker + Feedbackbogen. Der Laser graviert die dunklen Stellen ins Holz (wie „Bild für den Lasercutter“ in `stencil.html`), Schnittrand am Umriss, nicht gespiegelt. Landet bei den Stempeln als „Name-Portraet“ und kommt auf die Holzplatte. Nachrichten nennen es richtig („Das Porträt von …“)
- **Auswertung** `/auswertung` (nur am Laptop): pro Station geschafft, Sterne (Schnitt, Verteilung), KI-Frage richtig; Feedbackbögen (Lieblingsstationen, Wörter, Sätze)
- Fotos gehen erst bei „Station beendet“ an den Laptop (nur die letzten), Nachrichten-Abfrage einmal pro Minute, Diktier-Hinweis an allen Textfeldern

## Gerätecheck und Code-Prüfung (24.10.)

- `app/geraetecheck.html`: prüft auf dem iPad iPadOS/Safari, Speicher (IndexedDB, freier Platz), Kamera-Feld, Video (H.264/HEVC), WebGL, Darstellung, Canvas, Verbindung zum Laptop und BodyPix mit Zeitmessung. Ergebnis als Ampel und Text zum Weiterschicken. Speichert nichts dauerhaft
- Aller JavaScript-Code (23 Dateien/Blöcke) ist ES2017-tauglich (geprüft mit `es-check`), also lesbar ab Safari/iOS 11

## Weitere Screens

- *Patricia beschreibt sie noch:* BodyPix live, Pixel vs. Vektor, Coding, Mit der Hand drucken, Künstler:innen, Streetart, Berufe, Kunst- und Code-Quiz …
