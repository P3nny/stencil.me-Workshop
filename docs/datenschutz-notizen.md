# Datenschutz: Notizen für die spätere `Datenschutz.md`

Sammlung, kein fertiger Text. Wird in einem eigenen Schritt zu einer kindgerechten `Datenschutz.md` ausgearbeitet. Bei jeder Änderung am Datenweg hier einen Punkt ergänzen.

## Was bleibt auf dem iPad

- **Foto:** wird nur auf dem iPad verarbeitet (Personenerkennung, Schwarz-Weiß, Stempel). Es wird nicht gesendet.
- **Personenerkennung (BodyPix):** läuft auf dem iPad. Programm und Modell kommen vom Laptop oder von Netlify, nicht von Google.
- **Keine Anfragen an fremde Dienste:** keine CDNs, keine Google Fonts, keine Tracker (seit Branch `feature/stabilitaet`).
- **Stempel-Warteschlange:** Jeder abgeschickte Stempel (SVG + Vorname/Kürzel) liegt im Browser-Speicher des iPads (IndexedDB `stencilme`). **Er bleibt dort auch nach dem Workshop.** Löschen ist noch offen (Roadmap Schritt 8).
- **Testseite `docs/ipad-test.html`:** speichert nur einen Zeitstempel (IndexedDB `ipad-test`).

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
