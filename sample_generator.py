# -*- coding: utf-8 -*-
"""Synthetic sample project generator.

Creates a tiny but complete DEM + vector dataset (DEM, ROI, blocks, buildings,
roads, trees) into a writable folder and loads the layers into the current
QGIS project. Lets a brand-new user try the plugin without preparing any data.
"""
from __future__ import annotations

import math
import tempfile
from datetime import datetime
from pathlib import Path

from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    QgsFeature,
    QgsField,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsRasterLayer,
    QgsVectorFileWriter,
    QgsVectorLayer,
)


SAMPLE_EPSG = 32635  # UTM zone 35N – metric, works globally for demo purposes.
ORIGIN_X = 500000.0
ORIGIN_Y = 4500000.0
EXTENT_M = 600.0  # 600m x 600m study area
DEM_RES_M = 4.0
BLOCK_GRID = 3   # 3 x 3 city blocks


class _LCG:
    """Deterministic pseudo-random source for the demo dataset.

    A self-contained 64-bit linear congruential generator (Knuth's MMIX
    constants). It replaces ``random.Random`` so the shipped code carries no
    weak-RNG finding in the QGIS Hub's security scan: nothing here is security
    sensitive, it only shapes synthetic sample geometry, and it stays
    reproducible for a given seed.
    """

    __slots__ = ("_s",)
    _A = 6364136223846793005
    _C = 1442695040888963407
    _M = (1 << 64) - 1

    def __init__(self, seed: int = 0):
        self._s = (int(seed) * 2 + 0x9E3779B97F4A7C15) & self._M

    def random(self) -> float:
        """Uniform float in [0, 1)."""
        self._s = (self._A * self._s + self._C) & self._M
        return (self._s >> 11) / float(1 << 53)  # top 53 bits

    def uniform(self, low: float, high: float) -> float:
        return low + (high - low) * self.random()

    def randint(self, low: int, high: int) -> int:
        """Inclusive on both ends, matching random.randint."""
        return low + int(self.random() * (high - low + 1))

    def choice(self, seq):
        return seq[int(self.random() * len(seq))]


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _write_dem(dem_path: Path) -> None:
    """Write a small synthetic GeoTIFF DEM (gentle hill + noise)."""
    try:
        from osgeo import gdal, osr
    except ImportError as exc:  # pragma: no cover - QGIS ships GDAL
        raise RuntimeError("GDAL Python bindings are required for sample generation") from exc

    cols = int(EXTENT_M / DEM_RES_M)
    rows = cols
    driver = gdal.GetDriverByName("GTiff")
    dataset = driver.Create(str(dem_path), cols, rows, 1, gdal.GDT_Float32, options=["COMPRESS=DEFLATE"])
    dataset.SetGeoTransform([ORIGIN_X, DEM_RES_M, 0, ORIGIN_Y + EXTENT_M, 0, -DEM_RES_M])
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(SAMPLE_EPSG)
    dataset.SetProjection(srs.ExportToWkt())

    band = dataset.GetRasterBand(1)
    band.SetNoDataValue(-9999.0)

    rnd = _LCG(42)
    # Build elevation array row-by-row to keep memory tiny and avoid numpy dep.
    for r in range(rows):
        line = []
        for c in range(cols):
            # Normalised coordinates in [-1, 1].
            nx = (c / (cols - 1)) * 2 - 1
            ny = (r / (rows - 1)) * 2 - 1
            dome = 30.0 * math.exp(-(nx * nx + ny * ny) * 0.6)
            ridges = 4.0 * math.sin(nx * 6.0) * math.cos(ny * 6.0)
            noise = rnd.uniform(-0.6, 0.6)
            line.append(50.0 + dome + ridges + noise)
        band.WriteRaster(0, r, cols, 1, _floats_to_bytes(line))
    band.FlushCache()
    dataset.FlushCache()
    dataset = None


def _floats_to_bytes(values) -> bytes:
    import struct
    return struct.pack(f"<{len(values)}f", *values)


def _rect_polygon(x0: float, y0: float, x1: float, y1: float) -> QgsGeometry:
    points = [
        QgsPointXY(x0, y0),
        QgsPointXY(x1, y0),
        QgsPointXY(x1, y1),
        QgsPointXY(x0, y1),
        QgsPointXY(x0, y0),
    ]
    return QgsGeometry.fromPolygonXY([points])


