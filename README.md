# PlanX 3D City Viewer

PlanX 3D City Viewer is a QGIS publisher plugin for preparing GIS layers, exporting them to the embedded web viewer data contract, and launching a local Three.js 3D city cockpit.

## Requirements

- QGIS 3.28 or newer
- A modern browser
- No Node.js requirement
- No external Python packages
- Bundled browser libraries under `web/assets/vendor`
- The package does not ship generated DEM/settlement data. Export from QGIS creates `web/data` at runtime.

## Quick Start

1. Open the DEM and vector layers in one QGIS project.
2. Start `PlanX 3D City` from the toolbar or plugin menu.
3. In `1 Veri`, choose a publishing mode.
4. Use `Katmanlari otomatik eslestir` if your layer names contain common hints such as `dem`, `roi`, `yol`, `bina`, `ada`, `parsel`, or `plan`.
5. For `Vector Plan Mode`, select all required layers: DEM, ROI, roads, buildings, blocks, parcels.
6. For `Raster Plan Texture Mode`, select DEM, ROI, plan texture GeoTIFF, roads, and buildings. Blocks and parcels are optional in this mode.
7. Select optional layers if available: trees, hardscape, sidewalks, lights, benches, trash bins, bus stops.
8. If your roads layer has pedestrian/vehicle information, choose the road access field and keep or edit the no-car / vehicle keywords. Cars will not be spawned on pedestrian-only roads.
9. In `2 Kontrol`, generate and inspect the quality report.
10. In `3 Stil`, optionally create PlanX style fields and apply styles to selected blocks/buildings.
11. Click `Disari aktar ve 3D Viewer ac`.
12. Use `4 Yayin` to copy the viewer URL, reopen the browser, open exported data, or stop the local server.

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
- Build-sides for a solid model-base edge around the terrain. The default side base is calculated as the minimum valid DEM pixel value minus 5 meters.
- Project metadata panel fed by `planx_manifest.json`
- Persisted cockpit settings through browser local storage
- Camera panel for screenshots, video, orbit, FOV, and walk speed
- Building hover and click detail panels
- Road analysis coloring: default style, amenity-distance fade, or access/traffic class colors
- Wind plume screening for industrial/waste-like functions using a configurable prevailing wind direction
- Estimated building statistics in the click panel when population, dwelling, vehicle, or gross floor area fields are missing
- Minimap, compass, and scale bar

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
