<div align="center">

<img src="icons/icon.png" width="96" alt="PlanX 3D City Viewer icon"/>

# PlanX 3D City Viewer

**Turn QGIS layers into an interactive Three.js city — DEM terrain, buildings, mobility, wind and narrative keyframe tours in the browser.**

[![QGIS](https://img.shields.io/badge/QGIS-3.28%2B-93b023?logo=qgis&logoColor=white)](https://plugins.qgis.org/plugins/planx_3d_city/)
[![Version](https://img.shields.io/github/v/tag/YusufEminoglu/planx_3d_city?label=version&color=blue)](https://github.com/YusufEminoglu/planx_3d_city/releases)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)
[![QGIS Plugin Hub](https://img.shields.io/badge/QGIS%20Hub-install-589632?logo=qgis&logoColor=white)](https://plugins.qgis.org/plugins/planx_3d_city/)
[![Documentation](https://img.shields.io/badge/📖_Reference_Manual-13a0a0)](https://geophilo.com/planx_3d_city/)

</div>

---

PlanX 3D City Viewer is a QGIS publisher plugin for preparing GIS layers, exporting them to the embedded web viewer data contract, and launching a local Three.js 3D city cockpit.

## 📖 Documentation

**[Comprehensive Academic Reference Manual](https://geophilo.com/planx_3d_city/)** — complete documentation of every feature, parameter, data contract, and workflow. Hosted on Web Documentation.

## Requirements

- QGIS 3.28 or newer
- A modern browser
- No Node.js requirement
- No external Python packages
- Bundled browser libraries under `web/assets/vendor`
- The package does not ship generated DEM/settlement data. Export from QGIS creates `web/data` at runtime.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

## Quick Start

### First time? (zero data required)

1. Start `PlanX 3D City` from the QGIS toolbar or plugin menu — a welcome dialog appears on the first launch.
2. Click **Generate sample project**. The plugin synthesises a tiny DEM + blocks + buildings + roads + trees dataset in EPSG:32635 and adds them to your current QGIS project.
3. Click **Export and open 3D Viewer**. The browser opens the cockpit with the generated city — no preparation needed.

### With your own data

1. Open the DEM and any vector layers you have in one QGIS project (same metric CRS recommended).
2. Start `PlanX 3D City`.
3. In `1 Data` page, pick a publishing mode (Vector or Raster Plan Texture).
4. Map the layers you have. **DEM** is recommended for real topography, but Vector Plan Mode can also open on a flat presentation plane when no DEM is selected.
5. Optionally map enrichment layers (trees, hardscape, sidewalks, pedestrian paths, lights, benches, trash bins, bus stops).
6. `Auto-match layers` matches by common name hints (`dem`, `roi`, `yol`/`road`, `bina`/`building`, `ada`/`block`, etc.) in any language.
7. If your roads layer has a pedestrian/vehicle access field, map it under the road access dropdown — cars will not spawn on pedestrian-only roads.
8. Field mapping is optional (population, dwelling, vehicle, land-use, odor/noise source, furniture direction).
9. In `2 Kontrol`, inspect the quality report. Required / Recommended / Optional roles are colour-coded and update live with the publish mode.
10. In `3 Style`, optionally pick an Asset Theme (Modern Urban, Mediterranean, Campus, Eco, etc.), toggle island plateau flattening, or apply per-feature styles.
11. Click **Export and open 3D Viewer**.
12. Use `4 Yayin` to copy the viewer URL, reopen the browser, open exported data, create a portable viewer folder, create a portable ZIP, or stop the local server.

## Data Contract

The plugin writes the viewer inputs to fixed paths:

- `web/data/dem/mydem.tif`
- optional raster texture mode file: `web/data/texture/siteplan.tif`
- `web/data/vector/roi.geojson`
- `web/data/vector/myroads.geojson`
- `web/data/vector/mybuildings.geojson`
- `web/data/vector/myblocks.geojson`
- `web/data/vector/myparcels.geojson`
- optional `mytrees`, `myhardscape`, `mysidewalks`, `mypedestrian_paths`, `mylights`, `mybenches`, `mytrashbins`, `mybusstops`
- `web/data/planx_manifest.json`

Optional layers can be left empty. The plugin writes empty GeoJSON files so the viewer remains stable.

The repository intentionally excludes generated `web/data/dem`, `web/data/texture`, and `web/data/vector` files. This keeps the QGIS Plugin Hub zip smaller and prevents one user's project data from becoming part of the distributed plugin.

The manifest records the export time, QGIS project title, source layer names, targets, CRS values, feature counts, and empty optional inputs. The viewer uses it to show project provenance and data health without requiring the user to remember how the export was produced.

If a road access field is selected, the manifest also records that field and keyword lists. The viewer keeps all road geometry visible, but vehicle traffic is generated only on roads whose access value does not match pedestrian-only/no-car keywords.

The manifest can also record `fieldMappings`, `analysisDefaults`, `viewerDefaults`, `assetTheme`, `assetPools`, and `pedestrianStyle`. These let the browser understand your custom attribute names and selected visual theme without forcing a fixed schema.

## Publishing Modes

### Vector Plan Mode

This is the original workflow. The 3D base is built from whichever vector layers, DEM, ROI, and optional enrichment layers you provide. DEM is recommended, but the viewer can fall back to a flat presentation plane; missing vector layers are skipped.

### Raster Plan Texture Mode

Use this workflow when you already have a clipped 2D settlement plan as a GeoTIFF. The viewer drapes `siteplan.tif` directly over the DEM terrain as the main base texture. In this mode:

- DEM, ROI, plan texture GeoTIFF, roads, and buildings are required.
- Blocks and parcels are optional because the plan raster already contains the visual block/parcel/road form.
- Roads are still required for 3D road overlays, traffic, sidewalks, crosswalks, and navigation effects.
- The plan texture should be clipped to the study area and aligned to the DEM/ROI in the same metric CRS.
- The Style Dock includes texture visibility, opacity, brightness, and contrast controls.
- The viewer corrects the browser texture orientation for CanvasTexture so the GeoTIFF is draped without mirror flipping.

## Data Quality Expectations

- All vector layers and the DEM should use the same metric CRS.
- ROI, buildings, blocks, parcels, hardscape, and sidewalks should be polygon layers. Pedestrian paths may be line or polygon layers.
- Roads should be line layers.
- Trees, lights, benches, trash bins, and bus stops should be point layers.
- Buildings should ideally include `floors` (or `building:levels`) and `function`.
- Roads can optionally include a pedestrian/vehicle access field such as `road_type`, `highway`, `type`, or `access`. Select that field in the QGIS dialog to prevent cars from using pedestrian-only roads.
- Furniture point layers can optionally include a direction field in degrees, for example `planx_angle`, `angle`, `rotation`, `heading`, `bearing`, `azimuth`, or `direction`. If no direction field is mapped, benches, lights, trash bins, and bus stops align automatically to the nearest road direction.

The plugin reports missing required data, empty required layers, CRS differences, geometry mismatches, and missing recommended fields.

## Feature-Level Styling

Use the `3 Style` page to add style fields and apply values to selected features.

The same page also includes `Asset Theme / Material Pool`. Themes such as `Modern Urban`, `Mediterranean`, `Campus`, `Eco`, `Dense Urban`, `Civic Heritage`, and `Coastal Light` define lightweight visual pools for pedestrians, cars, trees, street furniture, facades, roofs, and paving. This selection changes only the browser visualization; it does not alter GIS geometry or attributes. Pedestrians and most material variants are procedural, so the plugin remains small and Plugin Hub friendly without relying on external texture URLs.

Common:

- `planx_color`: Hex color, for example `#0f766e`

Blocks:

- `planx_texture`: `None`, `SoftNoise`, `FineGrid`

Buildings:

- `planx_facade`: `UrbanA`, `UrbanB`, `UrbanC`, `UrbanD`
- `planx_roof_shape`: `Flat`, `Pyramid`, `Gable`, `Shed`, `Hip`
- `planx_roof_texture`: `RoofA`, `RoofC`, `GermanTile`, `USShingle`
- `planx_roof_color`: Hex color

Feature-level style attributes override global viewer controls.

## Viewer Cockpit

The browser viewer includes:

- Dashboard with building, block, parcel, and floor metrics
- Data health chips for optional layers
- Layer Dock for visibility toggles
- Scene Dock for terrain texture, DEM mesh quality, build-sides, road, island, roof, sun, and weather controls
- Analysis Dock for road coloring, wind plume direction, solar review, and shadow quality controls
- Narrative Dock for camera/keyframe storytelling
- ROI model base for a solid presentation plinth under the terrain. The base follows the full ROI polygon, samples the DEM along that boundary, and extrudes downward to the minimum valid DEM pixel value minus the configured side drop. The default drop is 5 meters and the default side color is a very light teal.
- Project metadata panel fed by `planx_manifest.json`
- Persisted cockpit settings through browser local storage
- Camera panel for screenshots, video, orbit, FOV, and walk speed
- Building hover and click detail panels
- Road analysis coloring: default style, amenity-distance fade, or access/traffic class colors
- Wind plume screening for industrial/waste-like functions using a configurable prevailing wind direction
- Estimated building statistics in the click panel when population, dwelling, vehicle, or gross floor area fields are missing
- Minimap, compass, and scale bar

## Field Mapping Guide

The plugin works without strict field names, but mapped fields improve the viewer:

- Roads: map a road access or hierarchy/type field if you have values such as pedestrian, vehicle, arterial, collector, local, or service.
- Buildings: map population, dwelling, vehicle, gross floor area, land-use/function, and odor/noise source fields when available.
- Furniture: map angle/direction fields for lights, benches, trash bins, and bus stops if you want explicit orientation. Use degrees clockwise from north. If you do not map a field, the viewer aligns the object to the nearest road axis.
- Wind: set the prevailing wind direction in the Analysis Dock. Odor/noise source mapping helps the plume overlay detect industrial, waste, storage, transfer, sewage, and logistics-like features.

## Narrative / Keyframe Studio

The Narrative Dock stores camera position, camera target, time of day, layer visibility, active analysis state, and an optional caption for each keyframe. Tours are saved in browser local storage and can be exported/imported as `planx_tour.json`. The JSON file stores the route and viewer states only; it does not contain screenshots, DEM, GeoJSON, tile imagery, or the full viewer application. You can play the tour and use the camera recording panel to capture a video.

For a full scene handoff, use the QGIS Publish page command `Portable viewer klasoru` or `Portable ZIP olustur`. The folder command copies the embedded browser app, bundled vendor libraries, and current exported project data into one timestamped folder. The ZIP command packages the same portable viewer into one file for moving to another computer. On Windows, extract the ZIP and double-click `Start-PlanX-Viewer.bat`; alternatively open a terminal in the extracted folder, run `py -3 -m http.server 8080`, and visit `http://127.0.0.1:8080/src/`.

Narrative Studio still exports keyframes as `planx_tour.json`. When creating a portable ZIP, QGIS can optionally add that tour JSON to `data/planx_tour.json`. If it is present, the browser auto-loads the tour on another computer; otherwise the user can still import the JSON manually from the Narrative Dock.

## DEM Quality

`DEM mesh quality` controls the terrain mesh segmentation used by the viewer. Higher values make the DEM surface smoother and closer to a resampled high-detail terrain, similar in spirit to terrain/image width controls in Qgis2threejs. Higher values also cost more browser performance, so use moderate values for large study areas.

At the DEM and ROI boundary, the viewer avoids repeating the last raster pixel outward and applies a narrow spike limiter. This prevents isolated edge cells or NoData-adjacent pixels from pulling visible terrain triangles upward at the study-area boundary.

The viewer also includes basic topography review modes: normal texture, elevation tint, and slope tint. These are visual review aids, not analytical replacements for QGIS raster tools.

## Global User Workflows

- Buildings can be shown as footprint only, extruded volumes, or extruded volumes with roofs.
- Building height is read from explicit height fields when present, then falls back to `floors x floor height`.
- Trees remain procedural in this release. Species/height-driven variants and glTF models can be added later after model licensing and package-size decisions.
- Tree height can be mapped in the QGIS publisher. Use a numeric field in meters for best results.
- QGIS basemap/XYZ layers can be selected in the publisher. The plugin renders the selected basemap through QGIS into a local PNG texture for the current project extent, which is more robust than asking the browser to fetch XYZ tiles directly.

## Qgis2threejs Comparison Note

Qgis2threejs is a mature general 3D export plugin with broad layer export and narrative animation concepts. PlanX 3D City is narrower by design: it is a planning cockpit with a fixed data contract, QGIS publisher workflow, raster plan texture mode, field mapping, planning analysis overlays, and lightweight Narrative Studio keyframes. It does not aim to replace Qgis2threejs as a generic glTF/web export engine.

## glTF Roadmap

glTF models can be integrated technically, especially for trees, landmark buildings, mosques, shelters, and street furniture. This release does not add glTF assets to avoid increasing Plugin Hub size and because model licensing must be controlled. A future release can add an optional local model folder and per-feature model fields after explicit approval.

## Planning Analysis Notes

The analysis overlays are intentionally lightweight decision-support tools:

- `Road analysis color = Amenity distance` colors road segments greener near detected amenities such as parks, schools, commerce, health, bus stops, lights, or trees, and greyer as distance increases.
- `Road analysis color = Access / traffic` colors pedestrian-only roads blue, major/arterial roads red, collector/secondary roads orange, and local roads grey when recognizable road-type fields exist.
- `Wind plume risk` scans building and hardscape attributes for industrial, waste, storage, transfer, sewage, or logistics-like functions and projects a translucent downwind impact zone.
- Building detail estimates use source fields first. If they are missing, the viewer estimates gross floor area from footprint x floors, dwellings from gross area, population from dwellings, and vehicles from dwellings.

These overlays are for plan review and classroom discussion, not engineering-grade air quality, microclimate, or traffic modelling.

## Troubleshooting

- If the viewer opens but data is missing, rerun export and check the `2 Kontrol` report.
- If scale looks wrong, check that the data is in a metric CRS rather than EPSG:4326 degrees.
- If buildings look flat, verify the `floors` values or the mapped floor-count field.
- If function coloring is weak, verify the `function` field or the mapped land-use field.
- If selected feature styling is not visible, save edits in QGIS and export again.

## Development

The plugin needs no Node.js: the viewer is plain ES modules with an import
map. Node is only used for the development checks, which CI also runs:

```bash
npm ci                                              # ESLint, TypeScript, Playwright (dev only)
npm run lint                                        # ESLint over the viewer and test scripts
npm run typecheck                                   # tsc --checkJs on modules with // @ts-check
npm test                                            # viewer unit tests (node --test)
python -m unittest discover -s tests -p 'test_*.py' # exporter and server unit tests
npx playwright install chromium                     # once, for the browser checks
npm run bench:data && npm run bench:check           # 1000-building benchmark gate
npm run visual                                      # visual regression (fixed cameras)
npm run smoke                                       # UI smoke test (docks, settings, analyses, exports)
```

`npm run bench:check -- --update` and `npm run visual -- --update` write new
baselines when a change is intended.

Viewer source layout (`web/src`): the top level holds self-contained
libraries with unit tests (building geometry and batching, roof skeleton,
exposure analysis, 3D Tiles, CityJSON, video export, catalogue, geography,
attributes, textures). The viewer itself is organised by role:

| Folder | Contents |
|---|---|
| `core/` | scene, camera and composer (`scene.js`), shared state (`state.js`), settings, rendering, data loading, scene build, scene-state sync, Model Studio storage |
| `terrain/` | DEM, terrain mesh and textures, `terrainLocalYAt()` |
| `layers/` | one module per layer: buildings, ground (blocks, parcels, fences, water), trees, landmarks, furniture, mobility, zoning, emissions, environment |
| `analysis/` | sun hours, sky view factor and viewshed drapes |
| `ui/` | docks, Model Studio, tour, picking, view links, exports, recording, minimap, dashboard, bookmarks, QGIS link |

`app.js` only wires them together: start-up, walk mode and the frame loop.
Values that several modules replace (scene origin, loaded data, terrain,
interaction modes) live on the `state` object in `core/state.js`; objects
that are only changed in place (scene, layer groups, settings) are exported
by their own modules.

## 🧩 Part of the PlanX ecosystem

This plugin is one of 15 open-source QGIS plugins for urban planning by the same author:

| Planning & analysis | CAD & production | 3D & visualization |
|---|---|---|
| [PlanX](https://github.com/YusufEminoglu/planx_3d_city) — spatial-planning suite | [PlanX CAD Toolset](https://github.com/YusufEminoglu/planx_3d_city) — drafting-grade CAD | [PlanX 3D City](https://github.com/YusufEminoglu/planx_3d_city) — Three.js city viewer |
| [GeoStats Lab](https://github.com/YusufEminoglu/planx_3d_city) — spatial statistics | [EasyFillet](https://github.com/YusufEminoglu/planx_3d_city) — tangent-arc fillet | [3D OSM Model](https://github.com/YusufEminoglu/planx_3d_city) — OSM → 3D city in browser |
| [Suitability Lab](https://github.com/YusufEminoglu/planx_3d_city) — raster MCDA | [Settlement Toolset](https://github.com/YusufEminoglu/planx_3d_city) — 9-stage settlement plans | [OSM Quick 3D](https://github.com/YusufEminoglu/planx_3d_city) — OSM → native QGIS 3D |
| [DataCube Lab](https://github.com/YusufEminoglu/planx_3d_city) — spatiotemporal cubes | [UIP Toolset](https://github.com/YusufEminoglu/planx_3d_city) — Turkish master-plan automation | [Urban Procedural 3D](https://github.com/YusufEminoglu/planx_3d_city) — parametric zoning lab |
| [Urban Resilience](https://github.com/YusufEminoglu/planx_3d_city) — 28 resilience tools | [ParcelFlux](https://github.com/YusufEminoglu/planx_3d_city) — parcel subdivision | [CartoLab](https://github.com/YusufEminoglu/planx_3d_city) — publication cartography |

## 📜 License & author

MIT © [Yusuf Eminoğlu](https://github.com/YusufEminoglu) — bug reports and feature requests welcome in [Issues](https://github.com/YusufEminoglu/planx_3d_city/issues).
