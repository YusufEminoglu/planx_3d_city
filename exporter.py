# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from qgis.PyQt.QtCore import QSize
from qgis.PyQt.QtGui import QColor
from qgis.core import (
    QgsCoordinateTransform,
    QgsCoordinateTransformContext,
    QgsMapRendererParallelJob,
    QgsMapSettings,
    QgsProject,
    QgsRasterFileWriter,
    QgsRasterPipe,
    QgsVectorFileWriter,
)


MODE_VECTOR = "vector"
MODE_RASTER_TEXTURE = "raster_texture"
PLUGIN_VERSION_FALLBACK = "0.8.22"
VECTOR_REQUIRED_INPUTS = ()
VECTOR_RECOMMENDED_INPUTS = ("dem", "roi", "roads", "buildings", "blocks", "parcels")
RASTER_TEXTURE_REQUIRED_INPUTS = ("roi", "plan_texture", "roads", "buildings")
REQUIRED_INPUTS = VECTOR_REQUIRED_INPUTS
OPTIONAL_INPUTS = ("trees", "hardscape", "sidewalks", "pedestrian_paths", "lights", "benches", "trashbins", "busstops")
VECTOR_OPTIONAL_INPUTS = VECTOR_RECOMMENDED_INPUTS + OPTIONAL_INPUTS
ASSET_THEME_DEFAULT = "Modern Urban"
ASSET_CATEGORIES = ("pedestrians", "cars", "trees", "lights", "benches", "bins", "busstops", "facades", "roofs", "paving")
TREE_VARIANT_CATALOG = (
    "Street Linden",
    "Plane",
    "Compact Maple",
    "Columnar",
    "Olive",
    "Cypress",
    "Palm",
    "Jacaranda",
    "Pine",
    "Broadleaf",
)
ASSET_THEME_PRESETS = {
    "Modern Urban": {
        "pedestrians": ["Commuter", "Urban Casual", "Office", "Student", "Evening"],
        "cars": ["Graphite", "Slate", "Teal", "White", "Navy", "Silver"],
        "trees": ["Street Linden", "Plane", "Compact Maple", "Columnar", "Broadleaf", "Pine", "Olive", "Cypress"],
        "lights": ["Modern Arc", "Dual Head", "Slim Post", "Bollard Path", "Classic Post"],
        "benches": ["Wood Plank", "Concrete Slab", "Curved Metal", "Slim Urban", "Stone Seat"],
        "bins": ["Square Box", "Dual Recycle", "Cylinder", "Compact", "Solar Compactor"],
        "busstops": ["Glass Shelter", "Minimal Canopy", "Steel Canopy", "Wood Cabin", "Compact Marker"],
        "facades": ["UrbanA", "UrbanB", "UrbanC", "UrbanD", "UrbanE"],
        "roofs": ["RoofA", "RoofB", "GermanTile", "USShingle", "StandingSeam"],
        "paving": ["Asphalt", "StoneA", "Cobble", "Concrete", "PlazaGranite"],
    },
    "Modern Turkish": {
        "pedestrians": ["Commuter", "Urban Casual", "Office", "Student", "Visitor"],
        "cars": ["White", "Graphite", "Silver", "Navy", "Slate", "Burgundy"],
        "trees": ["Plane", "Street Linden", "Compact Maple", "Columnar", "Olive", "Cypress", "Jacaranda", "Pine"],
        "lights": ["Modern Arc", "Slim Post", "Dual Head", "Classic Post"],
        "benches": ["Wood Plank", "Concrete Slab", "Slim Urban", "Stone Seat"],
        "bins": ["Square Box", "Dual Recycle", "Cylinder", "Compact"],
        "busstops": ["Glass Shelter", "Steel Canopy", "Minimal Canopy", "Compact Marker"],
        "facades": ["Urban_TR_A", "Urban_TR_B", "Urban_TR_C", "Urban_TR_D"],
        "roofs": ["TurkishTile", "CeramicLight", "StandingSeam", "RoofA"],
        "paving": ["Concrete", "StoneA", "WarmStone", "Asphalt", "PlazaGranite"],
    },
    "Mediterranean": {
        "pedestrians": ["Casual Linen", "Warm Neutral", "Student", "Visitor"],
        "cars": ["Ivory", "Terracotta", "Olive", "Slate", "Sand"],
        "trees": ["Olive", "Cypress", "Plane", "Palm", "Jacaranda", "Broadleaf", "Compact Maple", "Street Linden"],
        "lights": ["Classic Post", "Slim Post", "Heritage Lantern", "Modern Arc"],
        "benches": ["Wood Plank", "Curved Metal", "Stone Seat", "Classic Iron"],
        "bins": ["Cylinder", "Square Box", "Dual Recycle", "Compact"],
        "busstops": ["Minimal Canopy", "Wood Cabin", "Glass Shelter", "Compact Marker"],
        "facades": ["MediterraneanStucco", "UrbanB", "UrbanD", "CoastalWhite"],
        "roofs": ["TurkishTile", "CeramicLight", "GermanTile", "RoofA"],
        "paving": ["StoneA", "WarmStone", "Cobble", "Concrete"],
    },
    "Campus": {
        "pedestrians": ["Student", "Academic", "Sport", "Visitor"],
        "cars": ["Slate", "Navy", "White", "Graphite", "Silver"],
        "trees": ["Plane", "Pine", "Compact Maple", "Street Linden", "Broadleaf", "Columnar", "Olive", "Cypress"],
        "lights": ["Slim Post", "Campus Twin", "Modern Arc", "Dual Head"],
        "benches": ["Wood Plank", "Concrete Slab", "Slim Urban", "Eco Timber"],
        "bins": ["Dual Recycle", "Square Box", "Compact", "Solar Compactor"],
        "busstops": ["Glass Shelter", "Minimal Canopy", "Steel Canopy"],
        "facades": ["CampusGlass", "UrbanC", "UrbanA", "UrbanB"],
        "roofs": ["RoofA", "RoofC", "USShingle", "SolarRoof"],
        "paving": ["Concrete", "CampusPaver", "StoneA", "Asphalt"],
    },
    "Eco": {
        "pedestrians": ["Outdoor", "Casual Green", "Student", "Visitor"],
        "cars": ["Teal", "Olive", "White", "Slate", "Moss"],
        "trees": ["Broadleaf", "Pine", "Street Linden", "Compact Maple", "Olive", "Jacaranda", "Cypress", "Plane"],
        "lights": ["Slim Post", "Bollard Path", "Modern Arc", "Classic Post"],
        "benches": ["Eco Timber", "Wood Plank", "Stone Seat", "Concrete Slab"],
        "bins": ["Dual Recycle", "Compact", "Cylinder", "Solar Compactor"],
        "busstops": ["Wood Cabin", "Minimal Canopy", "Glass Shelter"],
        "facades": ["EcoTimber", "UrbanD", "UrbanB", "UrbanA"],
        "roofs": ["GreenRoof", "SolarRoof", "RoofA", "TurkishTile"],
        "paving": ["Permeable", "Cobble", "StoneA", "Concrete"],
    },
    "Dense Urban": {
        "pedestrians": ["Commuter", "Office", "Evening", "Urban Casual", "Visitor"],
        "cars": ["Graphite", "Black", "Navy", "White", "Slate", "Burgundy"],
        "trees": ["Columnar", "Compact Maple", "Street Linden", "Plane", "Broadleaf", "Pine", "Olive", "Cypress"],
        "lights": ["Dual Head", "Modern Arc", "Slim Post", "Bollard Path"],
        "benches": ["Concrete Slab", "Curved Metal", "Slim Urban", "Stone Seat"],
        "bins": ["Square Box", "Compact", "Dual Recycle", "Solar Compactor"],
        "busstops": ["Glass Shelter", "Steel Canopy", "Minimal Canopy", "Compact Marker"],
        "facades": ["DenseBrick", "UrbanA", "UrbanC", "UrbanD"],
        "roofs": ["StandingSeam", "RoofA", "RoofB", "USShingle"],
        "paving": ["Asphalt", "Concrete", "Grid", "PlazaGranite"],
    },
    "Civic Heritage": {
        "pedestrians": ["Visitor", "Academic", "Warm Neutral", "Commuter"],
        "cars": ["Graphite", "Ivory", "Slate", "Burgundy", "Black"],
        "trees": ["Plane", "Cypress", "Street Linden", "Columnar", "Olive", "Broadleaf", "Jacaranda", "Pine"],
        "lights": ["Heritage Lantern", "Classic Post", "Slim Post", "Bollard Path"],
        "benches": ["Classic Iron", "Stone Seat", "Wood Plank", "Concrete Slab"],
        "bins": ["Cylinder", "Square Box", "Dual Recycle", "Compact"],
        "busstops": ["Steel Canopy", "Glass Shelter", "Minimal Canopy"],
        "facades": ["CivicStone", "MediterraneanStucco", "UrbanB", "UrbanC"],
        "roofs": ["GermanTile", "CeramicLight", "TurkishTile", "StandingSeam"],
        "paving": ["WarmStone", "StoneA", "Cobble", "PlazaGranite"],
    },
    "Coastal Light": {
        "pedestrians": ["Casual Linen", "Visitor", "Student", "Outdoor"],
        "cars": ["White", "Ivory", "Teal", "Sand", "Slate"],
        "trees": ["Palm", "Plane", "Olive", "Broadleaf", "Jacaranda", "Street Linden", "Compact Maple", "Cypress"],
        "lights": ["Slim Post", "Modern Arc", "Bollard Path", "Classic Post"],
        "benches": ["Wood Plank", "Eco Timber", "Stone Seat", "Slim Urban"],
        "bins": ["Cylinder", "Dual Recycle", "Compact", "Square Box"],
        "busstops": ["Minimal Canopy", "Glass Shelter", "Wood Cabin"],
        "facades": ["CoastalWhite", "MediterraneanStucco", "UrbanD", "CampusGlass"],
        "roofs": ["CeramicLight", "RoofA", "SolarRoof", "TurkishTile"],
        "paving": ["WarmStone", "Permeable", "StoneA", "Concrete"],
    },
}