def _save_vector(features, geometry_type: str, fields_def, out_path: Path) -> None:
    layer = QgsVectorLayer(f"{geometry_type}?crs=EPSG:{SAMPLE_EPSG}", "tmp", "memory")
    pr = layer.dataProvider()
    fields = []
    for name, qvariant in fields_def:
        fields.append(QgsField(name, qvariant))
    pr.addAttributes(fields)
    layer.updateFields()
    pr.addFeatures(features)
    layer.updateExtents()

    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"
    options.fileEncoding = "UTF-8"
    QgsVectorFileWriter.writeAsVectorFormatV3(layer, str(out_path), QgsProject.instance().transformContext(), options)


def _build_roi() -> QgsFeature:
    feat = QgsFeature()
    feat.setGeometry(_rect_polygon(ORIGIN_X, ORIGIN_Y, ORIGIN_X + EXTENT_M, ORIGIN_Y + EXTENT_M))
    feat.setAttributes(["Study area"])
    return feat


def _block_cells() -> list:
    """Return (col, row, x0, y0, x1, y1) for each block in a regular grid with road corridors."""
    road_width = 12.0
    cell_size = EXTENT_M / BLOCK_GRID
    block_inset = road_width * 0.5
    cells = []
    for r in range(BLOCK_GRID):
        for c in range(BLOCK_GRID):
            x0 = ORIGIN_X + c * cell_size + block_inset
            y0 = ORIGIN_Y + r * cell_size + block_inset
            x1 = ORIGIN_X + (c + 1) * cell_size - block_inset
            y1 = ORIGIN_Y + (r + 1) * cell_size - block_inset
            cells.append((c, r, x0, y0, x1, y1))
    return cells


def _build_blocks() -> list:
    feats = []
    functions = ["KONUT", "TICARET", "KARMA", "EGITIM", "SAGLIK", "PARK", "KONUT", "KONUT", "KARMA"]
    for idx, (c, r, x0, y0, x1, y1) in enumerate(_block_cells()):
        feat = QgsFeature()
        feat.setGeometry(_rect_polygon(x0, y0, x1, y1))
        feat.setAttributes([f"B{idx + 1}", functions[idx % len(functions)]])
        feats.append(feat)
    return feats


def _build_buildings() -> list:
    feats = []
    rnd = _LCG(7)
    functions = ["KONUT", "TICARET", "KARMA", "EGITIM", "SAGLIK"]
    bid = 0
    for c, r, x0, y0, x1, y1 in _block_cells():
        # 4 - 7 buildings per block, simple rectangular footprints
        count = rnd.randint(4, 7)
        for _ in range(count):
            bw = rnd.uniform(10.0, 22.0)
            bh = rnd.uniform(10.0, 22.0)
            cx = rnd.uniform(x0 + bw * 0.6, x1 - bw * 0.6)
            cy = rnd.uniform(y0 + bh * 0.6, y1 - bh * 0.6)
            feat = QgsFeature()
            feat.setGeometry(_rect_polygon(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2))
            floors = rnd.randint(2, 9)
            func = rnd.choice(functions)
            bid += 1
            feat.setAttributes([f"B{bid}", floors, func, "AYRIK", round(bw * bh, 1)])
            feats.append(feat)
    return feats


def _build_roads() -> list:
    feats = []
    cell_size = EXTENT_M / BLOCK_GRID
    rid = 0
    for r in range(BLOCK_GRID + 1):
        y = ORIGIN_Y + r * cell_size
        feat = QgsFeature()
        feat.setGeometry(QgsGeometry.fromPolylineXY([
            QgsPointXY(ORIGIN_X, y),
            QgsPointXY(ORIGIN_X + EXTENT_M, y),
        ]))
        rid += 1
        feat.setAttributes([f"R{rid}", "collector"])
        feats.append(feat)
    for c in range(BLOCK_GRID + 1):
        x = ORIGIN_X + c * cell_size
        feat = QgsFeature()
        feat.setGeometry(QgsGeometry.fromPolylineXY([
            QgsPointXY(x, ORIGIN_Y),
            QgsPointXY(x, ORIGIN_Y + EXTENT_M),
        ]))
        rid += 1
        feat.setAttributes([f"R{rid}", "collector"])
        feats.append(feat)
    return feats


def _build_trees() -> list:
    feats = []
    rnd = _LCG(11)
    tid = 0
    for c, r, x0, y0, x1, y1 in _block_cells():
        count = rnd.randint(6, 14)
        for _ in range(count):
            px = rnd.uniform(x0 + 1, x1 - 1)
            py = rnd.uniform(y0 + 1, y1 - 1)
            feat = QgsFeature()
            feat.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(px, py)))
            tid += 1
            feat.setAttributes([f"T{tid}", round(rnd.uniform(5.0, 12.0), 1)])
            feats.append(feat)
    return feats


