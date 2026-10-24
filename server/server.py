#!/usr/bin/env python3
"""stencil.me workshop server.

Serves the workshop app to the iPads and receives stamp files (SVG), station
events (check-in, finished, answers) and station photos.
Only the Python standard library is used, nothing needs to be installed.

    python3 server/server.py            # port 8000
    python3 server/server.py --port 8080

iPads may only load the app files, upload their own data and read how many
groups are at each station (no names). The overview page (/laptop), the lists
and all uploaded files are only reachable from the laptop itself (localhost),
so the children cannot see each other's data.
"""
import argparse
import datetime
import functools
import http.server
import json
import os
import posixpath
import re
import shutil
import socket
import subprocess
import sys
import threading
import urllib.parse

import ki_app
import ki_bild
import plotter

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# STENCILME_DATEN: anderer Datenordner, z. B. für automatische Tests (echte Stempel bleiben unberührt)
DATA_ROOT = os.path.abspath(os.environ.get("STENCILME_DATEN") or os.path.join(REPO_DIR, "server", "daten"))
DATA_DIR = os.path.join(DATA_ROOT, "stempel")
STICKER_DIR = os.path.join(DATA_ROOT, "sticker")  # für den Schneideplotter (Bonus-Station)
PLOTTER_DIR = os.path.join(DATA_ROOT, "plotter")  # Sticker-Folien (Aufträge an die Cameo)
MAX_SHEET_BYTES = 20 * 1024 * 1024
GROUPS_DIR = os.path.join(DATA_ROOT, "gruppen")
SETTINGS_FILE = os.path.join(DATA_ROOT, "einstellungen.json")
KI_LOG_FILE = os.path.join(DATA_ROOT, "ki-protokoll.jsonl")
MESSAGES_FILE = os.path.join(DATA_ROOT, "nachrichten.json")  # Laptop -> Gruppen („wird gelasert“, „fertig“)
MAX_MESSAGE_LEN = 300
messages_lock = threading.Lock()
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_EVENT_BYTES = 64 * 1024
DEFAULT_SETTINGS = {"schueler": 26, "freigaben": []}  # freigaben: Stationen, die der Laptop für alle öffnet
FREIGABE_RE = re.compile(r"^[a-z0-9-]{1,40}$")

EVENT_TYPES = ("anmeldung", "checkin", "beendet")
# Image types accepted from the stations, recognised by their first bytes
IMAGE_TYPES = ((b"\xff\xd8\xff", ".jpg", "image/jpeg"), (b"\x89PNG", ".png", "image/png"))

# Paths the iPads may load. Everything else (archiv/, .git/, server/) stays private.
PUBLIC_FILES = {"/", "/index.html", "/stencil.html", "/code-quiz.html", "/kunst-quiz.html", "/docs/ipad-test.html", "/docs/test-foto.jpg"}
PUBLIC_PREFIXES = ("/vendor/", "/app/", "/stationen/")

ID_RE = re.compile(r"^[a-f0-9]{12}$")
STATION_RE = re.compile(r"^[a-z0-9-]{1,40}$")
NAME_RE = re.compile(r"[^A-Za-z0-9äöüÄÖÜß_-]")
VIRTUAL_IFACES = ("docker", "br-", "virbr", "veth", "vboxnet", "vmnet", "lxc", "lxd")


def clean_name(name):
    name = NAME_RE.sub("", (name or "").strip().replace(" ", "-"))[:20]
    return name or "ohne-Name"


def find_stamp(stamp_id, base=DATA_DIR):
    """Return the stored file name for an upload id, or None."""
    if not os.path.isdir(base):
        return None
    for day in os.listdir(base):
        day_dir = os.path.join(base, day)
        if os.path.isdir(day_dir):
            for f in os.listdir(day_dir):
                # Zeit_Name_ID.svg (alt) oder Zeit_Name_ID_Gruppe.svg
                if f.endswith(".svg") and f[:-4].split("_")[2:3] == [stamp_id]:
                    return day + "/" + f
    return None


