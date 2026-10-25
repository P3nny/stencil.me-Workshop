"""„Meine Daten“ für die Kinder: alles, was auf dem Laptop über die eigene Gruppe
liegt, auch Antworten, Sterne und Feedback (Datenschutz.md: „Du darfst jederzeit
fragen, was über dich gespeichert ist“).

Eine Ergebnis-Mappe (ZIP, USB-Stick) gibt es nicht mehr: Am Ende des Workshops
wird alles gelöscht (Patricia, 25.10.2026). Vorher sichert server/archiv.py
Apps und Auswertung ohne Namen.
"""
import os
import re

# Fremde Adressen in Apps sperren, wenn jemand sie später aus dem Archiv öffnet
CSP = ('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; '
       'style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; form-action \'none\'">')


def eigene_svgs(base, group_id):
    """Stempel- oder Sticker-Dateien der Gruppe: (Tag/Datei, Pfad), erkennbar an _<Gruppe>.svg."""
    treffer = []
    if not os.path.isdir(base):
        return treffer
    for tag in sorted(os.listdir(base)):
        tag_dir = os.path.join(base, tag)
        if os.path.isdir(tag_dir):
            for f in sorted(os.listdir(tag_dir)):
                if f.endswith("_" + group_id + ".svg"):
                    treffer.append((tag + "/" + f, os.path.join(tag_dir, f)))
    return treffer


def abgeschottet(html):
    return re.sub(r"<head[^>]*>", lambda m: m.group(0) + CSP, html, count=1, flags=re.I) if re.search(r"<head[^>]*>", html, re.I) else CSP + html


def meine_daten(state, groups_dir, stempel_dir, sticker_dir, zeiten=None):
    """Alles, was auf dem Laptop zu dieser Gruppe liegt, auch wann ihr wo wart (zeiten)."""
    group_id = state["gruppe"]
    dateien_dir = os.path.join(groups_dir, group_id, "dateien")
    dateien = []
    if os.path.isdir(dateien_dir):
        dateien = ["dateien/" + f for f in sorted(os.listdir(dateien_dir)) if not f.endswith(".tmp")]
    dateien += ["stempel/" + rel for rel, _ in eigene_svgs(stempel_dir, group_id)]
    dateien += ["sticker/" + rel for rel, _ in eigene_svgs(sticker_dir, group_id)]
    return {"personen": state["personen"], "fertig": state["fertig"], "antworten": state["antworten"], "dateien": dateien,
            "zeiten": zeiten or {}}


def datei_pfad(group_id, rel, groups_dir, stempel_dir, sticker_dir):
    """Pfad einer Datei aus meine_daten(), nur wenn sie zur Gruppe gehört. Sonst None."""
    art, _, rest = rel.partition("/")
    if art == "dateien":
        base = os.path.join(groups_dir, group_id, "dateien")
        pfad = os.path.abspath(os.path.join(base, rest))
        return pfad if pfad.startswith(base + os.sep) and "/" not in rest and os.path.isfile(pfad) else None
    if art in ("stempel", "sticker"):
        base = stempel_dir if art == "stempel" else sticker_dir
        return dict((r, p) for r, p in eigene_svgs(base, group_id)).get(rest)
    return None
