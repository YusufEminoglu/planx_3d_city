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

### 0.8.17

- Adds 40 Modern Turkish facade PNG textures: `Urban_TR_A_1` through `Urban_TR_D_10`, with four facade families and 1-10 storey variants.
- Adds a `Modern Turkish` asset theme and automatically maps Turkish facade families to each building's parsed floor count.
- Gives the first floor an entrance/commercial/lobby character while upper floors keep repeatable modern apartment facade language.

### 0.8.16

- Places Raster Plan Texture GeoTIFFs by their own projected bounding box inside the terrain extent, instead of stretching `siteplan.tif` over the full DEM.
- Keeps the 0.8.15 scene orientation fix and raises the plan texture processing cap to 4096 px for wide DEM context workflows.

### 0.8.15

- Fixes the scene-wide left/right orientation in both Vector Plan and Raster Plan Texture modes by correcting the projected-coordinate to local-coordinate transform.
- Keeps DEM sampling, island plateaus, buildings, hardscape, roads, furniture, walk mode, and raster plan textures aligned with the corrected local X axis.

### 0.8.14

- Fixes Raster Plan Texture Mode orientation: siteplan GeoTIFF pixels are normalized from their georeferenced X/Y resolution signs before they become the terrain CanvasTexture, preventing mirrored plan textures.
- Leaves basemap PNG texture orientation unchanged.

### 0.8.13

- Cleans the QGIS Hub Bandit B310 finding in the OpenStreetMap importer by validating the Overpass endpoint scheme before `urlopen` and documenting the narrow suppression.
- Removes the unused OSM importer typing import and Flake8 style warnings reported by the Hub scan.

### 0.8.12

- Prevents the web viewer from getting stuck at `Processing city layers...` when one vector layer fails during scene build.
- Skips only the problematic layer, keeps terrain/basemap and other layers rendering, and reports the skipped layer in the status text.
- Hides the loading overlay on catastrophic scene errors instead of leaving an infinite spinner.

### 0.8.11

- Adds an Outside ROI terrain toggle. Keep the wide DEM/blank context visible, or clip the terrain surface to the ROI for a clean model-only view.
- Persists and exports the outside-ROI terrain preference.

### 0.8.10

- Makes Layers panel visibility authoritative, including a stale async rebuild guard so disabled buildings cannot reappear.
- Adds Blocks visibility and Block transparency controls. Transparency defaults to `0` for fully visible blocks.
- Makes QGIS basemap texture win when enabled, so DEM plus satellite/basemap review is a clean workflow.
- Skips island plateau in hidden block-only review states so pure topography plus basemap stays pure.

### 0.8.9

- Sets the facade texture scale to a tuned 4.85x default and exposes a Building panel slider for final scene-level adjustment.
- Migrates older browser settings so island plateau does not remain silently disabled after an upgrade.
- Subdivides hardscape slabs before terrain drape, reducing paved-surface instability next to islands and plateau edges.
- Supports polygon holes in islands, hardscape, and building geometry.

### 0.8.8

- Re-enables island plateau by default so block surfaces and the underlying DEM are aligned again unless disabled.
- Separates hardscape, parcel, road, and vehicle elevation offsets to reduce z-fighting between islands, hardscape, and OSM roads.
- Enlarges building facade texture scale by 8x for more readable windows and floor lines.
- Reorders QGIS Data page actions and moves Save preset / Load preset to the right side.
- Adds a bundled English HTML user guide available from the new 0 Guide panel.

### 0.8.7

- Stabilizes terrain placement by making all draped layers clamp to the final smoothed terrain mesh, not the raw DEM sampler.
- Adds DEM smoothing controls for abrupt elevation jumps: smooth passes, smooth strength, and max slope clamp.
- Allows Vector Plan Mode to run without a DEM by using a flat presentation plane.
- Supports wide DEM context with ROI-only texture: outside the ROI the terrain stays visible in a blank colour, while the selected texture appears normally inside the ROI.

### 0.8.6

- Restores the released source tree into the development plugin folder and bumps the package metadata.
- Makes Vector Plan Mode genuinely DEM-only capable: missing ROI, blocks, parcels, buildings and roads load as empty layers instead of stopping the viewer.
- Derives terrain bounds from the DEM raster extent when no vector layer is present, so DEM-only exports open over the real georeferenced raster.
- Keeps island plateau flattening off by default in both the publisher and viewer; it remains available as a presentation cleanup toggle.
- Cache-busts the viewer module as `app.js?v=0.8.6` so updated cockpit code is loaded after plugin updates.

### 0.7.3

- Makes English the primary default language in the QGIS publisher and browser cockpit.
- Keeps Turkish as the secondary UI language through the browser language toggle and bilingual QGIS guidance text.
- Extends browser translation coverage to dashboard metrics, dock tooltips, camera controls, Narrative Studio, Walk HUD, minimap, status pills, placeholders, and empty-state text.
- Updates QGIS publish reports, overwrite confirmations, portable export messages, and the style assistant to use consistent English-first product language.

### 0.7.2

- Hardens DEM sampling at raster and ROI boundaries so edge pixels are no longer repeated into artificial upward triangle spikes.
- Adds a terrain boundary spike limiter around DEM edges and ROI clip edges, reducing isolated edge outliers while preserving the general terrain shape.
- Adds `Portable ZIP olustur` on the QGIS Publish page for complete viewer handoff as one zip file.
- Supports optional `planx_tour.json` inside the portable ZIP; the browser auto-loads `data/planx_tour.json` so Narrative Studio keyframes can travel to another computer.

### 0.7.1