def list_stamps(base=DATA_DIR):
    result = []
    if not os.path.isdir(base):
        return result
    for day in sorted(os.listdir(base), reverse=True):
        day_dir = os.path.join(base, day)
        if not os.path.isdir(day_dir):
            continue
        for f in sorted(os.listdir(day_dir), reverse=True):
            if f.endswith(".svg"):
                parts = f[:-4].split("_")
                result.append({
                    "pfad": day + "/" + f,
                    "datei": f,
                    "tag": day,
                    "zeit": parts[0][:2] + ":" + parts[0][2:4] if parts and len(parts[0]) >= 4 else "",
                    "name": parts[1] if len(parts) > 1 else "",
                    "gruppe": parts[3] if len(parts) > 3 and ID_RE.match(parts[3]) else "",
                })
    return result


def read_messages():
    try:
        with open(MESSAGES_FILE, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def add_message(groups, text):
    """Nachricht an mehrere Gruppen. Jede Gruppe sieht nur ihre eigenen."""
    entry = {"id": os.urandom(6).hex(), "zeit": datetime.datetime.now().isoformat(timespec="seconds"), "text": text}
    with messages_lock:
        data = read_messages()
        for g in groups:
            data.setdefault(g, []).append(entry)
        os.makedirs(DATA_ROOT, exist_ok=True)
        write_atomic(MESSAGES_FILE, json.dumps(data, ensure_ascii=False).encode("utf-8"))
    return entry


def write_atomic(path, data):
    tmp = path + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, path)


def read_settings():
    settings = dict(DEFAULT_SETTINGS)
    try:
        with open(SETTINGS_FILE, encoding="utf-8") as fh:
            settings.update(json.load(fh))
    except (OSError, ValueError):
        pass
    return settings


def read_events(group_id):
    """All events of one group, oldest first."""
    events = []
    events_dir = os.path.join(GROUPS_DIR, group_id, "ereignisse")
    if not os.path.isdir(events_dir):
        return events
    for f in os.listdir(events_dir):
        if f.endswith(".json"):
            try:
                with open(os.path.join(events_dir, f), encoding="utf-8") as fh:
                    events.append(json.load(fh))
            except (OSError, ValueError):
                continue
    events.sort(key=lambda e: (e.get("zeit", ""), e.get("empfangen", "")))
    return events


def group_state(group_id):
    """Names, current station and finished stations of one group, built from its events."""
    state = {"gruppe": group_id, "personen": [], "aktuell": None, "fertig": [], "antworten": {}, "dateien": []}
    for e in read_events(group_id):
        art, station = e.get("art"), e.get("station")
        if art == "anmeldung":
            state["personen"] = e.get("daten", {}).get("personen", [])
        elif art == "checkin":
            state["aktuell"] = station
        elif art == "beendet":
            if station not in state["fertig"]:
                state["fertig"].append(station)
            state["antworten"][station] = e.get("daten", {})
            if state["aktuell"] == station:
                state["aktuell"] = None
    files_dir = os.path.join(GROUPS_DIR, group_id, "dateien")
    if os.path.isdir(files_dir):
        state["dateien"] = sorted(group_id + "/dateien/" + f for f in os.listdir(files_dir) if not f.endswith(".tmp"))
    return state


def list_groups():
    if not os.path.isdir(GROUPS_DIR):
        return []
    return [group_state(g) for g in sorted(os.listdir(GROUPS_DIR)) if ID_RE.match(g)]


def station_occupancy():
    """How many groups are checked in at each station right now (no names)."""
    counts = {}
    for g in list_groups():
        if g["aktuell"]:
            counts[g["aktuell"]] = counts.get(g["aktuell"], 0) + 1
    return counts


def load_stations():
    """Stationen aus stationen/*.json (für Titel und Typ in der Auswertung)."""
    try:
        with open(os.path.join(REPO_DIR, "stationen", "index.json"), encoding="utf-8") as fh:
            ids = json.load(fh)["stationen"]
        result = []
        for sid in ids:
            with open(os.path.join(REPO_DIR, "stationen", sid + ".json"), encoding="utf-8") as fh:
                result.append(json.load(fh))
        return result
    except (OSError, ValueError, KeyError):
        return []


