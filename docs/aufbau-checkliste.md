# Aufbau-Checkliste

Was vorher noch zu erledigen ist (Canva, Einwilligung, KOMEZ): [merkliste-patricia.md](merkliste-patricia.md)

## 0. Gerätecheck (so früh wie möglich)

- [ ] KOMEZ bitten, `https://stencilme-workshop.netlify.app/app/geraetecheck.html` auf einem ihrer iPads zu öffnen und das Ergebnis zu schicken
- [ ] Vor Ort über den Laptop: `http://<IP>:8000/app/geraetecheck.html` (prüft zusätzlich die Verbindung zum Laptop)
- [ ] Am Ende des Checks auf jedem iPad „📷 Kamera testen“ antippen und ein Foto machen. Bleibt das Bild schwarz: Einstellungen › Safari › Kamera erlauben
- [ ] Falls Android-Tablets dazukommen: nicht getestet. Gerätecheck machen, Chrome als Standardbrowser, prüfen, dass der QR-Scan in Chrome öffnet (nicht in Samsung Internet o. Ä.)

## 1. 5-Minuten-Test im KOMEZ (Plan A möglich?)

- [ ] Laptop ins KOMEZ-WLAN
- [ ] Terminal im Repo-Ordner öffnen: `python3 -m http.server 8000`
- [ ] IP des Laptops anzeigen: `hostname -I` (die erste Adresse, z. B. `10.0.4.23`)
- [ ] Falls die Ubuntu-Firewall aktiv ist: `sudo ufw allow 8000/tcp`
- [ ] Auf einem iPad in Safari öffnen: `http://<IP>:8000/docs/ipad-test.html`
- [ ] **Seite lädt → Plan A geht.** Seite lädt nicht → Plan B (Netlify + Teilen).
- [ ] „Foto aufnehmen“ testen, Seite einmal neu laden, „Ergebnis kopieren“
- [ ] Ergebnis ins Testprotokoll in [entscheidungen.md](entscheidungen.md) eintragen
- [ ] Mr-Beam-Oberfläche vom Laptop aus öffnen
- [x] IP-Adresse des Laptops notieren: `192.168.0.30` im `Gast-KOMEZ`, bleibt laut Medientechniker gleich (02.11.). QR-Karten können laminiert werden

Zu Hause lässt sich derselbe Test im Heim-WLAN machen. Er zeigt, ob die Testseite auf dem iPad funktioniert, aber nicht, ob das KOMEZ-WLAN mitspielt.

## 2. Vor jedem Workshop (zu Hause)

- [ ] **Testdaten löschen:** Laptop-Seite „Alle Daten löschen“ (z. B. Probe-Stempel und Testgruppen vom Vortag). Danach erst die Namen von den Rückmeldezetteln eintragen
- [ ] **Server neu starten** nach jedem Update (am 08.11.: anonymes Feedback braucht den neuen Server)

- [ ] Laptop voll geladen, Netzteil eingepackt
- [ ] Netlify-Version ist aktuell (Plan B)
- [ ] [notfallkarte.md](notfallkarte.md) ausgedruckt, laminierte Karten dabei (Plan C)
- [ ] QR-Codes für die Stationen: Server starten, `http://localhost:8000/qr` öffnen, Adresse wählen, drucken. Nur gültig für diese Adresse: Bekommt der Laptop im KOMEZ eine andere IP, dort neu drucken (oder Netlify-Version für Plan B mitnehmen)
- [ ] Fallback für den großen Bildschirm: Auf `/qr` einmal mit `http://192.168.0.30:8000/` und einmal mit der Netlify-Adresse „Drucken“ → „Als PDF sichern“. Beide PDFs auf den 2. Laptop legen. `/qr` selbst öffnet sich nur am Ubuntu-Laptop
- [ ] **Probe-Sticker an der Cameo** (ein Sticker auf Stickerpapier). **Vor jedem Plotter-Auftrag Cameo aus- und wieder einschalten** (vor dem Laden der Matte): Die Automatik-Klinge schneidet sonst mit jedem Auftrag flacher, nach dem Einschalten stellt sie die Tiefe neu ein (beobachtet 08.11.). Messer: Druck 30, Tiefe 10 (Maximum), Tempo 2, 6 Durchgänge (getestet 08.11.: Sticker lässt sich herauslösen, Trägerpapier fast durch; 33/10/4 schnitt durch die Matte). Hängt der Sticker noch am Trägerpapier: vorsichtig herausdrücken.
- [ ] **Probestempel am Mr Beam** (eine Platte mit 2–4 Stempeln): Zeit notieren, prüfen, ob der Schnitt durchgeht (siehe Abschnitt 4)
- [ ] USB-Stick dabei
- [ ] Claude-Stationen (optional): Guthaben in der Claude Console prüfen und **auf mindestens ca. 15 $ aufladen** (Probelauf 02.11.: KI-Bild ca. 0,08 $, App ca. 0,26 $; 13 Gruppen mit je ca. 3 Bildern und 2 Apps ≈ 10 $), Laptop-Seite zeigt „KI (claude-sonnet-5-5): heute …“ (sonst `./server/einrichten.sh`). Braucht Internet im KOMEZ-WLAN. Ohne KI zeigen die Stationen Beispiele
- [ ] Einwilligungen der Erziehungsberechtigten liegen vor (Fotos im Workshop, Claude-Stationen), `Datenschutz.md` ist vorab verschickt
- [ ] `docs/datenschutz-kurz.md` ausgedruckt (Aushang)

