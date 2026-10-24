"""Ergebnis-Mappen (ZIP) und „Meine Daten“.

Mappe für die Lehrkraft: nur die Werke einer Gruppe (Patricia, 24.10.2026), also
Fotos, Stempel, Sticker, Porträt, KI-Bilder, Apps und der eigene Code. Keine
Textantworten, keine Sterne, kein Feedback.

„Meine Daten“ für die Kinder: alles, was auf dem Laptop über die eigene Gruppe
liegt, auch Antworten, Sterne und Feedback (Datenschutz.md: „Du darfst jederzeit
fragen, was über dich gespeichert ist“).
"""
import io
import os
import re
import zipfile

# Fremde Adressen in Apps sperren, wenn die Lehrkraft sie aus der Mappe öffnet
CSP = ('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; '
       'style-src \'unsafe-inline\'; img-src data: blob:; connect-src \'none\'; form-action \'none\'">')
CODE_DATEIEN = (("pixel-vektor", "svg-code", "pixel-vektor_euer-svg-code.html"),
                ("coding-web", "html-code", "coding-web_eure-webseite.html"))
NAME_RE = re.compile(r"[^A-Za-z0-9äöüÄÖÜß-]")
USB_WURZELN = ("/media", "/run/media")


def ordnername(state):
    namen = "-und-".join(NAME_RE.sub("", p.replace(" ", "-")) for p in state["personen"]) or "ohne-Namen"
    return "%s_%s" % (namen[:40], state["gruppe"][:6])


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


def werke(state, groups_dir, stempel_dir, sticker_dir):
    """Liste (Name in der Mappe, Inhalt als bytes)."""
    group_id = state["gruppe"]
    liste = []
    dateien_dir = os.path.join(groups_dir, group_id, "dateien")
    if os.path.isdir(dateien_dir):
        for f in sorted(os.listdir(dateien_dir)):
            if f.endswith(".tmp"):
                continue
            with open(os.path.join(dateien_dir, f), "rb") as fh:
                inhalt = fh.read()
            if f.endswith(".html"):
                inhalt = abgeschottet(inhalt.decode("utf-8", errors="replace")).encode("utf-8")
            liste.append((f, inhalt))
    for art, base in (("stempel", stempel_dir), ("sticker", sticker_dir)):
        for rel, pfad in eigene_svgs(base, group_id):
            teile = os.path.basename(rel)[:-4].split("_")
            name = teile[1] if len(teile) > 1 else art
            sorte = "portraet" if name.endswith("-Portraet") else art
            with open(pfad, "rb") as fh:
                liste.append(("%s_%s_%s.svg" % (sorte, name.replace("-Portraet", ""), teile[0]), fh.read()))
    for station, feld, name in CODE_DATEIEN:
        code = (state["antworten"].get(station, {}).get("antworten") or {}).get(feld)
        if code:
            liste.append((name, ('<!DOCTYPE html><meta charset="utf-8">\n' + code if station == "pixel-vektor" else code).encode("utf-8")))
    return liste


def zip_bauen(states, groups_dir, stempel_dir, sticker_dir):
    puffer = io.BytesIO()
    with zipfile.ZipFile(puffer, "w", zipfile.ZIP_DEFLATED) as z:
        for state in states:
            ordner = ordnername(state)
            for name, inhalt in werke(state, groups_dir, stempel_dir, sticker_dir):
                z.writestr(ordner + "/" + name, inhalt)
    return puffer.getvalue()


def usb_sticks():
    """Eingehängte, beschreibbare USB-Sticks (Ubuntu hängt sie unter /media/<user>/ ein)."""
    user = os.environ.get("USER") or ""
    sticks = []
    for wurzel in USB_WURZELN:
        basis = os.path.join(wurzel, user)
        if not user or not os.path.isdir(basis):
            continue
        for d in sorted(os.listdir(basis)):
            pfad = os.path.join(basis, d)
            if os.path.ismount(pfad) and os.access(pfad, os.W_OK):
                sticks.append(pfad)
    return sticks


def meine_daten(state, groups_dir, stempel_dir, sticker_dir):
    """Alles, was auf dem Laptop zu dieser Gruppe liegt."""
    group_id = state["gruppe"]
    dateien_dir = os.path.join(groups_dir, group_id, "dateien")
    dateien = []
    if os.path.isdir(dateien_dir):
        dateien = ["dateien/" + f for f in sorted(os.listdir(dateien_dir)) if not f.endswith(".tmp")]
    dateien += ["stempel/" + rel for rel, _ in eigene_svgs(stempel_dir, group_id)]
    dateien += ["sticker/" + rel for rel, _ in eigene_svgs(sticker_dir, group_id)]
    return {"personen": state["personen"], "fertig": state["fertig"], "antworten": state["antworten"], "dateien": dateien}


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