def evaluation():
    """Auswertung über alle Gruppen: Sterne und KI-Frage pro Station, Feedbackbögen."""
    stations = load_stations()
    per_station = {s["id"]: {"id": s["id"], "titel": s.get("titel", s["id"]), "typ": s.get("typ", ""),
                             "fertig": 0, "sterne": [], "kiTyp": {}} for s in stations}
    feedback = []
    groups = [g for g in sorted(os.listdir(GROUPS_DIR)) if ID_RE.match(g)] if os.path.isdir(GROUPS_DIR) else []
    for g in groups:
        done = {}
        for e in read_events(g):
            if e.get("art") == "beendet":
                done[e.get("station")] = e.get("daten", {})  # letzte Meldung pro Station zählt
        for sid, daten in done.items():
            st = per_station.setdefault(sid, {"id": sid, "titel": sid, "typ": "", "fertig": 0, "sterne": [], "kiTyp": {}})
            st["fertig"] += 1
            if daten.get("sterne"):
                st["sterne"].append(int(daten["sterne"]))
            if daten.get("kiTyp"):
                st["kiTyp"][daten["kiTyp"]] = st["kiTyp"].get(daten["kiTyp"], 0) + 1
            if sid == "feedback":
                feedback.extend(p for p in (daten.get("antworten") or {}).get("feedback", []) if isinstance(p, dict))
    stats = []
    for s in per_station.values():
        n = len(s["sterne"])
        richtig = s["kiTyp"].get(s["typ"], 0)
        antworten = sum(s["kiTyp"].values())
        stats.append(dict(s, sterneSchnitt=round(sum(s["sterne"]) / n, 1) if n else None,
                          sterneVerteilung=[s["sterne"].count(k) for k in range(1, 6)],
                          kiRichtig=richtig, kiAntworten=antworten))
    return {"gruppen": len(groups), "stationen": stats, "feedback": feedback}


# Stand der Server-Dateien beim Start. Ändern sie sich danach (neue Version), zeigt die
# Laptop-Seite „bitte neu starten“: Seiten kommen frisch von der Festplatte, der
# Server-Code aber nur beim Start.
SERVER_DATEIEN = [os.path.join(REPO_DIR, "server", f) for f in ("server.py", "ki_bild.py", "ki_app.py", "plotter.py")]


def server_stand():
    return max((os.path.getmtime(f) for f in SERVER_DATEIEN if os.path.exists(f)), default=0)


START_STAND = server_stand()


