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

Zu Hause lässt sich derselbe Test im Heim-WLAN machen. Er zeigt, ob die Testseite auf dem iPad funktioniert, aber nicht, ob das KOMEZ-WLAN mitspielt.

## 2. Vor jedem Workshop (zu Hause)

- [ ] Laptop voll geladen, Netzteil eingepackt
- [ ] Netlify-Version ist aktuell (Plan B)
- [ ] [notfallkarte.md](notfallkarte.md) ausgedruckt, laminierte Karten dabei (Plan C)
- [ ] USB-Stick dabei

## 3. Aufbau im Raum

- [ ] Laptop ins KOMEZ-WLAN, Startskript starten (kommt in einem späteren Schritt; bis dahin wie in Teil 1)
- [ ] QR-Code sichtbar aufstellen
- [ ] Pro iPad: QR-Code scannen, Seite öffnen, Teilen → „Zum Home-Bildschirm“, App vom Home-Bildschirm starten, ein Testfoto machen
- [ ] App offen lassen, nicht neu laden
