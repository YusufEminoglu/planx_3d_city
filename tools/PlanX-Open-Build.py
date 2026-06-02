# -*- coding: utf-8 -*-
"""PlanX 3D City - open any portable build (old or new) reliably.

Serves a portable build folder on a FREE local port with caching disabled, then
opens the browser. Use this to review several student / portable ZIPs in
sequence on ONE computer without the fixed-8080 collision that made every build
show a single, stale "version C".

Why this is needed:
  Older portable builds launch with `py -m http.server 8080`. A fixed port means
  the second build cannot bind 8080, so the browser keeps hitting whichever
  server (or leftover server) already owns 8080 - you see the wrong student.
  This tool gives every build its own free port and disables HTTP caching, so
  the browser can never serve a previous build's cached files.

Usage:
  - Drag an extracted build folder onto PlanX-Open-Build.bat, OR
  - py -3 PlanX-Open-Build.py "C:\\path\\to\\extracted\\build"

Close the console window (or press Ctrl+C) to stop the server, THEN open the
next student. Each run prints the exact URL it opened.
"""
import functools
import http.server
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path


def find_build_root(start):
    """Locate the folder that contains src/index.html (the build root)."""
    start = Path(start).resolve()
    if (start / "src" / "index.html").exists():
        return start
    # The ZIP may extract into a nested subfolder - search a few levels down.
    for depth in ("*", "*/*", "*/*/*"):
        for hit in start.glob(depth + "/src/index.html"):
            return hit.parent.parent
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        arg = Path(sys.argv[1])
    else:
        arg = Path(__file__).resolve().parent
    root = find_build_root(arg)
    if root is None:
        print("ERROR: could not find 'src/index.html' under:")
        print("    " + str(arg))
        print("Drag the EXTRACTED build folder onto PlanX-Open-Build.bat.")
        input("Press Enter to close...")
        return
    handler = functools.partial(Handler, directory=str(root))
    httpd = Server(("127.0.0.1", 0), handler)  # 0 -> OS assigns a free port
    port = httpd.server_address[1]
    url = "http://127.0.0.1:{0}/src/?portable=1".format(port)
    print("PlanX 3D City - serving build:")
    print("    " + str(root))
    print("    " + url)
    print("Keep this window open. Close it (or Ctrl+C) before opening the next build.")
    threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
