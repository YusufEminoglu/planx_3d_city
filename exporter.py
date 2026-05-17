# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from qgis.core import (
    QgsCoordinateTransformContext,
    QgsProject,
    QgsRasterFileWriter,
    QgsRasterPipe,
    QgsVectorFileWriter,
)


MODE_VECTOR = "vector"
MODE_RASTER_TEXTURE = "raster_texture"
VECTOR_REQUIRED_INPUTS = ("dem", "roi", "roads", "buildings", "blocks", "parcels")
RASTER_TEXTURE_REQUIRED_INPUTS = ("dem", "roi", "plan_texture", "roads", "buildings")
REQUIRED_INPUTS = VECTOR_REQUIRED_INPUTS
OPTIONAL_INPUTS = ("trees", "hardscape", "sidewalks", "lights", "benches", "trashbins", "busstops")

VECTOR_TARGETS = {
    "roi": "roi.geojson",
    "roads": "myroads.geojson",
    "buildings": "mybuildings.geojson",
    "blocks": "myblocks.geojson",
    "parcels": "myparcels.geojson",
    "trees": "mytrees.geojson",
    "hardscape": "myhardscape.geojson",
    "sidewalks": "mysidewalks.geojson",
    "lights": "mylights.geojson",
    "benches": "mybenches.geojson",
    "trashbins": "mytrashbins.geojson",
    "busstops": "mybusstops.geojson",
}

LABELS = {
    "dem": "DEM",
    "plan_texture": "Plan texture GeoTIFF",
    "roi": "ROI",
    "roads": "Roads",
    "buildings": "Buildings",
    "blocks": "Blocks",
    "parcels": "Parcels",
    "trees": "Trees",
    "hardscape": "Hardscape",
    "sidewalks": "Sidewalks",
    "lights": "Lights",
    "benches": "Benches",
    "trashbins": "Trash bins",
    "busstops": "Bus stops",
}


class ExportError(RuntimeError):
    pass


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
    return OPTIONAL_INPUTS


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

    _export_dem(layer_map["dem"], dem_dir / "mydem.tif")
    written.append(str(dem_dir / "mydem.tif"))
    manifest_inputs.append(_layer_manifest("dem", layer_map["dem"], "dem/mydem.tif", False, required_inputs))

    terrain_texture = None
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

    for key, filename in VECTOR_TARGETS.items():
        out_path = vector_dir / filename
        layer = layer_map.get(key)
        empty = layer is None
        if layer is None:
            write_empty_geojson(out_path)
        else:
            _export_vector(layer, out_path)
        written.append(str(out_path))
        manifest_inputs.append(_layer_manifest(key, layer, f"yerlesim/{filename}", empty, required_inputs))
        if feedback:
            feedback(f"{LABELS[key]} -> {out_path.name}")

    road_access = _road_access_manifest(layer_map)
    manifest_path = write_manifest(web_root, manifest_inputs, mode, required_inputs, optional_inputs, terrain_texture, road_access)
    written.append(str(manifest_path))
    return written


def write_manifest(
    web_root: str,
    inputs: list[dict],
    mode: str,
    required_inputs: tuple[str, ...],
    optional_inputs: tuple[str, ...],
    terrain_texture: Optional[dict],
    road_access: Optional[dict],
) -> Path:
    data_root = Path(web_root) / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    project = QgsProject.instance()
    project_title = project.title() or Path(project.fileName()).stem or "PlanX 3D City Project"
    manifest = {
        "schema": "planx-3d-city-manifest/v1",
        "plugin": "planx_3d_city",
        "version": "0.5.4",
        "mode": mode,
        "exportedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "project": {
            "title": project_title,
            "fileName": project.fileName() or "",
        },
        "requiredInputs": list(required_inputs),
        "optionalInputs": list(optional_inputs),
        "terrainTexture": terrain_texture,
        "roadAccess": road_access,
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


def _export_vector(layer, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"
    options.fileEncoding = "UTF-8"
    options.layerName = out_path.stem
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


def _local_raster_source(layer) -> Optional[str]:
    source = layer.source() or ""
    source = source.split("|", 1)[0]
    if source.lower().startswith("file:///"):
        source = source[8:]
    return source if source and os.path.exists(source) else None
