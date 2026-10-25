"""Workshop sichern, bevor alles gelöscht wird (Patricia, 25.10.2026).

Am Ende des Workshops werden alle Daten gelöscht. Vorher sichert der Laptop für die
Verbesserung des Workshops, ohne Namen, ohne Gruppen-ID und ohne Fotos:
die Apps aus dem Vibe Coding mit ihren Aufträgen, die Auswertung, den Ablauf
(wer war wann wo, als „Gruppe 1 … n“) und die Prompts der KI-Selbstporträts.
Der Ordner liegt in archiv/ (nicht im Repo).
"""
import copy
import datetime
import json
import os
import re

import mappe


def namen_entfernen(text, namen):
    """Vornamen der Kinder, die doch irgendwo im Text stehen (Feedback, Auftrag), durch [Name] ersetzen."""
    for name in sorted(namen, key=len, reverse=True):
        if len(name) >= 2:
            text = re.sub(r"(?<!\w)" + re.escape(name) + r"(?!\w)", "[Name]", text, flags=re.I)
    return text


def ordner_anlegen(wurzel):
    """Neuer Ordner mit Datum und Uhrzeit, nie einen alten überschreiben."""
    basis = os.path.join(wurzel, datetime.datetime.now().strftime("%Y-%m-%d_%H%M"))
    ordner, n = basis, 1
    while os.path.exists(ordner):
        n += 1
        ordner = "%s_%d" % (basis, n)
    os.makedirs(os.path.join(ordner, "apps"))
    return ordner


def sichern(wurzel, gruppen, auswertung, ki_eintraege, auswertung_html):
    """gruppen: [{"gruppe", "personen", "ereignisse", "apps": [(dateiname, html)]}], älteste zuerst.
    Gibt den neuen Ordner zurück."""
    nummer = {g["gruppe"]: i + 1 for i, g in enumerate(gruppen)}
    namen = {p for g in gruppen for p in g["personen"]}
    ordner = ordner_anlegen(wurzel)

    def schreiben(name, text):
        with open(os.path.join(ordner, name), "w", encoding="utf-8") as fh:
            fh.write(namen_entfernen(text, namen))

    def als_json(daten):
        return json.dumps(daten, ensure_ascii=False, indent=1)

    # Auswertung: Feedback ohne Vornamen
    auswertung = copy.deepcopy(auswertung)
    for bogen in auswertung.get("feedback", []):
        bogen.pop("name", None)
    schreiben("auswertung.json", als_json(auswertung))
    # Auswertungsseite zum Anschauen ohne Server: Daten stehen in der Datei
    schreiben("auswertung.html", auswertung_html.replace(
        "<script>", "<script>window.AUSWERTUNG = " + json.dumps(auswertung, ensure_ascii=False).replace("</", "<\\/") + ";</script>\n<script>", 1))

    # Ablauf: Reihenfolge der Stationen mit Uhrzeit, für Engpässe und Zeitplan
    ablauf = []
    for g in gruppen:
        stationen = {}
        for e in g["ereignisse"]:
            art, sid, zeit = e.get("art"), e.get("station") or "", str(e.get("zeit") or e.get("empfangen") or "")
            if art == "checkin":
                stationen.setdefault(sid, {"station": sid, "checkin": zeit, "fertig": ""})
            elif art == "beendet":
                stationen.setdefault(sid, {"station": sid, "checkin": "", "fertig": ""})["fertig"] = zeit
        anmeldung = next((str(e.get("zeit", "")) for e in g["ereignisse"] if e.get("art") == "anmeldung"), "")
        ablauf.append({"gruppe": nummer[g["gruppe"]], "personen": len(g["personen"]), "anmeldung": anmeldung,
                       "stationen": sorted(stationen.values(), key=lambda s: s["checkin"] or s["fertig"])})
    schreiben("ablauf.json", als_json(ablauf))

    # Apps aus dem Vibe Coding, abgeschottet wie früher in der Mappe
    nr = 0
    for g in gruppen:
        for _, html in g["apps"]:
            nr += 1
            schreiben("apps/app-%02d_gruppe-%d.html" % (nr, nummer[g["gruppe"]]), mappe.abgeschottet(html))

    # Aufträge (Apps) und Prompts (KI-Selbstporträts) aus dem KI-Protokoll, Gruppe als Nummer
    def eintrag(e, felder):
        d = {k: e[k] for k in felder if k in e}
        d["gruppe"] = nummer.get(e.get("gruppe"), 0)
        return d
    schreiben("apps/auftraege.json", als_json([eintrag(e, ("zeit", "prompt", "frei", "modell", "eingabe", "ausgabe", "kostenUsd"))
                                               for e in ki_eintraege if e.get("art") == "app"]))
    schreiben("ki-bilder.json", als_json([eintrag(e, ("zeit", "prompt", "modell", "eingabe", "ausgabe", "kostenUsd"))
                                          for e in ki_eintraege if e.get("art", "bild") == "bild"]))
    return ordner
