# Changelog

## [0.8.48] - 2026-06-01

- Add procedural road, sidewalk, roof color controls and wider model elevation range

## [0.8.47] - 2026-05-31

- Added a Building floor count field mapping to the QGIS publisher. Building height = floor count x floor height; previously the count was read only from a hard-coded `katadedi` column.
- The viewer resolves the floor count from the mapped field first, then common Turkish/English fallback column names (`katadedi`, `kat`, `kat_sayisi`, `floors`, `levels`, `storeys`, ...). Building extrusion, facade rows, ledges, statistics and tooltips all use the resolved count.
- Updated the viewer module cache key to app.js?v=0.8.47.

## [0.8.46] - 2026-05-31

- Added a Rotation slider to the Model Studio Model Transform panel for the light, bench, trash bin and bus stop categories (previously only mosque and tumulus had one).
- Furniture rotation is applied as a manual offset on top of the existing road-aligned / attribute-based orientation, so 0 keeps the current auto-alignment.
- Updated the viewer module cache key to app.js?v=0.8.46.

## [0.8.45] - 2026-05-31

- Added a Tumulus Placements & Overrides section to Model Studio, mirroring the mosque cards: per-tumulus model (global / procedural mound / uploaded GLB), color tint, scale X/Y/Z, rotation and elevation, persisted in browser storage.
- Tumulus rendering applies these per-placement overrides on top of the global category transform, with per-feature attribute scale/rotation still honored as fallbacks.
- Updated the viewer module cache key to app.js?v=0.8.45.

## [0.8.44] - 2026-05-31

- Model Studio's dynamic panels (Library Models, Tree Model Pool, Model Transform, Mosque placements) now re-render on language toggle, so their labels follow the English/Turkish switch while the dock stays open.
- Optimized tumulus rendering to build a single template (uploaded GLB or the default procedural mound) and clone it per feature, sharing geometry and materials.
- Minor cleanups: hoisted tree scale lookups out of the per-tree loop and removed an unused i18n key.
- Updated the viewer module cache key to app.js?v=0.8.44.

## [0.8.43] - 2026-05-31

- Added a Rotation slider to the Model Studio Model Transform panel for the mosque and tumulus categories; the tumulus global rotation now drives placement instead of a pseudo-random angle, so uploaded tumulus GLB models can be oriented.
- Converted the remaining changelog entries to English so the release notes are uniformly English.
- Updated the viewer module cache key to app.js?v=0.8.43.

## [0.8.42] - 2026-05-31

- Added a category-based Model Transform panel to Model Studio: a category selector (mosque, tumulus, tree, light, bench, bin, bus stop) exposing Elevation and Scale X/Y/Z sliders, especially for tumulus and mosque sizing.
- Global mosque/tumulus/tree/furniture scale now multiplies with per-feature attribute or per-placement overrides, so the category sliders always take effect.
- Updated the viewer module cache key to app.js?v=0.8.42.

## [0.8.41] - 2026-05-31

- Added Tumulus (burial mound) support to Model Studio: a new optional point layer (mytumulus.geojson) selectable in the QGIS publisher with optional GLB upload; when no model is uploaded a default procedural mound model (earthen dome + stone retaining ring) is rendered. Added a Tumulus visibility toggle to the Layers panel.
- Added a Model Elevation (Y offset) slider per model category (mosque, tumulus, tree, light, bench, bin, bus stop) so models that sink below the terrain (e.g. mosque) can be raised. Mosque placement cards also gained a per-feature elevation control.
- Added a multi-model tree pool: upload 2-3 tree GLB models in Model Studio and trees are placed by deterministic random selection from the pool. The default stylized trees remain when the pool is empty.
- Updated the viewer module cache key to app.js?v=0.8.41.

## [0.8.40] - 2026-05-30

- Added a custom 3D model upload panel (Model Studio), per-mosque model/color/scale/angle controls, library-model template assignment for street furniture and trees, and automatic layer activation.

## [0.8.38] - 2026-05-29

- Exclude .zipignore from packaging, fix sidewalk Z-value draping, and establish a unique PlanX branding identity.

## [0.8.37] - 2026-05-29

- Fix syntax error in buildBuildingLayer and enhance blockCategoryStyleState robustness

## [0.8.36] - 2026-05-29

- Force browser cache-bypass update for app.js by bumping script tag to v0.8.36

## [0.8.35] - 2026-05-29

- Fix TDZ ReferenceError (cannot access BLOCK_STYLE_STORAGE_KEY before initialization)

## [0.8.34] - 2026-05-29

