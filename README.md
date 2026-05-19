# PlanX 3D City Viewer

PlanX 3D City Viewer is a QGIS publisher plugin for preparing GIS layers, exporting them to the embedded web viewer data contract, and launching a local Three.js 3D city cockpit.

## Requirements

- QGIS 3.28 or newer
- A modern browser
- No Node.js requirement
- No external Python packages
- Bundled browser libraries under `web/assets/vendor`
- The package does not ship generated DEM/settlement data. Export from QGIS creates `web/data` at runtime.

## Latest Release Notes

### 0.6.9

- Adds a curated `Asset Theme / Material Pool` selector in the QGIS publisher.
- Exports `assetTheme`, `assetPools`, and `pedestrianStyle` into `planx_manifest.json` so the viewer uses only the selected visual pool.
- Upgrades pedestrians to lightweight procedural low-poly people with arms, legs, shoes, and subtle walk-cycle limb motion.
- Applies theme-aware restrained palettes to pedestrians, cars, trees, and street-furniture style fallbacks without adding glTF assets or significantly increasing package size.

### 0.6.8

- Marks `0.6.7` as the first verified stable cockpit baseline after testing with the exported QGIS profile data.
- Clips the terrain surface, raster plan texture, and QGIS basemap texture visually to the exported ROI boundary.
- Hides untrimmed DEM/basemap pixels outside the study area while keeping the terrain stable and opaque inside the ROI.

### 0.6.7

- Fixes the viewer startup render loop by initializing recording state before animation begins.
- Resolves the regression where dashboard metrics loaded but the 3D scene stayed as a blank blue viewport.
- Verified with the exported QGIS profile data that the 3D scene renders and dock buttons open again.

### 0.6.6

- Fixes a viewer regression where project data and dashboard statistics loaded, but the 3D viewport could remain a blank blue background in vector mode.
- Keeps the terrain surface opaque by default instead of cutting it with the island mask, so roads, buildings, furniture, DEM texture, and basemap views have a stable visual ground.
- Makes dock buttons more reliable by using delegated click handling and higher z-index values for the viewer controls.

### 0.6.5

- Applies robust DEM median sampling, percentile clamping, and boundary smoothing to terrain mesh vertices, so plan texture and basemap texture views inherit the cleaner edge behavior.
- Adds a QGIS `Basemap export size` selector: `1024`, `2048`, `4096`, or `8192`. The default is `4096`; higher values are sharper but slower and produce larger PNG files.
- Stabilizes WebM recording by using one consistent render path while recording, avoiding flicker caused by switching between postprocessed and direct render frames.

### 0.6.4

- Replaces the plugin icon with a more polished lightweight SVG mark.
- Adds an optional QGIS basemap/XYZ raster layer selector in the publisher dialog.
- During export, the selected basemap layer is rendered from QGIS to `web/data/texture/basemap.png`.
- The browser viewer can drape that rendered QGIS basemap over the terrain, avoiding browser-side projection and CORS problems that direct XYZ loading can cause.

### 0.6.3

- Adds a QGIS field mapping option for tree height so tree sizes can be controlled from an attribute column.
- The viewer reads the mapped tree height field first, then falls back to common aliases such as `height`, `boy`, and `yukseklik`.
- Stabilizes the ROI model-base edge by using median DEM sampling, percentile clamping, and smoothing along the study-area boundary.
- Reduces DEM boundary spikes that caused broken or jagged build-side edges near the ROI boundary.

### 0.6.2

- Improves building and street-furniture ground clamping so objects sit on terrain, roads, or sidewalks instead of dropping below the surface.
- Replaces fully random car and pedestrian colors with restrained urban palettes.
- Improves Walk Mode with smoother terrain following, sprint/crouch controls, and a compact help HUD.
- Adds scrollable QGIS publisher pages for smaller windows and mouse-wheel navigation.
- Clarifies that Narrative Studio JSON stores camera/tour/state only; it does not embed DEM, GeoJSON, imagery, or the complete viewer.
- Adds viewer controls for building footprint/extrusion modes and DEM topography tint modes.
- Documents XYZ tile and portable viewer folder export as future global-user workflows.

