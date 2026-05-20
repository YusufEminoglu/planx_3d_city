# Changelog

All notable changes to **PlanX 3D City Viewer** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

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