def local_ips():
    """IPv4 addresses of this laptop in the local network."""
    ips = []
    try:
        # No packet is sent; this only asks the OS which interface it would use.
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        # Further addresses, e.g. LAN cable and WLAN at the same time.
        # Virtual networks (Docker, VMs) are skipped, the iPads cannot reach them.
        out = subprocess.run(["ip", "-o", "-4", "addr", "show", "scope", "global"],
                             capture_output=True, text=True, timeout=3).stdout
        for line in out.splitlines():
            fields = line.split()
            if len(fields) < 4 or fields[1].startswith(VIRTUAL_IFACES):
                continue
            ip = fields[3].split("/")[0]
            if ip not in ips:
                ips.append(ip)
    except (OSError, subprocess.SubprocessError):
        pass
    return [ip for ip in ips if not ip.startswith("127.")]


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "stencilme"

    def is_local(self):
        return self.client_address[0] in ("127.0.0.1", "::1")

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # Always load the newest app version after a restart
        if self.path.split("?")[0] in PUBLIC_FILES or self.path.startswith(("/app/", "/stationen/")):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        raw = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        # Normalise first, so "/vendor/../archiv/" cannot slip past the allow list
        path = posixpath.normpath(raw) + ("/" if raw.endswith("/") and raw != "/" else "")
        if raw == "/":
            path = "/"

        if path == "/api/status":
            return self.send_json({"ok": True})
        if path == "/api/belegung":
            return self.send_json({"stationen": station_occupancy()})
        if path == "/api/einstellungen":
            return self.send_json(read_settings())
        if path == "/api/ki-bereit":
            return self.send_json({"eingerichtet": ki_bild.eingerichtet()})
        if path == "/api/nachrichten":
            # Nur die eigene Gruppe: Die ID ist zufällig und nur dem eigenen iPad bekannt
            group_id = (urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get("gruppe") or [""])[0]
            if not ID_RE.match(group_id):
                return self.send_json({"nachrichten": []})
            return self.send_json({"nachrichten": read_messages().get(group_id, [])})

        if path in ("/laptop", "/laptop/bogen.js", "/qr", "/auswertung", "/api/auswertung", "/api/liste", "/api/sticker", "/api/info", "/api/gruppen", "/api/ki-status", "/api/plotter/status") or path.startswith(("/daten/", "/dateien/", "/sticker/")):
            if not self.is_local():
                return self.send_error(403, "Nur am Laptop")
            if path in ("/laptop", "/laptop/bogen.js", "/qr", "/auswertung"):
                self.path = {"/laptop": "/server/laptop.html", "/laptop/bogen.js": "/server/bogen.js",
                             "/qr": "/server/qr-codes.html", "/auswertung": "/server/auswertung.html"}[path]
                return super().do_GET()
            if path == "/api/auswertung":
                return self.send_json(evaluation())
            if path == "/api/liste":
                return self.send_json({"stempel": list_stamps(), "ordner": DATA_DIR})
            if path == "/api/sticker":
                return self.send_json({"stempel": list_stamps(STICKER_DIR), "ordner": STICKER_DIR})
            if path.startswith("/sticker/"):
                return self.send_data_file(STICKER_DIR, path[len("/sticker/"):])
            if path == "/api/info":
                port = self.server.server_address[1]
                return self.send_json({"adressen": ["http://%s:%d/" % (ip, port) for ip in local_ips()],
                                       "neustartNoetig": server_stand() > START_STAND})
            if path == "/api/gruppen":
                return self.send_json({"gruppen": list_groups(), "ordner": GROUPS_DIR})
            if path == "/api/ki-status":
                return self.send_json(ki_bild.status(KI_LOG_FILE))
            if path == "/api/plotter/status":
                return self.send_json(plotter.status())
            if path.startswith("/dateien/"):
                return self.send_data_file(GROUPS_DIR, path[len("/dateien/"):])
            return self.send_data_file(DATA_DIR, path[len("/daten/"):])

        if path in PUBLIC_FILES or path.startswith(PUBLIC_PREFIXES):
            return super().do_GET()
        return self.send_error(404)

    def send_data_file(self, base, rel):
        full = os.path.abspath(os.path.join(base, rel))
        if not full.startswith(base + os.sep) or not os.path.isfile(full):
            return self.send_error(404)
        types = {".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".html": "text/html; charset=utf-8"}
        ctype = types.get(os.path.splitext(full)[1])
        if not ctype:
            return self.send_error(404)
        with open(full, "rb") as fh:
            body = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Uploaded files must never run scripts in the browser
        self.send_header("Content-Security-Policy", "sandbox")
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        # Not needed by the app; would otherwise bypass the allow list in do_GET
        self.send_error(405)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/stempel":
            return self.receive_stamp(urllib.parse.parse_qs(parsed.query))
        if parsed.path == "/api/ereignis":
            return self.receive_event()
        if parsed.path == "/api/datei":
            return self.receive_file(urllib.parse.parse_qs(parsed.query))
        if parsed.path == "/api/ki-bild":
            return self.ki_bild()
        if parsed.path == "/api/ki-app":
            return self.ki_app()
        if (parsed.path in ("/api/alle-loeschen", "/api/einstellungen", "/api/nachricht") or parsed.path.startswith("/api/plotter/")) and not self.is_local():
            return self.send_error(403, "Nur am Laptop")
        if parsed.path == "/api/einstellungen":
            return self.save_settings()
        if parsed.path == "/api/nachricht":
            return self.send_message()
        if parsed.path == "/api/plotter/folie":
            return self.plotter_folie()
        if parsed.path == "/api/plotter/schritt":
            return self.plotter_schritt()
        if parsed.path == "/api/alle-loeschen":
            for d in (DATA_DIR, STICKER_DIR, PLOTTER_DIR, GROUPS_DIR):
                if os.path.isdir(d):
                    shutil.rmtree(d)
            for f in (KI_LOG_FILE, MESSAGES_FILE):
                if os.path.exists(f):
                    os.remove(f)
            print("Alle Stempel, Antworten, Fotos und KI-Bilder gelöscht.")
            return self.send_json({"ok": True})
        return self.send_error(404)

    def read_body(self, limit):
        """Request body, or None if it is empty or larger than limit."""
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > limit:
            return None
        return self.rfile.read(length)

    def receive_event(self):
        body = self.read_body(MAX_EVENT_BYTES)
        if body is None:
            return self.send_json({"ok": False, "fehler": "leer oder zu groß"}, 413)
        try:
            event = json.loads(body.decode("utf-8"))
        except ValueError:
            return self.send_json({"ok": False, "fehler": "kein JSON"}, 400)
        if not isinstance(event, dict) or not ID_RE.match(str(event.get("id", ""))) or not ID_RE.match(str(event.get("gruppe", ""))):
            return self.send_json({"ok": False, "fehler": "ungültige ID"}, 400)
        station = str(event.get("station", ""))
        if event.get("art") not in EVENT_TYPES or (station and not STATION_RE.match(station)):
            return self.send_json({"ok": False, "fehler": "ungültiges Ereignis"}, 400)

        events_dir = os.path.join(GROUPS_DIR, event["gruppe"], "ereignisse")
        target = os.path.join(events_dir, event["id"] + ".json")
        if os.path.exists(target):
            # Same event sent again (retry): accept, but store only once
            return self.send_json({"ok": True, "doppelt": True})
        record = {
            "id": event["id"], "gruppe": event["gruppe"], "art": event["art"], "station": station,
            "zeit": str(event.get("zeit", ""))[:40], "empfangen": datetime.datetime.now().isoformat(timespec="seconds"),
            "daten": event.get("daten") if isinstance(event.get("daten"), dict) else {},
        }
        os.makedirs(events_dir, exist_ok=True)
        write_atomic(target, json.dumps(record, ensure_ascii=False, indent=1).encode("utf-8"))
        print("Station %s: %s (%s)" % (record["art"], station or "-", event["gruppe"]))
        return self.send_json({"ok": True, "doppelt": False})

    def receive_file(self, query):
        file_id = (query.get("id") or [""])[0]
        group_id = (query.get("gruppe") or [""])[0]
        station = (query.get("station") or [""])[0]
        if not ID_RE.match(file_id) or not ID_RE.match(group_id) or not STATION_RE.match(station):
            return self.send_json({"ok": False, "fehler": "ungültige ID"}, 400)
        body = self.read_body(MAX_UPLOAD_BYTES)
        if body is None:
            return self.send_json({"ok": False, "fehler": "Datei leer oder zu groß"}, 413)
        ext = next((e for magic, e, _ in IMAGE_TYPES if body.startswith(magic)), None)
        if not ext:
            return self.send_json({"ok": False, "fehler": "kein Foto"}, 400)

        files_dir = os.path.join(GROUPS_DIR, group_id, "dateien")
        target = os.path.join(files_dir, "%s_%s%s" % (station, file_id, ext))
        if os.path.exists(target):
            return self.send_json({"ok": True, "doppelt": True})
        os.makedirs(files_dir, exist_ok=True)
        write_atomic(target, body)
        print("Foto empfangen: %s/%s" % (group_id, os.path.basename(target)))
        return self.send_json({"ok": True, "doppelt": False})

    def ki_bild(self):
        body = self.read_body(MAX_EVENT_BYTES)
        try:
            anfrage = json.loads(body.decode("utf-8")) if body else {}
        except ValueError:
            anfrage = {}
        gruppe = str(anfrage.get("gruppe", ""))
        auswahl = anfrage.get("auswahl")
        if not ID_RE.match(gruppe) or not isinstance(auswahl, dict):
            return self.send_json({"ok": False, "fehler": "ungültige Anfrage"}, 400)
        try:
            return self.send_json(ki_bild.bild_fuer_gruppe(os.path.join(GROUPS_DIR, gruppe), KI_LOG_FILE, auswahl, gruppe))
        except ki_bild.KiFehler as err:
            return self.send_json({"ok": False, "fehler": err.text}, err.status)

    def ki_app(self):
        """Claude schreibt eine Mini-App. Der Code geht Stück für Stück ans iPad (kein JSON):
        so sehen die Kinder ihn entstehen. Fehler mittendrin: Marke ki_app.FEHLER_MARKE."""
        body = self.read_body(MAX_EVENT_BYTES)
        try:
            anfrage = json.loads(body.decode("utf-8")) if body else {}
        except ValueError:
            anfrage = {}
        gruppe = str(anfrage.get("gruppe", ""))
        auswahl = anfrage.get("auswahl")
        if not ID_RE.match(gruppe) or not isinstance(auswahl, dict):
            return self.send_json({"ok": False, "fehler": "ungültige Anfrage"}, 400)
        gruppe_dir = os.path.join(GROUPS_DIR, gruppe)
        try:
            auftrag = ki_app.vorbereiten(gruppe_dir, KI_LOG_FILE, auswahl)
        except ki_bild.KiFehler as err:
            return self.send_json({"ok": False, "fehler": err.text}, err.status)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.close_connection = True

        def schreiben(text):
            self.wfile.write(text.encode("utf-8"))
            self.wfile.flush()

        try:
            text, ein, aus, modell = ki_app.streamen(auftrag, schreiben)
            ki_app.speichern(gruppe_dir, KI_LOG_FILE, gruppe, auftrag, text, ein, aus, modell)
        except ki_bild.KiFehler as err:
            schreiben(ki_app.FEHLER_MARKE + err.text)
        except (BrokenPipeError, ConnectionResetError):
            print("KI-App: iPad hat die Verbindung getrennt.")
        except Exception as err:  # Server darf nie abstürzen
            print("KI-App-Fehler: %r" % err)
            schreiben(ki_app.FEHLER_MARKE + "Da ist etwas schiefgegangen. Bitte nochmal versuchen.")

    def plotter_folie(self):
        body = self.read_body(MAX_SHEET_BYTES)
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except ValueError:
            data = {}
        sticker = [s for s in data.get("sticker", []) if isinstance(s, dict)]
        try:
            auftrag = plotter.neuer_auftrag(PLOTTER_DIR, str(data.get("svg", "")).encode("utf-8"), sticker)
        except plotter.PlotterFehler as err:
            return self.send_json({"ok": False, "fehler": str(err)}, 409)
        print("Sticker-Folie bereit: %s (%d Sticker)" % (auftrag["name"], len(sticker)))
        return self.send_json({"ok": True, "auftrag": auftrag})

    def plotter_schritt(self):
        body = self.read_body(MAX_EVENT_BYTES)
        try:
            was = json.loads(body.decode("utf-8")).get("was", "") if body else ""
        except (ValueError, AttributeError):
            was = ""
        try:
            return self.send_json(dict(plotter.schritt(was), ok=True))
        except plotter.PlotterFehler as err:
            return self.send_json({"ok": False, "fehler": str(err)}, 409)

    def send_message(self):
        body = self.read_body(MAX_EVENT_BYTES)
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except ValueError:
            data = {}
        groups = [g for g in data.get("gruppen", []) if isinstance(g, str) and ID_RE.match(g)]
        text = str(data.get("text", "")).strip()[:MAX_MESSAGE_LEN]
        if not groups or not text:
            return self.send_json({"ok": False, "fehler": "Gruppen oder Text fehlen"}, 400)
        add_message(sorted(set(groups)), text)
        print("Nachricht an %d Gruppe(n): %s" % (len(set(groups)), text))
        return self.send_json({"ok": True, "gruppen": len(set(groups))})

    def save_settings(self):
        """Ändert nur, was mitgeschickt wird: schueler (Zahl) und/oder freigaben (Liste)."""
        body = self.read_body(MAX_EVENT_BYTES)
        try:
            data = json.loads(body.decode("utf-8")) if body else {}
        except ValueError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        settings = read_settings()
        if "schueler" in data:
            try:
                count = int(data.get("schueler"))
            except (ValueError, TypeError):
                return self.send_json({"ok": False, "fehler": "Zahl fehlt"}, 400)
            if not 1 <= count <= 60:
                return self.send_json({"ok": False, "fehler": "1 bis 60"}, 400)
            settings["schueler"] = count
        if "freigaben" in data:
            settings["freigaben"] = sorted(set(f for f in data.get("freigaben") or [] if isinstance(f, str) and FREIGABE_RE.match(f)))
        os.makedirs(DATA_ROOT, exist_ok=True)
        write_atomic(SETTINGS_FILE, json.dumps(settings).encode("utf-8"))
        return self.send_json(settings)

    def receive_stamp(self, query):
        stamp_id = (query.get("id") or [""])[0]
        name = clean_name((query.get("name") or [""])[0])
        group_id = (query.get("gruppe") or [""])[0]
        group_id = group_id if ID_RE.match(group_id) else ""
        if not ID_RE.match(stamp_id):
            return self.send_json({"ok": False, "fehler": "ungültige ID"}, 400)
        body = self.read_body(MAX_UPLOAD_BYTES)
        if body is None:
            return self.send_json({"ok": False, "fehler": "Datei leer oder zu groß"}, 413)
        text = body.decode("utf-8", errors="replace").lstrip()
        if not text.startswith("<svg") or "<script" in text.lower():
            return self.send_json({"ok": False, "fehler": "keine Stempel-Datei"}, 400)

        sorte = (query.get("art") or [""])[0]
        base = STICKER_DIR if sorte == "sticker" else DATA_DIR
        if sorte == "portraet":
            # Bonus 2 liegt bei den Stempeln (gleiche Holzplatte), am Namen erkennbar
            name = (name + "-Portraet")[:30]
        existing = find_stamp(stamp_id, base)
        if existing:
            # Same upload sent again (retry): accept, but store only once
            return self.send_json({"ok": True, "datei": existing, "doppelt": True})

        now = datetime.datetime.now()
        day_dir = os.path.join(base, now.strftime("%Y-%m-%d"))
        os.makedirs(day_dir, exist_ok=True)
        filename = "%s_%s_%s%s.svg" % (now.strftime("%H%M%S"), name.replace("_", "-"), stamp_id, "_" + group_id if group_id else "")
        tmp = os.path.join(day_dir, filename + ".tmp")
        with open(tmp, "wb") as fh:
            fh.write(body)
        os.replace(tmp, os.path.join(day_dir, filename))
        print("%s empfangen: %s" % ("Sticker" if base == STICKER_DIR else "Stempel", filename))
        return self.send_json({"ok": True, "datei": now.strftime("%Y-%m-%d") + "/" + filename, "doppelt": False})

    def log_message(self, fmt, *args):
        # Keep the terminal readable: only log errors
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("%s - %s\n" % (self.client_address[0], fmt % args))


def main():
    sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description="stencil.me Workshop-Server")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    handler = functools.partial(Handler, directory=REPO_DIR)
    try:
        server = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    except OSError as err:
        print("Server kann nicht starten: Port %d ist belegt oder gesperrt (%s)." % (args.port, err))
        print("Läuft der Server vielleicht schon in einem anderen Fenster?")
        sys.exit(1)

    print("stencil.me Workshop-Server läuft.")
    print("Übersicht am Laptop:  http://localhost:%d/laptop" % args.port)
    print("QR-Codes zum Drucken: http://localhost:%d/qr" % args.port)
    for ip in local_ips():
        print("Adresse für die iPads: http://%s:%d/" % (ip, args.port))
    print("Stempel landen in:   %s" % DATA_DIR)
    print("Stationen landen in: %s" % GROUPS_DIR)
    print("KI-Selbstporträt:     %s" % ("eingerichtet (%s)" % ki_bild.MODELL if ki_bild.eingerichtet() else "nicht eingerichtet, siehe server/einrichten.sh"))
    print("Beenden: dieses Fenster schließen oder Strg+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")


if __name__ == "__main__":
    main()