- Fix geometry setback and NaN coordinate checks to resolve loading hang on degenerate datasets

## [0.8.33] - 2026-05-29

- Fix app.js loading reference error, floor slab offset coordinates, and update index.html script cache query

## [0.8.32] - 2026-05-29

- Fix KeyError fences in QGIS UI dialogue

## [0.8.31] - 2026-05-29

- Add advanced procedural setbacks, floor slabs, road markings, and 3D zoning envelope compliance visualizer

## [0.8.30] - 2026-05-29

- Add dynamic block category styling, fences layer, and linear waterlines streams

## [0.8.29] - 2026-05-27

- Fixed roofs and walls turning invisible (fully transparent) from some camera angles and flipping as the scene was orbited: building wall, roof-cap, and pitched-roof materials are now double-sided, so faces render regardless of polygon winding direction.
- Reworked Gable, Shed, and Hip roofs to follow the real building footprint and its orientation instead of an axis-aligned bounding box. The ridge aligns to the footprint's long axis, the roof is centered on the footprint centroid, and a small eave (default capped at 0.30 m) follows the polygon outline.
- Gable and Hip are now built by lofting the footprint outline up to a ridge line (Gable: full-length ridge with vertical gable ends; Hip: ridge inset from the ends with sloped hips); near-square footprints collapse to a centered apex like Pyramid.
- Shed is now a single tilted plane over the real footprint with vertical skirt faces, so the raised sides are no longer left open.
- Updated the viewer module cache key to app.js?v=0.8.29.

## [0.8.28] - 2026-05-27

- Reworked roof handling: removed legacy Cone/Prism options, added robust Flat/Pyramid/Hip/Gable/Shed roof shapes, and separated facade materials from roof/cap rendering in Extruded + roof mode.
- Added per-function building style cards in the Style dock: each land-use/function can now control facade color, facade type, roof shape, roof texture, roof height, facade scale, and floor height independently.
- Persisted per-function building styles in viewer local storage and added cache-busting for both app.js and style.css.

## [0.8.27] - 2026-05-27

- Fixed regressions after recent updates: building roof presentation, block/island visibility recovery, and facade key normalization for stale saved settings.
- Replaced Turkish facade set with six realistic PNG facade textures (`Urban_TR_A` ... `Urban_TR_F`) generated with AI image creation workflow.
- Added compatibility handling for legacy `Urban_TR_*_<kat>` keys so old saved projects resolve to new TR facade images.
- Updated viewer cache-bust query to `app.js?v=0.8.27`.

## [0.8.26] - 2026-05-26

- Fixed conical tree variants (Cypress/Pine/Palm) sinking below terrain by correcting crown Y anchoring against geometry bounds.
- Updated viewer cache-bust query to `app.js?v=0.8.26`.

## [0.8.25] - 2026-05-26

- Fixed long-loading startup behavior by adding request timeouts and safer scene-rebuild error handling.
- Added global runtime error capture so the loading overlay closes with a clear status message instead of hanging.
- Updated viewer cache-bust query to `app.js?v=0.8.25`.
- Slimmed Turkish facade assets by removing numbered TR texture files; base `Urban_TR_A/B/C/D` variants remain.

## [0.8.24] - 2026-05-26

- Improved Turkish field-name matching in attribute detection (nüfus, araç, yükseklik, ağaç_boyu, yön) while preserving legacy aliases.

## [0.8.23] - 2026-05-26

- Qt5/Qt6 compatibility maintenance, welcome/dialog stability improvements, and QGIS 3.40+/4 runtime validation.

## [0.8.22] - 2026-05-26

- Maintenance release: refreshed Plugin Hub package with QGIS 4 welcome dialog fixes.

## [0.8.21] - 2026-05-26

- Fix QGIS 4 welcome dialog text-format and text-selection flags.

## [0.8.20] - 2026-05-26

- Fix QGIS 4 / Qt6 dialog frame enum compatibility.

All notable changes to **PlanX 3D City Viewer** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

## [0.8.18] - 2026-05-25

Sidewalk visibility, inner-block pedestrian paths, and raster building clamping release.
- Fixed exported sidewalk polygon rendering in the web viewer by passing the scene build token into the sidewalk polygon builder and raising sidewalk surfaces above road meshes with their own layer offset.
- Added an optional `Pedestrian paths` input (`mypedestrian_paths.geojson`) for inner-block paths/walkways; accepts line or polygon layers, appears in the QGIS publisher, exports in both Vector Plan and Raster Plan Texture modes, and has a dedicated viewer visibility toggle.
- Pedestrian animation now uses both road-side sidewalk curves and the new inner-block path curves, with path walkers clamped to the path surface instead of the road surface.
- Raster Plan Texture Mode building bases now use a low raster-specific ground offset so buildings sit on the textured DEM surface instead of floating, while Vector Plan building offsets remain unchanged.
- Updated the viewer module cache key to `app.js?v=0.8.18`.