### 0.6.1

- Corrects the ROI model base: the `-5 m` base is now the negative extrusion of the full study-area polygon, not only a boundary wall.
- Keeps the old advanced control power available while integrating the important controls into the new Scene, Layers, Style, Mobility, Street Furniture, Analysis, and Narrative docks.
- Improves Turkish/English consistency in the browser cockpit labels.
- Refines car elevation so vehicles stay attached to the road surface instead of floating above it.
- Refines street furniture orientation: explicit angle fields still override, while lights rotate 180 degrees from the road axis and benches/bus stops rotate 90 degrees toward the roadside by default.

### 0.6.0

- Professional cockpit layout with Scene, Layers, Analysis, and Narrative docks.
- Narrative Studio keyframes for camera position, target, layer states, analysis states, sun time, captions, local storage, and JSON import/export.
- ROI-based build-sides behave as a solid model-base support around the terrain.
- Building placement samples the footprint against the DEM so buildings are less likely to hover on sloped terrain.
- DEM mesh quality control gives smoother terrain surfaces for higher-detail presentations.
- Field mapping now supports custom building statistics fields, land-use/function fields, odor/noise source fields, road hierarchy/access fields, and furniture direction fields.
- Lights, benches, trash bins, and bus stops can use explicit direction fields such as `planx_angle`, `angle`, `rotation`, `heading`, `bearing`, `azimuth`, or `yon`. If no direction field is mapped, the viewer aligns them to the nearest road axis.
- glTF model support is documented as a future optional workflow and is not enabled in this package yet.

## Quick Start

1. Open the DEM and vector layers in one QGIS project.
2. Start `PlanX 3D City` from the toolbar or plugin menu.
3. In `1 Veri`, choose a publishing mode.
4. Use `Katmanlari otomatik eslestir` if your layer names contain common hints such as `dem`, `roi`, `yol`, `bina`, `ada`, `parsel`, or `plan`.
5. For `Vector Plan Mode`, select all required layers: DEM, ROI, roads, buildings, blocks, parcels.
6. For `Raster Plan Texture Mode`, select DEM, ROI, plan texture GeoTIFF, roads, and buildings. Blocks and parcels are optional in this mode.
7. Select optional layers if available: trees, hardscape, sidewalks, lights, benches, trash bins, bus stops.
8. If your roads layer has pedestrian/vehicle information, choose the road access field and keep or edit the no-car / vehicle keywords. Cars will not be spawned on pedestrian-only roads.
9. In the field mapping area, optionally map population, dwelling, vehicle, land-use, odor/noise source, and furniture direction fields.
10. In `2 Kontrol`, generate and inspect the quality report.
11. In `3 Stil`, optionally create PlanX style fields and apply styles to selected blocks/buildings.
12. Click `Disari aktar ve 3D Viewer ac`.
13. Use `4 Yayin` to copy the viewer URL, reopen the browser, open exported data, or stop the local server.

## Data Contract

The plugin writes the viewer inputs to fixed paths:

- `web/data/dem/mydem.tif`
- optional raster texture mode file: `web/data/texture/siteplan.tif`
- `web/data/yerlesim/roi.geojson`
- `web/data/yerlesim/myroads.geojson`
- `web/data/yerlesim/mybuildings.geojson`
- `web/data/yerlesim/myblocks.geojson`
- `web/data/yerlesim/myparcels.geojson`
- optional `mytrees`, `myhardscape`, `mysidewalks`, `mylights`, `mybenches`, `mytrashbins`, `mybusstops`
- `web/data/planx_manifest.json`

Optional layers can be left empty. The plugin writes empty GeoJSON files so the viewer remains stable.