- Expands the procedural material library with `Civic Heritage` and `Coastal Light` themes.
- Adds more street-furniture variants with actual procedural geometry: heritage lanterns, bollards, campus lights, stone seats, eco benches, compact stops, steel canopies, and solar bins.
- Adds offline procedural textures for facade, roof, paving, hardscape, and road materials; the viewer no longer relies on external texture URLs.
- Improves theme switching so roof, paving, street furniture, and function facade defaults follow the selected asset theme.

### 0.7.0

- Adds `Portable viewer klasoru` on the QGIS Publish page for classroom, review, and presentation handoff.
- Copies `web/src`, `web/assets/vendor`, and the current exported `web/data` into one timestamped portable folder.
- Writes launch scripts and a small guide into the portable folder so the scene can be opened by double-clicking `Start-PlanX-Viewer.bat` on Windows, or manually with `py -3 -m http.server 8080` and `http://127.0.0.1:8080/src/`.
- Clarifies that Narrative Studio JSON stores only tour/viewer state and must travel with the exported data for a complete scene handoff.

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

### First time? (zero data required)

1. Start `PlanX 3D City` from the QGIS toolbar or plugin menu — a welcome dialog appears on the first launch.
2. Click **Generate sample project**. The plugin synthesises a tiny DEM + blocks + buildings + roads + trees dataset in EPSG:32635 and adds them to your current QGIS project.
3. Click **Export and open 3D Viewer**. The browser opens the cockpit with the generated city — no preparation needed.

### With your own data

1. Open the DEM and any vector layers you have in one QGIS project (same metric CRS recommended).
2. Start `PlanX 3D City`.
3. In `1 Data` page, pick a publishing mode (Vector or Raster Plan Texture).
4. Map the layers you have. **DEM** is recommended for real topography, but Vector Plan Mode can also open on a flat presentation plane when no DEM is selected.
5. Optionally map enrichment layers (trees, hardscape, sidewalks, lights, benches, trash bins, bus stops).
6. `Auto-match layers` matches by common name hints (`dem`, `roi`, `yol`/`road`, `bina`/`building`, `ada`/`block`, etc.) in any language.
7. If your roads layer has a pedestrian/vehicle access field, map it under the road access dropdown — cars will not spawn on pedestrian-only roads.
8. Field mapping is optional (population, dwelling, vehicle, land-use, odor/noise source, furniture direction).
9. In `2 Kontrol`, inspect the quality report. Required / Recommended / Optional roles are colour-coded and update live with the publish mode.
10. In `3 Stil`, optionally pick an Asset Theme (Modern Urban, Mediterranean, Campus, Eco, etc.), toggle island plateau flattening, or apply per-feature styles.
11. Click **Export and open 3D Viewer**.
12. Use `4 Yayin` to copy the viewer URL, reopen the browser, open exported data, create a portable viewer folder, create a portable ZIP, or stop the local server.

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
- ROI, buildings, blocks, parcels, hardscape, and sidewalks should be polygon layers.
- Roads should be line layers.
- Trees, lights, benches, trash bins, and bus stops should be point layers.
- Buildings should ideally include `katadedi` and `uipfonksiyon`.
- Roads can optionally include a pedestrian/vehicle access field such as `yol_turu`, `tur`, `tip`, or `access`. Select that field in the QGIS dialog to prevent cars from using pedestrian-only roads.
- Furniture point layers can optionally include a direction field in degrees, for example `planx_angle`, `angle`, `rotation`, `heading`, `bearing`, `azimuth`, or `yon`. If no direction field is mapped, benches, lights, trash bins, and bus stops align automatically to the nearest road direction.

The plugin reports missing required data, empty required layers, CRS differences, geometry mismatches, and missing recommended fields.

## Feature-Level Styling

Use the `3 Stil` page to add style fields and apply values to selected features.

The same page also includes `Asset Theme / Material Pool`. Themes such as `Modern Urban`, `Mediterranean`, `Campus`, `Eco`, `Dense Urban`, `Civic Heritage`, and `Coastal Light` define lightweight visual pools for pedestrians, cars, trees, street furniture, facades, roofs, and paving. This selection changes only the browser visualization; it does not alter GIS geometry or attributes. Pedestrians and most material variants are procedural, so the plugin remains small and Plugin Hub friendly without relying on external texture URLs.

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

For a full scene handoff, use the QGIS Publish page command `Portable viewer klasoru` or `Portable ZIP olustur`. The folder command copies the embedded browser app, bundled vendor libraries, and current exported project data into one timestamped folder. The ZIP command packages the same portable viewer into one file for moving to another computer. On Windows, extract the ZIP and double-click `Start-PlanX-Viewer.bat`; alternatively open a terminal in the extracted folder, run `py -3 -m http.server 8080`, and visit `http://127.0.0.1:8080/src/`.

Narrative Studio still exports keyframes as `planx_tour.json`. When creating a portable ZIP, QGIS can optionally add that tour JSON to `data/planx_tour.json`. If it is present, the browser auto-loads the tour on another computer; otherwise the user can still import the JSON manually from the Narrative Dock.

## DEM Quality

`DEM mesh quality` controls the terrain mesh segmentation used by the viewer. Higher values make the DEM surface smoother and closer to a resampled high-detail terrain, similar in spirit to terrain/image width controls in Qgis2threejs. Higher values also cost more browser performance, so use moderate values for large study areas.

At the DEM and ROI boundary, the viewer avoids repeating the last raster pixel outward and applies a narrow spike limiter. This prevents isolated edge cells or NoData-adjacent pixels from pulling visible terrain triangles upward at the study-area boundary.

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
