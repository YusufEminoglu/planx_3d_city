# PlanX 3D City — Roadmap (v1.1 → v2.0)

Goal: become the fastest, most beautiful and most useful 3D city publisher in
the QGIS ecosystem. This plan is based on a review of the current code (v1.0.3);
every item is tied to a concrete file/function and ends with a measurable target.

---

## 0. Current state — identified bottlenecks

| # | Finding | Location | Impact |
|---|-------|-----|------|
| B1 | Every building is a separate `THREE.Mesh` + separate `MeshStandardMaterial`; every floor slab (ledge) is a separate mesh + **new material** | `web/src/app.js` `buildBuildingLayer` (~7433–7710) | 5,000 buildings × 6 floors ≈ 35,000+ draw calls → < 15 FPS on a mid-range GPU |
| B2 | The scene is rendered every frame (even when nothing moves) | `animate()` (~9620) | 100% GPU at idle, laptop fan noise, battery drain |
| B3 | `preserveDrawingBuffer: true` is always on | renderer setup (~432) | Noticeable FPS loss on tile-based GPUs |
| B4 | GeoJSON layers are loaded **sequentially** with `await` | ~8700–8720 | Startup time = sum of all files |
| B5 | GeoJSON parsing, DEM `readRasters`, `ExtrudeGeometry` run on the main thread | `loadGeoJson`, ~3870/3970 | UI freezes in large cities |
| B6 | DEM is copied at full size (not clipped to the ROI), GeoJSON coordinate precision is unlimited | `exporter.py` `_export_dem`, `_export_vector` | Export size 5–20× larger than necessary |
| B7 | Texture PNGs are 0.7–1.2 MB, in an uncompressed GPU format | `web/src/assets/*.png` | ~8 MB download, ~150 MB+ VRAM |
| B8 | `intersectObjects(buildingGroup.children)` → linear raycast over thousands of meshes | ~9318, 9351, 9398 | Stutter on hover/click |
| B9 | Single-cascade 2048² shadow map, ±1600 m box | ~484–488 | Blurry up close, wasteful in the distance |
| B10 | `app.js` is a single 10.6k-line file, no tests | `web/src/app.js` | Speed regressions go unnoticed |

---

## Phase 1 — "Instant speed" (1–2 weeks, low risk, highest return)

> **Status (October 2026):** 1.1–1.7 implemented. Measurement: `tests/bench`, 10,000 buildings,
> headless Chromium (SwiftShader): draw calls 44,249 → 1,848, scene ready
> 33.5 s → 16.0 s, frame time 3.8 s → 2.4 s, building selection 13.4 ms → 1.1 ms.
> Because SwiftShader renders on the CPU, absolute FPS does not reflect a real GPU; draw
> call counts and timing ratios do.

**Goal:** 60 FPS on a mid-range laptop for a 10,000-building scene, startup < 3 s.

1. **Building batching (B1)** — the biggest win.
   - Cache materials keyed by `(function, facade, floor-count-scale, roof)`; no `new MeshStandardMaterial` per building.
   - Merge wall/roof geometries that share the same material into a single mesh with `BufferGeometryUtils.mergeGeometries` (or r159+ `BatchedMesh`).
   - Turn floor slabs (`showLedges`) into a single `InstancedMesh` or merged geometry.
   - Store the building ID as a `feature_id` vertex attribute → selection/highlighting in the shader (`uSelectedId`), no separate mesh needed.
   - Expected: draw calls 35,000 → < 100.