## [0.8.17] - 2026-05-25

Modern Turkish facade asset release.
- Added 40 new realistic Turkish urban facade PNG textures: `Urban_TR_A_1` through `Urban_TR_D_10`, covering four modern apartment / mixed-use facade families across 1-10 storeys.
- Added a `Modern Turkish` asset theme in the QGIS publisher and web viewer.
- Turkish facade families auto-resolve to the building floor count, so choosing `Urban_TR_A` applies `Urban_TR_A_1..10` according to `katadedi` / parsed levels.
- Ground floors are drawn as entrance/commercial/lobby floors while upper storeys use repeatable residential facade language.
- Updated the viewer module cache key to `app.js?v=0.8.17`.

## [0.8.16] - 2026-05-23

Raster plan texture georeference alignment hotfix.
- Fixed Raster Plan Texture Mode placement: `siteplan.tif` is now drawn into a terrain-sized atlas using its own GeoTIFF bounding box, so the plan texture lands at its projected map position instead of being stretched across the whole DEM extent.
- Preserved the 0.8.15 scene-wide left/right orientation fix; vector layers, DEM sampling, and raster plan texture now share the same corrected local axes.
- Raised the plan texture processing cap to 4096 px so wide DEM context does not excessively blur a smaller ROI/siteplan texture.
- Updated the viewer module cache key to `app.js?v=0.8.16`.

## [0.8.15] - 2026-05-23

Scene-wide left/right orientation hotfix.
- Fixed the web viewer's projected-coordinate to local-coordinate mapping so Vector Plan and Raster Plan Texture modes no longer render the entire city mirrored left/right.
- DEM sampling now uses the same inverse local-to-projected transform, keeping terrain heights, island plateaus, buildings, hardscape, roads, furniture, walk mode, and the terrain cache aligned after the orientation correction.
- Raster plan GeoTIFF orientation now follows the corrected local X axis, so siteplan textures stay aligned with vector layers after the scene-wide fix.
- Updated the viewer module cache key to `app.js?v=0.8.15`.

## [0.8.14] - 2026-05-23

Raster plan texture orientation hotfix.
- Fixed Raster Plan Texture Mode in the web viewer: siteplan GeoTIFF pixels are now normalized from their georeferenced X/Y resolution signs before becoming a CanvasTexture, so south-up or west-flipped rasters no longer appear mirrored on the DEM terrain.
- Basemap PNG texture orientation is unchanged.
- Updated the viewer module cache key to `app.js?v=0.8.14`.

## [0.8.13] - 2026-05-22

QGIS Hub security and quality scan cleanup.
- Hardened the OpenStreetMap Overpass fetcher for Bandit B310 by validating the endpoint scheme before `urlopen` and documenting the narrow `nosec` suppression.
- Removed the unused typing import in `osm_importer.py`.
- Cleaned Flake8 style findings in the QGIS OSM import dialog and exporter spacing.
- Updated the viewer module cache key to `app.js?v=0.8.13`.

## [0.8.12] - 2026-05-22

Viewer loader resilience hotfix.
- Hardened the web viewer scene build so one problematic vector layer cannot leave the app stuck at `Processing city layers...`.
- Layer builds now fail soft: the broken layer is cleared/skipped, the rest of the DEM, basemap, terrain and available layers continue to render, and the status text reports which layer was skipped.
- Catastrophic scene errors now hide the loading overlay and show a scene-state warning instead of leaving an infinite spinner.
- Updated the viewer module cache key to `app.js?v=0.8.12`.

## [0.8.11] - 2026-05-22

Final beta-exit polish: optional outside-ROI terrain.
- Added an Outside ROI terrain toggle to the Layers and Scene panels. When enabled, wide DEM context remains visible with the blank outside colour; when disabled, the terrain surface is clipped to the ROI mask.
- The outside-ROI toggle works with basemap, plan texture, pavement, elevation tint, and slope tint modes.
- Persisted and exported the new outside-ROI terrain setting so projects reopen with the same presentation intent.
- Updated the viewer module cache key to `app.js?v=0.8.11`.

## [0.8.10] - 2026-05-22

