#!/usr/bin/env python3
"""Tiny dev server for the prototype: serves this folder and tells the browser never to cache."""
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5190

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):  # keep the terminal quiet
        pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Folder of Life prototype → http://localhost:{PORT}")
    httpd.serve_forever()