## 3. Aufbau im Raum

- [ ] Laptop ins KOMEZ-WLAN, Netzteil anschließen, Laptop **aufgeklappt** lassen
- [ ] **Alle iPads ins WLAN `Gast-KOMEZ`** (wie der Laptop, sonst lädt die Seite endlos). Erscheint die Anmeldeseite nicht: in Safari `http://captive.apple.com` öffnen, sonst WLAN › (i) › „Automatisch anmelden“ an, „Private WLAN-Adresse“ aus, neu verbinden
- [ ] Terminal im Repo-Ordner öffnen: `./server/start.sh`
  - Der Browser öffnet die Laptop-Seite mit QR-Code und Stempel-Liste.
  - Der Laptop geht nicht in den Ruhezustand, solange das Terminal-Fenster offen ist.
  - Nach jedem Update den Server neu starten. Die Laptop-Seite zeigt sonst einen pinken Hinweis.
- [ ] Laptop-Seite: Anzahl Schüler:innen eintragen
- [ ] Laptop-Seite: Vornamen von den Rückmeldezetteln eintragen (ohne Foto → Promi-Porträt, ohne KI → Beispiele)
- [ ] Laptop-Bildschirm mit dem QR-Code zu den iPads drehen
- [ ] Browser am Laptop: Einstellungen → Downloads → „Jedes Mal fragen, wo gespeichert werden soll“ an. Platten und Folien direkt in `server/daten/stempel/` speichern (nicht in die Tages-Unterordner): „Alle Daten löschen“ löscht sie dort mit, `~/Downloads` nicht
- [ ] Pro iPad: Einstellungen → Safari → Erweitert → Website-Daten: alte Daten der Workshop-Adresse löschen (Fotos der letzten Gruppe)
- [ ] Pro iPad: alle alten Safari-Tabs schließen, QR-Code in **Safari** öffnen (nicht „Zum Home-Bildschirm“), ein Testfoto machen, danach mit `?test` → „Alles zurücksetzen“
- [ ] Schnelltest aller Stationen (nur Testgerät): `…/app/station.html?id=foto&test&frei` öffnet jede Station ohne Voraussetzungen, oben rechts „Station öffnen …“. Danach „Alles zurücksetzen“ und den Tab schließen: `&frei` gehört auf kein Kinder-iPad.
- [ ] App offen lassen, nicht neu laden

## Zeitplan und Ansagen (ab Dezember 2026)

| Zeit | Was |
| --- | --- |
| 08:45 | Ankommen |
| 09:00 | Startpräsentation, dann Stationen: Foto, Bild bearbeiten, erste Lasercuts, erste Sticker |
| 10:00–10:10 | Kleine Pause (vorher Hintergrund-Stationen, wichtig fürs Quiz) |
| 10:55–11:30 | Große Pause mit Rausgehen |
| 11:30 | Quiz Teil 1 |
| 12:00 | Feedback für alle freigeben |
| 12:30 | Abschlussrunde, Quiz Teil 2, Siegerehrung, Daten löschen |
| ca. 12:45 | Ende |

- [ ] **Ansagen in der Startpräsentation:**
  - „Das ist kein Wettrennen. Wir machen das ganz in Ruhe.“
  - „Nach der Pause gibt es ein Quiz. Die drei besten Gruppen bekommen einen Preis. Lest also gut und merkt euch, was ihr an den Stationen lernt.“
  - „Wir machen Pausen. Außerhalb der Pausen will ich niemanden am Handy spielen sehen. Handys, die ich oder eine Lehrerin sehen, kommen bis zum Ende in diese Schüssel.“
  - „Ihr könnt mit mir zusammen eine eigene App-Idee entwickeln und umsetzen.“ Dazu 2–3 Beispiel-Apps zeigen.
  - „Essen nur in der Küche.“
- [ ] Schüssel für Handys bereitstellen
- [ ] Preise fürs Quiz: Urkunden für Platz 1–3 gedruckt (Vornamen von Hand), Süßigkeiten nach Platz gestaffelt, eine Alternative ohne Zucker
- [ ] Mit den Lehrkräften klären: Darf die 7. Klasse in der großen Pause zum Netto?
- [ ] Linolstation im Raum mit den Musikinstrumenten, **mit Aufsicht**
- [ ] Pia an der Linolstation: Platten zwischendurch sauber machen
- [ ] Bunte Druckfarben bereitlegen, nicht nur Schwarz
- [ ] Präsentationslaptop vorne: Start-, Zwischen- und Abschlusspräsentation
- [ ] Testgruppen vor dem Start auf der Laptop-Seite löschen

## 4. Während des Workshops

