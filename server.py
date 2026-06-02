# -*- coding: utf-8 -*-
from __future__ import annotations

import base64
import functools
import http.server
import json
import mimetypes
import re
import socket
import socketserver
import threading
from pathlib import Path


# Browser viewer -> local server save endpoint. The viewer auto-saves the live
# scene snapshot (settings, styles, Model Studio models) here so the portable
# ZIP can freeze it. Localhost only; SimpleHTTPRequestHandler stays read-only
# for everything else.
SCENE_STATE_ENDPOINT = "/api/scene-state"
SCENE_STATE_FILE = "planx_scene_state.json"
MODELS_SUBDIR = "models"
_SAFE_ID_RE = re.compile(r"[^A-Za-z0-9_\-]")
MAX_SCENE_STATE_BYTES = 256 * 1024 * 1024  # generous: embedded GLB models can be large


class QuietCorsHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):  # noqa: N802 (http.server naming)
        self.send_response(204)
        self.end_headers()

    def do_POST(self):  # noqa: N802 (http.server naming)
        if self.path.split("?", 1)[0] != SCENE_STATE_ENDPOINT:
            self._send_json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except (TypeError, ValueError):
            length = 0
        if length <= 0 or length > MAX_SCENE_STATE_BYTES:
            self._send_json(400, {"ok": False, "error": "missing or oversized body"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("payload must be a JSON object")
        except Exception as exc:
            self._send_json(400, {"ok": False, "error": f"bad request: {exc}"})
            return
        try:
            written = self._write_scene_state(payload)
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
            return
        self._send_json(200, {"ok": True, "written": written})

    def _send_json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _write_scene_state(self, payload: dict) -> str:
        data_dir = Path(self.directory) / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        state_path = data_dir / SCENE_STATE_FILE

        models_in = payload.pop("models", None)
        if models_in is None:
            # Lightweight save (settings/styles only): keep previously stored
            # Model Studio model references so the snapshot stays complete.
            try:
                prev = json.loads(state_path.read_text(encoding="utf-8"))
                payload["models"] = prev.get("models", []) if isinstance(prev, dict) else []
            except Exception:
                payload["models"] = []
        else:
            payload["models"] = self._write_model_files(data_dir, models_in)

        state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return str(state_path)

    def _write_model_files(self, data_dir: Path, models_in) -> list:
        models_dir = data_dir / MODELS_SUBDIR
        models_dir.mkdir(parents=True, exist_ok=True)
        refs = []
        keep = set()
        if isinstance(models_in, list):
            for model in models_in:
                if not isinstance(model, dict):
                    continue
                raw_id = str(model.get("id") or "").strip()
                b64 = model.get("dataBase64")
                if not raw_id or not b64:
                    continue
                safe_id = _SAFE_ID_RE.sub("", raw_id) or "model"
                try:
                    blob = base64.b64decode(b64)
                except Exception:
                    continue
                filename = f"{safe_id}.glb"
                (models_dir / filename).write_bytes(blob)
                keep.add(filename)
                refs.append({
                    "id": raw_id,
                    "name": model.get("name") or filename,
                    "category": model.get("category") or "",
                    "target": f"{MODELS_SUBDIR}/{filename}",
                })
        # Prune model files that are no longer part of the snapshot.
        for stale in models_dir.glob("*.glb"):
            if stale.name not in keep:
                try:
                    stale.unlink()
                except OSError:
                    pass
        return refs


class ReusableTcpServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class PlanX3DServer:
    def __init__(self, web_root: str, host: str = "127.0.0.1", start_port: int = 8080, end_port: int = 8099):
        self.web_root = Path(web_root)
        self.host = host
        self.start_port = start_port
        self.end_port = end_port
        self.port = None
        self._httpd = None
        self._thread = None

        mimetypes.add_type("application/json", ".geojson")
        mimetypes.add_type("image/tiff", ".tif")
        mimetypes.add_type("application/javascript", ".js")

    @property
    def is_running(self) -> bool:
        return self._httpd is not None

    @property
    def url(self) -> str:
        if self.port is None:
            return ""
        return f"http://{self.host}:{self.port}/src/"

    def start(self) -> str:
        if self.is_running:
            return self.url

        handler = functools.partial(QuietCorsHandler, directory=str(self.web_root))
        last_error = None
        for port in range(self.start_port, self.end_port + 1):
            if port_is_open(self.host, port):
                last_error = OSError(f"Port {port} is already in use")
                continue
            try:
                self._httpd = ReusableTcpServer((self.host, port), handler)
                self.port = port
                break
            except OSError as exc:
                last_error = exc

        if self._httpd is None:
            raise OSError(f"No free local port in {self.start_port}-{self.end_port}: {last_error}")

        self._thread = threading.Thread(target=self._httpd.serve_forever, name="PlanX3DServer", daemon=True)
        self._thread.start()
        return self.url

    def stop(self) -> None:
        if self._httpd is None:
            return
        self._httpd.shutdown()
        self._httpd.server_close()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self._thread = None
        self._httpd = None
        self.port = None


def port_is_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((host, port)) == 0
