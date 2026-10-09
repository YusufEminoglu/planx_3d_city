# -*- coding: utf-8 -*-
"""Selection bridge and its HTTP endpoints (server.py has no QGIS imports)."""
import importlib.util
import json
import tempfile
import unittest
import urllib.request
from pathlib import Path

_spec = importlib.util.spec_from_file_location("planx_server", Path(__file__).resolve().parents[1] / "server.py")
srv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(srv)


class BridgeTests(unittest.TestCase):
    def test_selection_sequence(self):
        b = srv.SelectionBridge()
        self.assertEqual(b.selection(), {"seq": 0, "points": []})
        b.set_qgis_selection([(1, 2), ("x", 3), (float("nan"), 1), [4.5, 6]])
        self.assertEqual(b.selection(), {"seq": 1, "points": [[1.0, 2.0], [4.5, 6.0]]})
        b.set_qgis_selection([])
        self.assertEqual(b.selection()["seq"], 2)

    def test_picks_are_queued_and_capped(self):
        b = srv.SelectionBridge()
        for i in range(30):
            b.add_viewer_pick(i, i)
        picks = b.pop_viewer_picks()
        self.assertEqual(len(picks), 20)
        self.assertEqual(picks[-1], (29.0, 29.0))
        self.assertEqual(b.pop_viewer_picks(), [])


class EndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        (Path(cls.tmp.name) / "src").mkdir()
        (Path(cls.tmp.name) / "src" / "index.html").write_text("ok", encoding="utf-8")
        cls.server = srv.PlanX3DServer(cls.tmp.name, start_port=18080, end_port=18120)
        cls.base = cls.server.start().rsplit("/src/", 1)[0]

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()
        cls.tmp.cleanup()

    def _get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=5) as r:  # nosec B310 - local test server
            return json.loads(r.read())

    def _post(self, path, body):
        data = json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=5) as r:  # nosec B310 - local test server
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_round_trip(self):
        self.server.bridge.set_qgis_selection([(500100.5, 4400200.25)])
        sel = self._get("/api/selection")
        self.assertEqual(sel["points"], [[500100.5, 4400200.25]])
        status, body = self._post("/api/viewer-pick", {"x": 500000, "y": 4400000})
        self.assertEqual((status, body["ok"]), (200, True))
        self.assertEqual(self.server.bridge.pop_viewer_picks(), [(500000.0, 4400000.0)])

    def test_bad_pick_is_rejected(self):
        status, body = self._post("/api/viewer-pick", {"x": "nope"})
        self.assertEqual(status, 400)
        self.assertFalse(body["ok"])

    def test_static_files_still_served(self):
        with urllib.request.urlopen(self.base + "/src/index.html", timeout=5) as r:  # nosec B310 - local test server
            self.assertEqual(r.read(), b"ok")


if __name__ == "__main__":
    unittest.main()
