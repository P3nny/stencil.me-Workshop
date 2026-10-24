# Entscheidungen

Stand: 24.10.2026 (Schritt 0 vom 23.10., danach Stationen-App)

Status-Werte: **entschieden** · **vorgeschlagen** (Test ausstehend) · **zurückgestellt** · **offen**

## Grundsatz

- **Jede Ausbaustufe muss den Workshop allein tragen.** Die alte Stufe (laminierte Karten, Pairdrop) bleibt immer als Rückfallebene.
- So wenig Technik wie möglich. Alles muss sich auch ohne Netzwerkwissen bedienen lassen.
- Die Bildverarbeitung läuft auf dem iPad. Netz braucht man nur, um die App zu laden und die fertige Stempel-Datei zu übertragen.

---

## Arbeitsannahmen (bis zur Antwort des KOMEZ, frühestens 02.11.2026)

Wir bauen mit diesen Annahmen weiter. Stellt sich eine als falsch heraus, greift der jeweilige Plan B.

| Annahme | Begründung | Falls falsch |
| --- | --- | --- |
| iPads im KOMEZ-WLAN können den Laptop erreichen | Laptop durfte ins WLAN, Pairdrop lief zwischen Geräten | Plan B (Netlify + Teilen) |
| Safari auf den iPads ist nutzbar | Pairdrop lief im Browser | Plan C (Karten) |
| iPads sind älter, wenig Arbeitsspeicher (2–3 GB) | Abstürze bei der Bildverarbeitung im letzten Workshop | — darum: Bilder klein rechnen, Fehler abfangen |
| iPadOS-Version unbekannt | — | vorsichtige Syntax (kein `?.`, `??`), keine neuen Web-APIs voraussetzen |
| ~~„Zum Home-Bildschirm“ evtl. gesperrt~~ | entschieden 24.10.: wird nicht benutzt | App läuft im normalen Safari-Tab |
| Mr Beam ist vom Ubuntu-Laptop erreichbar | laut Patricia möglich, Test am 02.11. | Pairdrop vom Laptop an das KOMEZ-MacBook am Mr Beam |

Tests laufen mit Patricias Ubuntu-Laptop und ihrem eigenen iPad. Das ist eine Annäherung: Die KOMEZ-iPads können älter und langsamer sein.

---

## 1. Server: Ubuntu-Laptop — entschieden

- Ein kleiner Server (Python) auf dem Ubuntu-Laptop liefert die App aus und nimmt Stempel-Dateien entgegen.
- Ein Startskript startet den Server, verhindert den Ruhezustand und zeigt einen QR-Code mit der Adresse.
- Der Windows-Rechner wird nicht gebraucht.

## 2. Netz: KOMEZ-WLAN mit Rückfallebenen — vorgeschlagen

**Plan A: Laptop im KOMEZ-WLAN**

- Der Laptop hängt im KOMEZ-WLAN. Kein eigener Router.
- Die iPads öffnen `http://<Laptop-IP>:8000` per QR-Code.
- Fotos über die Kamera-App des iPads (`<input type="file" capture>`): braucht kein HTTPS und ist auf alten iPads stabiler.
- Stempel-Dateien gehen per Knopfdruck an den Laptop.
- Voraussetzung: Geräte im KOMEZ-WLAN dürfen sich gegenseitig erreichen (keine Client-Isolation).
  - Bekannt: Der Laptop durfte schon ins KOMEZ-WLAN.
  - Pairdrop lief zwischen den iPads. Das ist ein gutes Zeichen, aber kein Beweis: Pairdrop findet Geräte über seinen Internet-Server und leitet Dateien notfalls über einen Umweg im Internet.
  - Test (5 Minuten): siehe [aufbau-checkliste.md](aufbau-checkliste.md).

**Plan B: Netlify + Datei teilen**

- Dieselbe App von `https://stencilme-workshop.netlify.app`. Die Bearbeitung läuft auf dem iPad.
- Die Stempel-Datei geht über den Knopf „Teilen“ weiter, z. B. per Pairdrop.

**Plan C: wie früher**

- Laminierte Karten, Übertragung per Pairdrop.

Umschalten zwischen den Plänen heißt: einen anderen QR-Code zeigen. Was bei Problemen zu tun ist, steht in [notfallkarte.md](notfallkarte.md).

## 3. Laser: Handarbeit — entschieden (für den nächsten Workshop)

- Der Laptop zeigt alle eingegangenen Stempel. Patricia lädt sie wie bisher in die Mr-Beam-Oberfläche und ordnet sie auf der Platte an.
- Keine automatische Anbindung an den Mr Beam vor dem Workshop.

## Zurückgestellt (nach dem Workshop, nur bei Bedarf)