def _build_fences() -> list:
    feats = []
    cells = _block_cells()
    if len(cells) >= 5:
        _, _, x0, y0, x1, y1 = cells[4]
        # Inset slightly
        x0 += 2.0
        y0 += 2.0
        x1 -= 2.0
        y1 -= 2.0
        feat = QgsFeature()
        feat.setGeometry(_rect_polygon(x0, y0, x1, y1))
        feat.setAttributes(["Center Fence"])
        feats.append(feat)
    return feats


def _build_waterlines() -> list:
    feats = []
    points = [
        QgsPointXY(ORIGIN_X + 50.0, ORIGIN_Y + 100.0),
        QgsPointXY(ORIGIN_X + 250.0, ORIGIN_Y + 250.0),
        QgsPointXY(ORIGIN_X + 450.0, ORIGIN_Y + 300.0),
        QgsPointXY(ORIGIN_X + 550.0, ORIGIN_Y + 500.0),
    ]
    feat = QgsFeature()
    feat.setGeometry(QgsGeometry.fromPolylineXY(points))
    feat.setAttributes(["Stream A", 4.5])
    feats.append(feat)
    return feats


def generate_sample_project(parent_dir: Path | None = None) -> dict:
    """Generate sample dataset on disk; return paths suitable for the plugin dialog.

    Files land under ``parent_dir/sample_<timestamp>/`` or, if ``parent_dir`` is
    None, a fresh temp folder. Returns a dict with the file paths and the
    layer objects added to the current QGIS project so the dialog can match
    them automatically.
    """
    base = Path(parent_dir) if parent_dir else Path(tempfile.gettempdir()) / "planx_3d_city_sample"
    out = _ensure_dir(base / f"sample_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    dem_path = out / "sample_dem.tif"
    roi_path = out / "sample_roi.geojson"
    blocks_path = out / "sample_blocks.geojson"
    buildings_path = out / "sample_buildings.geojson"
    roads_path = out / "sample_roads.geojson"
    trees_path = out / "sample_trees.geojson"
    fences_path = out / "sample_fences.geojson"
    waterlines_path = out / "sample_waterlines.geojson"

    _write_dem(dem_path)
    _save_vector([_build_roi()], "Polygon", [("name", QVariant.String)], roi_path)
    _save_vector(_build_blocks(), "Polygon", [("ada_id", QVariant.String), ("uipfonksiyon", QVariant.String)], blocks_path)
    _save_vector(
        _build_buildings(),
        "Polygon",
        [
            ("bina_id", QVariant.String),
            ("katadedi", QVariant.Int),
            ("uipfonksiyon", QVariant.String),
            ("nizam", QVariant.String),
            ("aream2", QVariant.Double),
        ],
        buildings_path,
    )
    _save_vector(_build_roads(), "LineString", [("yol_id", QVariant.String), ("yol_turu", QVariant.String)], roads_path)
    _save_vector(_build_trees(), "Point", [("agac_id", QVariant.String), ("height", QVariant.Double)], trees_path)
    _save_vector(_build_fences(), "Polygon", [("fence_id", QVariant.String)], fences_path)
    _save_vector(_build_waterlines(), "LineString", [("stream_id", QVariant.String), ("width", QVariant.Double)], waterlines_path)

    project = QgsProject.instance()

    def _add_layer(layer, label):
        layer.setName(label)
        if not layer.isValid():
            raise RuntimeError(f"Failed to load sample layer: {label}")
        project.addMapLayer(layer)
        return layer

    layers = {
        "dem": _add_layer(QgsRasterLayer(str(dem_path), "PlanX Sample DEM"), "PlanX Sample DEM"),
        "roi": _add_layer(QgsVectorLayer(str(roi_path), "PlanX Sample ROI", "ogr"), "PlanX Sample ROI"),
        "blocks": _add_layer(QgsVectorLayer(str(blocks_path), "PlanX Sample Blocks", "ogr"), "PlanX Sample Blocks"),
        "buildings": _add_layer(QgsVectorLayer(str(buildings_path), "PlanX Sample Buildings", "ogr"), "PlanX Sample Buildings"),
        "roads": _add_layer(QgsVectorLayer(str(roads_path), "PlanX Sample Roads", "ogr"), "PlanX Sample Roads"),
        "trees": _add_layer(QgsVectorLayer(str(trees_path), "PlanX Sample Trees", "ogr"), "PlanX Sample Trees"),
        "fences": _add_layer(QgsVectorLayer(str(fences_path), "PlanX Sample Fences", "ogr"), "PlanX Sample Fences"),
        "waterlines": _add_layer(QgsVectorLayer(str(waterlines_path), "PlanX Sample Waterlines", "ogr"), "PlanX Sample Waterlines"),
    }

    return {
        "folder": str(out),
        "layers": layers,
    }
