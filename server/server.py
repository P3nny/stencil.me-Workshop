#!/usr/bin/env python3
"""stencil.me workshop server.

Serves the workshop app to the iPads and receives stamp files (SVG).
Only the Python standard library is used, nothing needs to be installed.

    python3 server/server.py            # port 8000
    python3 server/server.py --port 8080

iPads may only load the app files and upload stamps. The overview page
(/laptop), the stamp list and the stamp files are only reachable from the
laptop itself (localhost), so the children cannot see each other's data.
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
import urllib.parse

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(REPO_DIR, "server", "daten", "stempel")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# Paths the iPads may load. Everything else (archiv/, .git/, server/) stays private.
PUBLIC_FILES = {"/", "/index.html", "/code-quiz.html", "/kunst-quiz.html", "/docs/ipad-test.html"}
PUBLIC_PREFIXES = ("/vendor/",)

ID_RE = re.compile(r"^[a-f0-9]{12}$")
NAME_RE = re.compile(r"[^A-Za-z0-9äöüÄÖÜß_-]")
VIRTUAL_IFACES = ("docker", "br-", "virbr", "veth", "vboxnet", "vmnet", "lxc", "lxd")


def clean_name(name):
    name = NAME_RE.sub("", (name or "").strip().replace(" ", "-"))[:20]
    return name or "ohne-Name"


def find_stamp(stamp_id):
    """Return the stored file name for an upload id, or None."""
    if not os.path.isdir(DATA_DIR):
        return None
    suffix = "_" + stamp_id + ".svg"
    for day in os.listdir(DATA_DIR):
        day_dir = os.path.join(DATA_DIR, day)
        if os.path.isdir(day_dir):
            for f in os.listdir(day_dir):
                if f.endswith(suffix):
                    return day + "/" + f
    return None


def list_stamps():
    result = []
    if not os.path.isdir(DATA_DIR):
        return result
    for day in sorted(os.listdir(DATA_DIR), reverse=True):
        day_dir = os.path.join(DATA_DIR, day)
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
                })
    return result


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
        if self.path.split("?")[0] in PUBLIC_FILES:
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

        if path in ("/laptop", "/api/liste", "/api/info") or path.startswith("/daten/"):
            if not self.is_local():
                return self.send_error(403, "Nur am Laptop")
            if path == "/laptop":
                self.path = "/server/laptop.html"
                return super().do_GET()
            if path == "/api/liste":
                return self.send_json({"stempel": list_stamps(), "ordner": DATA_DIR})
            if path == "/api/info":
                port = self.server.server_address[1]
                return self.send_json({"adressen": ["http://%s:%d/" % (ip, port) for ip in local_ips()]})
            return self.send_stamp_file(path[len("/daten/"):])

        if path in PUBLIC_FILES or path.startswith(PUBLIC_PREFIXES):
            return super().do_GET()
        return self.send_error(404)

    def send_stamp_file(self, rel):
        full = os.path.abspath(os.path.join(DATA_DIR, rel))
        if not full.startswith(DATA_DIR + os.sep) or not os.path.isfile(full):
            return self.send_error(404)
        with open(full, "rb") as fh:
            body = fh.read()
        self.send_response(200)
        self.send_header("Content-Type", "image/svg+xml")
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
        if parsed.path == "/api/alle-loeschen":
            if not self.is_local():
                return self.send_error(403, "Nur am Laptop")
            if os.path.isdir(DATA_DIR):
                shutil.rmtree(DATA_DIR)
            print("Alle Stempel gelöscht.")
            return self.send_json({"ok": True})
        return self.send_error(404)

    def receive_stamp(self, query):
        stamp_id = (query.get("id") or [""])[0]
        name = clean_name((query.get("name") or [""])[0])
        if not ID_RE.match(stamp_id):
            return self.send_json({"ok": False, "fehler": "ungültige ID"}, 400)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            return self.send_json({"ok": False, "fehler": "Datei leer oder zu groß"}, 413)
        body = self.rfile.read(length)
        text = body.decode("utf-8", errors="replace").lstrip()
        if not text.startswith("<svg") or "<script" in text.lower():
            return self.send_json({"ok": False, "fehler": "keine Stempel-Datei"}, 400)

        existing = find_stamp(stamp_id)
        if existing:
            # Same upload sent again (retry): accept, but store only once
            return self.send_json({"ok": True, "datei": existing, "doppelt": True})

        now = datetime.datetime.now()
        day_dir = os.path.join(DATA_DIR, now.strftime("%Y-%m-%d"))
        os.makedirs(day_dir, exist_ok=True)
        filename = "%s_%s_%s.svg" % (now.strftime("%H%M%S"), name, stamp_id)
        tmp = os.path.join(day_dir, filename + ".tmp")
        with open(tmp, "wb") as fh:
            fh.write(body)
        os.replace(tmp, os.path.join(day_dir, filename))
        print("Stempel empfangen: %s" % filename)
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
    for ip in local_ips():
        print("Adresse für die iPads: http://%s:%d/" % (ip, args.port))
    print("Stempel landen in:   %s" % DATA_DIR)
    print("Beenden: dieses Fenster schließen oder Strg+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer beendet.")


if __name__ == "__main__":
    main()
