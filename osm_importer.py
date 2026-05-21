# -*- coding: utf-8 -*-
"""OpenStreetMap importer.

Pulls buildings, roads, green areas and tree points from the public Overpass
API for a bounding box, reprojects to a metric CRS, and loads the result as
QGIS vector layers so the user can publish a 3D city without preparing any
of the geometry themselves. Designed for global use: any place on Earth that
OSM covers works.

Overpass is a shared community resource; this module asks the user to keep
the bounding box reasonably small (default soft cap ~5 km on the longer
side) and surfaces clear errors when Overpass rate-limits or returns nothing.
"""
from __future__ import annotations

import json
import math
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Iterable

from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsRectangle,
    QgsVectorFileWriter,
    QgsVectorLayer,
)


OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
USER_AGENT = "PlanX-3D-City-QGIS-Plugin/0.7.9 (https://github.com/YusufEminoglu/planx_3d_city)"
DEFAULT_TIMEOUT_S = 60
SOFT_BBOX_KM_CAP = 5.0


class OsmImportError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------
def utm_epsg_for(lon: float, lat: float) -> int:
    """Pick a sensible metric CRS (UTM zone) for the given WGS84 point."""
    zone = int(math.floor((lon + 180.0) / 6.0) + 1)
    zone = max(1, min(60, zone))
    return (32600 if lat >= 0 else 32700) + zone


