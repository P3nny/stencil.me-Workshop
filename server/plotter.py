"""Sticker-Folie an die Silhouette Cameo 4 (Bonus-Station „Sticker“).

Vorbild: archiv/00_fotobox-karte/fotobox-queue.py (läuft dort zuverlässig). Gleiche
Aufteilung und gleiche Plotter-Einstellungen, aber ohne Flask/lxml und ohne Eingaben im
Terminal: Die Laptop-Seite führt durch die Schritte.

    1. Folie zusammenstellen (Laptop-Seite)  -> neuer Auftrag, Zustand „bereit“
    2. „Zeichnen starten“                      -> Stift zeichnet alles außer „schneiden-rot“
    3. „Schneiden starten“                     -> Messer schneidet „schneiden-rot“
    4. „fertig“

Einstellungen wie in der Fotobox per Umgebungsvariable (PEN_PRESSURE, CUT_PRESSURE, …).
STENCILME_PLOTTER_TEST=1: Testlauf ohne Plotter (wie DRY_RUN in der Fotobox).
"""
import collections
import datetime
import json
import math
import os
import re
import subprocess
import threading
import time
import xml.etree.ElementTree as ET

PAGE_W, PAGE_H = 210.0, 297.0
TEST = os.environ.get("STENCILME_PLOTTER_TEST") == "1"
EXT_PYTHON = os.environ.get("EXT_PYTHON", "/usr/bin/python3")   # System-Python (Extension braucht numpy/usb)
EXT = os.environ.get("EXT", os.path.expanduser("~/.config/inkscape/extensions/sendto_silhouette.py"))
PEN = dict(pressure=int(os.environ.get("PEN_PRESSURE", 5)), speed=int(os.environ.get("PEN_SPEED", 5)))
CUT = dict(pressure=int(os.environ.get("CUT_PRESSURE", 14)), speed=int(os.environ.get("CUT_SPEED", 3)))
CUT_PASSES = int(os.environ.get("CUT_PASSES", 2))
CUT_TOOL = os.environ.get("CUT_TOOL", "autoblade")
CUT_DEPTH = int(os.environ.get("CUT_DEPTH", 4))
ENDPOS = os.environ.get("ENDPOS", "start")
JOIN_MM = float(os.environ.get("JOIN_MM", 0.7))
SIMPLIFY_MM = float(os.environ.get("SIMPLIFY_MM", 0.05))

SVGNS = "http://www.w3.org/2000/svg"
NS = "{%s}" % SVGNS
ET.register_namespace("", SVGNS)
_NUM = re.compile(r"-?\d+\.?\d*")
_TR = re.compile(r"translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\s*\)")

_sperre = threading.Lock()
_auftrag = None   # aktueller Auftrag (dict), nur einer gleichzeitig


class PlotterFehler(Exception):
    pass


def extension_da():
    return TEST or (os.path.isfile(EXT) and os.path.isfile(EXT_PYTHON))


def _translate(el):
    m = _TR.search(el.get("transform", "") or "")
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)


def _elemente(root):
    """Alle Pfade mit absolutem Versatz (nur translate, wie die Laptop-Seite die Folie baut)
    und der Info, ob sie in „schneiden-rot“ liegen."""
    ergebnis = []

    def gehe(el, dx, dy, schnitt):
        tx, ty = _translate(el)
        dx, dy = dx + tx, dy + ty
        schnitt = schnitt or el.get("id") == "schneiden-rot"
        if el.tag == NS + "path":
            ergebnis.append((el, dx, dy, schnitt))
        for kind in el:
            gehe(kind, dx, dy, schnitt)

    gehe(root, 0.0, 0.0, False)
    return ergebnis


def _dp(pts, eps):
    """Douglas-Peucker wie in der Fotobox."""
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    laenge = (dx * dx + dy * dy) ** 0.5
    md, mi = 0.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5 if laenge == 0 else abs(dy * (px - ax) - dx * (py - ay)) / laenge
        if d > md:
            md, mi = d, i
    if md > eps:
        return _dp(pts[:mi + 1], eps)[:-1] + _dp(pts[mi:], eps)
    return [pts[0], pts[-1]]


