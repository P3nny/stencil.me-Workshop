# Entscheidungen

Stand: 23.10.2026, Schritt 0 (Infrastruktur, überarbeitet)

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
| „Zum Home-Bildschirm“ evtl. gesperrt | MDM unbekannt | App muss auch im normalen Safari-Tab laufen |
| Mr Beam ist vom Laptop im KOMEZ-WLAN erreichbar | noch nicht geprüft, beim nächsten Besuch testen | USB-Stick, später lasern |

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
- Großes Aufteilen von `index.html`, Stationen-App, Anmeldung, Outbox

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

1. Frage ans KOMEZ schicken, 30-Minuten-Test vor Ort vereinbaren ([fragen-medienzentrum.md](fragen-medienzentrum.md)).
2. Stabilität in `index.html`: Bibliotheken lokal, Bilder auf 1024 px verkleinern, leere Maske abfangen.
3. Minimaler Upload: Server, Startskript mit QR-Code. In der App: „Stempel speichern“, „An Laptop senden“, „Teilen“.
4. Testlauf im KOMEZ spätestens eine Woche vorher.

---

## 4. Ergebnisse an die Kinder — offen

Aktueller Plan: ZIP auf USB-Stick an die Lehrkraft.

## 5. Claude-Station — offen

Eigener API-Schlüssel mit Ausgabenlimit, Nutzungsbedingungen prüfen.

## 6. Ersatz für Canva und KI-Selbstporträt — offen

## 7. Erklärer-/Macher-Rotation oder freier Ablauf — offen

---

## Testprotokoll

| Datum | Gerät (Modell, iPadOS) | Browser | Adresse | Ergebnis |
| ----- | ---------------------- | ------- | ------- | -------- |
|       |                        |         |         |          |