def bbox_size_km(min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> tuple:
    """Approximate width/height of a WGS84 bbox in kilometres."""
    mid_lat = (min_lat + max_lat) * 0.5
    width_km = (max_lon - min_lon) * 111.32 * math.cos(math.radians(mid_lat))
    height_km = (max_lat - min_lat) * 111.32
    return abs(width_km), abs(height_km)


def reproject_bbox(min_x: float, min_y: float, max_x: float, max_y: float,
                   from_crs: QgsCoordinateReferenceSystem,
                   to_crs: QgsCoordinateReferenceSystem) -> tuple:
    transform = QgsCoordinateTransform(from_crs, to_crs, QgsProject.instance())
    rect = transform.transformBoundingBox(QgsRectangle(min_x, min_y, max_x, max_y))
    return rect.xMinimum(), rect.yMinimum(), rect.xMaximum(), rect.yMaximum()


# ---------------------------------------------------------------------------
# Overpass query + fetch
# ---------------------------------------------------------------------------
def _overpass_query(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    return f"""
[out:json][timeout:{DEFAULT_TIMEOUT_S}];
(
  way["building"]({bbox});
  relation["building"]({bbox});
  way["highway"]({bbox});
  way["leisure"~"park|garden|playground|pitch"]({bbox});
  way["landuse"~"forest|grass|meadow|recreation_ground|cemetery"]({bbox});
  way["natural"~"wood|scrub"]({bbox});
  node["natural"="tree"]({bbox});
);
out body geom;
""".strip()


def fetch_overpass(min_lat: float, min_lon: float, max_lat: float, max_lon: float,
                   timeout_s: int = DEFAULT_TIMEOUT_S) -> dict:
    """Fetch Overpass results for the bbox. Returns the parsed JSON."""
    query = _overpass_query(min_lat, min_lon, max_lat, max_lon)
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(
        OVERPASS_ENDPOINT,
        data=data,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s + 10) as resp:
            payload = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            raise OsmImportError("Overpass API rate-limited the request (HTTP 429). Wait a minute and retry.") from exc
        raise OsmImportError(f"Overpass HTTP {exc.code}: {exc.reason}") from exc
    except Exception as exc:
        raise OsmImportError(f"Overpass fetch failed: {exc}") from exc

    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise OsmImportError(f"Overpass returned non-JSON ({len(payload)} bytes).") from exc


# ---------------------------------------------------------------------------
# OSM element -> QGIS feature
# ---------------------------------------------------------------------------
def _building_floors(tags: dict) -> int:
    for key in ("building:levels", "levels"):
        value = tags.get(key)
        if value:
            try:
                return max(1, int(float(str(value).split(";")[0])))
            except (ValueError, TypeError):
                pass
    height = tags.get("height")
    if height:
        try:
            return max(1, int(round(float(str(height).rstrip(" m")) / 3.0)))
        except (ValueError, TypeError):
            pass
    return 3


def _building_function(tags: dict) -> str:
    raw = (tags.get("building") or "").lower()
    if raw in ("apartments", "residential", "house", "detached", "terrace", "dormitory"):
        return "KONUT"
    if raw in ("commercial", "retail", "supermarket", "kiosk", "office"):
        return "TICARET"
    if raw in ("school", "university", "college", "kindergarten"):
        return "EGITIM"
    if raw in ("hospital", "clinic"):
        return "SAGLIK"
    if raw in ("industrial", "warehouse", "manufacture"):
        return "SANAYI"
    if raw in ("mosque", "church", "temple", "synagogue", "cathedral", "chapel"):
        return "DINI"
    if raw in ("public", "civic", "government", "townhall"):
        return "KAMU"
    if raw in ("yes", "") and tags.get("amenity"):
        amenity = tags["amenity"].lower()
        if amenity in ("school", "university"):
            return "EGITIM"
        if amenity in ("hospital", "clinic"):
            return "SAGLIK"
        if amenity in ("place_of_worship",):
            return "DINI"
    return "KARMA"


def _road_class(tags: dict) -> str:
    return (tags.get("highway") or "").lower() or "unknown"


def _green_function(tags: dict) -> str:
    if tags.get("leisure") in ("park", "garden", "playground"):
        return "PARK"
    if tags.get("leisure") == "pitch":
        return "SPOR"
    if tags.get("landuse") in ("forest", "grass", "meadow", "recreation_ground"):
        return "YESIL_ALAN"
    if tags.get("landuse") == "cemetery":
        return "MEZARLIK"
    if tags.get("natural") in ("wood", "scrub"):
        return "ORMAN"
    return "YESIL_ALAN"


def _way_polygon(element) -> QgsGeometry | None:
    geometry = element.get("geometry") or []
    if len(geometry) < 3:
        return None
    points = [QgsPointXY(pt["lon"], pt["lat"]) for pt in geometry]
    if points[0] != points[-1]:
        points.append(points[0])
    return QgsGeometry.fromPolygonXY([points])


def _way_polyline(element) -> QgsGeometry | None:
    geometry = element.get("geometry") or []
    if len(geometry) < 2:
        return None
    points = [QgsPointXY(pt["lon"], pt["lat"]) for pt in geometry]
    return QgsGeometry.fromPolylineXY(points)


def _node_point(element) -> QgsGeometry | None:
    if "lon" not in element or "lat" not in element:
        return None
    return QgsGeometry.fromPointXY(QgsPointXY(element["lon"], element["lat"]))


# ---------------------------------------------------------------------------
# Layer assembly
# ---------------------------------------------------------------------------
def _make_layer(name: str, wkb_type: str, epsg_dest: int, fields_def):
    layer = QgsVectorLayer(f"{wkb_type}?crs=EPSG:{epsg_dest}", name, "memory")
    provider = layer.dataProvider()
    fields = [QgsField(field_name, qvariant) for field_name, qvariant in fields_def]
    provider.addAttributes(fields)
    layer.updateFields()
    return layer, provider


def _project_feature(feat: QgsFeature, transform: QgsCoordinateTransform) -> QgsFeature | None:
    geom = QgsGeometry(feat.geometry())
    if geom.transform(transform):
        return None
    feat.setGeometry(geom)
    return feat


def _save_layer_to_geojson(layer: QgsVectorLayer, path: Path) -> None:
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GeoJSON"
    options.fileEncoding = "UTF-8"
    QgsVectorFileWriter.writeAsVectorFormatV3(
        layer, str(path), QgsProject.instance().transformContext(), options
    )


def import_osm_bbox(min_lon: float, min_lat: float, max_lon: float, max_lat: float,
                    add_to_project: bool = True, output_dir: Path | None = None) -> dict:
    """Fetch OSM data for the bbox and return a layer map keyed by plugin role.

    The bbox is in WGS84 (EPSG:4326). Geometry is reprojected to the local UTM
    zone so the publisher's metric assumptions hold. Layers are added to the
    active QGIS project when ``add_to_project`` is True.
    """
    width_km, height_km = bbox_size_km(min_lon, min_lat, max_lon, max_lat)
    if max(width_km, height_km) > SOFT_BBOX_KM_CAP:
        raise OsmImportError(
            f"Bounding box is too large for a polite Overpass request "
            f"(~{width_km:.1f} x {height_km:.1f} km; cap is {SOFT_BBOX_KM_CAP} km). "
            "Narrow the area or download a smaller neighbourhood first."
        )

    payload = fetch_overpass(min_lat, min_lon, max_lat, max_lon)
    elements = payload.get("elements") or []
    if not elements:
        raise OsmImportError("Overpass returned 0 elements. Try a different bounding box.")

    mid_lon = (min_lon + max_lon) / 2.0
    mid_lat = (min_lat + max_lat) / 2.0
    epsg_dest = utm_epsg_for(mid_lon, mid_lat)
    src_crs = QgsCoordinateReferenceSystem.fromEpsgId(4326)
    dst_crs = QgsCoordinateReferenceSystem.fromEpsgId(epsg_dest)
    transform = QgsCoordinateTransform(src_crs, dst_crs, QgsProject.instance())

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = f"{epsg_dest}"

    buildings_layer, b_pr = _make_layer(
        f"OSM Buildings ({suffix})", "Polygon", epsg_dest,
        [("osm_id", QVariant.String), ("katadedi", QVariant.Int),
         ("uipfonksiyon", QVariant.String), ("name", QVariant.String)],
    )
    roads_layer, r_pr = _make_layer(
        f"OSM Roads ({suffix})", "LineString", epsg_dest,
        [("osm_id", QVariant.String), ("yol_turu", QVariant.String), ("name", QVariant.String)],
    )
    blocks_layer, k_pr = _make_layer(
        f"OSM Greens ({suffix})", "Polygon", epsg_dest,
        [("osm_id", QVariant.String), ("uipfonksiyon", QVariant.String), ("name", QVariant.String)],
    )
    trees_layer, t_pr = _make_layer(
        f"OSM Trees ({suffix})", "Point", epsg_dest,
        [("osm_id", QVariant.String), ("height", QVariant.Double)],
    )

    roi_min_x, roi_min_y, roi_max_x, roi_max_y = reproject_bbox(
        min_lon, min_lat, max_lon, max_lat, src_crs, dst_crs
    )
    roi_layer, roi_pr = _make_layer(
        f"OSM ROI ({suffix})", "Polygon", epsg_dest, [("name", QVariant.String)]
    )
    roi_feat = QgsFeature()
    roi_feat.setGeometry(QgsGeometry.fromPolygonXY([[
        QgsPointXY(roi_min_x, roi_min_y),
        QgsPointXY(roi_max_x, roi_min_y),
        QgsPointXY(roi_max_x, roi_max_y),
        QgsPointXY(roi_min_x, roi_max_y),
        QgsPointXY(roi_min_x, roi_min_y),
    ]]))
    roi_feat.setAttributes([f"OSM bbox {timestamp}"])
    roi_pr.addFeatures([roi_feat])
    roi_layer.updateExtents()

    counts = {"buildings": 0, "roads": 0, "greens": 0, "trees": 0, "skipped": 0}
    for element in elements:
        etype = element.get("type")
        tags = element.get("tags") or {}
        feat: QgsFeature | None = None
        target_pr = None

        if etype == "node" and tags.get("natural") == "tree":
            geom = _node_point(element)
            if geom:
                feat = QgsFeature()
                feat.setGeometry(geom)
                height = tags.get("height")
                try:
                    height_val = float(str(height).rstrip(" m")) if height else 6.0
                except (ValueError, TypeError):
                    height_val = 6.0
                feat.setAttributes([str(element.get("id", "")), round(height_val, 1)])
                target_pr = t_pr
                counts["trees"] += 1

        elif etype in ("way", "relation") and tags.get("building"):
            geom = _way_polygon(element)
            if geom:
                feat = QgsFeature()
                feat.setGeometry(geom)
                feat.setAttributes([
                    str(element.get("id", "")),
                    _building_floors(tags),
                    _building_function(tags),
                    tags.get("name", ""),
                ])
                target_pr = b_pr
                counts["buildings"] += 1

        elif etype == "way" and tags.get("highway"):
            geom = _way_polyline(element)
            if geom:
                feat = QgsFeature()
                feat.setGeometry(geom)
                feat.setAttributes([str(element.get("id", "")), _road_class(tags), tags.get("name", "")])
                target_pr = r_pr
                counts["roads"] += 1

        elif etype == "way" and (tags.get("leisure") or tags.get("landuse") or tags.get("natural")):
            geom = _way_polygon(element)
            if geom:
                feat = QgsFeature()
                feat.setGeometry(geom)
                feat.setAttributes([str(element.get("id", "")), _green_function(tags), tags.get("name", "")])
                target_pr = k_pr
                counts["greens"] += 1
        else:
            counts["skipped"] += 1
            continue

        if feat and target_pr is not None:
            projected = _project_feature(feat, transform)
            if projected is None:
                counts["skipped"] += 1
                continue
            target_pr.addFeatures([projected])

    for layer in (buildings_layer, roads_layer, blocks_layer, trees_layer):
        layer.updateExtents()

    # Optionally persist as GeoJSON next to other PlanX exports.
    out = Path(output_dir) if output_dir else Path(tempfile.gettempdir()) / "planx_3d_city_osm"
    out = out / f"osm_{timestamp}"
    out.mkdir(parents=True, exist_ok=True)
    _save_layer_to_geojson(buildings_layer, out / "osm_buildings.geojson")
    _save_layer_to_geojson(roads_layer, out / "osm_roads.geojson")
    _save_layer_to_geojson(blocks_layer, out / "osm_greens.geojson")
    _save_layer_to_geojson(trees_layer, out / "osm_trees.geojson")
    _save_layer_to_geojson(roi_layer, out / "osm_roi.geojson")

    if add_to_project:
        project = QgsProject.instance()
        for layer in (roi_layer, blocks_layer, buildings_layer, roads_layer, trees_layer):
            if layer.featureCount() > 0:
                project.addMapLayer(layer)

    return {
        "folder": str(out),
        "epsg": epsg_dest,
        "counts": counts,
        "layers": {
            "roi": roi_layer if roi_layer.featureCount() else None,
            "blocks": blocks_layer if blocks_layer.featureCount() else None,
            "buildings": buildings_layer if buildings_layer.featureCount() else None,
            "roads": roads_layer if roads_layer.featureCount() else None,
            "trees": trees_layer if trees_layer.featureCount() else None,
        },
        "bbox_km": (round(width_km, 2), round(height_km, 2)),
    }
