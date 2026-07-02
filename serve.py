#!/usr/bin/env python3
"""Wendlo prototype server: static files + a same-origin /proxy for smart-link imports.

Usage:  python3 serve.py [port]         (default 8000, serves this directory)

/proxy?url=<https-url>  →  fetches the page server-side (no browser CORS) and
returns the body. Used by the admin console's DistroKid/TuneCore importer.
The production build replaces this with a Next.js API route.
"""
import sys, http.server, socketserver, urllib.request, urllib.parse, functools

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = __file__.rsplit('/', 1)[0] or '.'
MAX_BYTES = 3 * 1024 * 1024
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36')

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # dev server: always revalidate so edits show up on plain reloads
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/proxy'):
            return self.handle_proxy()
        return super().do_GET()

    def handle_proxy(self):
        qs = urllib.parse.urlparse(self.path).query
        url = urllib.parse.parse_qs(qs).get('url', [''])[0]
        if not url.startswith(('http://', 'https://')):
            return self.send_proxy_error(400, 'proxy: url param must be http(s)')
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*'})
            with urllib.request.urlopen(req, timeout=15) as r:
                body = r.read(MAX_BYTES)
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_proxy_error(502, f'proxy: {e}')

    def send_proxy_error(self, code, msg):
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(msg.encode())

    def log_message(self, fmt, *args):
        if '/proxy' in (args[0] if args else ''):
            super().log_message(fmt, *args)   # log proxy hits, keep static quiet


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('', PORT), handler) as httpd:
        print(f'Wendlo server on http://localhost:{PORT}  (static + /proxy)')
        httpd.serve_forever()