def plugin_version() -> str:
    try:
        metadata = Path(__file__).with_name("metadata.txt").read_text(encoding="utf-8-sig")
    except Exception:
        return PLUGIN_VERSION_FALLBACK
    for line in metadata.splitlines():
        key, sep, value = line.partition("=")
        if sep and key.strip() == "version":
            return value.strip() or PLUGIN_VERSION_FALLBACK
    return PLUGIN_VERSION_FALLBACK


VECTOR_TARGETS = {
    "roi": "roi.geojson",
    "roads": "myroads.geojson",
    "buildings": "mybuildings.geojson",
    "blocks": "myblocks.geojson",
    "parcels": "myparcels.geojson",
    "trees": "mytrees.geojson",
    "hardscape": "myhardscape.geojson",
    "sidewalks": "mysidewalks.geojson",
    "pedestrian_paths": "mypedestrian_paths.geojson",
    "lights": "mylights.geojson",
    "benches": "mybenches.geojson",
    "trashbins": "mytrashbins.geojson",
    "busstops": "mybusstops.geojson",
}

LABELS = {
    "dem": "DEM",
    "plan_texture": "Plan texture GeoTIFF",
    "basemap": "QGIS basemap texture",
    "roi": "ROI",
    "roads": "Roads",
    "buildings": "Buildings",
    "blocks": "Blocks",
    "parcels": "Parcels",
    "trees": "Trees",
    "hardscape": "Hardscape",
    "sidewalks": "Sidewalks",
    "pedestrian_paths": "Pedestrian paths",
    "lights": "Lights",
    "benches": "Benches",
    "trashbins": "Trash bins",
    "busstops": "Bus stops",
}