Layer dock authority, basemap-only terrain workflow, and block opacity controls.
- Fixed stale async rebuilds so Layers panel visibility toggles are authoritative; buildings no longer reappear after being disabled from the dock.
- Added Blocks visibility to the Layers panel and Advanced controls.
- Added Block transparency control with a default of `0`, meaning blocks render fully opaque unless the user chooses transparency.
- Made QGIS basemap texture take priority when enabled, so users can reliably view satellite/basemap imagery directly on DEM terrain without vector layers.
- Island plateau now skips hidden block-only presentation states when no block-dependent visible content is active, preserving pure DEM plus basemap review.
- Updated the viewer module cache key to `app.js?v=0.8.10`.

## [0.8.9] - 2026-05-22

Release-readiness pass for facade scale, hardscape drape, polygon holes, and settings migration.
- Tuned facade texture scale back 45% from the 8x enlargement target to a 4.85x default and exposed it as a viewer Building panel control.
- Added settings schema migration so older browser-local settings cannot silently keep island plateau disabled after upgrading.
- Subdivided hardscape slabs before draping them to the final terrain surface, reducing long-triangle instability between paved surfaces and islands.
- Added polygon hole support for islands, hardscape, and building footprints/extrusions so courtyards and donut polygons render correctly.
- Updated the viewer module cache key to `app.js?v=0.8.9`.

## [0.8.8] - 2026-05-22

Plateau defaults, road/hardscape Z stability, facade scale, and HTML guide.
- Re-enabled island plateau by default in the QGIS publisher, export manifest, and viewer defaults so blocks flatten their underlying terrain again unless the user disables the cleanup toggle.
- Separated hardscape, parcel, road, and vehicle elevation offsets and added road polygon offset to keep OSM roads and hardscape slabs above the final terrain surface without z-fighting.
- Enlarged building facade texture scale by 8x so procedural windows and floor lines read at presentation distance.
- Reordered the Data page actions: Auto-match, sample data, OSM import, quality report, export, then Save preset / Load preset on the right.
- Added a new 0 Guide panel that opens a detailed English HTML user guide bundled with the plugin.
- Updated the viewer module cache key to `app.js?v=0.8.8`.

## [0.8.7] - 2026-05-22

Stable terrain surface, DEM-less viewer, and ROI-only texture overlay.
- Added a stable terrain surface cache built from the final terrain mesh after DEM smoothing, boundary cleanup and optional island plateau passes. Islands, buildings, roads, trees and street furniture now clamp to the same visible surface instead of re-sampling unstable raw DEM values.
- Added DEM smoothing controls: smooth passes, smooth strength and max slope clamp. These damp abrupt elevation jumps that were tearing island drapes and causing unstable Z placement.
- Vector Plan Mode can now export without a DEM. The browser falls back to a dummy flat presentation plane and continues rendering available vector layers.
- Wide DEM exports now keep surrounding topography visible while clipping the active texture to the ROI: outside the ROI the terrain remains visible with a configurable blank color, inside the ROI the selected plan/basemap/pavement texture is shown normally.
- Updated the viewer module cache key to `app.js?v=0.8.7`.

## [0.8.6] - 2026-05-22

Flexible DEM-only exports and source-folder repair.
- Restored the released 0.8.5 source tree into the plugin folder after the working directory had only vendor/data directories and an incomplete `.git` directory.
- Viewer GeoJSON loading now follows manifest `requiredInputs`: in Vector Plan Mode, blocks, parcels, buildings, roads and ROI are optional and load as empty layers when absent; Raster Plan Texture Mode still treats its declared inputs as required.
- DEM-only Vector scenes now derive terrain bounds from the DEM raster extent instead of using the old `-500..500` placeholder, so a project with only `mydem.tif` opens over the real georeferenced raster.
- Added defensive empty-layer guards for minimap, hardscape, roads, sidewalks, crosswalks, trees and ROI boundary rendering.
- Publisher manifests now write the current metadata version dynamically and include `flexibleInputs=true` for Vector Plan Mode.
- Island plateau defaults are consistently off in the publisher and viewer, keeping the DEM visible unless the user enables plateau flattening.
- The viewer module script now carries a version query (`app.js?v=0.8.6`) so browser cache does not hold an older cockpit after plugin updates.

## [0.8.5] - 2026-05-22

