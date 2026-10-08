# -*- coding: utf-8 -*-
"""Deterministic benchmark scene for the web viewer (no QGIS needed).

Writes a grid city of N buildings, plus blocks, roads, trees and an ROI, into
web/data so the viewer can be measured headless (see bench.mjs). No DEM is
written: the viewer falls back to flat terrain, which keeps the benchmark
focused on vector layer cost.

    python tests/bench/make_bench_data.py --buildings 10000
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web" / "data"
ORIGIN_X = 500000.0
ORIGIN_Y = 4500000.0
CRS = {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::32635"}}
FUNCTIONS = ("Konut", "Ticaret", "Egitim", "Saglik", "Sanayi", "Konut+Ticaret")
BLOCK = 80.0       # block edge, metres
STREET = 16.0      # street width between blocks
PER_BLOCK = 9      # 3 x 3 buildings per block


class LCG:
    def __init__(self, seed):
        self.s = seed & ((1 << 64) - 1)

    def random(self):
        self.s = (6364136223846793005 * self.s + 1442695040888963407) & ((1 << 64) - 1)
        return (self.s >> 11) / float(1 << 53)


def rect(x0, y0, x1, y1):
    return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]


def fc(name, features):
    return {"type": "FeatureCollection", "name": name, "crs": CRS, "features": features}


def write(name, obj):
    path = DATA / "yerlesim" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--buildings", type=int, default=2000)
    args = ap.parse_args()
    rng = LCG(42)

    blocks_needed = max(1, math.ceil(args.buildings / PER_BLOCK))
    grid = math.ceil(math.sqrt(blocks_needed))
    pitch = BLOCK + STREET
    blocks, buildings, trees, roads = [], [], [], []
    bid = 0
    for gy in range(grid):
        for gx in range(grid):
            if len(blocks) >= blocks_needed:
                break
            bx = ORIGIN_X + gx * pitch
            by = ORIGIN_Y + gy * pitch
            blocks.append({"type": "Feature", "properties": {"ada": len(blocks)},
                           "geometry": {"type": "Polygon", "coordinates": rect(bx, by, bx + BLOCK, by + BLOCK)}})
            cell = BLOCK / 3.0
            for iy in range(3):
                for ix in range(3):
                    if bid >= args.buildings:
                        break
                    w = cell * (0.55 + 0.25 * rng.random())
                    d = cell * (0.55 + 0.25 * rng.random())
                    x0 = bx + ix * cell + (cell - w) / 2
                    y0 = by + iy * cell + (cell - d) / 2
                    # Some L-shaped footprints so extrusion is not only boxes.
                    if rng.random() < 0.3:
                        ring = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d * 0.5],
                                [x0 + w * 0.5, y0 + d * 0.5], [x0 + w * 0.5, y0 + d], [x0, y0 + d], [x0, y0]]
                        coords = [ring]
                    else:
                        coords = rect(x0, y0, x0 + w, y0 + d)
                    buildings.append({"type": "Feature", "properties": {
                        "id": bid,
                        "kat": 1 + int(rng.random() * 12),
                        "fonksiyon": FUNCTIONS[int(rng.random() * len(FUNCTIONS))],
                    }, "geometry": {"type": "Polygon", "coordinates": coords}})
                    bid += 1
            for k in range(4):
                trees.append({"type": "Feature", "properties": {},
                              "geometry": {"type": "Point", "coordinates": [bx + 4 + k * 24, by - STREET / 2]}})
    extent = grid * pitch
    for i in range(grid + 1):
        c = -STREET / 2 + i * pitch
        roads.append({"type": "Feature", "properties": {"genislik": 12},
                      "geometry": {"type": "LineString", "coordinates": [[ORIGIN_X - STREET, ORIGIN_Y + c], [ORIGIN_X + extent, ORIGIN_Y + c]]}})
        roads.append({"type": "Feature", "properties": {"genislik": 12},
                      "geometry": {"type": "LineString", "coordinates": [[ORIGIN_X + c, ORIGIN_Y - STREET], [ORIGIN_X + c, ORIGIN_Y + extent]]}})

    roi = [{"type": "Feature", "properties": {},
            "geometry": {"type": "Polygon", "coordinates": rect(ORIGIN_X - STREET, ORIGIN_Y - STREET, ORIGIN_X + extent, ORIGIN_Y + extent)}}]
    write("mybuildings.geojson", fc("mybuildings", buildings))
    write("myblocks.geojson", fc("myblocks", blocks))
    write("myroads.geojson", fc("myroads", roads))
    write("mytrees.geojson", fc("mytrees", trees))
    write("roi.geojson", fc("roi", roi))
    for name in ("myparcels", "myhardscape", "mysidewalks", "mypedestrian_paths", "mybikelanes", "mylights",
                 "mybenches", "mytrashbins", "mybusstops", "myfences", "mywaterlines", "mymosques", "mytumulus"):
        write(name + ".geojson", fc(name, []))
    manifest = {
        "schema": "planx-3d-city-manifest/v1", "plugin": "planx_3d_city", "version": "bench",
        "mode": "vector", "flexibleInputs": True, "project": {"title": f"Benchmark {args.buildings}"},
        "requiredInputs": [], "optionalInputs": [], "inputs": [],
    }
    (DATA / "planx_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {len(buildings)} buildings, {len(blocks)} blocks, {len(roads)} roads, {len(trees)} trees")


if __name__ == "__main__":
    main()