class ExportError(RuntimeError):
    pass


def copy_portable_viewer(web_root: str, output_dir: str, tour_json_path: Optional[str] = None) -> list[str]:
    """Copy the self-contained browser viewer payload for classroom handoff."""
    web_path = Path(web_root)
    data_path = web_path / "data"
    if not data_path.exists():
        raise ExportError("No exported web/data folder found. Export project data first, then create a portable viewer.")

    output_path = Path(output_dir)
    if output_path.exists():
        raise ExportError(f"Portable viewer folder already exists: {output_path}")
    output_path.mkdir(parents=True, exist_ok=False)

    copied: list[str] = []

    def copy_dir(source: Path, target: Path) -> None:
        if not source.exists():
            raise ExportError(f"Required viewer folder is missing: {source}")
        ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".git", ".idea", ".DS_Store")
        shutil.copytree(source, target, ignore=ignore)
        for path in target.rglob("*"):
            if path.is_file():
                copied.append(str(path))

    copy_dir(web_path / "src", output_path / "src")
    copy_dir(web_path / "assets" / "vendor", output_path / "assets" / "vendor")
    copy_dir(data_path, output_path / "data")

    if tour_json_path:
        tour_source = Path(tour_json_path)
        if not tour_source.exists():
            raise ExportError(f"Tour JSON file does not exist: {tour_source}")
        tour_target = output_path / "data" / "planx_tour.json"
        shutil.copy2(tour_source, tour_target)
        copied.append(str(tour_target))

    readme_path = output_path / "README_PORTABLE_VIEWER.txt"
    readme_path.write_text(
        "\n".join(
            [
                "PlanX 3D City Portable Viewer",
                "",
                "This folder contains the exported viewer app, bundled vendor libraries, and the current project data.",
                "",
                "How to open:",
                "Option A: double-click Start-PlanX-Viewer.bat on Windows.",
                "Option B:",
                "1. Open a terminal in this folder.",
                "2. Run: py -3 -m http.server 8080",
                "3. Open: http://127.0.0.1:8080/src/",
                "",
                "Notes:",
                "- Do not open src/index.html directly from the file system; GeoTIFF and GeoJSON loading needs a local HTTP server.",
                "- Narrative Studio JSON files store camera/tour/viewer state only. They do not embed DEM, GeoJSON, imagery, or the viewer app.",
                "- If this package includes data/planx_tour.json, the viewer can auto-load it on another computer.",
                "- If you export a newer project from QGIS, create a fresh portable folder so the copied data stays in sync.",
            ]
        ),
        encoding="utf-8",
    )
    copied.append(str(readme_path))

    bat_path = output_path / "Start-PlanX-Viewer.bat"
    bat_path.write_text(
        "\n".join(
            [
                "@echo off",
                "cd /d \"%~dp0\"",
                "start \"\" \"http://127.0.0.1:8080/src/\"",
                "py -3 -m http.server 8080",
                "pause",
            ]
        ),
        encoding="utf-8",
    )
    copied.append(str(bat_path))

    ps1_path = output_path / "Start-PlanX-Viewer.ps1"
    ps1_path.write_text(
        "\n".join(
            [
                "Set-Location -LiteralPath $PSScriptRoot",
                "Start-Process \"http://127.0.0.1:8080/src/\"",
                "py -3 -m http.server 8080",
            ]
        ),
        encoding="utf-8",
    )
    copied.append(str(ps1_path))
    return copied