2. **On-demand render (B2)** — a `needsRender` flag; render while controls, animations, settings changes or the traffic/pedestrian simulation are active, otherwise stop. The SSAO "settle" logic already exists; hook into it.
3. **`preserveDrawingBuffer` (B3)** — turn it off; capture screenshots/recordings with `toBlob` right after `renderer.render()`.
4. **Parallel loading (B4)** — run all `loadGeoJson` calls through `Promise.all`; building layer first, street furniture afterwards (progressive reveal).
5. **BVH raycast (B8)** — add `three-mesh-bvh` to vendor (MIT, standalone ESM) → O(log n) picking on merged meshes; the computation in the shadow heat map (`localRaycaster` ~5755) also becomes 10–50× faster.
6. **Adaptive resolution** — lower `pixelRatio` dynamically while FPS < 45, restore it when movement stops.
7. **Performance HUD** — `?perf=1` shows FPS, draw calls, triangles, VRAM and load times (`renderer.info`).

## Phase 2 — "Big city" scale (2–4 weeks)

**Goal:** 100,000+ buildings, district-scale DEM; without freezing the browser.

> **Status (October 2026, first round):** Measurement came first (`__planxPerf.timings()` /
> `breakdown()`), and it showed that the main cost was not where it was expected:
> - Building layer 13.7 s → ~4 s: slabs were being re-extruded for every floor
>   (now once per building), the merge loop moved to typed arrays, and the
>   quadratic detachment of 85k meshes via `remove()` became linear.
> - Most triangles were not in the buildings but in the **roads** (1.84M of 2.9M total):
>   lane strips produced one quad per meter → now one every 3 m. Roads are now 0.61M.
> - Slab tiles are hidden beyond 550 m (item 2, partial).
> - Instead of item 4, **a single shadow camera fitted to the view**: shadows were
>   actually never drawn (sun at 1300 m, shadow camera `far` 500 m; the map was also
>   not refreshed after the scene loaded). Now sharp up close.
> - Item 5: 9 photographic textures converted to WebP (8.2 MB → 1.5 MB). Since they are
>   small (768–1024 px), the VRAM gain of KTX2 is negligible.
>
> 10,000 buildings, original → now: scene ready 32.8 s → 9.3 s, frame 3.7 s →
> 1.5 s, triangles 2.88M → 1.17M, draw calls 44,249 → 1,763.

> **Status (second round):**
> - **1. Worker:** The building layer no longer creates meshes/materials and merges
>   them afterwards; the main thread converts each building into a flat "spec",
>   and `building_geometry.js` generates the extrusion/slabs/roof (per view, per tile)
>   and writes their buffers directly. Tiles are distributed across up to 6 module
>   workers; if workers are unavailable, the same code runs on the main thread.
> - **Roads/blocks/sidewalks were merged as well** (`mesh_merge.js`): in the 10k
>   city, draw calls 1,763 → 450.
> - **Quadratic bug found at scale:** `terrainLocalYAt` scanned all block
>   plateaus on every call (14 s in the 50k city); fixed with a grid index.
> - Merged vertex data was compressed (normals as int16, color/emissive as bytes,
>   UVs only on textured meshes): ~52 → ~26 bytes/vertex.
> - The scene is not drawn while the loading screen is visible (it was competing
>   with the build and the workers).
> - **3. Terrain LOD — deferred:** the terrain mesh is at most 420² segments (~353k
>   triangles; default 120² ≈ 29k), a single mesh; height queries use the DEM, not
>   the mesh. With today's limits, LOD brings no measurable gain. If the DEM
>   resolution/extent is increased (with Phase 3.1), it should be revisited.
> - **6. Occlusion culling — deferred:** once draw calls dropped to 450, it is no longer
>   a measurable bottleneck.
>
> 50,000 buildings (4 vCPU, SwiftShader): scene ready 61.5 s → 29.0 s; building
> layer 30 s → 7.4 s.

