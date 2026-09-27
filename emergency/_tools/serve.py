"""Serve the site locally with caching turned off, so edits show on reload.

    python emergency/_tools/serve.py [port]      (default 4401)

Serves the repository root, so Chill is at http://127.0.0.1:4401/emergency/
and its tests at http://127.0.0.1:4401/emergency/_tests/. Plain
`python -m http.server` lets the browser keep old copies of the JavaScript
modules, which hides changes.
"""

import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4401
    handler = functools.partial(NoCache, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Serving {ROOT} at http://127.0.0.1:{port}/emergency/")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
