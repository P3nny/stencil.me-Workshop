# Datenschutz: Notizen für die spätere `Datenschutz.md`

Sammlung, kein fertiger Text. Wird in einem eigenen Schritt zu einer kindgerechten `Datenschutz.md` ausgearbeitet. Bei jeder Änderung am Datenweg hier einen Punkt ergänzen.

## Was bleibt auf dem iPad

- **Foto:** wird nur auf dem iPad verarbeitet (Personenerkennung, Schwarz-Weiß, Stempel). Es wird nicht gesendet.
- **Personenerkennung (BodyPix):** läuft auf dem iPad. Programm und Modell kommen vom Laptop oder von Netlify, nicht von Google.
- **Keine Anfragen an fremde Dienste:** keine CDNs, keine Google Fonts, keine Tracker (seit Branch `feature/stabilitaet`).
- **Stempel-Warteschlange:** Jeder abgeschickte Stempel (SVG + Vorname/Kürzel) liegt im Browser-Speicher des iPads (IndexedDB `stencilme`). **Er bleibt dort auch nach dem Workshop.** Löschen ist noch offen (Roadmap Schritt 8).
- **Testseite `docs/ipad-test.html`:** speichert nur einen Zeitstempel (IndexedDB `ipad-test`).

## Stationen-App (geplant, Stand 24.10.2026, siehe `docs/screens.md`)

- **Rohfoto (Ausgangsfoto):** wird auf dem iPad bearbeitet und **geht seit 24.10.2026 auch an den Laptop** (erst bei „Station beendet“, nur das letzte Foto pro Person, keine verworfenen Versuche) (Patricia: lückenlose Dokumentation, die Kinder sollen am Ende nachvollziehen können, was gespeichert war). Ablage `server/daten/gruppen/<ID>/dateien/foto_*.jpg`. Muss in `Datenschutz.md` und in die Einwilligung. Das Video der Körpererkennung bleibt weiter nur im Arbeitsspeicher des iPads (wird nirgends gespeichert).
- **An den Laptop sollen gehen:** Check-in und „Station beendet“ (Name/Kürzel, Station, Uhrzeit), Textantworten, Bewertung (Sterne), Input-Fotos der Stationen (z. B. Foto vom Lasercutter).
  → Input-Fotos können Kinder zeigen (z. B. am Laser). Hinweis in der App: „Fotografiere die Maschine, nicht die Leute“?
- **Station Bild bearbeiten:** Foto, Schwarz-Weiß-Bild und Personenmaske bleiben auf dem iPad (Schwarz-Weiß-Porträt auch fürs Puzzle in IndexedDB). An den Laptop geht nur die Stempel-Datei (SVG) mit Vorname/Spitzname, wie bisher in `stencil.html`.
- **Foto-Station:** BodyPix prüft auf dem iPad, ob eine Person auf dem Foto ist. Ergebnis (erkannt/nicht erkannt) bleibt auf dem iPad und geht nicht an den Laptop.
- **Lasercutter:** Erklärvideo „Wie funktioniert ein Laser Cutter?“ (Coding For Tomorrow, YouTube `VKd2WsdRPvY`) eingebettet als Zwei-Klick-Lösung über `youtube-nocookie.com`: Erst nach „Video laden“ geht die IP-Adresse des iPads an Google/YouTube (Online-Dienst, keine Kinderdaten). Etikett Datenweg der Station prüfen (Laptop + Online). *Alternative: Video lokal abspielen, falls die Lizenz das erlaubt.*
- **A4-Platte (Laptop):** Die Laptop-Seite setzt die Stempel zu einer Datei zusammen. Welche Stempel schon auf einer Platte waren, merkt sich nur der Browser am Laptop.
- **Körpererkennung testen:** Das Video (Kinder in Bewegung) bleibt nur im Arbeitsspeicher des iPads, solange die Seite offen ist, und wird nirgends gespeichert. An den Laptop geht ein Standbild der KI-Ansicht (Video-Bild mit Gesicht + KI-Farben, entschieden 24.10.) und die Antworten auf die zwei Ethik-Fragen.
- **KI-Selbstporträt (neu, Online-Dienst!):** Das iPad schickt die Baukasten-Auswahl an den Laptop. Der Laptop schickt den daraus gebauten Satz an **Anthropic (Claude-API, USA)**, z. B. „Selbstporträt im Stil von Frida Kahlo, 14-jähriger Junge, braune Augen, kinnlange blonde Haare, Brille“. Kein Name, kein Foto, keine Gruppen-ID, kein freier Text. Rechtlicher Rahmen: Commercial Terms der API (nicht das private Pro-Abo). Auf dem Laptop: die erzeugten SVGs bei der Gruppe und `server/daten/ki-protokoll.jsonl` (Zeit, Gruppen-ID, Prompt, Token, Kosten), beides löscht „Alle Daten löschen“. → **Muss in `Datenschutz.md` und in die Einwilligung.** Offen: Aufbewahrung bei Anthropic laut deren API-Bedingungen nachlesen und kindgerecht erklären.
- **Quiz-Stationen:** Nur das Ergebnis („x von 9 richtig“) geht mit „beendet“ an den Laptop. Kunst-Quiz zusätzlich: Foto vom Lieblings-Streetart-Werk pro Person (Hinweis: nur das Bild, keine Leute).
- **Nachrichten vom Laptop:** `server/daten/nachrichten.json` (Gruppen-ID, Zeit, Text wie „Der Stempel von Ada und Bo ist fertig“). Ein iPad kann nur die Nachrichten der eigenen Gruppe abrufen (zufällige 12-stellige ID). Stempel-Dateinamen enthalten jetzt die Gruppen-ID. „Alle Daten löschen“ löscht beides.
- **Bonus-Sticker:** wie Stempel: SVG mit Vorname an den Laptop (`server/daten/sticker`), „Alle Daten löschen“ erfasst den Ordner.
- **Diktieren (Mikrofon-Taste der iPad-Tastatur):** Die App nutzt keine eigene Spracherkennung. Unter Textfeldern steht nur ein Hinweis auf die Mikrofon-Taste. Diktieren läuft über Apple (je nach Gerät auf dem iPad oder bei Apple-Servern) → in `Datenschutz.md` erwähnen, beim KOMEZ fragen, ob Diktieren erlaubt ist.
- **Hintergrund ändern (vorher Greenscreen):** Freistellen auf dem iPad. **Neu:** Das fertige Bild (Gesicht des Kindes vor neuem Hintergrund) geht an den Laptop, für die Ergebnis-Mappe (entschieden 24.10.). Damit liegt erstmals ein Foto der Kinder auf dem Laptop → in `Datenschutz.md` und Einwilligung aufnehmen, beim Löschen nach dem Workshop mitlöschen („Alle Daten löschen“ erfasst es).
- **Gebaut (Gerüst):** Auf dem iPad liegt alles in IndexedDB `werkstatt` (Gruppe, Fortschritt, Antworten, Fotos, Outbox). Auf dem Laptop: `server/daten/gruppen/<Gruppen-ID>/ereignisse/*.json` (Anmeldung mit Vornamen, Check-in, Beendet mit Antworten, KI-Antwort und Sternen) und `…/dateien/` (nur Fotos aus Stationen mit `"hochladen": true`, z. B. Lasercutter).
- **Wer sieht was:** Die iPads können nur abfragen, wie viele Gruppen an jeder Station sind (ohne Namen). Gruppen, Antworten und Fotos sieht nur die Laptop-Seite.
- **Löschen:** „Alle Daten löschen“ auf der Laptop-Seite löscht Stempel, Antworten und Fotos. Auf dem iPad: noch offen (Roadmap 8), zum Testen `?test` → „Alles zurücksetzen“.