Conforming island subdivision and camera bookmarks.
- **Conforming 4-1 subdivision (Loop-style).** Earlier `subdivideShapeGeometry` bisected only the longest edge per triangle. Two neighbouring triangles often disagreed on the midpoint, leaving T-vertex cracks that DEM drape made visible as a broken-up / faceted surface — the issue the user kept reporting. The new pass splits every triangle into 4 children at all three edge midpoints, so neighbours always agree on the shared midpoint. Combined with `indexAndMergeNonIndexed`, the drape lands on a watertight, smooth-shaded mesh again.
- **Camera bookmarks.** New section under the Scene dock: `Save current view` button records the camera position, target, FOV and time-of-day under a user-supplied name; the saved views list lets you jump to any of them via the existing fly-to animation, and × removes one. Bookmarks are persisted in browser `localStorage` (`planx_3d_city_camera_bookmarks`).

## [0.8.4] - 2026-05-22

Smooth island drape and recipe-aware facade UV scale.
- **Island drape rebuilt.** `subdivideShapeGeometry` now runs at 4 m max-edge (was 8 m) and the result feeds a new `indexAndMergeNonIndexed` pass that collapses coincident vertices into a shared index buffer. `computeVertexNormals` can finally produce smooth shading across triangle edges; the drape returns to a continuous surface instead of a faceted/stuttering one.
- **Per-building facade UV scale.** The cached facade texture clone now uses `repeat = (0.5, levels / textureFloorRows)`, where `textureFloorRows` is read from `FACADE_RECIPES[featureFacade].floorRows`. A 4-storey building renders 4 actual floor rows on the procedural facade instead of squashing the whole pattern into ~1.3 rows. Horizontal repeat raised from `0.22` to `0.5` so window columns read at human scale.

## [0.8.3] - 2026-05-22

User-controlled terrain texture tile size.
- Renamed `terrainTextureScale` to `terrainTileMeters` and exposed it as a slider in the Style dock (5-300 m per tile, default 60 m). The user can now dial in the right ground-texture density for their site instead of relying on a hard-coded constant. Persisted in browser local storage.

## [0.8.2] - 2026-05-22

Cumulative shadow heatmap, project presets, quick time + theme.
- **Cumulative shadow heatmap (Analysis dock).** New `Compute shadow heatmap` button raycasts 6 hours of the day (7, 9, 11, 13, 15, 17) across a 48×48 ground grid using the NOAA solar model. Each grid cell records how many sun samples are blocked by buildings/trees; a colour overlay (golden = always sunny → deep blue = always shaded) is rendered above the terrain. Runs asynchronously with progress feedback in the status bar; `Clear heatmap` removes it.
- **Project preset save/load (Data page).** `Save preset` writes the current layer selections (by display name), mode, asset theme, field mappings, plateau settings and basemap export size into a portable `.planx` JSON file. `Load preset` reads one back, matches layer names against the active QGIS project, and reports any layers that could not be matched.
- **Quick time-of-day presets.** Dawn 6 / Noon 12 / Sunset 19 / Night 22 buttons under the Time slider in the Scene dock. One click jumps the sun, disables `autoTime`, and reflects the new value in the dock.
- **Theme selector.** Auto / Light / Dark dropdown in the Scene dock. Persisted in browser `localStorage`. Implemented as a `data-theme` attribute on `<html>` that overrides `prefers-color-scheme`; new CSS variables under `[data-theme="light"]` and `[data-theme="dark"]` follow.

## [0.8.1] - 2026-05-22

Scale and ground-clamp fixes plus per-feature road width.
- **DEM visible by default.** `flattenIslands` setting now defaults to `false` so the underlying terrain stays readable. Users can still enable per-block plateau alignment from the Terrain panel; the DEM-less render path was already supported and remains the default when no DEM is provided (good for the walk-mode-only workflow the user reported).
- **Terrain pavement texture 10× larger.** `buildTerrain` repeat counts changed from `width/60, depth/60` to `width/600, depth/600`. The asphalt/stone tile now reads as actual paving rather than a tight checker.
- **Street furniture sits on the terrain.** Lights, benches, bins and bus stops dropped from `terrainLocalYAt + LAYER.content + LAYER.road + 0.08` (~1 m above ground) to `terrainLocalYAt + furnitureGroundOffset` (0.02 m anti-z-fight only). Night-time point-light Y kept its `+4.2 m` offset relative to the new base.
- **Per-feature road width.** `roadWidth` default raised to 8 m, slider widened to 5–20 m. New `road_width_field` field mapping in the QGIS publisher; the viewer reads it via `featureRoadWidth(f)` and subtracts ~3 m (1.5 m each side) for sidewalks before clamping to 5–20 m. So a 15 m right-of-way draws as a 12 m road surface, an 18 m row draws as 15 m, etc. Sidewalks and crosswalks pick up the same per-feature width.
- **Park & sport materials are now user-tunable.** `parkColor`, `parkTexture` (driven from the existing island procedural set, default `ParkGreen`) and `sportColor` are new persisted settings. Three new swatches appear in the Terrain panel.
- **Facade scale fix.** Procedural facade UV repeat raised from 0.22 to 0.55 so a 4-storey block renders with ~4 window rows instead of ~2. The floor-height slider range widened to 2.5–5.0 m for manual tuning.