def zip_portable_viewer(web_root: str, zip_path: str, tour_json_path: Optional[str] = None) -> list[str]:
    zip_target = Path(zip_path)
    zip_target.parent.mkdir(parents=True, exist_ok=True)
    if zip_target.exists():
        zip_target.unlink()

    root_name = zip_target.stem or "planx_3d_city_portable"
    with tempfile.TemporaryDirectory(prefix="planx_3d_city_portable_") as tmp:
        portable_root = Path(tmp) / root_name
        copied = copy_portable_viewer(web_root, str(portable_root), tour_json_path=tour_json_path)
        with zipfile.ZipFile(zip_target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for path in portable_root.rglob("*"):
                if path.is_file():
                    zf.write(path, path.relative_to(portable_root.parent).as_posix())
    return copied + [str(zip_target)]


def empty_feature_collection() -> dict:
    return {"type": "FeatureCollection", "name": "empty", "features": []}


def write_empty_geojson(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(empty_feature_collection(), ensure_ascii=False, indent=2), encoding="utf-8")


def web_data_paths(web_root: str) -> tuple[Path, Path]:
    data_root = Path(web_root) / "data"
    dem_dir = data_root / "dem"
    vector_dir = data_root / "yerlesim"
    dem_dir.mkdir(parents=True, exist_ok=True)
    vector_dir.mkdir(parents=True, exist_ok=True)
    return dem_dir, vector_dir


def target_files(web_root: str) -> list[Path]:
    dem_dir, vector_dir = web_data_paths(web_root)
    texture_dir = Path(web_root) / "data" / "texture"
    texture_dir.mkdir(parents=True, exist_ok=True)
    files = [dem_dir / "mydem.tif", texture_dir / "siteplan.tif"]
    files.append(texture_dir / "basemap.png")
    files.extend(vector_dir / filename for filename in VECTOR_TARGETS.values())
    files.append(Path(web_root) / "data" / "planx_manifest.json")
    return files


def existing_target_files(web_root: str) -> list[Path]:
    return [path for path in target_files(web_root) if path.exists()]


def export_mode(layer_map: dict) -> str:
    return layer_map.get("mode") or MODE_VECTOR


def required_inputs_for_mode(mode: str) -> tuple[str, ...]:
    return RASTER_TEXTURE_REQUIRED_INPUTS if mode == MODE_RASTER_TEXTURE else VECTOR_REQUIRED_INPUTS


def optional_inputs_for_mode(mode: str) -> tuple[str, ...]:
    if mode == MODE_RASTER_TEXTURE:
        return ("blocks", "parcels") + OPTIONAL_INPUTS
    return VECTOR_OPTIONAL_INPUTS


def recommended_inputs_for_mode(mode: str) -> tuple[str, ...]:
    if mode == MODE_RASTER_TEXTURE:
        return ("dem",)
    return VECTOR_RECOMMENDED_INPUTS


def validate_inputs(layer_map: dict) -> list[str]:
    required_inputs = required_inputs_for_mode(export_mode(layer_map))
    missing = []
    for key in required_inputs:
        if layer_map.get(key) is None:
            missing.append(LABELS[key])
    return missing


def export_all(layer_map: dict, web_root: str, feedback=None) -> list[str]:
    mode = export_mode(layer_map)
    required_inputs = required_inputs_for_mode(mode)
    optional_inputs = optional_inputs_for_mode(mode)
    missing = validate_inputs(layer_map)
    if missing:
        raise ExportError("Missing required inputs: " + ", ".join(missing))

    dem_dir, vector_dir = web_data_paths(web_root)
    texture_dir = Path(web_root) / "data" / "texture"
    texture_dir.mkdir(parents=True, exist_ok=True)
    written = []
    manifest_inputs = []
    export_crs = _target_export_crs(layer_map)
    if feedback and export_crs is not None:
        feedback(f"Export CRS -> {export_crs.authid() or export_crs.description()}")

    dem_path = dem_dir / "mydem.tif"
    dem_layer = layer_map.get("dem")
    if dem_layer is None:
        if dem_path.exists():
            dem_path.unlink()
        manifest_inputs.append(_layer_manifest("dem", None, "dem/mydem.tif", True, required_inputs))
    else:
        try:
            _export_dem(dem_layer, dem_path)
        except ExportError as exc:
            # DEM is optional in all modes; keep export alive and let the viewer
            # fall back to its flat-terrain mode.
            if dem_path.exists():
                dem_path.unlink()
            manifest_inputs.append(_layer_manifest("dem", None, "dem/mydem.tif", True, required_inputs))
            if feedback:
                feedback(f"DEM export skipped ({dem_layer.name()}): {exc}")
        else:
            written.append(str(dem_path))
            manifest_inputs.append(_layer_manifest("dem", dem_layer, "dem/mydem.tif", False, required_inputs))

    terrain_texture = None
    base_map_texture = None
    if mode == MODE_RASTER_TEXTURE:
        texture_path = texture_dir / "siteplan.tif"
        _export_dem(layer_map["plan_texture"], texture_path)
        terrain_texture = {
            "key": "plan_texture",
            "target": "texture/siteplan.tif",
            "label": LABELS["plan_texture"],
        }
        written.append(str(texture_path))
        manifest_inputs.append(_layer_manifest("plan_texture", layer_map["plan_texture"], "texture/siteplan.tif", False, required_inputs))

    if layer_map.get("basemap") is not None:
        basemap_path = texture_dir / "basemap.png"
        _export_basemap(layer_map, basemap_path)
        base_map_texture = {
            "key": "basemap",
            "target": "texture/basemap.png",
            "label": LABELS["basemap"],
            "sourceLayer": layer_map["basemap"].name(),
            "size": int(layer_map.get("basemap_export_size") or 4096),
        }
        written.append(str(basemap_path))
        manifest_inputs.append(_layer_manifest("basemap", layer_map["basemap"], "texture/basemap.png", False, required_inputs))

    for key, filename in VECTOR_TARGETS.items():
        out_path = vector_dir / filename
        layer = layer_map.get(key)
        empty = layer is None
        if layer is None:
            write_empty_geojson(out_path)
        else:
            _export_vector(layer, out_path, export_crs)
        written.append(str(out_path))
        manifest_inputs.append(_layer_manifest(key, layer, f"yerlesim/{filename}", empty, required_inputs))
        if feedback:
            feedback(f"{LABELS[key]} -> {out_path.name}")

    road_access = _road_access_manifest(layer_map)
    field_mappings = _field_mappings_manifest(layer_map)
    analysis_defaults = _analysis_defaults_manifest(layer_map)
    viewer_defaults = _viewer_defaults_manifest(layer_map)
    asset_theme, asset_pools, pedestrian_style = _asset_theme_manifest(layer_map)
    manifest_path = write_manifest(
        web_root,
        manifest_inputs,
        mode,
        required_inputs,
        optional_inputs,
        terrain_texture,
        base_map_texture,
        road_access,
        field_mappings,
        analysis_defaults,
        viewer_defaults,
        asset_theme,
        asset_pools,
        pedestrian_style,
    )
    written.append(str(manifest_path))
    return written


def write_manifest(
    web_root: str,
    inputs: list[dict],
    mode: str,
    required_inputs: tuple[str, ...],
    optional_inputs: tuple[str, ...],
    terrain_texture: Optional[dict],
    base_map_texture: Optional[dict],
    road_access: Optional[dict],
    field_mappings: dict,
    analysis_defaults: dict,
    viewer_defaults: dict,
    asset_theme: str,
    asset_pools: dict,
    pedestrian_style: dict,
) -> Path:
    data_root = Path(web_root) / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    project = QgsProject.instance()
    project_title = project.title() or Path(project.fileName()).stem or "PlanX 3D City Project"
    manifest = {
        "schema": "planx-3d-city-manifest/v1",
        "plugin": "planx_3d_city",
        "version": plugin_version(),
        "mode": mode,
        "flexibleInputs": mode == MODE_VECTOR,
        "exportedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "project": {
            "title": project_title,
            "fileName": project.fileName() or "",
        },
        "requiredInputs": list(required_inputs),
        "optionalInputs": list(optional_inputs),
        "terrainTexture": terrain_texture,
        "baseMapTexture": base_map_texture,
        "roadAccess": road_access,
        "fieldMappings": field_mappings,
        "analysisDefaults": analysis_defaults,
        "viewerDefaults": viewer_defaults,
        "assetLibraryVersion": "2026.05-procedural-v2",
        "assetTheme": asset_theme,
        "assetPools": asset_pools,
        "pedestrianStyle": pedestrian_style,
        "inputs": inputs,
        "summary": {
            "emptyOptionalInputs": [item["key"] for item in inputs if item.get("optional") and item.get("empty")],
            "crs": sorted({item.get("crs") for item in inputs if item.get("crs")}),
        },
    }
    manifest_path = data_root / "planx_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def _road_access_manifest(layer_map: dict) -> Optional[dict]:
    field = (layer_map.get("road_access_field") or "").strip()
    if not field:
        return None
    no_car_values = layer_map.get("road_no_car_values") or "yaya,pedestrian,foot,walk,path"
    vehicle_values = layer_map.get("road_vehicle_values") or "tasit,taşıt,vehicle,car,arac,araç,motorlu"
    return {
        "field": field,
        "noCarKeywords": [v.strip() for v in no_car_values.split(",") if v.strip()],
        "vehicleKeywords": [v.strip() for v in vehicle_values.split(",") if v.strip()],
    }