1. **Web Worker pipeline (B5)** — GeoJSON parsing + triangulation (earcut) + extrusion + merging in a worker; the main thread receives a `Transferable` `ArrayBuffer`. GeoTIFF decoding in workers via the `geotiff.js` pool.
2. **Spatial tiling + LOD** — data is split into 250 m tiles; distant tiles use LOD1 (plain box, untextured), near tiles LOD2 (roof type, facade texture, slabs). Load/unload tiles based on the camera frustum.
3. **Terrain LOD** — quadtree / chunked LOD for the DEM (high resolution nearby, sparse in the distance), crack-free with skirts.
4. **Cascaded Shadow Maps (B9)** — 3 cascades (`three/addons/csm/CSM.js`); sharp shadows up close, cheap in the distance. Shadows update only when the sun/camera changes (`autoUpdate=false`).
5. **Compressed textures (B7)** — PNG → KTX2/Basis (UASTC/ETC1S) + `KTX2Loader`; WebP as a fallback. Collect facade textures into a single **texture array / atlas** → one material, one draw call.
6. **Occlusion culling (optional)** — hierarchical Z or tile-based visibility in dense city centers.

## Phase 3 — Export (QGIS side) acceleration (1–2 weeks)

**Goal:** Reduce export time and size by 5×.

> **Status (October 2026):**
> - **1. DEM:** the local DEM is clipped to the viewer's scene bounds (+32 px + 2% margin)
>   and written as DEFLATE/PREDICTOR/TILED; on a GDAL error it falls back to the old
>   plain copy. Example: 4.6 MB → 327 KB, identical image. Resampling
>   (resolution selection) was not implemented.
> - **2. GeoJSON:** `COORDINATE_PRECISION=3` (mm). Field pruning was not implemented:
>   tooltips and style fields read arbitrary attributes.
> - **5. Incremental export:** file-based OGR layers and the DEM are skipped based on
>   a fingerprint (`web/data/.planx_export_cache.json`).
> - **4. QgsTask — deferred:** accessing layers from a worker thread is not
>   safe; it should not be done without testing inside QGIS.
> - **6. Gzip — not needed:** the server is localhost-only; GitHub Pages etc.
>   already compress.
> - **3. Binary format:** lower priority now that geometry is generated in workers (Phase 2).

1. **Clip the DEM to the ROI + buffer and resample it (B6)** — `gdal.Translate`/`QgsRasterPipe` with `-projwin`, a target resolution (e.g. selectable 1–5 m), `COMPRESS=DEFLATE`, `PREDICTOR=3`, `TILED=YES`.
2. **GeoJSON shrinking** — `COORDINATE_PRECISION=2` (cm in a metric CRS), `WRITE_BBOX`, drop unused fields (`field_mappings` is already known).
3. **Binary format** — optionally pre-triangulate buildings on the server side and write them as **glTF/GLB (meshopt + Draco)** or FlatGeobuf → parse/extrude time in the browser drops to zero.
4. **Background task** — run the export with `QgsTask` so the QGIS UI does not freeze, with a progress bar and cancellation.
5. **Incremental export** — do not rewrite a layer if it has not changed (hash/mtime).
6. **Gzip/Brotli** — `server.py` should serve pre-compressed `.gz` files with `Content-Encoding`.

## Phase 4 — Visual quality: "the best in the world" (3–6 weeks)