- **Speicher auf dem iPad:** Fotos liegen in den Website-Daten von Safari (IndexedDB `werkstatt`), nicht in der Fotos-App. Alle Stationen derselben Adresse auf diesem iPad sehen sie, andere iPads nicht. **Bleiben, bis sie gelöscht werden:** Nach dem Workshop Website-Daten löschen, sonst sieht die nächste Gruppe am iPad die Fotos.

## Was an den Laptop geht (Plan A)

- **Stempel-Datei (SVG)** und **Vorname oder Kürzel**, mehr nicht. Kein Foto.
- Der Stempel zeigt den Umriss des Porträts. Er ist also vermutlich personenbezogen (Person erkennbar).
- Ablage: `server/daten/stempel/<Datum>/<Uhrzeit>_<Name>_<ID>.svg`, nicht im Git-Repo.
- **Wer sieht es:** nur wer am Laptop sitzt. iPads können die Laptop-Seite und die Stempel anderer Kinder nicht öffnen.
- **Löschen:** Knopf „Alle Stempel löschen“ auf der Laptop-Seite (nach dem Workshop, siehe Aufbau-Checkliste).
- Netzwerk: KOMEZ-WLAN, unverschlüsselte Verbindung (HTTP) zwischen iPad und Laptop. Andere Geräte im selben WLAN könnten mitlesen.

## Plan B und C: Online-Dienste

- **Netlify (Plan B):** Die App-Dateien kommen von Netlify. Netlify sieht dabei die IP-Adresse der iPads (Server-Protokolle). Fotos und Stempel gehen nicht an Netlify.
- **Teilen / Pairdrop (Plan B und C):** Der Stempel geht über Pairdrop. Die Geräte finden sich über den Pairdrop-Server im Internet. Die Datei geht direkt von Gerät zu Gerät oder, wenn das nicht klappt, über einen Server im Internet.
  → Laut `CLAUDE.md` geht kein Foto eines Kindes an einen Online-Dienst, ohne dass es in `Datenschutz.md` steht und Einwilligungen vorliegen. **Klären, ob das für Stempel-Dateien über Pairdrop gilt.**

## Offene Fragen

- Wie lange bleiben die Stempel auf dem Laptop? Wer löscht sie wann?
- Wie werden die Daten auf den iPads gelöscht (IndexedDB)? Knopf in der App oder Website-Daten in Safari löschen?
- Ist der Stempel personenbezogen? Falls ja: Einwilligung nötig?
- Pairdrop als Rückfallebene: erlaubt, oder durch USB-Stick/AirDrop ersetzen?
- Zurückgestellt: Bei HTTPS mit eigener Domain würde der Name `workshop.datenhandlung.de` öffentlich protokolliert (keine Kinderdaten).
