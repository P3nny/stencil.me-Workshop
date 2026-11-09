"""Live-Quiz mit Bestenliste (Patricia, 09.11.2026).

Penny steuert das Quiz am Präsentationslaptop (/quiz, mit Quiz-PIN), die Paare antworten
auf dem iPad (/app/quiz.html). Teil 1 nach der großen Pause, Teil 2 in der Abschlussrunde,
die Punkte zählen zusammen. 1 Punkt pro richtiger Antwort, kein Bonus für Schnelligkeit
(„Kein Wettrennen“). Auf dem Beamer stehen nur Teamnamen (Tiere), keine Vornamen.

Daten: Teamname und Antworten pro Gruppe liegen auf dem Laptop (quiz.json) und werden mit
„Alle Daten löschen“ gelöscht. Ins Archiv kommt nur, wie viele Gruppen jede Frage richtig hatten.
Die Fragen stehen in server/quiz-fragen.json (nicht öffentlich, sonst stünden die Lösungen im Netz).
"""
import json
import os
import threading
import time

TIERE = [
    ("fuchs", "🦊", "Fuchs"), ("panda", "🐼", "Panda"), ("frosch", "🐸", "Frosch"), ("eule", "🦉", "Eule"),
    ("krake", "🐙", "Krake"), ("einhorn", "🦄", "Einhorn"), ("schildkroete", "🐢", "Schildkröte"), ("loewe", "🦁", "Löwe"),
    ("pinguin", "🐧", "Pinguin"), ("biene", "🐝", "Biene"), ("dino", "🦖", "Dino"), ("delfin", "🐬", "Delfin"),
    ("papagei", "🦜", "Papagei"), ("koala", "🐨", "Koala"), ("igel", "🦔", "Igel"), ("wal", "🐳", "Wal"),
]
TIER = {t[0]: {"id": t[0], "emoji": t[1], "name": t[2]} for t in TIERE}
PHASEN = ("aus", "lobby", "frage", "aufloesung", "ende")

_lock = threading.Lock()
DATEI = None         # quiz.json im Datenordner (server.py setzt das)
FRAGEN_DATEI = None  # server/quiz-fragen.json


def _leer():
    return {"phase": "aus", "teil": 1, "nr": -1, "bis": 0, "teams": {}, "antworten": {}}


def _lesen():
    try:
        with open(DATEI, encoding="utf-8") as fh:
            s = json.load(fh)
        if isinstance(s, dict) and s.get("phase") in PHASEN:
            return s
    except (OSError, ValueError, TypeError):
        pass
    return _leer()


def _schreiben(s):
    os.makedirs(os.path.dirname(DATEI), exist_ok=True)
    tmp = DATEI + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(s, fh, ensure_ascii=False)
    os.replace(tmp, DATEI)


def fragen():
    """{"sekunden": 30, "teile": {"1": [{frage, antworten[4], richtig, erklaerung}], "2": [...]}}"""
    try:
        with open(FRAGEN_DATEI, encoding="utf-8") as fh:
            f = json.load(fh)
        return f if isinstance(f, dict) and isinstance(f.get("teile"), dict) else {"teile": {}}
    except (OSError, ValueError):
        return {"teile": {}}


def _teil(f, teil):
    return f["teile"].get(str(teil)) or []


def punkte(s, f, gid):
    """Richtige Antworten. Die laufende Frage zählt erst nach dem Auflösen, sonst verrät die Punktzahl die Lösung."""
    n = 0
    for teil, nummern in s["antworten"].items():
        liste = _teil(f, teil)
        for nr, wahl in nummern.items():
            i = int(nr)
            if s["phase"] == "frage" and str(s["teil"]) == str(teil) and i == s["nr"]:
                continue
            if gid in wahl and i < len(liste) and wahl[gid] == liste[i].get("richtig"):
                n += 1
    return n


