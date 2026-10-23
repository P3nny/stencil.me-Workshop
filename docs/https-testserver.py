#!/usr/bin/env python3
"""Small HTTPS file server for testing the workshop pages on an iPad.

Deferred: not needed for the next workshop, see docs/entscheidungen.md.

Only the standard library is used. Example:
    python3 docs/https-testserver.py --cert fullchain.pem --key key.pem
"""
import argparse
import functools
import http.server
import os
import ssl


def main():
    parser = argparse.ArgumentParser(description="HTTPS-Testserver für die Workshop-Seiten")
    parser.add_argument("--cert", required=True, help="Zertifikat (fullchain.pem)")
    parser.add_argument("--key", required=True, help="privater Schlüssel (key.pem)")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."),
                        help="Ordner, der ausgeliefert wird (Standard: Repo-Wurzel)")
    args = parser.parse_args()

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(os.path.expanduser(args.cert), os.path.expanduser(args.key))

    handler = functools.partial(http.server.SimpleHTTPRequestHandler,
                                directory=os.path.abspath(args.dir))
    server = http.server.ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    server.socket = context.wrap_socket(server.socket, server_side=True)

    print("HTTPS-Testserver läuft auf Port %d, Ordner %s" % (args.port, os.path.abspath(args.dir)))
    print("Auf dem iPad: https://workshop.datenhandlung.de:%d/docs/ipad-test.html" % args.port)
    print("Beenden mit Strg+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
