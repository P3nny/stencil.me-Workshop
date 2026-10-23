# Aufbau-Checkliste

## 1. Testaufbau zu Hause (jetzt, ohne Router)

- [ ] Ubuntu-Rechner und iPad im selben WLAN (Heim-WLAN oder Ubuntu-Hotspot: Einstellungen → WLAN → „Hotspot einschalten“)
- [ ] HTTP-Test: im Repo `python3 -m http.server 8000`, auf dem iPad `http://<IP des Ubuntu>:8000/docs/ipad-test.html`
- [ ] HTTPS einrichten nach [https-einrichten.md](https-einrichten.md), Teile A und B
- [ ] HTTPS-Test: `https://workshop.datenhandlung.de:8443/docs/ipad-test.html`
- [ ] Beide Tests jeweils im Safari-Tab **und** als Home-Bildschirm-App (Teilen → „Zum Home-Bildschirm“)
- [ ] Testseite einmal neu laden: Steht bei IndexedDB ein „voriger Besuch“?
- [ ] Ergebnis kopieren und ins Testprotokoll in [entscheidungen.md](entscheidungen.md) eintragen

Hinweis: Ein Ubuntu-Hotspot hat oft eine andere IP als das Heim-WLAN. Dann muss der DNS-Eintrag bei INWX angepasst werden.

## 2. Testaufbau im KOMEZ (vor dem ersten Workshop)

- [ ] Antworten aus [fragen-medienzentrum.md](fragen-medienzentrum.md) liegen vor, Netz-Variante A oder B gewählt
- [ ] Router aufgestellt, WLAN-Name und Passwort notiert, kein Internet
- [ ] Ubuntu-Rechner per LAN-Kabel am Router, feste IP (DHCP-Reservierung) eingetragen
- [ ] Lokaler DNS eingerichtet ([https-einrichten.md](https-einrichten.md), Teil C)
- [ ] Mr Beam vom Ubuntu-Rechner erreichbar (Weboberfläche im Browser öffnen)
- [ ] 2 iPads: Testseite über HTTPS, Kamera und Foto, IndexedDB

## 3. Vor jedem Workshop (zu Hause, mit Internet)

- [ ] Zertifikat noch mindestens 14 Tage gültig (`acme.sh --list`), sonst erneuern
- [ ] Server-Rechner geladen, Netzteil dabei

## 4. Vorbereitung im Raum (pro iPad, ca. 2 Minuten)

- [ ] Mit Workshop-WLAN verbinden. Beim KOMEZ-WLAN „Automatisch verbinden“ ausschalten
- [ ] `https://workshop.datenhandlung.de` in Safari öffnen
- [ ] Teilen → „Zum Home-Bildschirm“, App vom Home-Bildschirm starten
- [ ] Kamera freigeben (einmal Foto testen)
- [ ] App offen lassen, nicht neu laden