def _field_mappings_manifest(layer_map: dict) -> dict:
    keys = (
        "road_hierarchy_field",
        "building_population_field",
        "building_dwelling_field",
        "building_vehicle_field",
        "building_floor_area_field",
        "landuse_function_field",
        "odor_source_field",
        "tree_height_field",
        "light_angle_field",
        "bench_angle_field",
        "trashbin_angle_field",
        "busstop_angle_field",
    )
    return {key: (layer_map.get(key) or "").strip() or None for key in keys}


def _analysis_defaults_manifest(layer_map: dict) -> dict:
    return {
        "roadColorMode": "Default",
        "windDirectionDeg": 315,
        "windPlumeDistance": 180,
        "screeningLabel": "Planning screening / design review",
    }


def _viewer_defaults_manifest(layer_map: dict) -> dict:
    latitude = layer_map.get("latitude")
    if latitude is None:
        latitude = _derive_latitude_from_dem(layer_map.get("dem"))
    tree_count_raw = layer_map.get("tree_random_variant_count", (layer_map.get("asset_pool_counts") or {}).get("trees", 8))
    try:
        tree_variant_count = int(tree_count_raw)
    except (TypeError, ValueError):
        tree_variant_count = 8
    tree_variant_count = max(1, min(len(TREE_VARIANT_CATALOG), tree_variant_count))
    tree_expr = str(layer_map.get("tree_height_random_expr") or "").strip()
    tree_render_mode = str(layer_map.get("tree_render_mode") or "Stylized").strip() or "Stylized"
    if tree_render_mode not in ("Stylized", "Realistic"):
        tree_render_mode = "Stylized"
    return {
        "showTerrainSides": True,
        "terrainSideDrop": 5.0,
        "terrainSideColor": "#d9fbf5",
        "demMeshQuality": 160,
        "showOutsideRoiTerrain": True,
        "terrainOutsideColor": "#edf2ef",
        "terrainSmoothingPasses": 2,
        "terrainSmoothingStrength": 0.45,
        "terrainMaxSlope": 0.75,
        "facadeTextureScale": float(layer_map.get("facade_texture_scale") or 4.85),
        "showXyzTiles": bool(layer_map.get("basemap")),
        "assetTheme": (layer_map.get("asset_theme") or ASSET_THEME_DEFAULT),
        "flattenIslands": bool(layer_map.get("flatten_islands", True)),
        "islandPlateauTransition": float(layer_map.get("island_plateau_transition") or 6.0),
        "showIslands": True,
        "islandTransparency": 0.0,
        "latitude": float(latitude) if latitude is not None else 39.0,
        "dayOfYear": int(layer_map.get("day_of_year") or 172),
        "treeRenderMode": tree_render_mode,
        "treeRandomize": bool(layer_map.get("tree_randomize_enabled", True)),
        "treeVariantCount": tree_variant_count,
        "treeHeightRandomExpr": tree_expr,
    }


