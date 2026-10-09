// @ts-check
// Shared mutable viewer state: the values that several modules read and
// replace (scene origin, loaded data, terrain, live layer data, interaction
// modes). Objects that are only mutated in place (the scene, layer groups,
// settings) are exported as constants by their own modules instead.
export const state = {
  // --- Scene origin and loaded data ---
  // Projected coordinates of the local origin (scene centre).
  centerX: 0,
  centerY: 0,
  /** @type {any} */ bounds: null,
  /** @type {any} */ layerDataCache: null,
  /** @type {any} */ projectManifest: null,
  manifestDefaultsApplied: false,
  // Incremented per scene build; a build that sees a newer token stops.
  sceneBuildToken: 0,
  // Building footprints by record id (projected outer ring, bbox, centre), to
  // match QGIS selection points and to report viewer clicks.
  /** @type {any[]} */ buildingFootprints: [],

  // --- Terrain ---
  /** @type {any} */ demSampler: null,
  demReady: false,
  demLoadingStarted: false,
  /** @type {any} */ terrainMesh: undefined,
  /** @type {any} */ terrainTexture: null,
  /** @type {any} */ baseMapTexture: null,
  /** @type {any} */ terrainOverlayMesh: null,
  terrainHeightStats: { min: 0, max: 0, avg: 0, p02: 0, p98: 0 },
  /** @type {any} */ terrainSurfaceCache: null,
  // Sun hours / sky view / viewshed drape.
  /** @type {any} */ shadowHeatmapMesh: null,

  // --- Live layer data (traffic, people, bikes) ---
  /** @type {any[]} */ roadCurves: [],
  /** @type {any[]} */ vehicleRoadCurves: [],
  /** @type {any[]} */ bikeLaneCurves: [],
  /** @type {any[]} */ pedestrianPathCurves: [],
  /** @type {any[]} */ cars: [],
  /** @type {any[]} */ bikes: [],
  /** @type {any[]} */ pedestrians: [],

  // --- Models ---
  /** @type {any} */ cachedDefaultMosqueModel: null,
  /** @type {any} */ cachedDefaultTreeModel: null,
  /** @type {any} */ cachedDefaultTumulusModel: null,
  /** @type {any[]} */ mosqueCustomizations: [],
  /** @type {any[]} */ tumulusCustomizations: [],

  // --- Interaction ---
  isWalkMode: false,
  isGameMode: false,
  lastCameraMove: 0,
  /** @type {any} */ hoveredBuilding: null,
  // Split scenario view: share of the width left of the divider.
  splitFraction: 0.5,
  // Viewshed point picking: the next click on the scene sets the observer.
  viewshedPicking: false,
  isRecording: false,
  // While a video is being rendered frame by frame, or a VR headset drives
  // the frames, the live loop stands by.
  videoExporting: false,
  xrActive: false,
  // A view link (#view=...) is applied once, when the first scene is ready.
  initialViewApplied: false,
  // Fly-to animation (bookmarks, view links, QGIS selection).
  /** @type {any} */ flyOrigin: null,
  /** @type {any} */ flyTarget: null,
  /** @type {any} */ flyControlsTarget: null,
  flyT: 1.0,

  // --- On-demand rendering ---
  // Frames are drawn until this time (performance.now()).
  renderKeepAliveUntil: 0,
  // The settled (post-processed) frame has been drawn.
  composerSettled: false,
  portableSceneState: null,
  solar: { elevationDeg: 30, azimuthDeg: 180 },
  // --- Model Studio Integration Logic & UI rendering ---
  uploadedModelsLoaded: false,
};
