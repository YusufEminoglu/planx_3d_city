# PlanX 3D City Viewer

PlanX 3D City Viewer is a QGIS publisher plugin for preparing GIS layers, exporting them to the embedded web viewer data contract, and launching a local Three.js 3D city cockpit.

## Requirements

- QGIS 3.28 or newer
- A modern browser
- No Node.js requirement
- No external Python packages
- Bundled browser libraries under `web/assets/vendor`

## Quick Start

1. Open the DEM and vector layers in one QGIS project.
2. Start `PlanX 3D City` from the toolbar or plugin menu.
3. In `1 Veri`, choose a publishing mode.
4. Use `Katmanlari otomatik eslestir` if your layer names contain common hints such as `dem`, `roi`, `yol`, `bina`, `ada`, `parsel`, or `plan`.
5. For `Vector Plan Mode`, select all required layers: DEM, ROI, roads, buildings, blocks, parcels.
6. For `Raster Plan Texture Mode`, select DEM, ROI, plan texture GeoTIFF, roads, and buildings. Blocks and parcels are optional in this mode.
7. Select optional layers if available: trees, hardscape, lights, benches, trash bins, bus stops.
8. In `2 Kontrol`, generate and inspect the quality report.
9. In `3 Stil`, optionally create PlanX style fields and apply styles to selected blocks/buildings.
10. Click `Disari aktar ve 3D Viewer ac`.
11. Use `4 Yayin` to copy the viewer URL, reopen the browser, open exported data, or stop the local server.

## Data Contract

The plugin writes the viewer inputs to fixed paths:

- `web/data/dem/mydem.tif`
- optional raster texture mode file: `web/data/texture/siteplan.tif`
- `web/data/yerlesim/roi.geojson`
- `web/data/yerlesim/myroads.geojson`
- `web/data/yerlesim/mybuildings.geojson`
- `web/data/yerlesim/myblocks.geojson`
- `web/data/yerlesim/myparcels.geojson`
- optional `mytrees`, `myhardscape`, `mylights`, `mybenches`, `mytrashbins`, `mybusstops`
- `web/data/planx_manifest.json`

Optional layers can be left empty. The plugin writes empty GeoJSON files so the viewer remains stable.

The manifest records the export time, QGIS project title, source layer names, targets, CRS values, feature counts, and empty optional inputs. The viewer uses it to show project provenance and data health without requiring the user to remember how the export was produced.

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

## Data Quality Expectations

- All vector layers and the DEM should use the same metric CRS.
- ROI, buildings, blocks, parcels, and hardscape should be polygon layers.
- Roads should be line layers.
- Trees, lights, benches, trash bins, and bus stops should be point layers.
- Buildings should ideally include `katadedi` and `uipfonksiyon`.

The plugin reports missing required data, empty required layers, CRS differences, geometry mismatches, and missing recommended fields.

## Feature-Level Styling

Use the `3 Stil` page to add style fields and apply values to selected features.

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
- Style Dock for global city styling
- Project metadata panel fed by `planx_manifest.json`
- Persisted cockpit settings through browser local storage
- Camera panel for screenshots, video, orbit, FOV, and walk speed
- Building hover and click detail panels
- Minimap, compass, and scale bar

## Troubleshooting

- If the viewer opens but data is missing, rerun export and check the `2 Kontrol` report.
- If scale looks wrong, check that the data is in a metric CRS rather than EPSG:4326 degrees.
- If buildings look flat, verify `katadedi` values.
- If function coloring is weak, verify `uipfonksiyon`.
- If selected feature styling is not visible, save edits in QGIS and export again.