def _derive_latitude_from_dem(dem_layer) -> float | None:
    """Best-effort: reproject the DEM bbox centroid to WGS84 and return its latitude."""
    if dem_layer is None:
        return None
    try:
        from qgis.core import (
            QgsCoordinateReferenceSystem,
            QgsCoordinateTransform,
            QgsProject,
        )
        src_crs = dem_layer.crs()
        if not src_crs.isValid():
            return None
        extent = dem_layer.extent()
        cx = (extent.xMinimum() + extent.xMaximum()) / 2.0
        cy = (extent.yMinimum() + extent.yMaximum()) / 2.0
        wgs = QgsCoordinateReferenceSystem.fromEpsgId(4326)
        if src_crs.authid() == "EPSG:4326":
            return cy
        transform = QgsCoordinateTransform(src_crs, wgs, QgsProject.instance())
        pt = transform.transform(cx, cy)
        return float(pt.y())
    except Exception:
        return None


def _asset_theme_manifest(layer_map: dict) -> tuple[str, dict, dict]:
    theme = (layer_map.get("asset_theme") or ASSET_THEME_DEFAULT).strip() or ASSET_THEME_DEFAULT
    if theme not in ASSET_THEME_PRESETS:
        theme = ASSET_THEME_DEFAULT
    counts = layer_map.get("asset_pool_counts") or {}
    preset = ASSET_THEME_PRESETS[theme]
    tree_override = []
    for value in layer_map.get("tree_variants") or []:
        name = str(value or "").strip()
        if name and name in TREE_VARIANT_CATALOG and name not in tree_override:
            tree_override.append(name)
    tree_default = list(TREE_VARIANT_CATALOG[:8])
    tree_requested_count_raw = layer_map.get("tree_random_variant_count", counts.get("trees", 8))
    try:
        tree_requested_count = int(tree_requested_count_raw)
    except (TypeError, ValueError):
        tree_requested_count = 8
    tree_requested_count = max(1, min(len(TREE_VARIANT_CATALOG), tree_requested_count))
    pools = {}
    for category in ASSET_CATEGORIES:
        if category == "trees":
            variants = list(tree_override or preset.get(category) or ASSET_THEME_PRESETS[ASSET_THEME_DEFAULT].get(category) or tree_default)
            if not variants:
                variants = tree_default
            count = min(tree_requested_count, len(variants))
            pools[category] = {
                "count": count,
                "variants": variants,
            }
        else:
            try:
                count = int(counts.get(category, 4))
            except (TypeError, ValueError):
                count = 4
            count = max(3, min(5, count))
            variants = list(preset.get(category) or ASSET_THEME_PRESETS[ASSET_THEME_DEFAULT].get(category) or [])
            pools[category] = {
                "count": count,
                "variants": variants[:count],
            }
    pedestrian_style = {
        "model": "procedural-low-poly",
        "limbs": True,
        "walkCycle": True,
        "palette": pools["pedestrians"]["variants"],
    }
    return theme, pools, pedestrian_style