- Eigener Router ohne Internet
- HTTPS mit `workshop.datenhandlung.de` (Anleitung: [https-einrichten.md](https-einrichten.md))
- Laser-Queue mit automatischem Anordnen
- Großes Aufteilen von `index.html` (stattdessen: Funktionen wandern in Stationen, sobald ein Screen sie braucht)

### Warum zurückgestellt: Risiken des Router-/HTTPS-Aufbaus

| Risiko | Wahrscheinlichkeit | Folge | Vorher testbar? |
| --- | --- | --- | --- |
| iPads per MDM gesperrt: kein WLAN-Wechsel, kein Home-Bildschirm | mittel | ganzer Aufbau unbrauchbar | nur mit KOMEZ |
| iPads springen zurück ins KOMEZ-WLAN | hoch | App nicht erreichbar | nur vor Ort |
| Lokaler DNS falsch eingerichtet | mittel | Adresse lädt nicht | teilweise |
| Zertifikat abgelaufen (90 Tage) | mittel | Seite blockiert | ja |
| Ubuntu in zwei Netzen: Routing-Fehler | mittel | Mr Beam oder iPads nicht erreichbar | teilweise |
| Automatische Mr-Beam-Anbindung | hoch | Laser-Queue fällt aus | kaum |
| Fehlersuche vor Ort braucht Netzwerkwissen | hoch | nur Patricia kann es lösen | – |
| Kein Testlauf im KOMEZ vor dem Workshop | hoch | Probleme erst mit 26 Jugendlichen | – |

## Reihenfolge bis zum nächsten Workshop (< 4 Wochen)

1. ~~Frage ans KOMEZ schicken~~, Test vor Ort am **02.11.2026** ([fragen-medienzentrum.md](fragen-medienzentrum.md)).
2. ~~Stabilität in `index.html`~~ (erledigt)
3. ~~Minimaler Upload~~ (erledigt, auf eigenem iPad getestet)
4. **Neu (24.10.):** Nicht auf Tests warten, sondern die Stationen-App Screen für Screen bauen ([screens.md](screens.md)). Am 02.11. wird alles zusammen vor Ort getestet.

## Entscheidungen vom 24.10.2026 (Stationen-App)

- **Ablauf:** Check-in, danach immer zuerst das Foto, dann stencil.me, dann Laser. Danach verteilt die App die Gruppen über `braucht` und `plaetze` (siehe Punkt 7).
- ~~**Rohfoto bleibt auf dem iPad**~~ (überholt durch Punkt 8: alle Fotos an den Laptop). Das Paar behält sein iPad für alle Stationen.
- **Laser:** Der Laptop ordnet die Stempel auf einer A4-SVG an, Patricia lädt sie in die Mr-Beam-Oberfläche. Einzelne Stempel bleiben möglich. Keine Mr-Beam-Schnittstelle.
- **Anzahl Schüler:innen** gibt Patricia auf der Laptop-Seite ein.
- **Safari statt Home-Bildschirm-App:** Die QR-Codes an den Stationen öffnen Safari. Eine Home-Bildschirm-App hat einen eigenen Speicher. Alle Stationen unter derselben Adresse teilen auf einem iPad einen Speicher, andere iPads sehen ihn nicht. Die Fotos liegen in den Website-Daten von Safari (IndexedDB), nicht in der Fotos-App. Die Adresse darf während des Workshops nicht wechseln. Nach dem Workshop werden die Website-Daten auf jedem iPad gelöscht.
- **Canva fällt weg**, die Greenscreen-Station wird eine eigene Seite mit festen, gemeinfreien Hintergründen.
- **Test am Rechner** mit Playwright-WebKit (dieselbe Engine wie Safari). Kamera, Speicher und Tempo alter iPads prüft nur das echte iPad.

---

## 4. Ergebnisse an die Kinder — entschieden (24.10.2026)

ZIP pro Paar auf USB-Stick an die Lehrkraft, Verteilung über die Schulplattform (siehe Punkt 8). Der ZIP-Export ist noch nicht gebaut.

## 5. Claude-Stationen — entschieden (24.10.2026)

