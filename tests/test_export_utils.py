"""Unit tests for export_utils (pure Python, no QGIS).

    python -m unittest tests.test_export_utils   # from the plugin folder
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location("export_utils", Path(__file__).resolve().parents[1] / "export_utils.py")
eu = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(eu)


class DemClipWindowTest(unittest.TestCase):
    DEM = (0.0, 0.0, 10000.0, 10000.0)  # 10 km square, 5 m pixels

    def test_no_view_keeps_whole_dem(self):
        self.assertIsNone(eu.dem_clip_window(None, self.DEM, 5, -5))

    def test_small_view_is_cropped_with_margin_and_snapped(self):
        w = eu.dem_clip_window((4000.0, 4000.0, 5000.0, 5000.0), self.DEM, 5, -5)
        self.assertIsNotNone(w)
        margin = 5 * eu.DEM_MARGIN_PX + 1000 * eu.DEM_MARGIN_FRACTION  # 180 m
        self.assertLessEqual(w[0], 4000 - margin)
        self.assertGreaterEqual(w[2], 5000 + margin)
        for v in w:
            self.assertAlmostEqual(v / 5, round(v / 5))  # on the pixel grid

    def test_window_contains_viewer_read_window(self):
        # The viewer reads bounds +/- 20 px; the crop must cover that.
        view = (1234.5, 2345.6, 3456.7, 4567.8)
        w = eu.dem_clip_window(view, self.DEM, 5, -5)
        self.assertLessEqual(w[0], view[0] - 20 * 5)
        self.assertLessEqual(w[1], view[1] - 20 * 5)
        self.assertGreaterEqual(w[2], view[2] + 20 * 5)
        self.assertGreaterEqual(w[3], view[3] + 20 * 5)

    def test_view_covering_most_of_dem_keeps_it(self):
        self.assertIsNone(eu.dem_clip_window((100.0, 100.0, 9900.0, 9900.0), self.DEM, 5, -5))

    def test_view_outside_dem_keeps_it(self):
        self.assertIsNone(eu.dem_clip_window((20000.0, 20000.0, 21000.0, 21000.0), self.DEM, 5, -5))

    def test_window_is_clamped_to_dem(self):
        w = eu.dem_clip_window((-500.0, -500.0, 1000.0, 1000.0), self.DEM, 5, -5)
        self.assertEqual((w[0], w[1]), (0.0, 0.0))


class MiscTest(unittest.TestCase):
    def test_union_bounds_skips_invalid(self):
        self.assertEqual(eu.union_bounds([None, (0, 0, 1, 1), (2, -1, 3, 0.5), (5, 5, 4, 4)]), (0, -1, 3, 1))
        self.assertIsNone(eu.union_bounds([None]))

    def test_creation_options(self):
        self.assertIn("PREDICTOR=3", eu.dem_creation_options(True))
        self.assertIn("PREDICTOR=2", eu.dem_creation_options(False))

    def test_precision(self):
        self.assertEqual(eu.coordinate_precision(False), 3)
        self.assertEqual(eu.coordinate_precision(True), 7)

    def test_cache_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "a.geojson"
            out.write_text("{}")
            cache = eu.ExportCache(Path(d))
            self.assertFalse(cache.is_fresh(out, ["sig"]))
            cache.record(out, ["sig"])
            cache.save()
            cache2 = eu.ExportCache(Path(d))
            self.assertTrue(cache2.is_fresh(out, ["sig"]))
            self.assertFalse(cache2.is_fresh(out, ["other"]))
            self.assertFalse(cache2.is_fresh(out, None))
            out.unlink()
            self.assertFalse(cache2.is_fresh(out, ["sig"]))



class GeoreferenceTests(unittest.TestCase):
    def test_control_points(self):
        self.assertEqual(eu.georeference_control_xy((500.0, 200.0)), [(500.0, 200.0), (1500.0, 200.0), (500.0, 1200.0)])

    def test_record(self):
        xy = eu.georeference_control_xy((475000.0, 4420000.0))
        lonlat = [(32.7, 39.92), (32.7117, 39.9201), (32.7001, 39.929)]
        rec = eu.georeference_record("EPSG:32636", xy, lonlat)
        self.assertEqual(rec["crs"], "EPSG:32636")
        self.assertEqual(len(rec["controlPoints"]), 3)
        self.assertEqual(rec["controlPoints"][1]["xy"], [476000.0, 4420000.0])

    def test_rejects_bad_points(self):
        xy = eu.georeference_control_xy((0.0, 0.0))
        self.assertIsNone(eu.georeference_record("X", xy, [(0, 0), (0, 0)]))
        self.assertIsNone(eu.georeference_record("X", xy, [(0, 0), (200, 0), (0, 1)]))
        self.assertIsNone(eu.georeference_record("X", [(0, 0), (1, 1), (2, 2)], [(0, 0), (1, 0), (0, 1)]))
        self.assertIsNone(eu.georeference_record("X", xy, [(0, 0), (float("nan"), 0), (0, 1)]))


if __name__ == "__main__":
    unittest.main()