def rangliste(s, f):
    """Teams mit Punkten und Platz (gleiche Punkte = gleicher Platz), bester zuerst."""
    liste = [{"gruppe": g, "tier": TIER.get(t), "punkte": punkte(s, f, g)} for g, t in s["teams"].items() if t in TIER]
    for e in liste:
        e["platz"] = 1 + sum(1 for x in liste if x["punkte"] > e["punkte"])
    return sorted(liste, key=lambda e: (e["platz"], e["tier"]["name"]))


def _rest(s):
    return max(0, int(round(s.get("bis", 0) - time.time()))) if s["phase"] == "frage" else 0


def _frage_daten(s, f, mit_loesung):
    liste = _teil(f, s["teil"])
    if not 0 <= s["nr"] < len(liste):
        return None
    q = liste[s["nr"]]
    d = {"frage": q.get("frage", ""), "antworten": q.get("antworten", []), "nr": s["nr"], "anzahl": len(liste)}
    if mit_loesung:
        d["richtig"] = q.get("richtig")
        d["erklaerung"] = q.get("erklaerung", "")
    return d


def status_gruppe(gid):
    """Für das iPad: nur die eigene Gruppe, Lösung erst nach dem Auflösen."""
    with _lock:
        s, f = _lesen(), fragen()
    team = s["teams"].get(gid)
    d = {"phase": s["phase"], "teil": s["teil"], "rest": _rest(s), "team": TIER.get(team),
         "vergeben": sorted(t for g, t in s["teams"].items() if g != gid), "tiere": [TIER[t[0]] for t in TIERE],
         "punkte": punkte(s, f, gid) if team else 0}
    if s["phase"] in ("frage", "aufloesung"):
        d["frage"] = _frage_daten(s, f, s["phase"] == "aufloesung")
        d["meine"] = s["antworten"].get(str(s["teil"]), {}).get(str(s["nr"]), {}).get(gid)
    if s["phase"] == "ende" and team:
        r = [e for e in rangliste(s, f) if e["gruppe"] == gid]
        d["platz"] = r[0]["platz"] if r else None
        d["teams"] = len(s["teams"])
    return d


def beamer():
    """Für den Präsentationslaptop: alles außer Gruppen-IDs."""
    with _lock:
        s, f = _lesen(), fragen()
    d = {"phase": s["phase"], "teil": s["teil"], "rest": _rest(s), "sekunden": f.get("sekunden", 30),
         "teams": [TIER[t] for t in s["teams"].values() if t in TIER],
         "anzahlTeile": {k: len(v) for k, v in f["teile"].items()}}
    if s["phase"] in ("frage", "aufloesung"):
        d["frage"] = _frage_daten(s, f, s["phase"] == "aufloesung")
        wahl = s["antworten"].get(str(s["teil"]), {}).get(str(s["nr"]), {})
        d["beantwortet"] = len(wahl)
        if s["phase"] == "aufloesung":
            n = len((d["frage"] or {}).get("antworten", []))
            d["verteilung"] = [sum(1 for w in wahl.values() if w == i) for i in range(n)]
    if s["phase"] == "ende":
        d["rangliste"] = [{"tier": e["tier"], "punkte": e["punkte"], "platz": e["platz"]} for e in rangliste(s, f)]
    return d


def beitreten(gid, tier):
    if tier not in TIER:
        return "Dieses Tier gibt es nicht."
    with _lock:
        s = _lesen()
        if s["phase"] == "aus":
            return "Gerade läuft kein Quiz."
        if any(t == tier and g != gid for g, t in s["teams"].items()):
            return "Das Tier hat schon eine andere Gruppe. Sucht euch ein anderes aus."
        s["teams"][gid] = tier
        _schreiben(s)
    return None