- Für das KI-Selbstporträt: **Claude-API mit eigenem Schlüssel**, nicht das Pro-Abo. Laut Anthropic dürfen Anfragen für andere Nutzer:innen nicht über Pro/Max-Zugänge laufen, Pro-Kontingente gelten für „ordinary, individual usage“ (code.claude.com/docs/en/legal-and-compliance)
- Schlüssel nur auf dem Laptop (`~/.config/stencilme/anthropic-key`, nicht im Repo), Guthaben vorab ohne automatisches Nachladen, Ausgabenlimit im Workspace `stencilme-workshop`, zusätzlich Grenzen im Server (6 pro Gruppe, 150 pro Tag)
- Modell: **Claude Sonnet 5.5** (Vergleich 24.10. mit demselben Prompt: Haiku 17 s / 0,2 Cent, sehr grob; Sonnet 52 s / 7 Cent, deutlich besser; Opus 71 s / 15 Cent, kaum besser als Sonnet). Ca. 2–6 € pro Workshop. Mit Rückfall-Modell bei Ablehnung (`fallbacks: "default"`). Umstellbar mit `STENCILME_KI_MODELL`
- Zweite Claude-Station: **Bild-App vibe coden** (Lückentext, Streaming, App läuft abgeschottet, 3 pro Gruppe, 60 pro Tag). Die Code-Erklärung bleibt ein Quiz ohne Claude
- **Beide Claude-Stationen sind optional** (Patricia, 24.10. spät): zählen nicht zu „x von 11“, nur mit Einwilligung. Erklärung zu den Anthropic-Vorgaben für Minderjährige steht in `Datenschutz.md`

## 6. Ersatz für Canva und KI-Selbstporträt — entschieden (24.10.2026)

- Hintergrund ändern: eigene Station mit BodyPix (Screen 5)
- KI-Selbstporträt: Claude zeichnet SVG aus einem Prompt-Baukasten (Screen 9). Kein Foto der Kinder, kein freier Text, nur die ausgewählten Merkmale gehen an Anthropic

## 7. Erklärer-/Macher-Rotation oder freier Ablauf — entschieden (24.10.2026)

Freier Ablauf: Die App schlägt die nächste Station vor (Voraussetzungen `braucht`, freie `plaetze`). Keine feste Rotation.

## 8. Entscheidungen vom 24.10.2026, abends

- **Sticker:** Cameo 4 mit Stift + Messer wie `archiv/00_fotobox-karte/fotobox-queue.py` (Stift zeichnet Schraffur auf weiße Folie, Messer schneidet außen)
- **Kunst-Quiz-Bilder:** urheberrechtlich geschützt, darum **nur über den Laptop** ausliefern (nicht im Repo, nicht auf GitHub/Netlify)
- **Daten an die Kinder:** ZIP pro Paar auf USB-Stick an die Lehrkraft, Verteilung über die Schulplattform. Am Ende sieht jedes Paar auf dem iPad, was auf dem Laptop gespeichert war
- **Alle Fotos an den Laptop**, auch das Ausgangsfoto, damit die Dokumentation lückenlos ist (muss in `Datenschutz.md`)
- Reihenfolge der nächsten Schritte: Abschluss jeder Station → alle Fotos → Nachrichten an Gruppen → Sticker-Folie + Plotter → Bonus 2 Positiv → ZIP + „Meine Daten“ → Berufe → Kunst-Quiz-Bilder

## 9. Entscheidungen vom 24.10.2026, spät

- **Fotos an den Laptop** erst bei „Station beendet“, nur das letzte pro Person, keine verworfenen Versuche
- **Feedbackbogen** nach Bonus 1 oder über den Laptop-Knopf „für alle freigeben“, jede Person einzeln. **Bonus 2 Lasercut-Porträt** nach Sticker + Feedbackbogen, blau = gravieren, rot = schneiden
- **Bonus 1 (Sticker)** bleibt bei 8 geschafften Stationen (jetzt 8 von 11)
- **Nachrichten-Abfrage** einmal pro Minute. **Diktieren** nur als Hinweis auf die Mikrofon-Taste, keine eigene Spracherkennung
- **Datenschutz:** `Datenschutz.md` im Stil der Stationstexte, Kontakt patricia.ennenbach@bildung.koeln.de, Löschung auf dem Laptop spätestens eine Woche nach dem Workshop
- **Android-Tablets:** nicht getestet. Wahrscheinlich lauffähig (Tests laufen auch in Chromium), Risiko: QR-Scan öffnet einen anderen Browser mit eigenem Speicher

---

## Testprotokoll

| Datum | Gerät (Modell, iPadOS) | Browser | Adresse | Ergebnis |
| ----- | ---------------------- | ------- | ------- | -------- |
| 23.10.2026 | iPad Air 11-inch, iPadOS 27.0.1 (Patricias iPad, neuer als die KOMEZ-iPads) | Safari | Heim-WLAN, `http://<Laptop-IP>:8000/` (Branch `feature/upload`) | Upload Stempel → Laptop reibungslos |
| 23.10.2026 | iPad Air 11-inch, iPadOS 27.0.1 | Safari | Heim-WLAN, Branch `feature/upload` | Stabilität Test 2 (Foto ohne Person): kein Absturz, Stempel nicht leer. Tests 1, 3, 4 auf altem KOMEZ-iPad ausstehend |
