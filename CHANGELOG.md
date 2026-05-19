# Changelog

All notable changes to **PlanX 3D City Viewer** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · versioning: [SemVer](https://semver.org/).

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
