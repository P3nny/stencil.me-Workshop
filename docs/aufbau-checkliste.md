# Aufbau-Checkliste

Was vorher noch zu erledigen ist (Canva, Einwilligung, KOMEZ): [merkliste-patricia.md](merkliste-patricia.md)

## 0. Gerätecheck (so früh wie möglich)

- [ ] KOMEZ bitten, `https://stencilme-workshop.netlify.app/app/geraetecheck.html` auf einem ihrer iPads zu öffnen und das Ergebnis zu schicken
- [ ] Vor Ort über den Laptop: `http://<IP>:8000/app/geraetecheck.html` (prüft zusätzlich die Verbindung zum Laptop)
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
- [ ] IP-Adresse des Laptops notieren und beim nächsten Besuch vergleichen: Bleibt sie gleich, können die QR-Karten laminiert werden

Zu Hause lässt sich derselbe Test im Heim-WLAN machen. Er zeigt, ob die Testseite auf dem iPad funktioniert, aber nicht, ob das KOMEZ-WLAN mitspielt.

## 2. Vor jedem Workshop (zu Hause)

- [ ] Laptop voll geladen, Netzteil eingepackt
- [ ] Netlify-Version ist aktuell (Plan B)
- [ ] [notfallkarte.md](notfallkarte.md) ausgedruckt, laminierte Karten dabei (Plan C)
- [ ] QR-Codes für die Stationen: Server starten, `http://localhost:8000/qr` öffnen, Adresse wählen, drucken. Nur gültig für diese Adresse: Bekommt der Laptop im KOMEZ eine andere IP, dort neu drucken (oder Netlify-Version für Plan B mitnehmen)
- [ ] USB-Stick dabei
- [ ] Claude-Stationen (optional): Guthaben in der Claude Console prüfen, Laptop-Seite zeigt „KI (claude-sonnet-5-5): heute …“ (sonst `./server/einrichten.sh`). Braucht Internet im KOMEZ-WLAN. Ohne KI zeigen die Stationen Beispiele
- [ ] Einwilligungen der Erziehungsberechtigten liegen vor (Fotos auf dem Laptop, Claude-Stationen), `Datenschutz.md` ist vorab verschickt
- [ ] `docs/datenschutz-kurz.md` ausgedruckt (Aushang)

## 3. Aufbau im Raum

- [ ] Laptop ins KOMEZ-WLAN, Netzteil anschließen, Laptop **aufgeklappt** lassen
- [ ] Terminal im Repo-Ordner öffnen: `./server/start.sh`
  - Der Browser öffnet die Laptop-Seite mit QR-Code und Stempel-Liste.
  - Der Laptop geht nicht in den Ruhezustand, solange das Terminal-Fenster offen ist.
  - Nach jedem Update den Server neu starten. Die Laptop-Seite zeigt sonst einen pinken Hinweis.
- [ ] Laptop-Seite: Anzahl Schüler:innen eintragen
- [ ] Laptop-Bildschirm mit dem QR-Code zu den iPads drehen
- [ ] Pro iPad: Einstellungen → Safari → Erweitert → Website-Daten: alte Daten der Workshop-Adresse löschen (Fotos der letzten Gruppe)
- [ ] Pro iPad: alle alten Safari-Tabs schließen, QR-Code in **Safari** öffnen (nicht „Zum Home-Bildschirm“), ein Testfoto machen, danach mit `?test` → „Alles zurücksetzen“
- [ ] App offen lassen, nicht neu laden

## 4. Während des Workshops

- [ ] Die Gruppen melden sich auf der Startseite an (Vornamen) und scannen an jeder Station den QR-Code.
- [ ] Neue Stempel erscheinen auf der Laptop-Seite unter „Stempel → A4-Holzplatte“: anhaken, „Platte zusammenstellen“, „Platte herunterladen (SVG)“, in der Mr-Beam-Oberfläche hochladen, 2× gravieren.
- [ ] Unter „Letzte Platten“: „📣 Wird gelasert“ und „📣 Fertig, abholen“ an die Gruppen schicken.
- [ ] Sticker (Bonus): „Folie zusammenstellen“, dann die Plotter-Schritte auf der Laptop-Seite.
- [ ] Gegen Ende: „Feedbackbogen für alle freigeben“.
- [ ] Abschlusspräsentation, letzte Folie: „Abschluss: Löschen auf den iPads freigeben“. Die Kinder sehen „Meine Daten“ an und tippen „Jetzt alles löschen“ (geht erst, wenn alles beim Laptop ist).
- [ ] Steht auf dem iPad „Noch nicht beim Laptop“: nichts tun, die App versucht es alle 15 Sekunden erneut.

## 5. Nach dem Workshop

- [ ] Auswertung ansehen: `/auswertung` (Sterne, KI-Frage, Feedbackbögen)
- [ ] Ergebnis-Mappen für die Lehrkraft: USB-Stick einstecken, Laptop-Seite „Auf USB-Stick kopieren“ (oder „Alle Mappen als ZIP herunterladen“ und selbst auf den Stick ziehen). Stick erst nach „Auswerfen“ abziehen. Einzelne Mappe: „ZIP“ in der Gruppen-Tabelle
- [ ] Spätestens eine Woche nach dem Workshop (steht so in `Datenschutz.md`): Laptop-Seite „Alle Daten löschen“
- [ ] Pro iPad prüfen: steht „✓ Gelöscht“? Sonst Startseite → „Andere Gruppe? Neu anmelden“ oder Website-Daten in Safari löschen. Alle Safari-Tabs schließen
- [ ] Laptop-Seite: Löschen-Freigabe zurücknehmen (sonst sieht die nächste Gruppe den Hinweis sofort)
- [ ] Terminal-Fenster schließen (Server aus)