## [0.8.0] - 2026-05-22

Modern cockpit UI, FPS HUD and Shadow Study.
- **Modern cockpit theme.** Added design tokens (CSS variables) for colours, radii, blur, shadows, spacing, typography. Every dock and `.glass-panel` now uses a unified glassmorphism surface with consistent border, blur and shadow. Buttons get a subtle hover lift; range sliders, selects and number inputs get accent-coloured focus rings; scrollbars are polished. Automatic dark-mode follow via `prefers-color-scheme`. Honours `prefers-reduced-motion`.
- **FPS HUD.** Top-right `hud-chip` shows live frames per second sampled once per second. Colour switches to amber under 45 fps and red under 25 fps so users see when the scene needs lighter settings.
- **Shadow Study (Analysis dock).** Four preset buttons (Winter Solstice, Spring Equinox, Summer Solstice, Autumn Equinox) snap `dayOfYear` + noon time so shadow patterns are immediately visible. Play day / Stop animates sunrise→sunset using the existing `autoTime` loop; speed slider exposed in the dock. Built on the NOAA solar model from v0.7.9 so the shadows are physically correct for the site latitude.
- Added new i18n keys (TR + EN) for the shadow study UI and theme controls.

## [0.7.9] - 2026-05-22

OpenStreetMap importer and astronomical solar model.
- New "Import from OpenStreetMap" button on the Data page. Enter a small WGS84 bounding box (or pull it from the current QGIS canvas) and the plugin queries the Overpass API for buildings, roads, parks/greens and trees, reprojects them to the local UTM zone, and adds them as named layers. Bina katadedi, fonksiyon, yol türü ve ağaç yüksekliği otomatik eşlenir. Soft cap ~5 km per side to stay polite to the shared Overpass endpoint.
- Replaced the simple sine sun model with a NOAA-style solar position calculator. New viewer sliders for **Day of year (1-365)** and **Latitude (deg)** move the sun realistically with season + location. Sunrise/sunset, golden-hour intensity ramp and night detection now follow the actual solar elevation rather than a fixed clock window.
- The compass widget gains a small live sun marker on the ring showing the sun's true bearing from the current camera.
- QGIS publisher writes the derived project latitude (from the DEM bbox centroid reprojected to WGS84) and a default day-of-year into `planx_manifest.json` so the viewer starts at a sensible solar pose for the actual site.

## [0.7.8] - 2026-05-22

Plugin Hub security/quality scan cleanup.
- Removed unused imports (`json`, `os`, `typing.Tuple`, `REQUIRED_INPUTS`, `OPTIONAL_INPUTS`) and stray local variables (`optional_keys`, `crs`, `block_w`, `block_h`) flagged by the Hub Flake8 scan.
- `zip_hub.py` now drops `.zipignore` from the released archive (added to `EXCLUDE_FILENAMES`) so the Hub suspicious-file scanner no longer reports a hidden file. The `.zipignore` itself stays in the repository for build hygiene.
- No functional changes to the viewer or the QGIS publisher; this is a packaging/lint patch only.

## [0.7.7] - 2026-05-21

Terrain low-edge stability, first-run onboarding, and a built-in sample dataset.
- Added a median + median-absolute-deviation (MAD) clamp to terrain vertices: any DEM sample more than 3 MAD below the median is treated as a low outlier and pulled up to a robust local neighbourhood height. Eliminates the upward triangle spikes that used to ride the lowest-elevation contour along DEM/ROI edges and broke the DEM texture along that line.
- Added a first-run welcome dialog shown once per plugin version, with quick-start steps, a "Generate sample project" shortcut, and a link to the online documentation.
- Added an in-plugin synthetic sample-project generator (DEM + ROI + blocks + buildings + roads + trees in EPSG:32635) reachable from both the welcome dialog and a new "Try with sample data" button on the Data page. New global users can publish and explore the 3D viewer with zero data preparation.
- Quality report and badge UI now reflects Required / Recommended / Optional roles dynamically when the publish mode changes — in Vector mode only the DEM is starred as required, ROI / blocks / parcels / buildings / roads carry a clear "Recommended" hint instead of a hard requirement.

## [0.7.6] - 2026-05-21

