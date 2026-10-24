# Aufbau-Checkliste

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
- [ ] KI-Selbstporträt: Guthaben in der Claude Console prüfen, Laptop-Seite zeigt „KI-Selbstporträt: claude-haiku-5-5 …“ (sonst `./server/einrichten.sh`). Braucht Internet im KOMEZ-WLAN

## 3. Aufbau im Raum

- [ ] Laptop ins KOMEZ-WLAN, Netzteil anschließen, Laptop **aufgeklappt** lassen
- [ ] Terminal im Repo-Ordner öffnen: `./server/start.sh`
  - Der Browser öffnet die Laptop-Seite mit QR-Code und Stempel-Liste.
  - Der Laptop geht nicht in den Ruhezustand, solange das Terminal-Fenster offen ist.
- [ ] Laptop-Bildschirm mit dem QR-Code zu den iPads drehen
- [ ] Pro iPad: Einstellungen → Safari → Erweitert → Website-Daten: alte Daten der Workshop-Adresse löschen (Fotos der letzten Gruppe)
- [ ] Pro iPad: QR-Code in **Safari** öffnen (nicht „Zum Home-Bildschirm“), ein Testfoto machen, danach mit `?test` → „Alles zurücksetzen“
- [ ] App offen lassen, nicht neu laden

## 4. Während des Workshops

- [ ] Die Kinder tippen beim Negativ-Stempel ihren Vornamen oder ein Kürzel ein und dann „Stempel abschicken“.
- [ ] Neue Stempel erscheinen auf der Laptop-Seite (pink markiert).
- [ ] In der Mr-Beam-Oberfläche die Dateien aus dem angezeigten Ordner hochladen.
- [ ] Steht auf dem iPad „Noch nicht beim Laptop“: nichts tun, die App versucht es alle 15 Sekunden erneut.

## 5. Nach dem Workshop

- [ ] Stempel auf USB-Stick sichern, falls sie noch gebraucht werden
- [ ] Laptop-Seite: „Alle Daten löschen“
- [ ] Pro iPad: Website-Daten in Safari löschen (bis es in der App einen Knopf dafür gibt)
- [ ] Terminal-Fenster schließen (Server aus)
