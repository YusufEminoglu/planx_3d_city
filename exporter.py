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


REQUIRED_INPUTS = ("dem", "roi", "roads", "buildings", "blocks", "parcels")
OPTIONAL_INPUTS = ("trees", "hardscape", "lights", "benches", "trashbins", "busstops")

VECTOR_TARGETS = {
    "roi": "roi.geojson",
    "roads": "myroads.geojson",
    "buildings": "mybuildings.geojson",
    "blocks": "myblocks.geojson",
    "parcels": "myparcels.geojson",
    "trees": "mytrees.geojson",
    "hardscape": "myhardscape.geojson",
    "lights": "mylights.geojson",
    "benches": "mybenches.geojson",
    "trashbins": "mytrashbins.geojson",
    "busstops": "mybusstops.geojson",
}

LABELS = {
    "dem": "DEM",
    "roi": "ROI",
    "roads": "Roads",
    "buildings": "Buildings",
    "blocks": "Blocks",
    "parcels": "Parcels",
    "trees": "Trees",
    "hardscape": "Hardscape",
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
    files = [dem_dir / "mydem.tif"]
    files.extend(vector_dir / filename for filename in VECTOR_TARGETS.values())
    files.append(Path(web_root) / "data" / "planx_manifest.json")
    return files


def existing_target_files(web_root: str) -> list[Path]:
    return [path for path in target_files(web_root) if path.exists()]


def validate_inputs(layer_map: dict) -> list[str]:
    missing = []
    for key in REQUIRED_INPUTS:
        if layer_map.get(key) is None:
            missing.append(LABELS[key])
    return missing


def export_all(layer_map: dict, web_root: str, feedback=None) -> list[str]:
    missing = validate_inputs(layer_map)
    if missing:
        raise ExportError("Missing required inputs: " + ", ".join(missing))

    dem_dir, vector_dir = web_data_paths(web_root)
    written = []
    manifest_inputs = []

    _export_dem(layer_map["dem"], dem_dir / "mydem.tif")
    written.append(str(dem_dir / "mydem.tif"))
    manifest_inputs.append(_layer_manifest("dem", layer_map["dem"], "dem/mydem.tif", False))

    for key, filename in VECTOR_TARGETS.items():
        out_path = vector_dir / filename
        layer = layer_map.get(key)
        empty = layer is None
        if layer is None:
            write_empty_geojson(out_path)
        else:
            _export_vector(layer, out_path)
        written.append(str(out_path))
        manifest_inputs.append(_layer_manifest(key, layer, f"yerlesim/{filename}", empty))
        if feedback:
            feedback(f"{LABELS[key]} -> {out_path.name}")

    manifest_path = write_manifest(web_root, manifest_inputs)
    written.append(str(manifest_path))
    return written


def write_manifest(web_root: str, inputs: list[dict]) -> Path:
    data_root = Path(web_root) / "data"
    data_root.mkdir(parents=True, exist_ok=True)
    project = QgsProject.instance()
    project_title = project.title() or Path(project.fileName()).stem or "PlanX 3D City Project"
    manifest = {
        "schema": "planx-3d-city-manifest/v1",
        "plugin": "planx_3d_city",
        "version": "0.4.2",
        "exportedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "project": {
            "title": project_title,
            "fileName": project.fileName() or "",
        },
        "requiredInputs": list(REQUIRED_INPUTS),
        "optionalInputs": list(OPTIONAL_INPUTS),
        "inputs": inputs,
        "summary": {
            "emptyOptionalInputs": [item["key"] for item in inputs if item.get("optional") and item.get("empty")],
            "crs": sorted({item.get("crs") for item in inputs if item.get("crs")}),
        },
    }
    manifest_path = data_root / "planx_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def _layer_manifest(key: str, layer, target: str, empty: bool) -> dict:
    item = {
        "key": key,
        "label": LABELS[key],
        "target": target,
        "required": key in REQUIRED_INPUTS,
        "optional": key in OPTIONAL_INPUTS,
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
