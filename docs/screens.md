# Screens der Workshop-App

Arbeitsplan für den Bau der Stationen-App. Patricia beschreibt jeden Screen, Claude ergänzt Hinweise (*kursiv*) und baut nach Freigabe. Ein Screen pro Branch. Ziel: Test vor Ort am **02.11.2026**.

## Grundprinzip

- Patricia gibt zu Beginn auf der Laptop-Seite die Anzahl der Schüler:innen ein. Anzahl und Reihenfolge der Stationen kommen aus den Daten in `stationen/`.
- Fortschritt: „x von y Stationen“. Oben setzt sich pro abgeschlossener Station ein Puzzleteil des stencil.me-Porträts zusammen, bei Paaren zwei Porträts.
- Ablauf jeder Station: QR-Code scannen (Check-in) → Station bearbeiten → **Input** (Bild-Upload, Text oder Quiz) → „Station beendet“ → „Wie hat dir die Station gefallen?“
- Check-in und „beendet“ gehen an den Laptop. Er weiß so, welche Stationen besetzt sind.
- Das Paar behält sein iPad für alle Stationen. Alles wird zuerst auf dem iPad gespeichert (IndexedDB).

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

## Screen 3: Bild bearbeiten (stencil.me)

- Nimmt die Fotos aus Screen 2 und die Namen aus Screen 1
- Jeder Schritt ist sichtbar: Rohbild → Schwarz-Weiß → BodyPix → Otsu → Stempel
- Frage: „Was bedeuten die Farben?“ (Texteingabe)
- Input: Der fertige Stempel geht an den Laptop
- *Die Bildverarbeitung kommt nach `app/core/`. Die vorhandene Outbox aus `stencil.html` wird durch `app/core/outbox.js` ersetzt.*

## Screen 4: Lasercutter

- „Geht zu Penny am Lasercutter“. Zusehen beim Positionieren, den Laser anschauen, Erklärvideo (Link)
- Eingabe: eine Frage an die Person am Laser, dazu die Antwort
- Input: Foto vom Lasercutter
- Für Penny: Die Laptop-Seite ordnet die Stempel auf einer A4-SVG an. Ist die Platte voll, wird sie heruntergeladen und in der Mr-Beam-Oberfläche geöffnet. Einzelne Stempel gehen weiterhin.

## Screen 5: Greenscreen

- Das Rohfoto wird auf dem iPad freigestellt (BodyPix)
- Die Jugendlichen wählen einen Hintergrund aus festen, gemeinfreien Bildern
- Canva fällt weg, dafür gibt es eine eigene Seite (HTML, CSS, JavaScript)
- *Offen: Input = Bild mit Hintergrund. Nur auf dem iPad speichern oder an den Laptop senden?*

## Weitere Screens

- *Patricia beschreibt sie noch:* BodyPix live, Pixel vs. Vektor, Coding, Mit der Hand drucken, Künstler:innen, Streetart, Berufe, Kunst- und Code-Quiz …