Island plateau alignment and flexible Vector Plan Mode inputs.
- Added Island Plateau: under each block polygon, DEM vertices are pulled to the block's local median height with a configurable transition ramp (default 6 m) toward the surrounding terrain. Eliminates the remaining DEM/island interpenetration.
- The plateau cache is shared with terrainLocalYAt() so buildings, trees, and street furniture inside a block also clamp to the plateau height instead of the underlying raw DEM.
- New viewer toggles: "Flatten DEM under islands" (default on) and "Plateau edge ramp (m)" slider in the Terrain panel.
- Vector Plan Mode now requires only the DEM; ROI, blocks, parcels, buildings, and roads are reclassified as recommended but optional. The viewer skips empty layers gracefully so minimal exports (DEM-only, DEM + buildings, etc.) render cleanly.
- QGIS publisher quality report now distinguishes Required / Recommended / Optional roles and warns when recommended Vector layers are missing without blocking export.
- Bounds derivation in the viewer falls back through ROI → blocks → roads → buildings → parcels so any single vector layer is enough to anchor the scene.

## [0.7.5] - 2026-05-21

DEM edge stability, island layer overhaul, and themed facade textures release.
- Hardened terrain edge cleanup further: widened the boundary blend band (~2× wider), strengthened the spike clamp toward the local median, increased the boundary median sampling radius, and out-of-ROI vertices now snap to a robust DEM average so the raster halo around the export window no longer pulls triangles up or down.
- Reused a single ROI polygon cache between the terrain vertex pass and the boundary spike limiter for faster terrain rebuilds.
- Islands now render as a clean second layer above the DEM: raised the island elevation offset, subdivided block polygons so they drape across DEM curvature instead of cutting through it, and removed the unused island alpha-mask code path and its stale comment.
- Added four themed island materials: ParkGreen, ResidentialBeige, CivicGravel, and CoastalSand.
- Rewrote procedural facade textures for theme facades (CampusGlass, EcoTimber, CivicStone, DenseBrick, CoastalWhite, MediterraneanStucco, UrbanE) with real window grids, floor lines, optional ground-floor shopfronts, and per-theme column patterns (brick, timber, pilaster, flat).
- UrbanA-D PNG facades remain unchanged for backwards-compatible feature-level styling.

## [0.7.4] - 2026-05-20

Security scan compliance and vendor cleanup release.
- Removed unused Draco codec, zstddec, and other unreferenced Three.js vendor libraries that triggered false-positive secret detections on the QGIS Plugin Hub.
- Added `detect-secrets` pragma allowlist comments to the bundled GeoTIFF library to suppress false-positive high-entropy string warnings.
- Stripped unused Three.js build variants, source maps, loader modules, and large binary assets to reduce the plugin package size significantly.
- No functional changes to the viewer or QGIS publisher.

## [0.7.3] - 2026-05-20

English-first bilingual interface and publisher polish release.
- Made English the primary default language in both the QGIS publisher and browser cockpit, with Turkish available as the secondary language.
- Extended browser i18n coverage to dashboard metrics, dock tooltips, camera controls, Narrative Studio, Walk HUD, minimap, status pills, placeholders, and empty-state text.
- Updated QGIS publisher wording, quality reports, publish summaries, overwrite prompts, portable export messages, and the style assistant to English-first labels with Turkish guidance where useful.
- Added a language note to the quality report and kept project workflow terminology consistent between QGIS and the web viewer.

## [0.7.2] - 2026-05-20

Terrain boundary stability and portable tour ZIP release.
- Hardened DEM sampling at raster and ROI boundaries so edge pixels are no longer repeated into artificial upward triangle spikes.
- Added a terrain boundary spike limiter around DEM edges and ROI clip edges to smooth isolated elevation outliers without flattening the whole terrain.
- Added a QGIS Portable ZIP command for complete viewer handoff, including app files, vendor libraries, exported data, launch scripts, and optional `planx_tour.json`.
- The browser can auto-load `data/planx_tour.json` from a portable package so Narrative Studio keyframes travel cleanly to another computer.

## [0.7.1] - 2026-05-20

Expanded procedural material library and offline viewer polish.
- Expanded the curated asset theme library with `Civic Heritage` and `Coastal Light` themes.
- Added more procedural street furniture variants, including heritage lanterns, bollards, campus lights, stone seats, eco benches, compact stops, steel canopies, and solar bins.
- Added procedural facade, roof, paving, hardscape, and road textures so the viewer no longer depends on external texture URLs.
- Improved theme switching so roof, paving, street furniture, and function facade defaults follow the selected asset theme.

## [0.7.0] - 2026-05-20

