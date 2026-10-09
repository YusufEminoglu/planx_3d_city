# -*- coding: utf-8 -*-
"""Export helpers that do not depend on QGIS, so they can be unit tested.

- DEM crop window: the viewer only reads the DEM inside its scene bounds (the
  ROI, or else the union of the main vector layers) plus a 20 px margin, so
  everything further out is dead weight in the export.
- GeoTIFF creation options for a compressed, tiled DEM that geotiff.js reads.
- Coordinate precision for GeoJSON output.
- A small signature cache so unchanged layers are not rewritten.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Iterable, Optional

Bounds = tuple[float, float, float, float]  # (min_x, min_y, max_x, max_y)

# Viewer reads bounds + 20 px; keep a wider margin so small CRS round-off or a
# later ROI tweak does not cut into the visible terrain.
DEM_MARGIN_PX = 32
DEM_MARGIN_FRACTION = 0.02
# Cropping below this saving is not worth re-encoding the raster.
DEM_MIN_AREA_SAVING = 0.10

CACHE_FILE = ".planx_export_cache.json"


def union_bounds(items: Iterable[Optional[Bounds]]) -> Optional[Bounds]:
    result = None
    for b in items:
        if b is None or not all(map(_finite, b)) or b[0] > b[2] or b[1] > b[3]:
            continue
        result = b if result is None else (
            min(result[0], b[0]), min(result[1], b[1]), max(result[2], b[2]), max(result[3], b[3])
        )
    return result


def dem_clip_window(view: Optional[Bounds], dem: Bounds, res_x: float, res_y: float) -> Optional[Bounds]:
    """Extent to crop the DEM to, or None to keep the whole raster.

    The window is the viewer's scene bounds grown by a margin, snapped outward
    to the DEM pixel grid and clamped to the DEM extent.
    """
    if view is None:
        return None
    px = abs(res_x) or 1.0
    py = abs(res_y) or 1.0
    span = max(view[2] - view[0], view[3] - view[1], 0.0)
    margin_x = px * DEM_MARGIN_PX + span * DEM_MARGIN_FRACTION
    margin_y = py * DEM_MARGIN_PX + span * DEM_MARGIN_FRACTION
    min_x = max(dem[0], view[0] - margin_x)
    min_y = max(dem[1], view[1] - margin_y)
    max_x = min(dem[2], view[2] + margin_x)
    max_y = min(dem[3], view[3] + margin_y)
    if min_x >= max_x or min_y >= max_y:
        return None  # scene does not overlap the DEM; leave it to the viewer
    # Snap outward to whole pixels of the source grid (origin at dem min x / max y).
    min_x = dem[0] + _floor((min_x - dem[0]) / px) * px
    max_x = dem[0] + _ceil((max_x - dem[0]) / px) * px
    max_y = dem[3] - _floor((dem[3] - max_y) / py) * py
    min_y = dem[3] - _ceil((dem[3] - min_y) / py) * py
    min_x, min_y = max(dem[0], min_x), max(dem[1], min_y)
    max_x, max_y = min(dem[2], max_x), min(dem[3], max_y)
    dem_area = (dem[2] - dem[0]) * (dem[3] - dem[1])
    clip_area = (max_x - min_x) * (max_y - min_y)
    if dem_area <= 0 or clip_area >= dem_area * (1.0 - DEM_MIN_AREA_SAVING):
        return None
    return (min_x, min_y, max_x, max_y)


def dem_creation_options(is_float: bool) -> list[str]:
    """Lossless DEFLATE, tiled; floating-point predictor for float rasters.

    geotiff.js (the viewer's decoder) supports DEFLATE and predictors 2 and 3.
    """
    return [
        "COMPRESS=DEFLATE",
        f"PREDICTOR={3 if is_float else 2}",
        "ZLEVEL=6",
        "TILED=YES",
        "BLOCKXSIZE=256",
        "BLOCKYSIZE=256",
    ]


def coordinate_precision(is_geographic: bool) -> int:
    """GeoJSON decimal places: millimetres in projected CRSs, ~1 cm in degrees."""
    return 7 if is_geographic else 3


GEOREF_STEP_M = 1000.0


def georeference_control_xy(centre: tuple[float, float], step: float = GEOREF_STEP_M) -> list[tuple[float, float]]:
    """Projected control points: the scene centre, one step east, one step north."""
    cx, cy = centre
    return [(cx, cy), (cx + step, cy), (cx, cy + step)]


def georeference_record(crs_authid: str, xy: list, lonlat: list) -> Optional[dict]:
    """Manifest entry tying the export CRS to WGS84 through three control points.

    The viewer fits an affine map from these (exact for three points; the
    projection is close to affine over a city), which is enough to place the
    scene on the globe for 3D Tiles. None when the points are unusable.
    """
    if len(xy) != 3 or len(lonlat) != 3:
        return None
    pts = []
    for (x, y), (lon, lat) in zip(xy, lonlat):
        if not all(map(_finite, (x, y, lon, lat))) or not (-180 <= lon <= 180 and -90 <= lat <= 90):
            return None
        pts.append({"xy": [round(x, 3), round(y, 3)], "lonLat": [round(lon, 9), round(lat, 9)]})
    (x0, y0), (x1, y1), (x2, y2) = xy
    if abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) < 1e-6:
        return None
    return {"crs": crs_authid or "", "controlPoints": pts}


def file_signature(path: Optional[str]) -> Optional[list]:
    """(size, mtime) of a local file, or None when it is not a readable file."""
    if not path:
        return None
    try:
        st = os.stat(path)
    except OSError:
        return None
    return [st.st_size, int(st.st_mtime_ns)]


class ExportCache:
    """Signatures of what each output file was last written from.

    An output is reused only when its recorded signature matches the new one
    exactly and the file is still there; anything without a reliable
    signature (memory layers, unsaved edits, web services) is always written.
    """

    def __init__(self, data_root: Path):
        self.path = Path(data_root) / CACHE_FILE
        try:
            self.entries = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(self.entries, dict):
                self.entries = {}
        except (OSError, ValueError):
            self.entries = {}

    def is_fresh(self, output: Path, signature) -> bool:
        if signature is None or not Path(output).exists():
            return False
        return self.entries.get(str(Path(output).name)) == signature

    def record(self, output: Path, signature) -> None:
        key = str(Path(output).name)
        if signature is None:
            self.entries.pop(key, None)
        else:
            self.entries[key] = signature

    def forget(self, output: Path) -> None:
        self.entries.pop(str(Path(output).name), None)

    def save(self) -> None:
        try:
            self.path.write_text(json.dumps(self.entries, indent=1, sort_keys=True), encoding="utf-8")
        except OSError:
            pass  # the cache is an optimisation; a failed write only costs a re-export


def _finite(v) -> bool:
    try:
        return v == v and abs(float(v)) != float("inf")
    except (TypeError, ValueError):
        return False


def _floor(v: float) -> float:
    return math.floor(v + 1e-9)


def _ceil(v: float) -> float:
    return math.ceil(v - 1e-9)