def _layer_manifest(key: str, layer, target: str, empty: bool, required_inputs: tuple[str, ...]) -> dict:
    item = {
        "key": key,
        "label": LABELS[key],
        "target": target,
        "required": key in required_inputs,
        "optional": key not in required_inputs,
        "empty": bool(empty),
        "sourceLayer": None,
        "crs": None,
    }
    if layer is None:
        return item

    item["sourceLayer"] = layer.name()
    if hasattr(layer, "crs") and layer.crs().isValid():
        item["crs"] = layer.crs().authid()
    if hasattr(layer, "featureCount"):
        item["featureCount"] = int(layer.featureCount())
        if hasattr(layer, "wkbType"):
            item["wkbType"] = int(layer.wkbType())
    else:
        item["width"] = int(layer.width()) if hasattr(layer, "width") else None
        item["height"] = int(layer.height()) if hasattr(layer, "height") else None
        item["source"] = _local_raster_source(layer) or layer.source()
    return item


def _target_export_crs(layer_map: dict):
    """Choose one stable CRS for all vector exports so mixed-CRS projects stay aligned in the web viewer."""
    candidates = (
        "dem",
        "roi",
        "roads",
        "buildings",
        "blocks",
        "parcels",
        "trees",
        "hardscape",
        "sidewalks",
        "pedestrian_paths",
        "lights",
        "benches",
        "trashbins",
        "busstops",
    )
    for key in candidates:
        layer = layer_map.get(key)
        if layer is None or not hasattr(layer, "crs"):
            continue
        crs = layer.crs()
        if crs and crs.isValid():
            return crs
    return None


