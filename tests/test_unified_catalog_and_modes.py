"""Unit tests for unified raster/vector mode, empty layer defaults, and synced 3D building catalog."""
import re
import unittest
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parents[1]
OSM_3D_DIR = PLUGIN_DIR.parent / "osm_3d_model"


class UnifiedModeAndCatalogTests(unittest.TestCase):
    def test_style_tools_and_dialog_presets_contain_new_facades_roofs_and_massing(self):
        style_src = (PLUGIN_DIR / "style_tools.py").read_text(encoding="utf-8")
        dialog_src = (PLUGIN_DIR / "dialog.py").read_text(encoding="utf-8")
        self.assertIn('"planx_massing": QVariant.String', style_src)

        for facade in (
            "Apartment", "MixedUse", "Modern", "Office", "Heritage", "Brick", "Villa", "Industrial", "Civic",
            "ApartmentTextureA", "ApartmentTextureB", "ApartmentTextureC", "ApartmentTextureD",
            "ApartmentTextureE", "ApartmentTextureF", "ModernTextureA", "ModernTextureB",
        ):
            self.assertIn(f'"{facade}"', dialog_src, f"{facade} missing in dialog.py Quick Style")

        for roof in ("ClayTile", "Slate", "Shingle", "MetalSeam", "Copper", "Lead", "Gravel", "Green", "Solar"):
            self.assertIn(f'"{roof}"', dialog_src, f"{roof} missing in dialog.py Quick Style")

        for ground in ("Grass", "Gravel", "Sand", "Earth", "Water"):
            self.assertIn(f'"{ground}"', dialog_src, f"{ground} missing in dialog.py Quick Style")

        # Retired catalogue names must not be offered any more (they still load as aliases).
        for retired in ("ResidentialA", "UrbanA", "CurtainWall", "TurkishTile", "GravelBallast", "ParkGreen"):
            self.assertNotIn(f'"{retired}"', dialog_src, f"retired name {retired} still offered in dialog.py")

        for massing in (
            "Auto Smart Massing",
            "Extruded + roof",
            "Podium + tower",
            "Stepped tower",
            "Courtyard block",
            "Cantilever / pilotis",
            "Penthouse crown",
            "Extruded",
            "Footprint only",
        ):
            self.assertIn(massing, dialog_src, f"{massing} missing in dialog.py Quick Style")

    def test_residential_facade_assets_copied_to_planx_3d_city(self):
        assets_dir = PLUGIN_DIR / "web" / "src" / "assets"
        for letter in ("a", "b", "c", "d", "e", "f"):
            asset = assets_dir / f"facade_resid_{letter}.webp"
            self.assertTrue(asset.is_file(), f"Missing {asset.name}")
            self.assertGreater(asset.stat().st_size, 1000)

    def test_catalog_and_osm_3d_model_have_matching_facades_roofs_and_massing(self):
        catalog_src = (PLUGIN_DIR / "web" / "src" / "catalog.js").read_text(encoding="utf-8")
        osm_app_src = (OSM_3D_DIR / "web" / "src" / "app.js").read_text(encoding="utf-8")

        # Facades, roofs and surfaces come from one material catalogue, kept
        # byte-identical in both viewers.
        planx_catalogue = (PLUGIN_DIR / "web" / "src" / "material_catalogue.js").read_bytes()
        osm_catalogue = (OSM_3D_DIR / "web" / "src" / "material_catalogue.js").read_bytes()
        self.assertEqual(planx_catalogue, osm_catalogue, "material_catalogue.js differs between the two viewers")
        for name, src in (("planx_3d_city catalog.js", catalog_src), ("osm_3d_model app.js", osm_app_src)):
            self.assertIn("from './material_catalogue.js'", src, f"{name} does not use the material catalogue")

        expected_tokens = (
            "Modern Turkish",
            "Auto Smart Massing", "Podium + tower", "Stepped tower",
            "Courtyard block", "Cantilever / pilotis", "Penthouse crown",
        )
        for token in expected_tokens:
            self.assertIn(token, catalog_src, f"{token} missing in planx_3d_city catalog.js")
            self.assertIn(token, osm_app_src, f"{token} missing in osm_3d_model app.js")

        # Verify single-line buildingMode contract in osm_3d_model/web/src/app.js for looks_check.mjs
        match = re.search(r"buildingMode: \['([^\]]+)'\]", osm_app_src)
        self.assertIsNotNone(match, "buildingMode single-line array missing in osm_3d_model/web/src/app.js")
        modes = match.group(1).split("', '")
        self.assertIn("Auto Smart Massing", modes)
        self.assertIn("Extruded + roof", modes)
        self.assertIn("Podium + tower", modes)

    def test_relative_js_imports_resolve(self):
        src_root = PLUGIN_DIR / "web" / "src"
        patterns = (
            re.compile(r"^\s*import\s[^;]*?from\s+'(\.[^']+)'", re.M),
            re.compile(r"\bimport\(\s*'(\.[^']+)'\s*\)"),
            re.compile(r"new URL\(\s*'(\.[^']+)'\s*,\s*import\.meta\.url\s*\)"),
        )
        missing = []
        for js_file in src_root.rglob("*.js"):
            if "assets" in js_file.parts:
                continue
            code = js_file.read_text(encoding="utf-8")
            for pat in patterns:
                for m in pat.finditer(code):
                    target = (js_file.parent / m.group(1)).resolve()
                    if not target.exists():
                        missing.append(f"{js_file.relative_to(src_root)} -> {m.group(1)}")
        self.assertEqual(missing, [])

    def test_exporter_has_no_mandatory_layer_requirements(self):
        exporter_src = (PLUGIN_DIR / "exporter.py").read_text(encoding="utf-8")
        self.assertIn("RASTER_TEXTURE_REQUIRED_INPUTS = ()", exporter_src)
        self.assertIn("return ()", exporter_src)

    def test_dialog_initializes_empty_combos_and_has_clear_all_button(self):
        dialog_src = (PLUGIN_DIR / "dialog.py").read_text(encoding="utf-8")
        self.assertIn("box.setAllowEmptyLayer(True)", dialog_src)
        self.assertIn("box.setLayer(None)", dialog_src)
        self.assertIn("self.clear_layers_button", dialog_src)
        self.assertIn("def _clear_all_layers", dialog_src)
        self.assertNotIn("Publish mode", dialog_src)


if __name__ == "__main__":
    unittest.main()
