# Changelog

All notable changes to **PlanX 3D City Viewer** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

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