- [ ] Die Gruppen melden sich auf der Startseite an (Vornamen) und scannen an jeder Station den QR-Code.
- [ ] **Erste Laserplatte früh starten**, sobald etwa 4 Stempel da sind (eine Reihe). Der Laser ist der Engpass: Er soll ab dann durchlaufen.
  - Gemessen 09.11.: 35 Min. für 6 Stempel (40 mm, 2×), also knapp 6 Min. pro Stempel.
  - Ab Dezember Porträt statt Stempel. Geschätzt: **45 mm, Gravur 1×, ca. 3 Min. pro Porträt, 18 Porträts ≈ 1 h** (Tabelle in `entscheidungen.md`, Abschnitt 11). **Erstes Porträt anschauen**: zu blass, dann Gravur 2×. Stempel nur auf einer eigenen Platte (2×).
  - Auf eine A4-Platte passen ca. 19 Stempel (17–20). 26 Kinder → 2 Platten.
  - **Laserzeit pro Platte notieren** (für die Größenentscheidung beim nächsten Mal: 45 mm wären ca. 25 % mehr Zeit).
  - Bonus 2 (Lasercut-Porträt) nur lasern, wenn am Ende Zeit bleibt.
- [ ] Mr-Beam-Einstellungen: Material „Sperrholz Pappel 3 mm“. Gravur (Blau) 2 Durchgänge. **Schnitt (Rot): Geschwindigkeit 300, 2 Durchgänge** (getestet 02.11., das Preset allein schnitt nicht ganz durch).
  - **Schnitt geht trotzdem nicht durch:** der Reihe nach prüfen: Materialstärke in der Mr-Beam-Oberfläche wirklich 3 mm (bestimmt den Fokus)? Platte flach (verzogenes Sperrholz beschweren)? Linse sauber? Dann 1 Durchgang mehr. Stempel nicht herausbrechen, sondern den Schnitt wiederholen: Platte nicht bewegen, dieselbe Datei noch einmal laden und nur Rot (Schnitt) lasern, Blau in der Mr-Beam-Oberfläche weglassen. *Noch nicht ausprobiert.*
  - **Gravur zu langsam:** Falls die Mr-Beam-Oberfläche einen Linienabstand anbietet, an einem Probestempel 0,15 mm statt 0,1 mm testen. Druckt der Stempel noch sauber, so lassen.
- [ ] Neue Stempel erscheinen auf der Laptop-Seite unter „Stempel → A4-Holzplatte“: anhaken, „Platte zusammenstellen“, „Platte herunterladen (SVG)“, in der Mr-Beam-Oberfläche hochladen, 2× gravieren.
- [ ] Unter „Letzte Platten“: „📣 Wird gelasert“ und „📣 Fertig, abholen“ an die Gruppen schicken.
- [ ] **Angefangene Platte/Folie weiter nutzen:** Die Laptop-Seite merkt sich, was schon belegt ist (grau in der Vorschau), und setzt die nächsten Stücke auf den Rest. Platte dafür nicht verschieben und die SVG in der Mr-Beam-Oberfläche immer an derselben Stelle (A4-Ecke) ausrichten. Folie wieder oben links an die Mattenecke. Neue Platte oder Folie eingelegt: „Neue Platte eingelegt“ bzw. „Neue Folie eingelegt“ drücken (auch nach einem verworfenen Plotter-Auftrag).
- [ ] Sticker (Bonus): „Folie zusammenstellen“, dann die Plotter-Schritte auf der Laptop-Seite.
- [ ] Ca. 20 Min. vor Schluss: „Feedbackbogen für alle freigeben“ (Feedback kommt anonym, ohne Namen und ohne Gruppe).
- [ ] Abschlusspräsentation, letzte Folie: „Abschluss: Löschen auf den iPads freigeben“. Die Kinder sehen „Meine Daten“ an und tippen „Jetzt alles löschen“ (geht erst, wenn alles beim Laptop ist).
- [ ] Steht auf dem iPad „Noch nicht beim Laptop“: nichts tun, die App versucht es alle 15 Sekunden erneut.

## 5. Nach dem Workshop

- [ ] Auswertung ansehen: `/auswertung` (Sterne, KI-Frage, Feedbackbögen mit „Empfehlen? Ja/Nein“, Laserzeit pro Platte)
- [ ] Auswertung kurz durchsehen: Stehen im Feedback Namen, die der Laptop nicht kennt (Spitznamen)?
- [ ] Laptop-Seite „Für die Workshop-Verbesserung sichern (ohne Namen)“ → Ordner `archiv/workshops/<Datum>/`
- [ ] Am Ende des Workshops (steht so in `Datenschutz.md`): Laptop-Seite „Alle Daten löschen“
- [ ] In `~/Downloads` nach `platte-*.svg` und `folie-*.svg` schauen und löschen (falls doch dort gelandet)
- [ ] Pro iPad prüfen: steht „✓ Gelöscht“? Sonst Startseite → „Andere Gruppe? Neu anmelden“ oder Website-Daten in Safari löschen. Alle Safari-Tabs schließen
- [ ] Laptop-Seite: Löschen-Freigabe zurücknehmen (sonst sieht die nächste Gruppe den Hinweis sofort)
- [ ] Terminal-Fenster schließen (Server aus)