def antworten(gid, teil, nr, wahl):
    with _lock:
        s, f = _lesen(), fragen()
        if gid not in s["teams"]:
            return "Erst ein Tier aussuchen."
        if s["phase"] != "frage" or str(teil) != str(s["teil"]) or nr != s["nr"]:
            return "Diese Frage ist schon vorbei."
        if _rest(s) <= 0:
            return "Die Zeit ist um."
        liste = _teil(f, s["teil"])
        if not 0 <= wahl < len(liste[s["nr"]].get("antworten", [])):
            return "Ungültige Antwort."
        # Bis zum Auflösen darf die Gruppe ihre Antwort noch ändern
        s["antworten"].setdefault(str(s["teil"]), {}).setdefault(str(s["nr"]), {})[gid] = wahl
        _schreiben(s)
    return None


def steuern(aktion, teil=None):
    """aktion: start (mit teil), weiter, aufloesen, ende, aus, zuruecksetzen."""
    with _lock:
        s, f = _lesen(), fragen()
        if aktion == "zuruecksetzen":
            s = _leer()
        elif aktion == "start":
            if str(teil) not in f["teile"]:
                return "Diesen Teil gibt es nicht."
            s.update(phase="lobby", teil=int(teil), nr=-1, bis=0)
        elif aktion == "weiter":
            liste = _teil(f, s["teil"])
            if s["phase"] == "lobby" or s["phase"] == "aufloesung":
                if s["nr"] + 1 < len(liste):
                    s.update(phase="frage", nr=s["nr"] + 1, bis=time.time() + int(f.get("sekunden", 30)))
                else:
                    s["phase"] = "ende"
            else:
                return "Erst auflösen."
        elif aktion == "aufloesen":
            if s["phase"] != "frage":
                return "Gerade läuft keine Frage."
            s.update(phase="aufloesung", bis=0)
        elif aktion == "ende":
            s.update(phase="ende", bis=0)
        elif aktion == "aus":
            s.update(phase="aus", bis=0)
        else:
            return "Unbekannte Aktion."
        _schreiben(s)
    return None


def meine(gid):
    """Für „Meine Daten“: Teamname, Antworten und Punkte der eigenen Gruppe."""
    with _lock:
        s, f = _lesen(), fragen()
    if gid not in s["teams"]:
        return None
    antw = []
    for teil, nummern in sorted(s["antworten"].items()):
        liste = _teil(f, teil)
        for nr, wahl in sorted(nummern.items(), key=lambda x: int(x[0])):
            i = int(nr)
            if gid in wahl and i < len(liste):
                q = liste[i]
                a = q.get("antworten", [])
                antw.append({"teil": int(teil), "frage": q.get("frage", ""), "antwort": a[wahl[gid]] if wahl[gid] < len(a) else "",
                             "richtig": wahl[gid] == q.get("richtig")})
    return {"team": TIER.get(s["teams"][gid]), "punkte": punkte(s, f, gid), "antworten": antw}


def gruppe_loeschen(gid):
    with _lock:
        s = _lesen()
        s["teams"].pop(gid, None)
        for nummern in s["antworten"].values():
            for wahl in nummern.values():
                wahl.pop(gid, None)
        _schreiben(s)


def loeschen():
    with _lock:
        if DATEI and os.path.exists(DATEI):
            os.remove(DATEI)


def zusammenfassung():
    """Fürs Archiv: pro Frage, wie viele Gruppen geantwortet und wie viele richtig. Ohne Gruppen, ohne Teams."""
    with _lock:
        s, f = _lesen(), fragen()
    ergebnis = []
    for teil, liste in sorted(f["teile"].items()):
        for i, q in enumerate(liste):
            wahl = s["antworten"].get(teil, {}).get(str(i), {})
            ergebnis.append({"teil": int(teil), "nr": i + 1, "frage": q.get("frage", ""), "antworten": len(wahl),
                             "richtig": sum(1 for w in wahl.values() if w == q.get("richtig"))})
    return {"teams": len(s["teams"]), "fragen": ergebnis}
