"""A stand-in for Supabase Storage on a laptop, so the real API runs locally end to end (signing a
prescription uploads its PDF). Keeps files in memory. Only what lib/storage.ts calls:
  POST /storage/v1/object/<bucket>/<path>                upload
  GET  /storage/v1/object/authenticated/<bucket>/<path>  download
  POST /storage/v1/object/sign/<bucket>/<path>           a signed link
Run: python3 storage_stub.py 54330, and start the API with SUPABASE_URL=http://127.0.0.1:54330.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FILES: dict[str, bytes] = {}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, code, body=b"", kind="application/json"):
        self.send_response(code)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        data = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        if self.path.startswith("/storage/v1/object/sign/"):
            key = self.path[len("/storage/v1/object/sign/"):]
            return self._send(200, json.dumps({"signedURL": f"/object/authenticated/{key}"}).encode())
        if self.path.startswith("/storage/v1/object/"):
            FILES[self.path[len("/storage/v1/object/"):]] = data
            return self._send(200, json.dumps({"Key": self.path}).encode())
        self._send(404)

    def do_GET(self):
        key = self.path[len("/storage/v1/object/authenticated/"):]
        if key in FILES:
            return self._send(200, FILES[key], "application/pdf")
        self._send(404)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 54330
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