> **Status (October 2026, first round):** 4.1, most of 4.2 and the night-window
> part of 4.3 implemented.
> - **Atmosphere (`web/src/atmosphere.js`):** "Cinematic" mode draws a physical `Sky`
>   and bakes a PMREM environment map from the same sky (re-baked when the sun moves
>   more than 1.5°). Because the frame-wide ACES washed out colors, the sky is
>   tone-mapped with exposure + ACES in its own shader; ambient lighting is
>   `envMapIntensity` 0.32 per material + ambient 0.16. The fog takes the horizon
>   color. "Clean" mode keeps the old flat presentation background (Effects menu).
> - **Post-process:** SSAOPass redrew the scene without MSAA and ignored the RenderPass.
>   It was replaced with a 4x MSAA HalfFloat target → GTAOPass (meter-scaled
>   radius, Poisson denoise) → bloom (night only) → OutputPass. It runs only on the
>   "settled" frame drawn once the camera stops; in SwiftShader the settled frame went
>   ~0.95 s → ~1.45 s (GTAO's normal/depth pass), the motion frame is unchanged.
>   Added `__planxPerf.timeComposer()`.
> - **Night windows:** the window grid of the facade texture (column/row counts,
>   phase, window rectangle) is estimated at load time from brightness profiles
>   (autocorrelation + cell mean; no metadata needed for photo or procedural
>   textures). The wall shader lights a random share of windows, equal to each building's `planxGlow`
>   ratio, with warm/cool light; bright enough to trigger bloom.
> - Remaining: TAA/SMAA (for the motion frame), DoF, glass reflection, 4.4–4.6.
>
> **Status (second round):**
> - **TAA/SMAA not needed:** motion frames are already drawn with the default framebuffer's
>   MSAA (`antialias: true`), and the still frame goes through the 4x MSAA
>   composer. The unused SMAA/SSAO files in vendor were deleted.
> - **4.4 Roofs:** `web/src/roof_skeleton.js` — straight skeleton for simple polygons
>   (kinetic wavefront; edge and split events are validated against the live front
>   when they are popped from the queue, zero-width regions become level
>   ridges). Hip/Gable now gives each eave edge its own plane at the same
>   pitch: correct ridges and valleys on L/T/U plans. Gable slides the
>   apex at the hip end along the ridge to the wall. Roof texture
>   rows run parallel to each face's eave. On failure (if the face area does not
>   fully cover the footprint) it falls back to the old single-ridge solution. Under `tests/js`:
>   square/rectangle/L/T/U/irregular cases and 200 random block tests; a stress test with 6,000
>   random polygons shows no failures. CI now runs the Python and JS unit
>   tests.
> - **Glass reflection:** the window mask (grid + window rectangle) is computed once per
>   pixel; during the day it makes the glass glossy and increases the sky reflection,
>   at night the same mask lights the windows.
> - **DoF (presentation):** Effects → Depth of field. BokehPass on the still frame;
>   the focus is the ground point at the screen center, blur follows relative depth
>   (same feel at street level and above the city). No cost when disabled.
> - **4.5 Water and vegetation:** water lines are brighter and get full sky
>   reflection (a normal map was not added because it would break merging). Optional
>   wind sway for tree crowns (vertex shader, per-tree phase, the analysis
>   wind direction); while enabled the viewer keeps drawing frames, shadows
>   stay static. Grass instancing was not done (the data model has no grass areas).
> - **4.6 WebGPU — deferred:** requires an r160 → r17x upgrade and rewriting every
>   shader patch made via `onBeforeCompile` (building batch, windows, sky,
>   wind) as TSL/node materials; the WebGL2
>   path is not a bottleneck today. It should be handled as a separate phase.

1. **Physical sky + IBL** — `Sky` → PMREM environment map; synchronized with time/latitude (latitude is already derived from the DEM). City lights + stars at night.
2. **Modern post-process chain** — **GTAO/N8AO** instead of SSAO, TAA or SMAA, ACES/AgX tone mapping, subtle bloom, height fog, DoF (presentation mode).
3. **Procedural facade shader** — floor/window grid independent of textures, randomly lit windows at night (currently `Math.random()` emissive per-material), glass reflection — all in one shader, zero extra textures.
4. **Realistic roofs** — correct hip/gable roofs for every polygon via a straight skeleton; solar panel and green roof variants.
5. **Water, vegetation** — reflective water surface, wind-swayed tree shader (vertex wind), grass instancing.
6. **WebGPU path** — optional backend via Three.js `WebGPURenderer` (r16x+); falls back to WebGL2 when unsupported. Upgrading Three.js from r160 to the current release is a prerequisite for this phase.

## Phase 5 — Killer features for planners (ongoing)