Portable viewer folder export release.
- Added a QGIS Publish page command to create a portable viewer folder for classroom, review, and presentation handoff.
- Copies the embedded viewer app, bundled vendor libraries, exported project data, and launch instructions into one timestamped folder.
- Adds Windows launch scripts inside the portable folder for easier student and jury review.
- Clarifies that Narrative Studio JSON stores camera/tour/viewer state only and must travel with the viewer data for a complete scene handoff.

## [0.6.9] - 2026-05-20

Procedural pedestrians and curated asset theme release.
- Added a QGIS Asset Theme / Material Pool selector with curated visual themes and active variant counts.
- Exported `assetTheme`, `assetPools`, and `pedestrianStyle` metadata into `planx_manifest.json`.
- Upgraded pedestrians to lightweight procedural low-poly people with arms, legs, shoes, and subtle walk-cycle limb motion.
- Applied theme-aware restrained palettes for pedestrians, cars, trees, and street-furniture style fallbacks.

## [0.6.8] - 2026

Stable reference release and ROI-clipped terrain/base imagery.
- Marks the 0.6.7 render-loop fix as the first verified stable cockpit baseline.
- Clips the terrain, raster plan texture, and QGIS basemap texture visually to the exported ROI boundary.
- Keeps the terrain opaque inside the ROI while hiding untrimmed DEM/basemap pixels outside the study area.

## [0.6.7]

Render loop startup hotfix.
- Moves the recording state initialization before the animation loop starts.
- Fixes the blank blue viewer regression where dashboard statistics loaded but the 3D scene did not render.
- Confirms dock activation works after the render loop fix.

## [0.6.6]

Viewer visibility and dock activation hotfix.
- Keeps the vector-mode terrain surface opaque so exported projects do not collapse into a blank blue background when island masks hide the ground.
- Makes dock button activation more robust with delegated click handling for Scene, Layers, Analysis, Style, Mobility, Street Furniture, and Narrative panels.
- Raises dock and toolbar z-index values so viewer controls stay clickable above the 3D canvas.

## [0.6.5] - 2026

Terrain texture smoothing, basemap resolution, and recording stability release.
- Applies robust median DEM sampling and percentile clamping to terrain mesh vertices, not only ROI model-base sides.
- Smooths terrain vertices near the study-area boundary to reduce DEM edge spikes under plan and basemap textures.
- Adds a QGIS basemap export size selector with 1024, 2048, 4096, and 8192 pixel options.
- Writes selected basemap texture size into the manifest.
- Stabilizes WebM recording by using a consistent non-postprocessed render path while recording.

## [0.6.4]

Premium icon and QGIS basemap texture export release.
- Replaced the plugin icon with a more polished PlanX 3D City mark while keeping it as a lightweight SVG.
- Added an optional QGIS basemap/XYZ raster layer selector in the publisher dialog.
- Renders the selected QGIS basemap layer to `web/data/texture/basemap.png` during export.
- Adds basemap texture metadata so the browser viewer can drape the rendered QGIS basemap over the terrain.

## [0.6.3]

Tree height mapping and clean ROI model-base edge release.
- Added QGIS field mapping for tree height so tree sizes can be controlled from a selected attribute field.
- Updated the viewer to read mapped tree height fields with safe fallback aliases.
- Stabilized ROI model-base side heights with median DEM sampling, percentile clamping, and smoothed boundary profiles.
- Reduced DEM boundary spikes that previously made the model base look broken near the study-area edge.

## [0.6.2]

Surface alignment, walk mode, global modes, and dialog usability release.
- Improved building and street-furniture ground clamping so objects stay on the terrain, road, or sidewalk surface.
- Replaced fully random car and pedestrian colors with restrained urban palettes.
- Improved walk mode with smoother terrain following, sprint/crouch controls, and a compact help HUD.
- Added scrollable QGIS publisher pages for smaller windows and mouse-wheel navigation.
- Clarified Narrative Studio JSON export scope and documented portable viewer export as the next package workflow.
- Added viewer controls for building footprint/extrusion modes and DEM topography tint modes.

## [0.6.1]

Corrected ROI model base, dock completeness, language consistency, and placement fixes.
- Reworked build-sides into a solid ROI model base with a bottom polygon at DEM minimum minus the configured drop.
- Added missing advanced controls into the new dock system while keeping lil-gui available from Advanced.
- Improved Turkish/English dock label consistency across the browser viewer.
- Corrected vehicle elevation so cars stay attached to the road surface.
- Improved street furniture orientation with explicit angle fields and road-based fallback rotations for lights, benches, bins, and bus stops.