The repository intentionally excludes generated `web/data/dem`, `web/data/texture`, and `web/data/yerlesim` files. This keeps the QGIS Plugin Hub zip smaller and prevents one user's project data from becoming part of the distributed plugin.

The manifest records the export time, QGIS project title, source layer names, targets, CRS values, feature counts, and empty optional inputs. The viewer uses it to show project provenance and data health without requiring the user to remember how the export was produced.

If a road access field is selected, the manifest also records that field and keyword lists. The viewer keeps all road geometry visible, but vehicle traffic is generated only on roads whose access value does not match pedestrian-only/no-car keywords.

The manifest can also record `fieldMappings`, `analysisDefaults`, `viewerDefaults`, `assetTheme`, `assetPools`, and `pedestrianStyle`. These let the browser understand your custom attribute names and selected visual theme without forcing a fixed schema.

## Publishing Modes

### Vector Plan Mode

This is the original workflow. The 3D base is built from vector blocks, parcels, roads, buildings, DEM, ROI, and optional enrichment layers. Blocks and parcels are required.

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
- ROI, buildings, blocks, parcels, hardscape, and sidewalks should be polygon layers.
- Roads should be line layers.
- Trees, lights, benches, trash bins, and bus stops should be point layers.
- Buildings should ideally include `katadedi` and `uipfonksiyon`.
- Roads can optionally include a pedestrian/vehicle access field such as `yol_turu`, `tur`, `tip`, or `access`. Select that field in the QGIS dialog to prevent cars from using pedestrian-only roads.
- Furniture point layers can optionally include a direction field in degrees, for example `planx_angle`, `angle`, `rotation`, `heading`, `bearing`, `azimuth`, or `yon`. If no direction field is mapped, benches, lights, trash bins, and bus stops align automatically to the nearest road direction.

The plugin reports missing required data, empty required layers, CRS differences, geometry mismatches, and missing recommended fields.

## Feature-Level Styling

Use the `3 Stil` page to add style fields and apply values to selected features.

The same page also includes `Asset Theme / Material Pool`. Themes such as `Modern Urban`, `Mediterranean`, `Campus`, `Eco`, and `Dense Urban` define lightweight visual pools for pedestrians, cars, trees, street furniture, facades, roofs, and paving. This selection changes only the browser visualization; it does not alter GIS geometry or attributes. Pedestrians are procedural low-poly models rather than bundled glTF assets, so the plugin remains small and Plugin Hub friendly.

Common:

- `planx_color`: Hex color, for example `#0f766e`

Blocks:

- `planx_texture`: `None`, `SoftNoise`, `FineGrid`

Buildings:

- `planx_facade`: `UrbanA`, `UrbanB`, `UrbanC`, `UrbanD`
- `planx_roof_shape`: `Flat`, `Pyramid`, `Gable`, `Cone`, `Prism`
- `planx_roof_texture`: `RoofA`, `GermanTile`, `TurkishTile`, `USShingle`
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

For a full scene handoff, the preferred future workflow is a QGIS-side `Export portable viewer folder` command that copies `web/src`, `web/assets/vendor`, `web/data`, and an optional `planx_tour.json` into one folder. That is intentionally kept out of this lightweight release to avoid a heavy export/package workflow.

## DEM Quality

`DEM mesh quality` controls the terrain mesh segmentation used by the viewer. Higher values make the DEM surface smoother and closer to a resampled high-detail terrain, similar in spirit to terrain/image width controls in Qgis2threejs. Higher values also cost more browser performance, so use moderate values for large study areas.

The viewer also includes basic topography review modes: normal texture, elevation tint, and slope tint. These are visual review aids, not analytical replacements for QGIS raster tools.

## Global User Workflows

- Buildings can be shown as footprint only, extruded volumes, or extruded volumes with roofs.
- Building height is read from explicit height fields when present, then falls back to `katadedi x floor height`.
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
- If buildings look flat, verify `katadedi` values.
- If function coloring is weak, verify `uipfonksiyon`.
- If selected feature styling is not visible, save edits in QGIS and export again.