def _export_vector(layer, out_path: Path, target_crs=None) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"
    options.fileEncoding = "UTF-8"
    options.layerName = out_path.stem
    if target_crs is not None and target_crs.isValid() and hasattr(layer, "crs") and layer.crs().isValid():
        if layer.crs().authid() != target_crs.authid():
            options.ct = QgsCoordinateTransform(layer.crs(), target_crs, QgsProject.instance())
    transform_context = QgsProject.instance().transformContext()
    result = QgsVectorFileWriter.writeAsVectorFormatV3(layer, str(out_path), transform_context, options)

    error_code = result[0] if isinstance(result, tuple) else result
    if error_code != QgsVectorFileWriter.NoError:
        message = result[1] if isinstance(result, tuple) and len(result) > 1 else "unknown writer error"
        raise ExportError(f"Could not export {layer.name()} to {out_path}: {message}")


def _export_dem(layer, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    source_path = _local_raster_source(layer)
    if source_path and os.path.exists(source_path):
        shutil.copy2(source_path, out_path)
        return

    provider = layer.dataProvider()
    pipe = QgsRasterPipe()
    if not pipe.set(provider.clone()):
        raise ExportError(f"Could not create raster pipe for {layer.name()}")

    writer = QgsRasterFileWriter(str(out_path))
    result = writer.writeRaster(
        pipe,
        layer.width(),
        layer.height(),
        layer.extent(),
        layer.crs(),
        QgsCoordinateTransformContext(),
    )
    if result != QgsRasterFileWriter.NoError:
        raise ExportError(f"Could not export DEM {layer.name()} to {out_path}")


def _export_basemap(layer_map: dict, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    basemap = layer_map.get("basemap")
    if basemap is None:
        return
    size = int(layer_map.get("basemap_export_size") or 4096)
    size = max(1024, min(8192, size))

    extent_layer = layer_map.get("roi") or layer_map.get("dem") or basemap
    extent = extent_layer.extent()
    destination_crs = extent_layer.crs() if hasattr(extent_layer, "crs") and extent_layer.crs().isValid() else basemap.crs()

    settings = QgsMapSettings()
    settings.setLayers([basemap])
    settings.setExtent(extent)
    settings.setDestinationCrs(destination_crs)
    settings.setTransformContext(QgsProject.instance().transformContext())
    settings.setOutputSize(QSize(size, size))
    settings.setBackgroundColor(QColor(255, 255, 255, 0))

    job = QgsMapRendererParallelJob(settings)
    job.start()
    job.waitForFinished()
    rendered = job.renderedImage()
    if rendered.isNull():
        raise ExportError(f"Could not render basemap layer {basemap.name()}")
    if not rendered.save(str(out_path), "PNG"):
        raise ExportError(f"Could not save rendered basemap to {out_path}")


def _local_raster_source(layer) -> Optional[str]:
    source = layer.source() or ""
    source = source.split("|", 1)[0]
    if source.lower().startswith("file:///"):
        source = source[8:]
    return source if source and os.path.exists(source) else None