> **Status (October 2026, first round):** 5.1 (sun hours + SVF), 5.2, 5.3 (3D
> Tiles), 5.4 (view link) and the high-resolution image part of 5.5.
> - **Fix (important):** the sun was in the wrong hemisphere. The data puts north at +Z and east
>   at −X; the sun treated north as −Z and east as +X, i.e. it was rotated by 180°
>   (morning shadows fell to the east, noon shadows to the south). The compass was correct.
>   The sun, wind clouds and tree wind now share a single compass→scene
>   transform. Also, `setStatus` messages were being written to an element that is not
>   on the page; they now appear as a notification in the corner.
> - **5.1 GPU exposure analysis** (`web/src/exposure_analysis.js`): a top-down
>   height map + a depth map for each sun position (15 min) or sky direction (128,
>   cosine-weighted); accumulated into a float target with a full-screen pass.
>   Streets, squares and roofs at ~1.5 m resolution. On the sample city,
>   17 s (sun hours) / 31 s (SVF) in SwiftShader; it replaced the old 48×48 ray-traced
>   heat map. The result is draped over the scene (wall
>   triangles are discarded), with a legend and the mean. Viewshed and
>   facade analysis remain.
> - **5.2 Zoning scenarios** (`web/src/zoning_scenario.js`): the permitted massing for
>   each parcel (or block if there are none) from BCR (building coverage ratio), FAR (floor area
>   ratio), Hmax and setback distance; a comparison table against existing buildings
>   (floor area, FAR, BCR, population estimate) and color-coded masses. "Split"
>   view: existing on the left, scenario on the right, draggable divider. When the rules
>   change, only the scenario is redrawn. An A/B comparison of two scenarios
>   remains (currently existing ↔ scenario).
> - **5.3 3D Tiles 1.1 export** (`tiles_math.js`, `tiles_export.js`):
>   the QGIS export writes georeferencing into the manifest (CRS + center,
>   WGS84 control points 1 km east and 1 km north). The viewer
>   generates GLB + tileset.json in 800 m tiles and zips them; root transform:
>   affine fit → meridian convergence/scale → WGS84 ENU→ECEF. Trees use
>   EXT_mesh_gpu_instancing. There is a height offset field for the geoid. Tests:
>   < 10 cm against UTM; the GLBs pass the Khronos glTF validator without errors.
>   CityJSON and the Google Photorealistic 3D Tiles context remain.
> - **5.4 View link:** the camera (+ time) is stored in the URL hash (`#view=`) and copied with
>   "Copy view link"; opening the link goes to that view.
>   GitHub/GitLab Pages publishing remains.
> - **5.5 High-resolution image:** screen / 2x / 4K / 8K; screen-sized
>   tiles (`setViewOffset`) are stitched together, with no seams. 4K MP4 (WebCodecs)
>   remains.
> - **Remaining:** 5.6 WebXR, 5.7 in-QGIS preview panel.
>
> **Status (second round) — the rest of Phase 5:**
> - **Viewshed:** Analysis → "Viewshed from a point", then click an observer
>   point in the scene; at eye height (1.6 m), six 90°
>   depth views (a cube) mark every street/square/roof within the radius as
>   visible/not visible, with the visible share in the legend. Same GPU pipeline,
>   with a linear distance test for the perspective views.
> - **Two-scenario comparison:** rule set B (BCR, FAR, Hmax, setback)
>   and "Split: B | A"; table shows existing / A / B.
> - **Fix:** zoning envelopes (Show Zoning Envelopes) were never drawn
>   (a list of polygons was passed where a single polygon was expected); each part now sits on its own ground level.
> - **CityJSON 2.0:** buildings as LoD1 solids (courtyards and multi-part buildings as
>   MultiSolid), in the export CRS, with their attributes. Tests check for closed and
>   outward-facing shells; the sample output validates against the CityJSON 2.0.2 schema
>   without errors, and cjio reads it.
> - **MP4 tour video:** each keyframe tour frame is drawn at its own time (t = i/fps),
>   encoded in the browser with WebCodecs and muxed into MP4
>   (mp4-muxer, MIT), with captions burned into the frames; 720p / 1080p / 4K.
>   Falls back to VP9/AV1 (inside MP4) if H.264 is unavailable. Test: 180 frames, 6 s, ffmpeg decodes
>   it without errors.
> - **Static publishing:** the portable package has index.html at its root (#view= is preserved),
>   .nojekyll and .gitlab-ci.yml, so it can be uploaded as-is to GitHub/GitLab Pages and
>   Netlify; the README describes the steps.
> - **WebXR:** "Enter VR" when the browser supports immersive VR; starts at street
>   level in the current viewing direction, with controller teleportation.
>   Without a headset, only the button/fallback was tested.
> - **In-QGIS preview + live selection:** "3D preview
>   panel" in the plugin menu; the viewer runs inside QGIS if QtWebEngine is available, otherwise in the browser.
>   Selection is bidirectional: a building selected in QGIS is highlighted orange in 3D and
>   brought into the camera view; a building clicked in the viewer is selected in QGIS and the map
>   pans to it. Matching is by location (point in polygon, export CRS),
>   no ID required. The server-side bridge has Python tests; the end-to-end test
>   was run against the real PlanX server. The QGIS panel itself was not
>   tried, since QGIS is not available here.

1. **Real-time analyses (GPU)** — sky view factor (SVF), sun hours heat map (21 December / 21 June), viewshed, shadow duration — all within seconds via GPU render-to-texture.
2. **Zoning scenarios** — "what if" mode with BCR/FAR/Hmax parameters; A/B scenario comparison with a slider (split-screen).
3. **3D Tiles / CityGML / CityJSON import/export** — OGC 3D Tiles 1.1 output (compatible with Cesium, ArcGIS, Unreal); Google Photorealistic 3D Tiles context layer (API key supplied by the user).
4. **Sharing** — one-click static web package (ZIP already exists) + GitHub/GitLab Pages publishing; embed the camera state in the scene URL.
5. **Video/image output** — 4K MP4 from the keyframe tour (WebCodecs), high-resolution tiled screenshot (8K+).
6. **VR/AR** — walk through the scene with WebXR (Quest browser).
7. **In-QGIS preview** — `QWebEngineView` panel; the object selected in QGIS is highlighted in 3D (bidirectional sync).

## Phase 6 — Engineering infrastructure (should start in parallel with Phase 1)

> **Status (October 2026, first round):**
> - **6.4 Lint + type checking:** `package.json` (development only; not included in the
>   plugin zip) pins ESLint, TypeScript and Playwright versions.
>   ESLint found a duplicate color key ('Olive') and dead code (91 lines
>   deleted). `tsc --checkJs` checks the 16+ modules marked with `// @ts-check` against their
>   JSDoc types (vendor libraries are treated as untyped).
> - **6.2 Benchmark in CI:** deterministic 1000-building city; if draw
>   calls, triangle or mesh counts rise more than 10% above the baseline, CI turns red
>   (`tests/bench/baseline.json`); timings are reported, and only a 3×
>   slowdown turns it red (CI machines vary).
> - **6.3 Visual regression:** four fixed cameras (day, street, night,
>   Clean), captured directly from the WebGL canvas (no UI/fonts), traffic/people
>   and GTAO disabled (no randomness); 24-level / 1.5% pixel tolerance,
>   diff images as CI artifacts. Pixel-identical across consecutive runs.
> - **6.1 Splitting app.js (first round):** 11,157 → 9,691 lines; code moved as-is
>   into the `ui_text.js`, `catalog.js`, `geo.js`, `props.js`, `textures.js`
>   modules (no circular imports: the field mapping and anisotropy are
>   injected). Visual tests pixel-identical, structural metrics unchanged.
>
> **Status (October 2026, second round — Phase 6 complete):**
> - **6.1 Splitting app.js (done):** 9,691 → ~900 lines (only startup, walk
>   mode and the frame loop). 50 variables modified by more than one module
>   (scene center, loaded data, terrain, traffic data, interaction modes)
>   moved into the `state` object in `core/state.js`; objects mutated in place
>   (scene, layer groups, settings) are exported as constants from their own
>   modules. New folders: `core/` (scene, state, settings,
>   rendering, data loading, scene build, scene state sync, model
>   store), `terrain/`, `layers/` (buildings, ground, trees, monuments, street furniture,
>   transport, zoning, emissions, environment), `analysis/`, `ui/` (docks, Model
>   Studio, tour, selection, view links, export, recording, minimap,
>   dashboard, bookmarks, QGIS link). No circular imports:
>   the scene build calls the UI through hooks (`setSceneBuildHooks`), and saving
>   settings calls the scene state sync via `setAfterSave`. The move was
>   done with a tool based on scope analysis (code text moved verbatim);
>   visual tests pixel-identical, structural metrics unchanged.
> - **UI smoke test (`tests/smoke`, in CI):** opens every dock, changes each
>   dock setting, runs the sun/sky/viewshed analyses, the scenario
>   views, bookmarks, the tour editor, Model Studio, building
>   selection, screenshots, CityJSON and 3D Tiles export;
>   red on any page or console error. During the split, this test caught
>   broken `import()` paths that resolve relative to the module path;
>   a unit test now checks all relative
>   imports. The benchmark data also carries georeferencing (so 3D Tiles
>   export can be tested).
> - The two remaining non-English code comments were translated.

1. **Split `app.js` into modules** — `scene/`, `layers/buildings.js`, `layers/terrain.js`, `analysis/`, `ui/`, `workers/`. Native ES modules + an import map, with no build tool required (the existing "no Node.js required" principle is preserved).
2. **Benchmark scene** — deterministic 1k / 10k / 100k-building data from `sample_generator.py`; FPS, draw call and startup time measurement in CI with Playwright + headless Chromium (a new job in `.github/workflows/quality.yml`). Red if the regression exceeds 10%.
3. **Visual regression tests** — screenshot comparison from a fixed camera.
4. **JS lint** (ESLint) and type checking (JSDoc + `tsc --checkJs`) in CI.

---

## Prioritization (impact / effort)

| Priority | Work item | Impact | Effort |
|---|---|---|---|
| P0 | Building batching + material cache (F1.1) | ★★★★★ | Medium |
| P0 | On-demand render (F1.2) | ★★★★ | Low |
| P0 | Parallel loading (F1.4) | ★★★ | Very low |
| P0 | Benchmark + perf HUD (F6.2, F1.7) | ★★★★ (you cannot speed up what you do not measure) | Low |
| P1 | Worker pipeline (F2.1) | ★★★★ | Medium |
| P1 | DEM clipping + GeoJSON precision (F3.1–3.2) | ★★★★ | Low |
| P1 | BVH raycast (F1.5) | ★★★ | Low |
| P1 | KTX2 + texture atlas (F2.5) | ★★★ | Medium |
| P2 | Tiling + LOD, CSM, terrain LOD | ★★★★ | High |
| P2 | Visual quality package (Phase 4) | ★★★★ | High |
| P3 | 3D Tiles, WebXR, WebGPU, in-QGIS preview | ★★★ | High |

## Success criteria (v2.0)

- 10k buildings: ≥ 60 FPS (Intel Iris Xe), startup < 3 s
- 100k buildings: ≥ 30 FPS, the UI never freezes
- Idle GPU usage ≈ 0%
- Export size ≥ 5× smaller than in the first release
- The zero-external-dependency rule is preserved (no Node.js / pip packages)

## Recommended first sprint (PR order)

1. Perf HUD + benchmark data generator (measurement baseline)
2. Parallel `loadGeoJson` + on-demand render + disabling `preserveDrawingBuffer`
3. Material cache + building/slab geometry merging + `feature_id`-based selection
4. DEM ROI clipping + GeoJSON coordinate precision
5. Raycast and shadow heat map acceleration with `three-mesh-bvh`