def _teilpfade(elemente):
    subs = []
    for el, dx, dy, schnitt in elemente:
        if schnitt:
            continue
        for teil in re.split(r"(?=M)", el.get("d", "")):
            if not teil.startswith("M"):
                continue
            n = [float(v) for v in _NUM.findall(teil)]
            pts = [(n[i] + dx, n[i + 1] + dy) for i in range(0, len(n) - 1, 2)]
            if len(pts) < 2:
                continue
            geschlossen = "Z" in teil or "z" in teil
            if geschlossen:
                pts.append(pts[0])
            subs.append((_dp(pts, SIMPLIFY_MM), geschlossen))
    return subs


def _planen(subs):
    """Reihenfolge nach kürzestem Leerlauf, nahe Linienenden verbinden (wie _plan in der Fotobox)."""
    zelle = 5.0
    key = lambda p: (int(p[0] // zelle), int(p[1] // zelle))
    gitter = collections.defaultdict(list)
    for i, (pts, geschlossen) in enumerate(subs):
        gitter[key(pts[0])].append((i, 0))
        if not geschlossen:
            gitter[key(pts[-1])].append((i, 1))
    ketten, cur, pos = [], None, (0.0, 0.0)
    for _ in range(len(subs)):
        cx, cy = key(pos)
        best, rad = None, 0
        while rad <= 150 and (best is None or rad * zelle < best[0]):
            for gx in range(cx - rad, cx + rad + 1):
                for gy in range(cy - rad, cy + rad + 1):
                    if max(abs(gx - cx), abs(gy - cy)) != rad:
                        continue
                    for (j, e) in gitter.get((gx, gy), ()):
                        d = math.dist(pos, subs[j][0][0 if e == 0 else -1])
                        if best is None or d < best[0]:
                            best = (d, j, e)
            rad += 1
        d, j, e = best
        pts, geschlossen = subs[j]
        for ende in (0, 1):
            c = key(pts[0 if ende == 0 else -1])
            if (j, ende) in gitter.get(c, ()):
                gitter[c].remove((j, ende))
        seg = pts[::-1] if e == 1 else pts
        if cur and cur["join"] and not geschlossen and d <= JOIN_MM:
            cur["pts"] += seg
        else:
            if cur:
                ketten.append(cur)
            cur = {"pts": list(seg), "closed": geschlossen, "join": not geschlossen}
        pos = seg[-1]
    if cur:
        ketten.append(cur)
    return ketten


def _neues_svg():
    return ET.Element(NS + "svg", {"width": "%smm" % PAGE_W, "height": "%smm" % PAGE_H,
                                    "viewBox": "0 0 %s %s" % (PAGE_W, PAGE_H)})


def aufteilen(folie_datei, ordner):
    """Folie -> stift.svg und messer.svg in ordner. Rückgabe: (Stiftzüge, Schnittpfade)."""
    root = ET.parse(folie_datei).getroot()
    elemente = _elemente(root)
    ketten = _planen(_teilpfade(elemente))
    stift = _neues_svg()
    g = ET.SubElement(stift, NS + "g", {"fill": "none", "stroke": "#1e4fd6"})
    for k in ketten:
        d = "M " + " L ".join("%.3f %.3f" % (x, y) for x, y in k["pts"]) + (" Z" if k["closed"] else "")
        ET.SubElement(g, NS + "path", {"d": d})
    ET.ElementTree(stift).write(os.path.join(ordner, "stift.svg"))
    messer = _neues_svg()
    g = ET.SubElement(messer, NS + "g", {"fill": "none", "stroke": "#d6291e"})
    schnitte = 0
    for el, dx, dy, schnitt in elemente:
        if schnitt:
            ET.SubElement(g, NS + "path", {"d": el.get("d", ""), "transform": "translate(%.3f,%.3f)" % (dx, dy)})
            schnitte += 1
    ET.ElementTree(messer).write(os.path.join(ordner, "messer.svg"))
    return len(ketten), schnitte


def _senden(svg, werkzeug, p, extra, protokoll):
    cmd = [EXT_PYTHON, EXT, "--tool=%s" % werkzeug, "--pressure=%d" % p["pressure"],
           "--speed=%d" % p["speed"], "--endposition=%s" % ENDPOS] + list(extra) + [svg]
    with open(protokoll, "a", encoding="utf-8") as lf:
        lf.write(time.strftime("%H:%M:%S ") + " ".join(cmd) + "\n")
        if TEST:
            time.sleep(1)
            return True
        lf.flush()
        r = subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT)
    return r.returncode == 0


def _messer_extra():
    e = []
    if CUT_PASSES > 1:
        e.append("--multipass=%d" % CUT_PASSES)
    if CUT_DEPTH >= 0:
        e.append("--depth=%d" % CUT_DEPTH)
    return e


def status():
    with _sperre:
        a = dict(_auftrag) if _auftrag else None
    return {"auftrag": a, "plotterBereit": extension_da(), "test": TEST}


def neuer_auftrag(basis_ordner, svg_bytes, sticker):
    """Neue Folie ablegen und aufteilen. sticker: [{name, gruppe, pfad}] für Nachrichten."""
    global _auftrag
    with _sperre:
        if _auftrag and _auftrag["zustand"] in ("zeichnet", "schneidet"):
            raise PlotterFehler("Der Plotter arbeitet gerade. Erst den laufenden Auftrag abschließen.")
    text = svg_bytes.decode("utf-8", errors="replace").lstrip()
    if not text.startswith("<svg") or "<script" in text.lower():
        raise PlotterFehler("keine Sticker-Folie")
    name = datetime.datetime.now().strftime("folie-%Y-%m-%d-%H%M%S")
    ordner = os.path.join(basis_ordner, name)
    os.makedirs(ordner, exist_ok=True)
    folie = os.path.join(ordner, "folie.svg")
    with open(folie, "wb") as fh:
        fh.write(svg_bytes)
    zuege, schnitte = aufteilen(folie, ordner)
    with _sperre:
        _auftrag = {"name": name, "ordner": ordner, "zustand": "bereit", "sticker": sticker,
                    "stiftzuege": zuege, "schnitte": schnitte, "meldung": "", "zeiten": {}}
        with open(os.path.join(ordner, "auftrag.json"), "w", encoding="utf-8") as fh:
            json.dump(_auftrag, fh, ensure_ascii=False)
        return dict(_auftrag)


def _lauf(schritt):
    global _auftrag
    ordner = _auftrag["ordner"]
    protokoll = os.path.join(ordner, "protokoll.log")
    start = time.time()
    if schritt == "zeichnen":
        ok = _senden(os.path.join(ordner, "stift.svg"), "pen", PEN, (), protokoll)
        weiter, fehler = "gezeichnet", "Der Plotter hat beim Zeichnen nicht reagiert. USB-Kabel und Strom prüfen, dann nochmal."
    else:
        ok = _senden(os.path.join(ordner, "messer.svg"), CUT_TOOL, CUT, _messer_extra(), protokoll)
        weiter, fehler = "fertig", "Der Plotter hat beim Schneiden nicht reagiert. USB-Kabel und Strom prüfen, dann nochmal."
    with _sperre:
        _auftrag["zeiten"][schritt] = round((time.time() - start) / 60, 1)
        if ok:
            _auftrag["zustand"], _auftrag["meldung"] = weiter, ""
        else:
            _auftrag["zustand"] = "bereit" if schritt == "zeichnen" else "gezeichnet"
            _auftrag["meldung"] = fehler
        with open(os.path.join(ordner, "auftrag.json"), "w", encoding="utf-8") as fh:
            json.dump(_auftrag, fh, ensure_ascii=False)


def schritt(was):
    """„zeichnen“ (aus „bereit“), „schneiden“ (aus „gezeichnet“) oder „verwerfen“."""
    global _auftrag
    with _sperre:
        if not _auftrag:
            raise PlotterFehler("Kein Auftrag. Erst eine Folie zusammenstellen.")
        if was == "verwerfen":
            if _auftrag["zustand"] in ("zeichnet", "schneidet"):
                raise PlotterFehler("Der Plotter arbeitet gerade.")
            _auftrag = None
            return {"auftrag": None}
        erlaubt = {"zeichnen": "bereit", "schneiden": "gezeichnet"}
        if was not in erlaubt:
            raise PlotterFehler("Unbekannter Schritt.")
        if _auftrag["zustand"] != erlaubt[was]:
            raise PlotterFehler("Das geht gerade nicht (Zustand: %s)." % _auftrag["zustand"])
        if not extension_da():
            raise PlotterFehler("Silhouette-Erweiterung nicht gefunden (%s)." % EXT)
        _auftrag["zustand"] = "zeichnet" if was == "zeichnen" else "schneidet"
        _auftrag["meldung"] = ""
    threading.Thread(target=_lauf, args=(was,), daemon=True).start()
    return status()
