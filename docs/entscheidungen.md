# Entscheidungen

Stand: 23.10.2026, Schritt 0 (Infrastruktur)

Status-Werte: **entschieden** · **vorgeschlagen** (Test ausstehend) · **offen**

---

## 1. Server: Ubuntu-Rechner — entschieden

- Der Workshop-Server (Python/Flask, ab Schritt 3) läuft auf dem **Ubuntu-Rechner**.
- Gründe: Adminrechte vorhanden, Python ist schon installiert, Claude-CLI läuft dort, stabil.
- Der Windows-Rechner wird nicht gebraucht. `find.mrbeam` ist nur eine Suchhilfe. Im selben Netz ist der Mr Beam direkt über seine IP erreichbar.
- Noch prüfen: Erreicht der Ubuntu-Rechner den Mr Beam (Weboberfläche im Browser öffnen)?

## 2. HTTPS: `workshop.datenhandlung.de` — vorgeschlagen

Problem:

- Auf dem iPad gibt Safari die Kamera im Browser nur über HTTPS frei.
- Die Netlify-Seite (`https://stencilme-workshop.netlify.app`) darf keinen HTTP-Server im WLAN ansprechen, weil der Browser „gemischte Inhalte“ blockiert.
- Ohne Internet im Workshop-WLAN lädt die Netlify-Seite außerdem nicht.

Lösung:

- Die App kommt im Workshop vom Ubuntu-Server: **`https://workshop.datenhandlung.de`**.
- Das Zertifikat ist echt (Let's Encrypt). Es wird per DNS-Prüfung über die INWX-Schnittstelle geholt (`acme.sh`, `dns_inwx`). Auf den iPads muss nichts installiert werden.
- Das Zertifikat gilt 90 Tage. **Vor jedem Workshop zu Hause erneuern**, dafür braucht der Rechner Internet.
- Namensauflösung:
  - zu Hause: öffentlicher DNS-Eintrag bei INWX, der auf die Heimnetz-IP zeigt
  - im Workshop: lokaler DNS (Router oder `dnsmasq` auf Ubuntu)
- Fallback ohne HTTPS: Foto über die Kamera-App (`<input type="file" capture>`). Das funktioniert auch über HTTP.
- Netlify bleibt für Demo, Vorbereitung, Lehrkräfte und Eltern.
- Anleitung: [https-einrichten.md](https-einrichten.md)

Datenschutz und Sicherheit:

- INWX-Zugangsdaten liegen nur auf dem Ubuntu-Rechner, **nie im Repo**.
- Der Name `workshop.datenhandlung.de` wird bei Zertifikaten öffentlich protokolliert (Certificate Transparency). Unkritisch, weil weder Inhalte noch Daten von Kindern daran hängen.

Test ausstehend: `ipad-test.html` über HTTP und über HTTPS auf einem echten iPad (siehe [aufbau-checkliste.md](aufbau-checkliste.md)).

## 3. WLAN: eigener Router ohne Internet — vorgeschlagen

- Ein mitgebrachter Router, **ohne Internet**.
- Ubuntu-Server mit fester IP (DHCP-Reservierung), Beispiel `192.168.8.10`.
- Client-Isolation **aus**, damit die iPads den Server erreichen.
- Jedes iPad wird in der Vorbereitung **einmal** mit dem WLAN verbunden. Beim KOMEZ-WLAN „Automatisch verbinden“ ausschalten, sonst wechseln die iPads zurück.
- Auf MDM-verwalteten iPads kann der WLAN-Wechsel gesperrt sein. Alternative: Das KOMEZ verteilt das WLAN per MDM. Siehe [fragen-medienzentrum.md](fragen-medienzentrum.md).

### Netzplan, Variante A: alles in einem Netz (bevorzugt)

Voraussetzung: Der Mr Beam lässt sich mit dem eigenen Router verbinden (LAN-Kabel oder WLAN).

```
             Eigener Router (kein Internet)
             WLAN „stencilme“, 192.168.8.1
                 │
   ┌─────────────┼───────────────────┐
   │             │                   │
 Ubuntu-Server   Mr Beam           13 iPads
 192.168.8.10    192.168.8.x       (DHCP)
 (Kabel)         (Kabel/WLAN)
 Flask + DNS
```

### Netzplan, Variante B: Ubuntu als Brücke

Der Mr Beam bleibt im KOMEZ-WLAN. Ubuntu hängt in beiden Netzen und braucht dafür zwei Anschlüsse.

```
 13 iPads ── WLAN ── Eigener Router ── LAN-Kabel ── Ubuntu-Server ── WLAN ── KOMEZ-WLAN ── Mr Beam
                     192.168.8.1                  192.168.8.10
                                                   + KOMEZ-IP
```

- iPads sprechen nur mit dem Server, der Server spricht mit dem Mr Beam.
- Voraussetzung: Im KOMEZ-WLAN ist keine Client-Isolation aktiv.
- Wenn Ubuntu kein LAN hat: USB-WLAN-Stick als zweiter Anschluss.

Welche Variante gilt, hängt von den Antworten des KOMEZ ab.

---

## 4. Ergebnisse an die Kinder — offen (Schritt 8)

Aktueller Plan: ZIP auf USB-Stick an die Lehrkraft.

## 5. Claude-Station — offen (Schritt 9)

Eigener API-Schlüssel mit Ausgabenlimit, Nutzungsbedingungen prüfen.

## 6. Ersatz für Canva und KI-Selbstporträt — offen (Schritt 9)

## 7. Erklärer-/Macher-Rotation oder freier Ablauf — offen (Schritt 6)

---

## Testprotokoll

| Datum | Gerät (Modell, iPadOS) | Browser | Adresse (HTTP/HTTPS) | Ergebnis |
| ----- | ---------------------- | ------- | -------------------- | -------- |
|       |                        |         |                      |          |
