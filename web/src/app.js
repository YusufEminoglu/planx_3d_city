import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

let currentLang = 'TR';
const i18n = {
  TR: {
    guiTitle: 'Kentsel Kontroller',
    env: 'Çevre', fog: 'Sis', sunDir: 'Güneş Yönü', sunElev: 'Güneş Yük.',
    terrain: 'Zemin & Yüzey', pavement: 'Yol Kaplaması', showHardscape: 'Sert Zemin Göster',
    hardTex: 'Sert Zemin Dokusu', hardH: 'Sert Zemin Yüksekliği', islCol: 'Ada Rengi', islTex: 'Ada Dokusu',
    parcels: 'Parseller', showParcels: 'Parselleri Göster', boundCol: 'Sınır Rengi', boundOp: 'Sınır Opaklığı',
    bld: 'Binalar', floorH: 'Kat Yüksekliği (m)', roofShape: 'Çatı Tipi', roofTex: 'Çatı Dokusu', roofH: 'Çatı Yüksekliği (m)',
    roads: 'Yollar & Trafik', showCars: 'Arabaları Göster', showRoads: 'Yolları Göster', roadCol: 'Yol Rengi',
    roadW: 'Yol Genişliği', trafficSpd: 'Trafik Hızı',
    funcCol: 'Kullanım Renkleri', funcFac: 'Kullanım Cepheleri',
    demWait: 'DEM bekleniyor...', demFail: 'DEM yüklenemedi. Düz zeminle devam.',
    loadingData: 'Veri yükleniyor...', processing: 'Katmanlar işleniyor...',
    clickDesc: 'Fonksiyon: {f} <br> Kat: {k} <br> Nizam: {n}',
    htmlTitle: '🏛️ PlanX 3D City',
    htmlDesc: 'Gerçekçi kentsel görselleştirme. DEM yükselti, bina, yol ve ağaç katmanları.',
    help1: 'Sol tık + sürükle: Döndür', help2: 'Scroll: Yakınlaştır / Uzaklaştır',
    help3: 'Sağ tık + sürükle: Kaydır', help4: 'Binaya tıkla: Bilgi göster',
    statsTitle: 'Alan İstatistikleri',
    statBld: 'Toplam Bina:', statBlock: 'Ada:', statParcel: 'Parsel:', statFlr: 'Ort. Kat:',
    carDensity: 'Araç Yoğunluğu', 
    sfFolder: 'Sokak Elemanları', sfLights: 'Aydınlatma', sfBenches: 'Banklar', sfBins: 'Çöp Kutuları', sfStops: 'Duraklar',
    fxFolder: 'Zaman & Efektler', timeOfDay: 'Zaman (Saat)', sSsa: 'SSAO (Gölgeler)', sBloom: 'Bloom (Parlama)',
    pedDensity: 'Yaya Yoğunluğu',
    weather: 'Hava Durumu',
    showSidewalks: 'Kaldırımlar', showCrosswalks: 'Yaya Geçitleri',
    binaInfo: 'Bina Bilgisi', biFonk: 'Fonksiyon', biKat: 'Kat Sayısı', biNiz: 'Nizam', biAlan: 'Alan',
    sapanMode: 'Sapan Modu', sapanHit: 'Vuruş! +1', sapanScoreLbl: 'Skor',
    autoTime: '⏱ Güneş Animasyonu', autoTimeSpd: 'Hız (sa/s)',
    minimap: 'Mini Harita'
  },
  EN: {
    guiTitle: 'Urban Controls',
    env: 'Environment', fog: 'Fog', sunDir: 'Sun Direction', sunElev: 'Sun Elevation',
    terrain: 'Terrain & Base', pavement: 'Pavement', showHardscape: 'Show Hardscape',
    hardTex: 'Hardscape Texture', hardH: 'Hardscape Height', islCol: 'Island Color', islTex: 'Island Texture',
    parcels: 'Parcels', showParcels: 'Show Parcels', boundCol: 'Boundary Color', boundOp: 'Boundary Opacity',
    bld: 'Buildings', floorH: 'Floor Height (m)', roofShape: 'Roof Shape', roofTex: 'Roof Texture', roofH: 'Roof Height (m)',
    roads: 'Roads & Traffic', showCars: 'Show Cars', showRoads: 'Show Roads', roadCol: 'Road Color',
    roadW: 'Road Width', trafficSpd: 'Traffic Speed',
    funcCol: 'Function Colors', funcFac: 'Function Facades',
    demWait: 'Waiting for DEM...', demFail: 'DEM failed. Using flat terrain.',
    loadingData: 'Loading data...', processing: 'Processing layers...',
    clickDesc: 'Function: {f} <br> Floor: {k} <br> Type: {n}',
    htmlTitle: '🏛️ PlanX 3D City',
    htmlDesc: 'Realistic urban visualization with DEM elevation, buildings, roads, and tree layers.',
    help1: 'Left click + drag: Orbit', help2: 'Scroll: Zoom in / out',
    help3: 'Right click + drag: Pan', help4: 'Click building: Show info',
    statsTitle: 'Area Statistics',
    statBld: 'Total Buildings:', statBlock: 'Blocks:', statParcel: 'Parcels:', statFlr: 'Avg Floors:',
    carDensity: 'Car Density', 
    sfFolder: 'Street Furniture', sfLights: 'Lights', sfBenches: 'Benches', sfBins: 'Trash Bins', sfStops: 'Bus Stops',
    fxFolder: 'Time & Effects', timeOfDay: 'Time of Day', sSsa: 'SSAO (Shadows)', sBloom: 'Bloom (Glow)',
    pedDensity: 'Pedestrian Density',
    weather: 'Weather',
    showSidewalks: 'Sidewalks', showCrosswalks: 'Crosswalks',
    binaInfo: 'Building Info', biFonk: 'Function', biKat: 'Floors', biNiz: 'Type', biAlan: 'Area',
    sapanMode: 'Slingshot Mode', sapanHit: 'Hit! +1', sapanScoreLbl: 'Score',
    autoTime: '⏱ Solar Animation', autoTimeSpd: 'Speed (h/s)',
    minimap: 'Minimap'
  }
};
function t(key) { return i18n[currentLang][key]; }

Object.assign(i18n.TR, {
  dockLayers: 'Katmanlar', dockScene: 'Sahne', dockStyle: 'Stil', dockMobility: 'Hareketlilik',
  dockFurniture: 'Kent Mobilyalari', dockAnalysis: 'Analiz',
  lblRoads: 'Yollar', lblSidewalks: 'Kaldirimlar', lblCrosswalks: 'Yaya gecitleri',
  lblParcels: 'Parseller', lblHardscape: 'Sert zemin', lblBuildings: 'Binalar',
  lblTrees: 'Agaclar', lblFurniture: 'Kent mobilyalari', lblCars: 'Araclar', lblPedestrians: 'Yayalar',
  lblPlanTexture: 'Plan texture', lblTextureOpacity: 'Texture opakligi',
  lblTextureBrightness: 'Texture parlakligi', lblTextureContrast: 'Texture kontrasti',
  lblModelBase: 'ROI model altligi', lblSideDrop: 'Altlik dususu', lblSideColor: 'Altlik rengi',
  lblDemQuality: 'DEM mesh kalitesi', lblFog: 'Sis', lblTime: 'Zaman',
  lblAutoTime: 'Gunes animasyonu', lblAutoTimeSpeed: 'Animasyon hizi',
  lblWeather: 'Hava', lblSSAO: 'Golge kalitesi', lblBloom: 'Bloom/parlama',
  lblIslandColor: 'Ada rengi', lblIslandTexture: 'Ada dokusu',
  lblParcelColor: 'Parsel sinir rengi', lblParcelOpacity: 'Parsel sinir opakligi',
  lblRoadColor: 'Yol rengi', lblRoadStyle: 'Yol dokusu', lblPavementStyle: 'Zemin dokusu',
  lblHardscapeStyle: 'Sert zemin dokusu', lblHardscapeHeight: 'Sert zemin yuksekligi',
  lblBuildingMode: 'Bina modu', lblTerrainAnalysis: 'Topoğrafya görünümü', lblAssetTheme: 'Asset theme',
  lblXyzTiles: 'QGIS basemap altligi', lblXyzUrl: 'XYZ URL sablonu',
  lblFloorHeight: 'Kat yuksekligi', lblRoofShape: 'Cati tipi', lblRoofHeight: 'Cati yuksekligi',
  lblRoofTexture: 'Cati dokusu', lblFunctionStyles: 'Kullanim renkleri ve cepheleri',
  lblRoadAnalysis: 'Yol analizi', lblRoadWidth: 'Yol genisligi',
  lblTrafficSpeed: 'Trafik hizi', lblCarDensity: 'Arac yogunlugu', lblPedDensity: 'Yaya yogunlugu',
  lblLights: 'Aydinlatmalar', lblLightStyle: 'Aydinlatma tipi', lblBenches: 'Banklar',
  lblBenchStyle: 'Bank tipi', lblBins: 'Cop kutulari', lblBinStyle: 'Cop kutusu tipi',
  lblStops: 'Duraklar', lblStopStyle: 'Durak tipi', lblWindPlumes: 'Ruzgar etki zonu',
  lblWindDirection: 'Ruzgar yonu', lblPlumeDistance: 'Etki mesafesi',
  lblSolarReview: 'Solar inceleme', lblUrbanComfort: 'Kentsel konfor taramasi',
  analysisNote: 'Planlama taramasi / tasarim kontrolu. Bu katmanlar muhendislik simulasyonu degildir.'
});

Object.assign(i18n.EN, {
  dockLayers: 'Layers', dockScene: 'Scene', dockStyle: 'Style', dockMobility: 'Mobility',
  dockFurniture: 'Street Furniture', dockAnalysis: 'Analysis',
  lblRoads: 'Roads', lblSidewalks: 'Sidewalks', lblCrosswalks: 'Crosswalks',
  lblParcels: 'Parcels', lblHardscape: 'Hardscape', lblBuildings: 'Buildings',
  lblTrees: 'Trees', lblFurniture: 'Street furniture', lblCars: 'Cars', lblPedestrians: 'Pedestrians',
  lblPlanTexture: 'Plan texture', lblTextureOpacity: 'Texture opacity',
  lblTextureBrightness: 'Texture brightness', lblTextureContrast: 'Texture contrast',
  lblModelBase: 'ROI model base', lblSideDrop: 'Base drop', lblSideColor: 'Base color',
  lblDemQuality: 'DEM mesh quality', lblFog: 'Fog', lblTime: 'Time',
  lblAutoTime: 'Solar animation', lblAutoTimeSpeed: 'Animation speed',
  lblWeather: 'Weather', lblSSAO: 'Shadow quality', lblBloom: 'Bloom/glow',
  lblIslandColor: 'Block color', lblIslandTexture: 'Block texture',
  lblParcelColor: 'Parcel boundary color', lblParcelOpacity: 'Parcel boundary opacity',
  lblRoadColor: 'Road color', lblRoadStyle: 'Road texture', lblPavementStyle: 'Ground texture',
  lblHardscapeStyle: 'Hardscape texture', lblHardscapeHeight: 'Hardscape height',
  lblBuildingMode: 'Building mode', lblTerrainAnalysis: 'Topography view', lblAssetTheme: 'Asset theme',
  lblXyzTiles: 'QGIS basemap texture', lblXyzUrl: 'XYZ URL template',
  lblFloorHeight: 'Floor height', lblRoofShape: 'Roof shape', lblRoofHeight: 'Roof height',
  lblRoofTexture: 'Roof texture', lblFunctionStyles: 'Function colors and facades',
  lblRoadAnalysis: 'Road analysis', lblRoadWidth: 'Road width',
  lblTrafficSpeed: 'Traffic speed', lblCarDensity: 'Car density', lblPedDensity: 'Pedestrian density',
  lblLights: 'Lights', lblLightStyle: 'Light style', lblBenches: 'Benches',
  lblBenchStyle: 'Bench style', lblBins: 'Trash bins', lblBinStyle: 'Trash bin style',
  lblStops: 'Bus stops', lblStopStyle: 'Bus stop style', lblWindPlumes: 'Wind impact zone',
  lblWindDirection: 'Wind direction', lblPlumeDistance: 'Impact distance',
  lblSolarReview: 'Solar review', lblUrbanComfort: 'Urban comfort screening',
  analysisNote: 'Planning screening / design review. These overlays are not engineering simulation.'
});


const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcee4ef);
scene.fog = new THREE.FogExp2(0xcee4ef, 0.0003);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(0, 420, 580);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('map').appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById('map').appendChild(labelRenderer.domElement);

const renderPass = new RenderPass(scene, camera);
const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 8;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);

const composer = new EffectComposer(renderer);
composer.addPass(renderPass);
composer.addPass(ssaoPass);
composer.addPass(bloomPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.addEventListener('change', () => { _lastCameraMove = performance.now(); sun.shadow.needsUpdate = true; });

const walkControls = new PointerLockControls(camera, document.body);
let isWalkMode = false;
let isGameMode = false;
let gameScore = 0;
const stoneProjectiles = []; // { mesh, velocity, life }
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let sprintWalk = false;
let crouchWalk = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

const ambient = new THREE.AmbientLight(0xffffff, 0.62);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.25);
sun.castShadow = true;
sun.shadow.autoUpdate = false;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -1600;
sun.shadow.camera.right = 1600;
sun.shadow.camera.top = 1600;
sun.shadow.camera.bottom = -1600;
scene.add(sun);

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const texLoader = new THREE.TextureLoader();
const world = new THREE.Group();
scene.add(world);

let terrainMesh;
let islandGroup = new THREE.Group();
let parcelGroup = new THREE.Group();
let hardscapeGroup = new THREE.Group();
let buildingGroup = new THREE.Group();
let roadGroup = new THREE.Group();
let treeGroup = new THREE.Group();
let carGroup = new THREE.Group();
let furnitureGroup = new THREE.Group();
let pedestrianGroup = new THREE.Group();
let sidewalkGroup = new THREE.Group();
let crosswalkGroup = new THREE.Group();
let terrainSideGroup = new THREE.Group();
let windPlumeGroup = new THREE.Group();
let roiBoundaryGroup = new THREE.Group();
world.add(islandGroup);
world.add(parcelGroup);
world.add(hardscapeGroup);
world.add(buildingGroup);
world.add(sidewalkGroup);
world.add(crosswalkGroup);
world.add(terrainSideGroup);
world.add(windPlumeGroup);
world.add(roadGroup);
world.add(treeGroup);
world.add(carGroup);
world.add(furnitureGroup);
world.add(pedestrianGroup);
world.add(roiBoundaryGroup);

/* ── Layer Elevation Hierarchy ─────────────────────────────────
 *  DEM  <  DEM Texture  <  Adalar  <  Parcels=Buildings=Hardscape=Trees  <  Roads  <  Cars
 *  Each layer offset is relative to the DEM terrain surface.
 */
const LAYER = {
  island:   0.25,   // Adalar – DEM üzerinde
  content:  0.40,   // Yapılar, Sert Zemin, Ağaçlar, Kent Mobilyaları
  parcel:   0.55,   // Parsel sınırları – adaların üzerinde net görünür
  road:     0.55,   // Yollar – içerik üzerinde
  carExtra: 0.60    // Arabalar – yol üzerinde ekstra
};
LAYER.carExtra = 0.08;

let centerX = 0;
let centerY = 0;
let bounds = null;
let demSampler = null;
let demReady = false;
let demLoadingStarted = false;
let layerDataCache = null;
let projectManifest = null;
let terrainTexture = null;
let baseMapTexture = null;
let roadCurves = [];
let vehicleRoadCurves = [];
let cars = [];
let pedestrians = [];
let buildingFunctionMaterials = new Map();
let manifestDefaultsApplied = false;
let terrainHeightStats = { min: 0, max: 0, avg: 0, p02: 0, p98: 0 };

// --- Performance ---
const rc = new THREE.Raycaster();
rc.firstHitOnly = true;
let _lastCameraMove = 0;
let _lastSSAORender = 0;
let isRecording = false;

// --- Hover / highlight ---
let _hoveredBldg = null;
const _hovEmissive = new THREE.Color();
let _hovEmissiveIntensity = 0;

// --- Fly-to ---
let _flyOrigin = null;
let _flyTarget = null;
let _flyControlsTarget = null;
let _flyT = 1.0;

// --- Minimap ---
let _mmBg = null;           // pre-rendered static canvas
let _mmScale = 1, _mmOx = 0, _mmOy = 0;
const _mmW = 160, _mmH = 160;
let _mmLastUpdate = 0;

function _mmPx(lx, lz) {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  return [_mmOx + (lx + w * 0.5) * _mmScale, _mmOy + (h * 0.5 - lz) * _mmScale];
}

function rebuildMinimapBg() {
  if (!bounds || !layerDataCache) return;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  _mmScale = Math.min(_mmW, _mmH) * 0.86 / Math.max(w, h);
  _mmOx = (_mmW - w * _mmScale) / 2;
  _mmOy = (_mmH - h * _mmScale) / 2;

  const bg = document.createElement('canvas');
  bg.width = _mmW; bg.height = _mmH;
  const ctx = bg.getContext('2d');

  ctx.fillStyle = '#0d1425';
  ctx.fillRect(0, 0, _mmW, _mmH);

  // ROI outline
  if (layerDataCache.roi) {
    ctx.strokeStyle = 'rgba(239,68,68,0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    for (const f of layerDataCache.roi.features) {
      const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of rings) {
        for (const ring of poly) {
          ctx.beginPath();
          ring.forEach(([cx, cy], i) => {
            const [lx, lz] = metersToLocal(cx, cy);
            const [mx, my] = _mmPx(lx, lz);
            i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
          });
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);
  }

  // Island blocks
  for (const f of layerDataCache.adalar.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      const ring = poly[0]; if (!ring) continue;
      const fn = ((f.properties?.uipfonksiyon || f.properties?.arazi_kull || '')).toString().toUpperCase();
      ctx.fillStyle = fn.includes('PARK') || fn.includes('YEŞİL') ? 'rgba(30,90,45,0.65)' : 'rgba(155,155,150,0.45)';
      ctx.beginPath();
      ring.forEach(([cx, cy], i) => {
        const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      });
      ctx.closePath(); ctx.fill();
    }
  }

  // Roads
  ctx.strokeStyle = '#222a38'; ctx.lineWidth = 1.2;
  for (const f of layerDataCache.yollar.features) {
    if (f.geometry?.type !== 'LineString') continue;
    ctx.beginPath();
    f.geometry.coordinates.forEach(([cx, cy], i) => {
      const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
      i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
    });
    ctx.stroke();
  }

  // Buildings (colored by function)
  for (const f of layerDataCache.yapilar.features) {
    const fn = (f.properties?.uipfonksiyon || 'BELIRSIZ').toString();
    ctx.fillStyle = functionColorState[fn] || '#94a3b8';
    for (const poly of getPolygonRings(f.geometry)) {
      const ring = poly[0]; if (!ring) continue;
      ctx.beginPath();
      ring.forEach(([cx, cy], i) => {
        const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      });
      ctx.closePath(); ctx.fill();
    }
  }

  // Trees
  ctx.fillStyle = '#4ade80';
  for (const f of layerDataCache.agaclar.features) {
    if (f.geometry?.type !== 'Point') continue;
    const [lx, lz] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
    const [mx, my] = _mmPx(lx, lz);
    ctx.beginPath(); ctx.arc(mx, my, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  _mmBg = bg;
}

function updateMinimapCamera() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas || !_mmBg) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, _mmW, _mmH);
  ctx.drawImage(_mmBg, 0, 0);

  const [cmx, cmy] = _mmPx(camera.position.x, camera.position.z);
  if (cmx < -10 || cmy < -10 || cmx > _mmW + 10 || cmy > _mmH + 10) return;

  // Camera direction arrow
  const cDir = new THREE.Vector3();
  camera.getWorldDirection(cDir);
  const arrowLen = 10;
  const ax = cDir.x, ay = -cDir.z; // canvas Y: south = positive
  const norm = Math.sqrt(ax * ax + ay * ay);

  ctx.save();
  ctx.translate(cmx, cmy);
  if (norm > 0.01) {
    // FOV indicator
    const ang = Math.atan2(ay, ax);
    ctx.fillStyle = 'rgba(56,189,248,0.10)';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 16, ang - 0.55, ang + 0.55);
    ctx.closePath(); ctx.fill();
    // Arrow
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(ax / norm * arrowLen, ay / norm * arrowLen);
    ctx.stroke();
  }
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// --- Scale bar ---
let _sbLastUpdate = 0;
function updateScaleBar() {
  const bar = document.getElementById('scale-bar');
  if (!bar || isWalkMode) { if (bar) bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const dist = camera.position.distanceTo(controls.target);
  let m = 500;
  if (dist < 600) m = 200;
  if (dist < 250) m = 100;
  if (dist < 120) m = 50;
  if (dist < 60)  m = 20;
  if (dist < 25)  m = 10;

  const tgt = controls.target.clone();
  const right = new THREE.Vector3();
  camera.getWorldDirection(right);
  right.cross(new THREE.Vector3(0, 1, 0)).normalize();
  const p2 = tgt.clone().addScaledVector(right, m);
  const v1 = tgt.project(camera);
  const v2 = p2.project(camera);
  const px = Math.abs(v2.x - v1.x) * window.innerWidth / 2;

  const line = document.getElementById('scale-line');
  const label = document.getElementById('scale-label');
  if (line) line.style.width = Math.max(20, px) + 'px';
  if (label) label.textContent = m >= 1000 ? `${m / 1000}km` : `${m}m`;
}
const functionColorState = {};
const functionFacadeState = {};

const textureSets = {
  pavement: {
    Asphalt: null,
    StoneA: 'assets/pavement.png',
    StoneB: 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg',
    Grid: 'https://threejs.org/examples/textures/uv_grid_opengl.jpg'
  },
  road: {
    Plain: null,
    Asphalt: 'Asphalt',
    Cobblestone: 'assets/pavement.png'
  },
  island: {
    None: null,
    SoftNoise: 'SoftNoise',
    FineGrid: 'FineGrid'
  },
  hardscape: {
    Cobble: 'assets/pavement.png',
    Concrete: 'https://threejs.org/examples/textures/brick_bump.jpg',
    Tile: 'https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg'
  },
  facade: {
    UrbanA: 'assets/facade.png',
    UrbanB: 'assets/facade2.png',
    UrbanC: 'assets/facade3.png',
    UrbanD: 'assets/facade4.png'
  },
  roof: {
    RoofA: 'assets/roof.png',
    RoofB: 'https://threejs.org/examples/textures/brick_diffuse.jpg',
    RoofC: 'https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
    RoofD: 'https://threejs.org/examples/textures/planets/moon_1024.jpg',
    GermanTile: 'GermanTile',
    TurkishTile: 'TurkishTile',
    USShingle: 'USShingle'
  }
};

const assetThemePresets = {
  'Modern Urban': {
    pedestrians: ['Commuter', 'Urban Casual', 'Office', 'Student', 'Evening'],
    cars: ['Graphite', 'Slate', 'Teal', 'White', 'Navy'],
    trees: ['Street Linden', 'Plane', 'Compact Maple', 'Columnar'],
    lights: ['Modern Arc', 'Dual Head', 'Slim Post', 'Classic Post'],
    benches: ['Wood Plank', 'Concrete Slab', 'Curved Metal', 'Slim Urban'],
    bins: ['Square Box', 'Dual Recycle', 'Cylinder', 'Compact'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy', 'Wood Cabin'],
    facades: ['UrbanA', 'UrbanB', 'UrbanC', 'UrbanD'],
    roofs: ['RoofA', 'RoofB', 'GermanTile', 'USShingle'],
    paving: ['Asphalt', 'StoneA', 'Cobble', 'Concrete']
  },
  Mediterranean: {
    pedestrians: ['Casual Linen', 'Warm Neutral', 'Student', 'Visitor'],
    cars: ['Ivory', 'Terracotta', 'Olive', 'Slate'],
    trees: ['Olive', 'Cypress', 'Plane', 'Palm'],
    lights: ['Classic Post', 'Modern Arc', 'Slim Post'],
    benches: ['Wood Plank', 'Curved Metal', 'Stone Seat'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle'],
    busstops: ['Minimal Canopy', 'Wood Cabin', 'Glass Shelter'],
    facades: ['UrbanB', 'UrbanD', 'UrbanA'],
    roofs: ['TurkishTile', 'GermanTile', 'RoofA'],
    paving: ['StoneA', 'Cobble', 'Concrete']
  },
  Campus: {
    pedestrians: ['Student', 'Academic', 'Sport', 'Visitor'],
    cars: ['Slate', 'Navy', 'White', 'Graphite'],
    trees: ['Plane', 'Pine', 'Compact Maple', 'Street Linden'],
    lights: ['Slim Post', 'Modern Arc', 'Dual Head'],
    benches: ['Wood Plank', 'Concrete Slab', 'Slim Urban'],
    bins: ['Dual Recycle', 'Square Box', 'Compact'],
    busstops: ['Glass Shelter', 'Minimal Canopy'],
    facades: ['UrbanC', 'UrbanA', 'UrbanB'],
    roofs: ['RoofA', 'RoofC', 'USShingle'],
    paving: ['Concrete', 'StoneA', 'Asphalt']
  },
  Eco: {
    pedestrians: ['Outdoor', 'Casual Green', 'Student', 'Visitor'],
    cars: ['Teal', 'Olive', 'White', 'Slate'],
    trees: ['Broadleaf', 'Pine', 'Street Linden', 'Compact Maple'],
    lights: ['Slim Post', 'Modern Arc', 'Classic Post'],
    benches: ['Wood Plank', 'Stone Seat', 'Concrete Slab'],
    bins: ['Dual Recycle', 'Compact', 'Cylinder'],
    busstops: ['Wood Cabin', 'Minimal Canopy', 'Glass Shelter'],
    facades: ['UrbanD', 'UrbanB', 'UrbanA'],
    roofs: ['RoofA', 'TurkishTile', 'RoofC'],
    paving: ['Cobble', 'StoneA', 'Concrete']
  },
  'Dense Urban': {
    pedestrians: ['Commuter', 'Office', 'Evening', 'Urban Casual', 'Visitor'],
    cars: ['Graphite', 'Black', 'Navy', 'White', 'Slate'],
    trees: ['Columnar', 'Compact Maple', 'Street Linden'],
    lights: ['Dual Head', 'Modern Arc', 'Slim Post'],
    benches: ['Concrete Slab', 'Curved Metal', 'Slim Urban'],
    bins: ['Square Box', 'Compact', 'Dual Recycle'],
    busstops: ['Glass Shelter', 'Steel Canopy', 'Minimal Canopy'],
    facades: ['UrbanA', 'UrbanC', 'UrbanD', 'UrbanB'],
    roofs: ['RoofA', 'RoofB', 'USShingle'],
    paving: ['Asphalt', 'Concrete', 'Grid']
  }
};

const namedAssetColors = {
  Graphite: 0x1f2937, Slate: 0x475569, Teal: 0x0f766e, White: 0xe5e7eb, Navy: 0x1d4ed8,
  Ivory: 0xf8f1df, Terracotta: 0x9f5b3f, Olive: 0x556b2f, Black: 0x111827,
  Commuter: 0x334155, 'Urban Casual': 0x475569, Office: 0x1f2937, Student: 0x0f766e,
  Evening: 0x374151, 'Casual Linen': 0xd8c3a5, 'Warm Neutral': 0x8b6f47, Visitor: 0x64748b,
  Academic: 0x243044, Sport: 0x2563eb, Outdoor: 0x365314, 'Casual Green': 0x15803d,
  Broadleaf: 0x2f7d32, Pine: 0x1f5f3a, 'Street Linden': 0x3f8f3b, Plane: 0x4b9c45,
  'Compact Maple': 0x5a8f35, Columnar: 0x2c6e3f, Cypress: 0x174d32, Palm: 0x3d8b44
};

function activeAssetTheme() {
  const name = settings.assetTheme || projectManifest?.assetTheme || 'Modern Urban';
  return assetThemePresets[name] ? name : 'Modern Urban';
}

function assetPoolVariants(category) {
  const fromManifest = settings.assetTheme === projectManifest?.assetTheme ? projectManifest?.assetPools?.[category]?.variants : null;
  if (Array.isArray(fromManifest) && fromManifest.length) return fromManifest;
  return assetThemePresets[activeAssetTheme()]?.[category] || assetThemePresets['Modern Urban'][category] || [];
}

function assetColor(name, fallback = 0x64748b) {
  return namedAssetColors[name] ?? fallback;
}

function propFirst(props, names) {
  if (!props) return null;
  const lowerMap = {};
  for (const key of Object.keys(props)) lowerMap[key.toLowerCase()] = key;
  for (const name of names) {
    const key = lowerMap[name.toLowerCase()];
    if (key && props[key] !== null && props[key] !== undefined && String(props[key]).trim() !== '') {
      return props[key];
    }
  }
  return null;
}

function normalizeHexColor(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash : fallback;
}

function presetValue(value, presetMap, fallback) {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const found = Object.keys(presetMap).find((key) => key.toLowerCase() === raw.toLowerCase());
  return found || fallback;
}

function roofShapeValue(value, fallback) {
  const allowed = ['Flat', 'Pyramid', 'Gable', 'Cone', 'Prism'];
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  return allowed.find((key) => key.toLowerCase() === raw.toLowerCase()) || fallback;
}

function parseNumberProp(props, names, fallback = null) {
  let lookupNames = names;
  if (names.includes('population') || names.includes('pop')) {
    lookupNames = namesWithMapping('building_population_field', names);
  } else if (names.includes('vehicle') || names.includes('cars')) {
    lookupNames = namesWithMapping('building_vehicle_field', names);
  } else if (names.includes('gross_area') || names.includes('floor_area')) {
    lookupNames = namesWithMapping('building_floor_area_field', names);
  } else if (names.includes('dwellings') || names.includes('dwelling')) {
    lookupNames = namesWithMapping('building_dwelling_field', names);
  }
  const raw = propFirst(props || {}, lookupNames);
  if (raw === null || raw === undefined || raw === '') return fallback;
  const value = Number(String(raw).replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
}

function featureLabelText(props, names, fallback = '') {
  const value = propFirst(props || {}, names);
  return value === null || value === undefined ? fallback : String(value);
}

function mappedField(key) {
  return projectManifest?.fieldMappings?.[key] || null;
}

function namesWithMapping(mappingKey, fallbackNames) {
  const mapped = mappedField(mappingKey);
  return mapped ? [mapped, ...fallbackNames] : fallbackNames;
}

function buildingFunctionValue(props) {
  return propFirst(props || {}, namesWithMapping('landuse_function_field', ['uipfonksiyon', 'fonksiyon', 'kullanim', 'landuse', 'arazi_kull'])) || 'BELIRSIZ';
}

const settings = {
  sunElevation: 30,
  sunAzimuth: 30,
  fogDensity: 0.0003,
  mapOpacity: 1.0,
  floorHeight: 3.2,
  pavementStyle: 'Asphalt',
  showTerrainTexture: true,
  terrainTextureOpacity: 1.0,
  terrainTextureBrightness: 1.0,
  terrainTextureContrast: 1.0,
  showTerrainSides: true,
  terrainSideDrop: 5.0,
  terrainSideColor: '#d9fbf5',
  islandColor: '#e5e7eb',
  islandTexture: 'None',
  parcelBoundaryColor: '#71717a',
  parcelBoundaryOpacity: 0.35,
  hardscapeStyle: 'Cobble',
  hardscapeHeight: 0.30,
  buildingMode: 'Extruded + roof',
  terrainAnalysisMode: 'Texture',
  assetTheme: 'Modern Urban',
  showXyzTiles: false,
  xyzTileUrl: '',
  roofTexture: 'RoofA',
  roofShape: 'Pyramid',
  roofHeight: 2.0,
  roadStyle: 'Asphalt',
  roadColor: '#2f3438',
  roadColorMode: 'Default',
  roadWidth: 7.5,
  trafficSpeed: 1.0,
  showWindPlumes: false,
  windDirectionDeg: 315,
  windPlumeDistance: 180,
  showUrbanComfort: false,
  carDensity: 0.2,
  showParcels: true,
  showHardscape: false,
  showBuildings: true,
  showTrees: true,
  showFurniture: true,
  showCars: false,
  showRoads: true,
  showSidewalks: true,
  showCrosswalks: true,
  showLights: true,
  lightStyle: 'Modern Arc',
  showBenches: true,
  benchStyle: 'Wood Plank',
  showBins: true,
  binStyle: 'Square Box',
  showBusStops: true,
  stopStyle: 'Glass Shelter',
  fastTerrainSegments: 120,
  demMeshQuality: 160,
  timeOfDay: 14,
  enableSSAO: true,
  enableBloom: true,
  showPedestrians: true,
  pedestrianDensity: 0.5,
  weather: 'Clear',
  fov: 58,
  walkSpeed: 1.0,
  autoOrbit: false,
  autoOrbitSpeed: 0.3,
  autoTime: false,
  autoTimeSpeed: 2.0
};

const PERSISTED_SETTING_KEYS = [
  'islandColor', 'islandTexture', 'parcelBoundaryColor', 'parcelBoundaryOpacity',
  'showTerrainTexture', 'terrainTextureOpacity', 'terrainTextureBrightness', 'terrainTextureContrast',
  'showTerrainSides', 'terrainSideDrop', 'terrainSideColor',
  'fogDensity', 'autoTime', 'autoTimeSpeed', 'enableSSAO', 'enableBloom',
  'pavementStyle', 'hardscapeStyle', 'hardscapeHeight', 'buildingMode', 'terrainAnalysisMode', 'showXyzTiles', 'xyzTileUrl',
  'assetTheme',
  'floorHeight', 'roofTexture', 'roofShape', 'roofHeight', 'roadStyle', 'roadColor', 'roadColorMode', 'roadWidth',
  'showLights', 'lightStyle', 'showBenches', 'benchStyle', 'showBins', 'binStyle', 'showBusStops', 'stopStyle',
  'showParcels', 'showHardscape', 'showBuildings', 'showTrees', 'showFurniture',
  'showCars', 'showRoads', 'showSidewalks', 'showCrosswalks', 'showPedestrians',
  'showWindPlumes', 'windDirectionDeg', 'windPlumeDistance', 'showUrbanComfort',
  'demMeshQuality', 'timeOfDay', 'weather', 'fov', 'walkSpeed'
];

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem('planx_3d_city_settings');
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const key of PERSISTED_SETTING_KEYS) {
      if (!(key in saved) || !(key in settings)) continue;
      if (typeof settings[key] === 'number') settings[key] = Number(saved[key]);
      else if (typeof settings[key] === 'boolean') settings[key] = Boolean(saved[key]);
      else settings[key] = saved[key];
    }
  } catch (err) {
    console.warn('Could not restore PlanX viewer settings', err);
  }
}

function savePersistedSettings() {
  try {
    const payload = {};
    for (const key of PERSISTED_SETTING_KEYS) payload[key] = settings[key];
    localStorage.setItem('planx_3d_city_settings', JSON.stringify(payload));
  } catch (err) {
    console.warn('Could not save PlanX viewer settings', err);
  }
}

loadPersistedSettings();

const tourState = {
  keyframes: [],
  duration: 18,
  loop: false,
  playing: false,
  currentTime: 0,
  startedAt: 0,
  startTime: 0
};

function loadTourState() {
  try {
    const raw = localStorage.getItem('planx_3d_city_tour');
    if (!raw) return;
    const saved = JSON.parse(raw);
    tourState.keyframes = Array.isArray(saved.keyframes) ? saved.keyframes : [];
    tourState.duration = Number(saved.duration) || 18;
    tourState.loop = !!saved.loop;
  } catch (err) {
    console.warn('Could not restore PlanX tour', err);
  }
}

function saveTourState() {
  try {
    localStorage.setItem('planx_3d_city_tour', JSON.stringify({
      keyframes: tourState.keyframes,
      duration: tourState.duration,
      loop: tourState.loop
    }));
  } catch (err) {
    console.warn('Could not save PlanX tour', err);
  }
}

loadTourState();

function createAsphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2e3135';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = Math.random() * 1.2 + 0.2;
    const g = 80 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${g},${g},${g},0.20)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createIslandTexturePreset(name) {
  if (name === 'None') return null;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(0, 0, 256, 256);
  if (name === 'SoftNoise') {
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = Math.random() * 1.4;
      ctx.fillStyle = 'rgba(120,130,140,0.14)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (name === 'FineGrid') {
    ctx.strokeStyle = 'rgba(120,130,140,0.24)';
    for (let i = 0; i < 256; i += 12) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function setStatus(text) {
  const el = document.getElementById('dem-status');
  if (el) el.innerText = text;
}

function updateTimeOfDay() {
  const t = settings.timeOfDay;
  
  // Calculate elevation: Max at noon (12), min at midnight (0/24)
  // Let's make it rise at 6, set at 18.
  let elevation = -5;
  if (t > 6 && t < 18) {
    // 6..18 maps to 0..180 degrees (0 to PI)
    const normalized = (t - 6) / 12;
    elevation = Math.sin(normalized * Math.PI) * 75; // max 75 degrees
  }
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  
  // Azimuth from East to West (90 to 270)
  const azimuth = 90 + ((t / 24) * 180);
  const theta = THREE.MathUtils.degToRad(azimuth);
  const pos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  
  sun.position.copy(pos).multiplyScalar(1300);
  sun.intensity = elevation > 0 ? 1.25 : 0;
  sun.shadow.needsUpdate = true;
  
  sky.material.uniforms.sunPosition.value.copy(pos);
  scene.fog.density = settings.fogDensity;

  // Night Mode effects
  const isNight = t < 6.5 || t > 17.5;
  ambient.intensity = isNight ? 0.2 : 0.62;
  
  // Toggle bloom based on night mode and settings
  bloomPass.strength = (isNight && settings.enableBloom) ? 1.2 : 0.0;
  
  // We will apply emissive changes when generating materials, 
  // but let's just trigger a scene rebuild if day/night status changes to refresh building windows.
  // We can track lastNightMode to avoid infinite loops.
}
let lastTimeOfDay = -1;

// Lightweight day/night switch — updates only emissive + furniture lights.
// Does NOT rebuild terrain, geometry or DEM.
function rebuildLightingOnly() {
  const isNight = settings.timeOfDay < 6.5 || settings.timeOfDay > 17.5;
  buildingGroup.children.forEach(mesh => {
    if (!Array.isArray(mesh.material) || mesh.material.length < 2) return;
    const mat = mesh.material[1];
    if (!mat) return;
    mat.emissive.setHex(isNight ? 0x333322 : 0x000000);
    // Deterministic per-building intensity from position hash (avoids random on every call)
    const hash = Math.abs(Math.sin(mesh.position.x * 12.9898 + mesh.position.z * 78.233)) % 1;
    mat.emissiveIntensity = isNight ? 0.2 + hash * 0.8 : 0;
  });
  buildFurnitureLayer(); // refresh lamp glow
}

function checkTimeChange() {
  updateTimeOfDay();
  const isNight = settings.timeOfDay < 6.5 || settings.timeOfDay > 17.5;
  if (lastTimeOfDay !== -1) {
    const wasNight = lastTimeOfDay < 6.5 || lastTimeOfDay > 17.5;
    if (isNight !== wasNight) {
      rebuildLightingOnly();
    }
  }
  lastTimeOfDay = settings.timeOfDay;
}
checkTimeChange();

let weatherParticles = null;
function updateWeather() {
  if (weatherParticles) {
    scene.remove(weatherParticles);
    weatherParticles.geometry.dispose();
    weatherParticles.material.dispose();
    weatherParticles = null;
  }
  if (settings.weather === 'Clear') return;
  
  const count = settings.weather === 'Rain' ? 10000 : 8000;
  const size = settings.weather === 'Rain' ? 0.2 : 0.5;
  const color = settings.weather === 'Rain' ? 0xaaaaff : 0xffffff;
  const opacity = settings.weather === 'Rain' ? 0.5 : 0.8;
  
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for(let i=0; i<count*3; i+=3){
      pos[i] = (Math.random() - 0.5) * 800;
      pos[i+1] = Math.random() * 400;
      pos[i+2] = (Math.random() - 0.5) * 800;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  
  let tex = null;
  if (settings.weather === 'Snow') {
      const c = document.createElement('canvas');
      c.width=32; c.height=32;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(16,16,0,16,16,16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,32,32);
      tex = new THREE.CanvasTexture(c);
  }
  
  const mat = new THREE.PointsMaterial({
      color: color,
      size: size,
      transparent: true,
      opacity: opacity,
      map: tex,
      depthWrite: false,
      blending: THREE.AdditiveBlending
  });
  
  weatherParticles = new THREE.Points(geo, mat);
  scene.add(weatherParticles);
}
updateWeather();

function metersToLocal(x, y) {
  return [x - centerX, y - centerY];
}

function parseLevel(v) {
  if (v == null) return 4;
  const s = String(v).replace(',', '.');
  const n = parseFloat(s);
  if (Number.isFinite(n) && n > 0) return n;
  return 4;
}

function getPolygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function geometryBounds(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features) {
    if (!f.geometry) continue;
    const type = f.geometry.type;
    // Handle Polygon / MultiPolygon
    if (type === 'Polygon' || type === 'MultiPolygon') {
      for (const poly of getPolygonRings(f.geometry)) {
        for (const ring of poly) {
          for (const c of ring) {
            minX = Math.min(minX, c[0]);
            minY = Math.min(minY, c[1]);
            maxX = Math.max(maxX, c[0]);
            maxY = Math.max(maxY, c[1]);
          }
        }
      }
    }
    // Handle LineString
    else if (type === 'LineString') {
      for (const c of f.geometry.coordinates) {
        minX = Math.min(minX, c[0]);
        minY = Math.min(minY, c[1]);
        maxX = Math.max(maxX, c[0]);
        maxY = Math.max(maxY, c[1]);
      }
    }
    // Handle MultiLineString
    else if (type === 'MultiLineString') {
      for (const line of f.geometry.coordinates) {
        for (const c of line) {
          minX = Math.min(minX, c[0]);
          minY = Math.min(minY, c[1]);
          maxX = Math.max(maxX, c[0]);
          maxY = Math.max(maxY, c[1]);
        }
      }
    }
    // Handle Point
    else if (type === 'Point') {
      const c = f.geometry.coordinates;
      minX = Math.min(minX, c[0]);
      minY = Math.min(minY, c[1]);
      maxX = Math.max(maxX, c[0]);
      maxY = Math.max(maxY, c[1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

function mergeBounds(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

async function loadGeoJson(path, options = {}) {
  const { required = false, label = path } = options;
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data || !Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON FeatureCollection');
    }
    return data;
  } catch (err) {
    if (required) {
      throw new Error(`${label} yuklenemedi: ${path}`);
    }
    console.warn(`Optional layer skipped: ${path}`, err);
    return { ...EMPTY_GEOJSON, name: label };
  }
}

async function loadManifest() {
  try {
    const r = await fetch('../data/planx_manifest.json', { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.warn('PlanX manifest not available', err);
    return null;
  }
}

function applyManifestDefaults() {
  if (manifestDefaultsApplied || !projectManifest) return;
  manifestDefaultsApplied = true;
  const persistedRaw = localStorage.getItem('planx_3d_city_settings');
  if (persistedRaw) {
    try {
      const persisted = JSON.parse(persistedRaw);
      if (!persisted.assetTheme && projectManifest.assetTheme) settings.assetTheme = projectManifest.assetTheme;
    } catch (_err) {
      if (projectManifest.assetTheme) settings.assetTheme = projectManifest.assetTheme;
    }
    return;
  }
  const defaults = { ...(projectManifest.viewerDefaults || {}), ...(projectManifest.analysisDefaults || {}) };
  if (projectManifest.assetTheme && !defaults.assetTheme) defaults.assetTheme = projectManifest.assetTheme;
  for (const [key, value] of Object.entries(defaults)) {
    if (key in settings && value !== null && value !== undefined) settings[key] = value;
  }
}

async function loadTexture(path, repeatX = 1, repeatY = 1) {
  if (!path) return null;
  return new Promise((resolve, reject) => {
    texLoader.load(path, (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.colorSpace = THREE.SRGBColorSpace;
      resolve(t);
    }, undefined, reject);
  });
}

function viewerMode() {
  return projectManifest?.mode || 'vector';
}

function isRasterTextureMode() {
  return viewerMode() === 'raster_texture';
}

function normalizeAccessText(value) {
  return String(value ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function keywordList(values) {
  return (values || []).map(normalizeAccessText).filter(Boolean);
}

function roadAllowsCars(feature) {
  const access = projectManifest?.roadAccess;
  const field = access?.field;
  if (!field) return true;
  const props = feature?.properties || {};
  const raw = props[field];
  if (raw === undefined || raw === null || String(raw).trim() === '') return true;
  const value = normalizeAccessText(raw);
  const noCar = keywordList(access.noCarKeywords || ['yaya', 'pedestrian', 'foot', 'walk', 'path']);
  const vehicle = keywordList(access.vehicleKeywords || ['tasit', 'vehicle', 'car', 'arac', 'motorlu']);
  const hasNoCar = noCar.some((kw) => value.includes(kw));
  const hasVehicle = vehicle.some((kw) => value.includes(kw));
  return !hasNoCar || hasVehicle;
}

function roadModeText(feature) {
  const access = projectManifest?.roadAccess;
  const field = access?.field;
  const props = feature?.properties || {};
  const hierarchy = mappedField('road_hierarchy_field');
  if (hierarchy) return featureLabelText(props, [hierarchy], '');
  return field ? featureLabelText(props, [field], '') : featureLabelText(props, ['yol_turu', 'yoltipi', 'tur', 'tip', 'access', 'mode'], '');
}

function estimateAmenityPoints() {
  const points = [];
  const data = layerDataCache || {};
  const furniture = data.furniture || {};
  for (const collection of [furniture.busstops, furniture.lights, data.agaclar]) {
    for (const f of collection?.features || []) {
      if (f.geometry?.type === 'Point') points.push(f.geometry.coordinates);
    }
  }
  for (const f of data.yapilar?.features || []) {
    const fn = normalizeAccessText(buildingFunctionValue(f.properties || {}));
    if (!/(egitim|okul|park|saglik|ticaret|sosyal|kultur|spor|yesil|donati)/.test(fn)) continue;
    const rings = getPolygonRings(f.geometry);
    const outer = rings?.[0]?.[0];
    if (!outer?.length) continue;
    const c = outer.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    points.push([c[0] / outer.length, c[1] / outer.length]);
  }
  return points;
}

function featureMidpoint(feature) {
  const coords = feature?.geometry?.coordinates || [];
  if (!coords.length) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  return Array.isArray(mid) ? mid : null;
}

function minDistanceToPoints(point, points) {
  if (!point || !points.length) return Infinity;
  let min = Infinity;
  for (const p of points) {
    const dx = point[0] - p[0];
    const dy = point[1] - p[1];
    min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
  }
  return min;
}

function roadVisualColor(feature, amenityPoints = []) {
  if (settings.roadColorMode === 'Amenity distance') {
    const d = minDistanceToPoints(featureMidpoint(feature), amenityPoints);
    const t = Math.max(0, Math.min(1, d / 450));
    return new THREE.Color(0x16a34a).lerp(new THREE.Color(0x9ca3af), t);
  }
  if (settings.roadColorMode === 'Access / traffic') {
    if (!roadAllowsCars(feature)) return new THREE.Color(0x0ea5e9);
    const mode = normalizeAccessText(roadModeText(feature));
    if (/(ana|arter|bulvar|otoyol|primary|trunk)/.test(mode)) return new THREE.Color(0xef4444);
    if (/(cadde|collector|secondary)/.test(mode)) return new THREE.Color(0xf59e0b);
    return new THREE.Color(0x64748b);
  }
  return new THREE.Color(settings.roadColor);
}

function applyTone(value) {
  let v = value / 255;
  v = (v - 0.5) * settings.terrainTextureContrast + 0.5;
  v *= settings.terrainTextureBrightness;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

async function loadTerrainTextureFromGeoTiff() {
  const target = projectManifest?.terrainTexture?.target;
  if (!target || !settings.showTerrainTexture) return null;
  const res = await fetch(`../data/${target}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Terrain texture not found: ${target}`);
  const file = await res.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(file);
  const image = await tiff.getImage();
  const w = image.getWidth();
  const h = image.getHeight();
  const maxSize = 2048;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const samples = image.getSamplesPerPixel ? image.getSamplesPerPixel() : 1;
  const raster = await image.readRasters({ interleave: true, width: outW, height: outH });
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(outW, outH);
  for (let i = 0; i < outW * outH; i++) {
    const src = i * samples;
    const dst = i * 4;
    const gray = raster[src];
    const r = samples >= 3 ? raster[src] : gray;
    const g = samples >= 3 ? raster[src + 1] : gray;
    const b = samples >= 3 ? raster[src + 2] : gray;
    const a = samples >= 4 ? raster[src + 3] : 255;
    img.data[dst] = applyTone(Number(r) || 0);
    img.data[dst + 1] = applyTone(Number(g) || 0);
    img.data[dst + 2] = applyTone(Number(b) || 0);
    img.data[dst + 3] = Number.isFinite(a) ? Math.max(0, Math.min(255, a)) : 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

async function loadBaseMapTexture() {
  const target = projectManifest?.baseMapTexture?.target;
  if (!target || !settings.showXyzTiles) return null;
  const texture = await new Promise((resolve, reject) => {
    texLoader.load(`../data/${target}`, resolve, undefined, reject);
  });
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function demHeightAtProjected(x, y, fallback = 0) {
  if (!demSampler) return fallback;
  let px = Math.floor((x - demSampler.originX) / demSampler.resX);
  let py = Math.floor((y - demSampler.originY) / demSampler.resY);
  px = Math.max(0, Math.min(px, demSampler.width - 1));
  py = Math.max(0, Math.min(py, demSampler.height - 1));
  const idx = py * demSampler.width + px;
  const v = demSampler.raster[idx];
  if (!Number.isFinite(v)) return fallback;
  if (demSampler.noData !== null && String(v) === String(demSampler.noData)) return fallback;
  return v;
}

function demHeightMedianAtProjected(x, y, fallback = null, radius = 1) {
  if (!demSampler) return fallback;
  let px = Math.floor((x - demSampler.originX) / demSampler.resX);
  let py = Math.floor((y - demSampler.originY) / demSampler.resY);
  const values = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = Math.max(0, Math.min(demSampler.width - 1, px + dx));
      const sy = Math.max(0, Math.min(demSampler.height - 1, py + dy));
      const v = demSampler.raster[sy * demSampler.width + sx];
      if (!Number.isFinite(v)) continue;
      if (demSampler.noData !== null && String(v) === String(demSampler.noData)) continue;
      values.push(v);
    }
  }
  if (!values.length) return fallback;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

async function loadProjectDem() {
  setStatus('DEM yükleniyor...');
  const res = await fetch('../data/dem/mydem.tif');
  if (!res.ok) throw new Error('DEM not found');
  const file = await res.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(file);
  const image = await tiff.getImage();
  const [originXFull, originYFull] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const wFull = image.getWidth();
  const hFull = image.getHeight();

  let minPx = 0;
  let minPy = 0;
  let maxPx = wFull - 1;
  let maxPy = hFull - 1;
  if (bounds) {
    const pxA = Math.floor((bounds.minX - originXFull) / resX);
    const pxB = Math.floor((bounds.maxX - originXFull) / resX);
    const pyA = Math.floor((bounds.minY - originYFull) / resY);
    const pyB = Math.floor((bounds.maxY - originYFull) / resY);
    minPx = Math.max(0, Math.min(pxA, pxB) - 20);
    maxPx = Math.min(wFull - 1, Math.max(pxA, pxB) + 20);
    minPy = Math.max(0, Math.min(pyA, pyB) - 20);
    maxPy = Math.min(hFull - 1, Math.max(pyA, pyB) + 20);
  }
    const winMinX = Math.max(0, Math.min(minPx, maxPx));
  const winMaxX = Math.min(wFull - 1, Math.max(minPx, maxPx));
  const winMinY = Math.max(0, Math.min(minPy, maxPy));
  const winMaxY = Math.min(hFull - 1, Math.max(minPy, maxPy));
  const raster = await image.readRasters({
    interleave: true,
    window: [winMinX, winMinY, winMaxX + 1, winMaxY + 1]
  });
  const originX = originXFull + winMinX * resX;
  const originY = originYFull + winMinY * resY;
  demSampler = {
    raster,
    originX,
    originY,
    resX,
    resY,
    width: winMaxX - winMinX + 1,
    height: winMaxY - winMinY + 1,
    noData: image.getGDALNoData()
  };
  demReady = true;
  setStatus('DEM yüklendi (Bergama_Elevation_Cropped.tif).');
}

function clearGroup(g) {
  while (g.children.length) {
    const c = g.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => m.dispose());
    }
  }
}

function createIslandMaskTexture(adalar, width, depth) {
  const roi = layerDataCache?.roi;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const toPixel = (x, z) => {
    const u = (x + width * 0.5) / width;
    const v = (z + depth * 0.5) / depth;
    return [u * size, v * size];
  };

  const drawPolygons = (features, color) => {
    ctx.fillStyle = color;
    for (const f of features) {
      for (const poly of getPolygonRings(f.geometry)) {
        const outer = poly[0];
        if (!outer || outer.length < 3) continue;
        ctx.beginPath();
        outer.forEach((c, i) => {
          const [lx, lz] = metersToLocal(c[0], c[1]);
          const [px, py] = toPixel(lx, lz);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  if (roi && roi.features.length > 0) {
    // Outside ROI → transparent. Start black, paint ROI white, then cut islands.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    drawPolygons(roi.features, '#ffffff');   // ROI interior → opaque
    drawPolygons(adalar.features, '#000000'); // island areas → transparent (own geometry on top)
  } else {
    // No ROI: original behaviour — everything opaque except island areas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    drawPolygons(adalar.features, '#000000');
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createRoiMaskTexture(width, depth) {
  const roi = layerDataCache?.roi;
  if (!roi || !roi.features || !roi.features.length) return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const toPixel = (x, z) => {
    const u = (x + width * 0.5) / width;
    const v = (z + depth * 0.5) / depth;
    return [u * size, v * size];
  };

  ctx.fillStyle = '#ffffff';
  for (const f of roi.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      if (!poly.length) continue;
      ctx.beginPath();
      poly.forEach((ring) => {
        if (!ring || ring.length < 3) return;
        ring.forEach((c, i) => {
          const [lx, lz] = metersToLocal(c[0], c[1]);
          const [px, py] = toPixel(lx, lz);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
      });
      ctx.fill('evenodd');
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function edgeHeightAt(localX, localZ, fallback) {
  const wx = localX + centerX;
  const wy = localZ + centerY;
  let z = demHeightMedianAtProjected(wx, wy, null, 2);
  if (z === null) z = fallback;
  const lo = Number.isFinite(terrainHeightStats.p02) ? terrainHeightStats.p02 : fallback - 20;
  const hi = Number.isFinite(terrainHeightStats.p98) ? terrainHeightStats.p98 : fallback + 20;
  return Math.max(lo, Math.min(hi, z));
}

function smoothSideLineHeights(points, fallbackHeight) {
  const raw = points.map(([x, z]) => edgeHeightAt(x, z, fallbackHeight));
  return raw.map((value, i) => {
    const a = raw[Math.max(0, i - 2)];
    const b = raw[Math.max(0, i - 1)];
    const c = value;
    const d = raw[Math.min(raw.length - 1, i + 1)];
    const e = raw[Math.min(raw.length - 1, i + 2)];
    return (a + b + c * 2 + d + e) / 6;
  });
}

function robustTerrainHeightAtProjected(x, y, fallback) {
  let z = demHeightMedianAtProjected(x, y, null, 1);
  if (z === null) z = fallback;
  const lo = Number.isFinite(terrainHeightStats.p02) ? terrainHeightStats.p02 : fallback - 20;
  const hi = Number.isFinite(terrainHeightStats.p98) ? terrainHeightStats.p98 : fallback + 20;
  return Math.max(lo, Math.min(hi, z));
}

function ringToLocalPolyline(ring, maxStep = 5) {
  const points = [];
  if (!ring || ring.length < 2) return points;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const [x, z] = metersToLocal(a[0] + dx * t, a[1] + dy * t);
      points.push([x, z]);
    }
  }
  const last = ring[ring.length - 1];
  const [x, z] = metersToLocal(last[0], last[1]);
  points.push([x, z]);
  return points;
}

function roiSidePolylines() {
  const roi = layerDataCache?.roi;
  const lines = [];
  for (const feature of roi?.features || []) {
    for (const poly of getPolygonRings(feature.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      lines.push(ringToLocalPolyline(outer));
    }
  }
  return lines.filter((line) => line.length > 1);
}

function demExtentSidePolylines(width, depth) {
  const samples = Math.max(16, Math.floor(currentTerrainSegments() / 2));
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const north = [];
  const east = [];
  const south = [];
  const west = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    north.push([-halfW + width * t, -halfD]);
    east.push([halfW, -halfD + depth * t]);
    south.push([halfW - width * t, halfD]);
    west.push([-halfW, halfD - depth * t]);
  }
  return [north, east, south, west];
}

function buildTerrainSideSkirt(width, depth, demMin, fallbackHeight) {
  clearGroup(terrainSideGroup);
  if (!settings.showTerrainSides) return;
  const baseY = demMin - Math.max(0, Number(settings.terrainSideDrop) || 0);
  const positions = [];
  const colors = [];
  const indices = [];
  const baseColor = new THREE.Color(settings.terrainSideColor || '#d9fbf5');
  const lowerColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.55);

  const addVertex = (x, y, z, color) => {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    return positions.length / 3 - 1;
  };
  const addStrip = (points) => {
    let prevTop = null;
    let prevBottom = null;
    const topHeights = smoothSideLineHeights(points, fallbackHeight);
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      const topY = topHeights[i];
      const top = addVertex(x, topY, z, baseColor);
      const bottom = addVertex(x, baseY, z, lowerColor);
      if (prevTop !== null) {
        indices.push(prevTop, top, prevBottom, top, bottom, prevBottom);
      }
      prevTop = top;
      prevBottom = bottom;
    }
  };

  const roiLines = roiSidePolylines();
  const sideLines = roiLines.length ? roiLines : demExtentSidePolylines(width, depth);
  sideLines.forEach(addStrip);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: false,
    opacity: 1,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
    depthWrite: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = -40;
  terrainSideGroup.add(mesh);

  const addBottomPolygon = (rings) => {
    if (!rings || !rings[0] || rings[0].length < 3) return;
    const outer = rings[0].map((coord) => metersToLocal(coord[0], coord[1]));
    const shape = new THREE.Shape();
    outer.forEach(([x, z], idx) => { if (idx === 0) shape.moveTo(x, z); else shape.lineTo(x, z); });
    for (let r = 1; r < rings.length; r++) {
      const holePts = rings[r].map((coord) => metersToLocal(coord[0], coord[1]));
      if (holePts.length < 3) continue;
      const hole = new THREE.Path();
      holePts.forEach(([x, z], idx) => { if (idx === 0) hole.moveTo(x, z); else hole.lineTo(x, z); });
      shape.holes.push(hole);
    }
    const bottomGeo = new THREE.ShapeGeometry(shape);
    const bottomPos = bottomGeo.attributes.position;
    for (let i = 0; i < bottomPos.count; i++) {
      const x = bottomPos.getX(i);
      const z = bottomPos.getY(i);
      bottomPos.setXYZ(i, x, baseY, z);
    }
    bottomGeo.computeVertexNormals();
    const bottomMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: true
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.receiveShadow = true;
    bottomMesh.renderOrder = -41;
    terrainSideGroup.add(bottomMesh);
  };

  const roiFeatures = layerDataCache?.roi?.features || [];
  if (roiFeatures.length) {
    roiFeatures.forEach((feature) => getPolygonRings(feature.geometry).forEach(addBottomPolygon));
  } else {
    const halfW = width * 0.5;
    const halfD = depth * 0.5;
    addBottomPolygon([[
      [bounds.minX, bounds.minY],
      [bounds.maxX, bounds.minY],
      [bounds.maxX, bounds.maxY],
      [bounds.minX, bounds.maxY],
      [bounds.minX, bounds.minY]
    ]]);
  }
}

function currentTerrainSegments() {
  const v = Number(settings.demMeshQuality || settings.fastTerrainSegments || 120);
  return Math.max(32, Math.min(420, Math.round(v)));
}

function terrainVertexBoundaryBlend(localX, localY, width, depth) {
  const edgeDistance = Math.min(localX + width * 0.5, width * 0.5 - localX, localY + depth * 0.5, depth * 0.5 - localY);
  const band = Math.max(8, Math.min(width, depth) * 0.018);
  if (edgeDistance >= band) return 0;
  return 1 - Math.max(0, edgeDistance) / band;
}

async function buildTerrain(adalar) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const segments = currentTerrainSegments();
  const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
  const pos = geo.attributes.position;
  let zMin = Infinity;
  let zMax = -Infinity;

  let sumZ = 0;
  let countZ = 0;
  const validHeights = [];

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const wx = lx + centerX;
    const wy = -ly + centerY;
    const z = demHeightAtProjected(wx, wy, null);
    if (z !== null) {
      zMin = Math.min(zMin, z);
      zMax = Math.max(zMax, z);
      sumZ += z;
      countZ++;
      validHeights.push(z);
    }
  }

  const avgZ = countZ > 0 ? sumZ / countZ : 0;
  if (zMin === Infinity) { zMin = avgZ; zMax = avgZ; }
  validHeights.sort((a, b) => a - b);
  const percentile = (p, fallback) => validHeights.length ? validHeights[Math.max(0, Math.min(validHeights.length - 1, Math.floor((validHeights.length - 1) * p)))] : fallback;
  terrainHeightStats = {
    min: zMin,
    max: zMax,
    avg: avgZ,
    p02: percentile(0.02, zMin),
    p98: percentile(0.98, zMax)
  };

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const wx = lx + centerX;
    const wy = -ly + centerY;
    let z = robustTerrainHeightAtProjected(wx, wy, avgZ);
    if (z === null) z = avgZ;
    const edgeBlend = terrainVertexBoundaryBlend(lx, ly, width, depth);
    if (edgeBlend > 0) {
      const smoothZ = demHeightMedianAtProjected(wx, wy, z, 2);
      z = z * (1 - edgeBlend) + smoothZ * edgeBlend;
    }
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();
  const useTopoTint = settings.terrainAnalysisMode && settings.terrainAnalysisMode !== 'Texture';
  if (useTopoTint) {
    const colors = [];
    const normals = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      let color;
      if (settings.terrainAnalysisMode === 'Slope tint') {
        const steep = 1 - Math.max(0, Math.min(1, normals.getZ(i)));
        color = new THREE.Color().setHSL(0.33 - steep * 0.33, 0.72, 0.46 + steep * 0.10);
      } else {
        const tZ = (z - zMin) / Math.max(1e-6, zMax - zMin);
        color = new THREE.Color().setHSL(0.58 - tZ * 0.45, 0.62, 0.42 + tZ * 0.18);
      }
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  const useRasterTexture = isRasterTextureMode() && settings.showTerrainTexture && terrainTexture;
  const useBaseMapTexture = !useRasterTexture && settings.showXyzTiles && baseMapTexture;
  const groundTex = useRasterTexture
    ? terrainTexture
    : (useBaseMapTexture
      ? baseMapTexture
    : (settings.pavementStyle === 'Asphalt'
      ? createAsphaltTexture()
      : await loadTexture(textureSets.pavement[settings.pavementStyle], width / 60, depth / 60)));
  /* Ada poligonları içinde DEM texture %100 transparan,
   * kalan yerlerde (yollar, boş alanlar) normal asfalt görünür */
  const terrainOpacity = useRasterTexture ? settings.terrainTextureOpacity : 1;
  const roiMaskTexture = createRoiMaskTexture(width, depth);
  const materialOptions = {
    map: useTopoTint ? null : groundTex,
    vertexColors: useTopoTint,
    transparent: terrainOpacity < 1 || !!roiMaskTexture,
    opacity: terrainOpacity,
    roughness: (useRasterTexture || useBaseMapTexture) ? 0.82 : 0.95,
    metalness: 0.02,
    depthWrite: true
  };
  if (roiMaskTexture) {
    materialOptions.alphaMap = roiMaskTexture;
    materialOptions.alphaTest = 0.02;
  }
  const mat = new THREE.MeshStandardMaterial(materialOptions);
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.receiveShadow = true;
  terrainMesh.renderOrder = -30;
  world.add(terrainMesh);
  buildTerrainSideSkirt(width, depth, zMin, avgZ);
  _lastTerrainY = avgZ;   // fallback için ortalama DEM yüksekliğini başlat
  setStatus(`DEM yüklendi (mydem.tif). Z: ${zMin.toFixed(1)} - ${zMax.toFixed(1)} m`);
}

/* terrainLocalYAt: DEM yüzeyinden Y değerini raycaster ile okur.
/* terrainLocalYAt: DEM'den doğrudan yükseklik okur.
 * Raycasting KULLANMAZ — demHeightAtProjected ile aynı kaynağı kullanır.
 * Terrain mesh segment çözünürlüğüne bağımlılık ortadan kalkar. */
let _lastTerrainY = 0;
function terrainLocalYAt(localX, localZ) {
  if (!demSampler) return _lastTerrainY;
  /* metersToLocal(mx, my) → [mx-centerX, my-centerY]
   * Ters dönüşüm: mx = localX + centerX, my = localZ + centerY */
  const wx = localX + centerX;
  const wy = localZ + centerY;
  const z = demHeightAtProjected(wx, wy, null);
  if (z !== null) {
    _lastTerrainY = z;
    return z;
  }
  return _lastTerrainY;
}

async function buildIslandLayer(adalar) {
  clearGroup(islandGroup);
  const t = createIslandTexturePreset(settings.islandTexture);
  const defaultMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.islandColor),
    map: t,
    roughness: 0.92,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const customMaterials = {};
  const materialForIsland = (feature, fallbackMat) => {
    const props = feature.properties || {};
    const customColor = normalizeHexColor(propFirst(props, ['planx_color', 'planx_renk', 'color', 'renk']));
    const customTexture = presetValue(propFirst(props, ['planx_texture', 'planx_island_texture', 'texture', 'doku']), textureSets.island, null);
    if (!customColor && !customTexture) return fallbackMat;

    const color = customColor || settings.islandColor;
    const textureName = customTexture || settings.islandTexture;
    const key = `${color}_${textureName}`;
    if (!customMaterials[key]) {
      customMaterials[key] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        map: createIslandTexturePreset(textureName),
        roughness: 0.92,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
    }
    return customMaterials[key];
  };
  const parkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x5e9e3e),
    roughness: 0.90,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const sportMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x4a8c30),
    roughness: 0.88,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });

  for (const f of adalar.features) {
    const fn = ((f.properties?.uipfonksiyon || f.properties?.arazi_kull || '')).toString().toUpperCase();
    const isPark = fn.includes('PARK') || fn.includes('YEŞİL') || fn.includes('ORMAN') || fn.includes('BAHÇE');
    const isSport = fn.includes('SPOR') || fn.includes('STADYUM');
    const mat = materialForIsland(f, isPark ? parkMat : (isSport ? sportMat : defaultMat));

    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = new THREE.Shape();
      outer.forEach((c, i) => {
        const [x, z] = metersToLocal(c[0], c[1]);
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
      });
      const g = new THREE.ShapeGeometry(shape);
      g.rotateX(Math.PI / 2);
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const vz = pos.getZ(vi);
        pos.setY(vi, terrainLocalYAt(vx, vz) + LAYER.island);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.renderOrder = 0;
      islandGroup.add(m);
    }
  }
}

function buildParcelLayer(parseller) {
  clearGroup(parcelGroup);
  /* Parsel: sadece boundary (sınır çizgisi), fill yok.
   * Her vertex kendi DEM yüksekliğini alır (relevant to DEM). */
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(settings.parcelBoundaryColor),
    transparent: true,
    opacity: settings.parcelBoundaryOpacity,
    depthWrite: false          // ada yüzeyleriyle depth-fighting önlenir
  });

  for (const f of parseller.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const pts = [];
      outer.forEach((c) => {
        const [x, z] = metersToLocal(c[0], c[1]);
        const y = terrainLocalYAt(x, z) + LAYER.parcel;
        pts.push(new THREE.Vector3(x, y, z));
      });
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.LineLoop(lg, lineMat);
      l.renderOrder = 5;
      parcelGroup.add(l);
    }
  }
}

async function buildHardscapeLayer(hardscape) {
  clearGroup(hardscapeGroup);
  const t = await loadTexture(textureSets.hardscape[settings.hardscapeStyle], 8, 8);
  const mat = new THREE.MeshStandardMaterial({
    map: t, roughness: 0.94, metalness: 0.02,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  for (const f of hardscape.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = new THREE.Shape();
      outer.forEach((c, i) => {
        const [x, z] = metersToLocal(c[0], c[1]);
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
      });
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      /* -- Per-vertex DEM elevation -- */
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const vz = pos.getZ(vi);
        const isTop = pos.getY(vi) > -0.5;
        const baseDem = terrainLocalYAt(vx, vz);
        const yVal = isTop ? (baseDem + LAYER.content + settings.hardscapeHeight) : (baseDem + LAYER.content);
        pos.setY(vi, yVal);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.renderOrder = 5;
      hardscapeGroup.add(m);
    }
  }
}

function polygonCentroidGeo(ring) {
  if (!ring?.length) return null;
  const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

function polygonAreaGeo(ring) {
  if (!ring?.length) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) * 0.5;
}

function estimateBuildingFeatureMetrics(feature) {
  const props = feature?.properties || {};
  const levels = parseLevel(props.katadedi);
  let footprint = parseNumberProp(props, ['taban_alani', 'footprint_area', 'aream2'], null);
  if (!footprint) {
    const outer = getPolygonRings(feature.geometry)?.[0]?.[0];
    footprint = polygonAreaGeo(outer);
  }
  const floorArea = parseNumberProp(props, namesWithMapping('building_floor_area_field', ['toplam_insaat', 'insaat_alani', 'floor_area', 'gross_area']), footprint * levels);
  const dwellings = parseNumberProp(props, namesWithMapping('building_dwelling_field', ['daire', 'daire_sayisi', 'dwelling', 'dwellings']), Math.max(1, Math.round(floorArea / 115)));
  const population = parseNumberProp(props, namesWithMapping('building_population_field', ['nufus', 'nÃ¼fus', 'population', 'pop']), Math.round(dwellings * 3.1));
  const vehicles = parseNumberProp(props, namesWithMapping('building_vehicle_field', ['arac', 'araÃ§', 'vehicle', 'cars']), Math.round(dwellings * 0.7));
  return { footprint, floorArea, dwellings, population, vehicles };
}

function buildingBaseYForOuterRing(outer) {
  const samples = [];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const coord of outer || []) {
    if (!coord || coord.length < 2) continue;
    sx += coord[0];
    sy += coord[1];
    n++;
    const [x, z] = metersToLocal(coord[0], coord[1]);
    samples.push(terrainLocalYAt(x, z));
  }
  if (n > 0) {
    const [cx, cz] = metersToLocal(sx / n, sy / n);
    samples.push(terrainLocalYAt(cx, cz));
  }
  const valid = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!valid.length) return terrainLocalYAt(0, 0) + LAYER.content;
  const mid = valid[Math.floor(valid.length / 2)];
  const high = valid[Math.max(0, Math.ceil(valid.length * 0.72) - 1)];
  return Math.max(mid, high - 0.35) + LAYER.content + 0.03;
}

function buildingHeightFromProps(props, levels) {
  const explicit = parseNumberProp(props || {}, ['planx_height', 'height', 'yukseklik', 'yÃ¼kseklik', 'bina_yuksekligi', 'building_height'], null);
  if (explicit !== null && explicit > 0) return explicit;
  return levels * settings.floorHeight;
}

function isOdorOrEmissionSource(feature) {
  const props = feature?.properties || {};
  const odorField = mappedField('odor_source_field');
  if (odorField && props[odorField] !== undefined) {
    return /(1|true|evet|yes|source|risk|sanayi|industry|atik|waste|cop|depolama|storage|aritma|sewage)/.test(normalizeAccessText(props[odorField]));
  }
  const text = normalizeAccessText([
    props[mappedField('landuse_function_field')], props.uipfonksiyon, props.fonksiyon, props.kullanim, props.landuse,
    props.tesis, props.adi, props.name, props.tip, props.tur
  ].filter(Boolean).join(' '));
  return /(sanayi|industry|atik|waste|cop|solid|depolama|transfer|arıtma|aritma|sewage|lojistik|logistics)/.test(text);
}

function buildWindPlumeLayer() {
  clearGroup(windPlumeGroup);
  if (!settings.showWindPlumes) return;
  const sources = [
    ...(layerDataCache?.yapilar?.features || []),
    ...(layerDataCache?.hardscape?.features || [])
  ].filter(isOdorOrEmissionSource);
  if (!sources.length) return;

  const dir = THREE.MathUtils.degToRad(settings.windDirectionDeg);
  const dx = Math.sin(dir);
  const dz = Math.cos(dir);
  const length = settings.windPlumeDistance;
  const width = Math.max(28, length * 0.28);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (const f of sources) {
    const rings = getPolygonRings(f.geometry);
    const outer = rings?.[0]?.[0];
    const c = polygonCentroidGeo(outer);
    if (!c) continue;
    const [lx, lz] = metersToLocal(c[0], c[1]);
    const cx = lx + dx * length * 0.5;
    const cz = lz + dz * length * 0.5;
    const y = terrainLocalYAt(lx, lz) + 2.0;
    const geo = new THREE.PlaneGeometry(width, length, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(cx, y, cz);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.renderOrder = 44;
    windPlumeGroup.add(mesh);
  }
}

function createRoofPresetTexture(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const bg = {
    RoofA: '#9a7b61', RoofB: '#6f7885', RoofC: '#8e5a49', RoofD: '#5e6368',
    GermanTile: '#3d4a5c', TurkishTile: '#b94a1a', USShingle: '#2d3340'
  }[name] || '#9a7b61';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  if (name === 'RoofA') {
    ctx.strokeStyle = 'rgba(240,220,200,0.65)';
    for (let y = 10; y < 256; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,70,55,0.28)';
    for (let y = 18; y < 256; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
  } else if (name === 'RoofB') {
    ctx.strokeStyle = 'rgba(210,220,235,0.55)';
    for (let x = -120; x < 300; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 90, 256); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,70,85,0.3)';
    for (let x = -120; x < 300; x += 18) {
      ctx.beginPath(); ctx.moveTo(x + 7, 0); ctx.lineTo(x + 97, 256); ctx.stroke();
    }
  } else if (name === 'RoofC') {
    ctx.strokeStyle = 'rgba(255,220,200,0.45)';
    for (let y = 0; y < 256; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 8); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(80,45,38,0.25)';
    for (let y = 8; y < 256; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 8); ctx.stroke();
    }
  } else if (name === 'GermanTile') {
    // Dark slate, staggered rectangular tiles with shadow lines
    ctx.fillStyle = '#3d4a5c';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 32, th = 20;
    for (let row = 0; row * th < 256; row++) {
      const offset = (row % 2) * (tw / 2);
      for (let col = -1; col * tw < 256; col++) {
        const x = col * tw + offset, y = row * th;
        ctx.fillStyle = `rgba(${50 + (row * 7 + col * 3) % 20},${60 + (row * 5 + col * 7) % 20},${80 + (row * 3) % 15},1)`;
        ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);
        ctx.strokeStyle = 'rgba(20,28,40,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
        // highlight top edge
        ctx.strokeStyle = 'rgba(100,120,150,0.3)';
        ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + tw - 1, y + 1); ctx.stroke();
      }
    }
  } else if (name === 'TurkishTile') {
    // Terracotta curved tiles (Ottoman/Marsilya kiremit)
    ctx.fillStyle = '#b94a1a';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 28, th = 22;
    for (let row = 0; row * th < 280; row++) {
      const offset = (row % 2) * (tw / 2);
      for (let col = -1; col * tw < 270; col++) {
        const x = col * tw + offset, y = row * th;
        // Base tile body
        const shade = 160 + (row * 11 + col * 7) % 40;
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.42)},${Math.floor(shade * 0.12)})`;
        ctx.fillRect(x, y, tw, th);
        // Curved ridge (arc overlay for the concave tile look)
        const grad = ctx.createLinearGradient(x, y, x + tw, y);
        grad.addColorStop(0,   'rgba(80,25,5,0.5)');
        grad.addColorStop(0.5, 'rgba(220,100,40,0.15)');
        grad.addColorStop(1,   'rgba(80,25,5,0.5)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(x + tw / 2, y + th / 2, tw / 2, th / 2, 0, 0, Math.PI * 2); ctx.fill();
        // Shadow line between rows
        ctx.strokeStyle = 'rgba(60,18,4,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y + th - 1); ctx.lineTo(x + tw, y + th - 1); ctx.stroke();
      }
    }
  } else if (name === 'USShingle') {
    // Asphalt shingles – dark charcoal, staggered, slightly bumpy
    ctx.fillStyle = '#2d3340';
    ctx.fillRect(0, 0, 256, 256);
    const sw = 40, sh = 14;
    for (let row = 0; row * sh < 280; row++) {
      const offset = (row % 2) * (sw / 2);
      for (let col = -1; col * sw < 270; col++) {
        const x = col * sw + offset, y = row * sh;
        const v = 40 + (row * 5 + col * 11) % 22;
        ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
        ctx.fillRect(x + 1, y + 1, sw - 2, sh - 2);
        // Bottom shadow
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 1, y + sh - 1); ctx.lineTo(x + sw - 1, y + sh - 1); ctx.stroke();
        // Top highlight
        ctx.strokeStyle = 'rgba(160,170,185,0.18)';
        ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + sw - 1, y + 1); ctx.stroke();
        // Granule texture dots
        for (let d = 0; d < 3; d++) {
          const dx = x + 4 + d * 12 + (row % 3) * 3;
          const dy = y + 4 + (col % 2) * 3;
          ctx.fillStyle = `rgba(${v + 20},${v + 24},${v + 30},0.4)`;
          ctx.fillRect(dx, dy, 2, 2);
        }
      }
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 0; y < 256; y += 14) {
      for (let x = 0; x < 256; x += 14) {
        if ((x + y) % 28 === 0) ctx.fillRect(x, y, 6, 6);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.8, 2.8);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function polygonCentroid(points) {
  if (!points.length) return new THREE.Vector3(0, 0, 0);
  let signedArea = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const a = p0.x * p1.z - p1.x * p0.z;
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cz += (p0.z + p1.z) * a;
  }
  if (Math.abs(signedArea) < 1e-7) {
    const c = new THREE.Vector3();
    points.forEach((p) => c.add(p));
    c.multiplyScalar(1 / points.length);
    return c;
  }
  const k = 1 / (3 * signedArea);
  return new THREE.Vector3(cx * k, 0, cz * k);
}

function roofMeshFor(shape, footprintPoints, hBase, height, roofShape = settings.roofShape, roofHeight = settings.roofHeight) {
  const bb = new THREE.Box3().setFromPoints(footprintPoints);
  const size = new THREE.Vector3();
  bb.getSize(size);
  const minDim = Math.max(0.6, Math.min(size.x, size.z));
  const rh = Math.max(0.5, roofHeight);

  const ring = footprintPoints.filter((_, i) => i === 0 || footprintPoints[i - 1].distanceTo(footprintPoints[i]) > 1e-6);
  let roofGeo;
  if (roofShape === 'Pyramid' && ring.length >= 3) {
    const center = polygonCentroid(ring);
    const apexY = rh;
    const verts = [];
    const uvs = [];
    const bb2 = new THREE.Box2();
    ring.forEach((p) => bb2.expandByPoint(new THREE.Vector2(p.x, p.z)));
    const sx = Math.max(1e-6, bb2.max.x - bb2.min.x);
    const sz = Math.max(1e-6, bb2.max.y - bb2.min.y);
    const uvFor = (x, z) => [(x - bb2.min.x) / sx, (z - bb2.min.y) / sz];

    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      verts.push(a.x, 0, a.z, b.x, 0, b.z, center.x, apexY, center.z);
      const ua = uvFor(a.x, a.z);
      const ub = uvFor(b.x, b.z);
      const uc = uvFor(center.x, center.z);
      uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    }
    roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roofGeo.computeVertexNormals();
  } else
  if (roofShape === 'Flat') {
    roofGeo = new THREE.ShapeGeometry(shape);
    roofGeo.rotateX(Math.PI / 2);
  } else {
    let extrudeOpts;
    const sD = minDim;
    if (roofShape === 'Gable') {
      // Sharp ridge: bevelSize nearly half the building width, sharp bevelSegments=1
      extrudeOpts = { depth: 0.02, bevelEnabled: true, bevelSegments: 1, steps: 1,
        bevelSize: sD * 0.46, bevelThickness: rh };
    } else if (roofShape === 'Cone') {
      // Round cone: many bevel segments for smooth taper
      extrudeOpts = { depth: 0.02, bevelEnabled: true, bevelSegments: 7, steps: 1,
        bevelSize: sD * 0.43, bevelThickness: rh * 0.9 };
    } else if (roofShape === 'Prism') {
      // Shed/hip: moderate inset, flat-ish peak
      extrudeOpts = { depth: rh * 0.3, bevelEnabled: true, bevelSegments: 2, steps: 1,
        bevelSize: sD * 0.28, bevelThickness: rh * 0.7 };
    } else {
      extrudeOpts = { depth: 0.02, bevelEnabled: true, bevelSegments: 2, steps: 1,
        bevelSize: sD * 0.35, bevelThickness: rh * 0.8 };
    }
    roofGeo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
    roofGeo.rotateX(Math.PI / 2);
  }

  roofGeo.computeBoundingBox();
  const minY = roofGeo.boundingBox ? roofGeo.boundingBox.min.y : 0;
  if (minY !== 0) roofGeo.translate(0, -minY, 0);

  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xc8b089, roughness: 0.85 }));
  roof.position.y = hBase + height + 0.02;
  roof.castShadow = true;
  return roof;
}

// InstancedMesh trees — one draw call per variant (6 total) instead of 2N+ draw calls
function buildTreeLayer(agaclar) {
  clearGroup(treeGroup);
  const feats = agaclar.features.filter(f => f.geometry?.type === 'Point');
  if (!feats.length) return;
  const heightFields = namesWithMapping('tree_height_field', ['planx_tree_height', 'tree_height', 'height', 'boy', 'agac_boyu', 'aÄŸaÃ§_boyu', 'yukseklik', 'yÃ¼kseklik']);

  // Group by variant (0,1,2)
  const buckets = [[], [], []];
  feats.forEach((f, i) => {
    const h = parseNumberProp(f.properties || {}, heightFields, 8);
    const treeH = Number.isFinite(h) && h > 1 ? h : 8;
    const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
    const y = terrainLocalYAt(x, z) + LAYER.content;
    buckets[i % 3].push({ x, y, z, h: treeH });
  });

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 });
  const treeVariants = assetPoolVariants('trees');
  const leafMats = [0, 1, 2].map((idx) => new THREE.MeshStandardMaterial({
    color: assetColor(treeVariants[idx], [0x3b6e2e, 0x497e3a, 0x4a7530][idx]),
    roughness: idx === 2 ? 0.88 : 0.9
  }));
  const crownGeos = [
    new THREE.ConeGeometry(1, 2.2, 7),       // conifer
    new THREE.SphereGeometry(1, 6, 5),        // deciduous round
    new THREE.IcosahedronGeometry(1, 1)       // bushy irregular
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1, 5);
  const dummy = new THREE.Object3D();

  buckets.forEach((trees, vi) => {
    if (!trees.length) return;
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    trunkInst.castShadow = true;
    const crownInst = new THREE.InstancedMesh(crownGeos[vi], leafMats[vi], trees.length);
    crownInst.castShadow = true;

    trees.forEach(({ x, y, z, h }, idx) => {
      const trunkH = Math.max(1.2, h * 0.22);
      const crownH = Math.max(2, h * 0.78);
      // deterministic rotation from position
      const rot = ((x * 13.7 + z * 7.3) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

      dummy.position.set(x, y + trunkH * 0.5, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, trunkH, 1);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      const cr = crownH * (vi === 0 ? 0.38 : vi === 1 ? 0.50 : 0.44);
      const ch = crownH * (vi === 0 ? 1.0  : vi === 1 ? 0.72 : 0.68);
      const cy = y + trunkH + crownH * (vi === 0 ? 0.48 : 0.35);
      dummy.position.set(x, cy, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(cr, ch, cr);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    treeGroup.add(trunkInst, crownInst);
  });
}

function numericPropFirst(props, names) {
  for (const name of names) {
    if (!name || props?.[name] === undefined || props?.[name] === null || props?.[name] === '') continue;
    const value = Number(String(props[name]).replace(',', '.'));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function nearestRoadInfo(x, z) {
  let bestDist = Infinity;
  let bestAngle = 0;
  let bestSide = 1;
  for (const curve of roadCurves || []) {
    const samples = 28;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bestDist) {
        const tangent = curve.getTangentAt(t);
        bestDist = d;
        bestAngle = Math.atan2(tangent.x, tangent.z);
        const cross = tangent.x * (z - p.z) - tangent.z * (x - p.x);
        bestSide = cross >= 0 ? 1 : -1;
      }
    }
  }
  return { angle: bestAngle, side: bestSide, distance: Math.sqrt(bestDist) };
}

function furnitureRotationY(feature, x, z, mappedKey) {
  const props = feature?.properties || {};
  const fieldNames = namesWithMapping(mappedKey, [
    'planx_angle', 'planx_rotation', 'angle', 'rotation', 'rot',
    'heading', 'bearing', 'azimuth', 'direction', 'yon', 'yÃ¶n'
  ]);
  const deg = numericPropFirst(props, fieldNames);
  if (deg !== null) return -THREE.MathUtils.degToRad(deg);
  const info = nearestRoadInfo(x, z);
  if (mappedKey === 'light_angle_field') return info.angle + Math.PI;
  if (mappedKey === 'bench_angle_field' || mappedKey === 'busstop_angle_field') return info.angle + info.side * Math.PI / 2;
  if (mappedKey === 'trashbin_angle_field') return info.angle;
  return info.angle;
}

function buildFurnitureLayer() {
  clearGroup(furnitureGroup);
  const db = layerDataCache.furniture || {};
  const { lights, benches, bins, busstops } = db;
  
  // Materials
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4b2d, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
  const poolStyle = (category, current, fallbacks) => {
    const variants = assetPoolVariants(category);
    const allowed = variants.length ? variants : fallbacks;
    return allowed.includes(current) ? current : allowed[0];
  };
  const activeLightStyle = poolStyle('lights', settings.lightStyle, ['Modern Arc', 'Classic Post', 'Dual Head']);
  const activeBenchStyle = poolStyle('benches', settings.benchStyle, ['Wood Plank', 'Concrete Slab', 'Curved Metal']);
  const activeBinStyle = poolStyle('bins', settings.binStyle, ['Square Box', 'Cylinder', 'Dual Recycle']);
  const activeStopStyle = poolStyle('busstops', settings.stopStyle, ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin']);

  function getLightGeo() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4, 8), metalMat);
    pole.position.y = 2;
    const isNight = settings.timeOfDay < 6.5 || settings.timeOfDay > 17.5;
    const lampMat = new THREE.MeshStandardMaterial({
      color: isNight ? 0xffffee : 0xdddddd, 
      emissive: isNight ? 0xffcc88 : 0x000000,
      emissiveIntensity: isNight ? 2.0 : 0
    });
    if (activeLightStyle === 'Classic Post') {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), lampMat);
      lamp.position.set(0, 4.2, 0);
      g.add(pole, lamp);
    } else if (activeLightStyle === 'Dual Head') {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), metalMat);
      cross.position.y = 4;
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), lampMat);
      l1.position.set(0.5, 4, 0);
      const l2 = l1.clone();
      l2.position.set(-0.5, 4, 0);
      g.add(pole, cross, l1, l2);
    } else { // Modern Arc
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), metalMat);
      arm.position.set(0.3, 4, 0);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), lampMat);
      lamp.position.set(0.5, 3.95, 0);
      g.add(pole, arm, lamp);
    }
    return g;
  }

  function getBenchGeo() {
    const g = new THREE.Group();
    if (activeBenchStyle === 'Concrete Slab') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), new THREE.MeshStandardMaterial({color: 0x999999, roughness: 0.9}));
      b.position.y = 0.25;
      g.add(b);
    } else if (activeBenchStyle === 'Curved Metal') {
      const mMat = new THREE.MeshStandardMaterial({color: 0x555555, metalness: 0.6, roughness: 0.4});
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12, 1, false, 0, Math.PI), mMat);
      seat.rotation.z = Math.PI/2;
      seat.position.y = 0.3;
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.4), mMat);
      l1.position.set(0.7, 0.2, 0);
      const l2 = l1.clone();
      l2.position.set(-0.7, 0.2, 0);
      g.add(seat, l1, l2);
    } else { // Wood Plank
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), woodMat);
      seat.position.y = 0.4;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), woodMat);
      back.position.set(0, 0.7, -0.21);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.4), metalMat);
      leg1.position.set(0.6, 0.2, 0);
      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.4), metalMat);
      leg2.position.set(-0.6, 0.2, 0);
      g.add(seat, back, leg1, leg2);
    }
    return g;
  }

  function getBinGeo() {
    if (activeBinStyle === 'Square Box') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({color: 0x222222}));
      b.position.y = 0.4;
      return b;
    } else if (activeBinStyle === 'Dual Recycle') {
      const g = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.4), new THREE.MeshStandardMaterial({color: 0x225588}));
      b1.position.set(-0.22, 0.35, 0);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.4), new THREE.MeshStandardMaterial({color: 0x226622}));
      b2.position.set(0.22, 0.35, 0);
      g.add(b1, b2);
      return g;
    } else { // Cylinder
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.8, 12), new THREE.MeshStandardMaterial({color: 0x2d3748}));
      b.position.y = 0.4;
      return b;
    }
  }

  function getStopGeo() {
    const g = new THREE.Group();
    if (activeStopStyle === 'Minimal Canopy') {
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8), metalMat);
      pole1.position.set(-1.5, 1.4, -0.5);
      const pole2 = pole1.clone();
      pole2.position.set(1.5, 1.4, -0.5);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.1, 1.8), new THREE.MeshStandardMaterial({color: 0xdddddd}));
      roof.position.set(0, 2.8, 0);
      g.add(pole1, pole2, roof);
    } else if (activeStopStyle === 'Wood Cabin') {
      const wBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.6), woodMat);
      const wBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.1), woodMat);
      wBack.position.set(0, 1.2, -0.75);
      const wRoof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.8), woodMat);
      wRoof.position.set(0, 2.4, 0);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 1.5), woodMat);
      s1.position.set(-1.75, 1.2, 0);
      const s2 = s1.clone();
      s2.position.set(1.75, 1.2, 0);
      g.add(wBase, wBack, wRoof, s1, s2);
    } else { // Glass Shelter
      const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.5), metalMat);
      const wall1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 1.5), glassMat);
      wall1.position.set(-1.95, 1.25, 0);
      const wall2 = wall1.clone();
      wall2.position.set(1.95, 1.25, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 0.1), glassMat);
      back.position.set(0, 1.25, -0.7);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.8), metalMat);
      roof.position.y = 2.55;
      g.add(base, wall1, wall2, back, roof);
    }
    return g;
  }

  const lightGeo = getLightGeo();
  const benchGeo = getBenchGeo();
  const binMesh = getBinGeo();
  const stopGeo = getStopGeo();
  const angleFieldKeyByKind = {
    lights: 'light_angle_field',
    benches: 'bench_angle_field',
    bins: 'trashbin_angle_field',
    busstops: 'busstop_angle_field'
  };

  const placeItem = (feats, modelTemplate, kind) => {
    if (!feats || !feats.features) return;
    feats.features.forEach(f => {
      if (!f.geometry || f.geometry.type !== 'Point') return;
      const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
      const y = terrainLocalYAt(x, z) + Math.max(LAYER.content, LAYER.road) + 0.08;
      const m = modelTemplate.clone();
      m.position.set(x, y, z);
      m.rotation.y = furnitureRotationY(f, x, z, angleFieldKeyByKind[kind]);
      furnitureGroup.add(m);
    });
  };

  const isNight = settings.timeOfDay < 6.5 || settings.timeOfDay > 17.5;
  if (settings.showLights) {
    placeItem(lights, lightGeo, 'lights');
    if (isNight && lights && lights.features) {
      lights.features.forEach((f) => {
        if (!f.geometry || f.geometry.type !== 'Point') return;
        const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const y = terrainLocalYAt(x, z) + Math.max(LAYER.content, LAYER.road) + 4.2;
        const pl = new THREE.PointLight(0xffcc88, 1.4, 24);
        pl.position.set(x, y, z);
        furnitureGroup.add(pl);
      });
    }
  }
  if (settings.showBenches) placeItem(benches, benchGeo, 'benches');
  if (settings.showBins) placeItem(bins, binMesh, 'bins');
  if (settings.showBusStops) placeItem(busstops, stopGeo, 'busstops');
}

function getSemanticColor(fn) {
  const f = fn.toUpperCase();
  if (f.includes('KONUT') || f.includes('YERLEŞİK') || f.includes('MESKEN')) return '#f5e4c2';
  if (f.includes('OKUL') || f.includes('EĞİTİM') || f.includes('ÜNİVERSİTE')) return '#bfdbfe';
  if (f.includes('CAMİ') || f.includes('DİNİ') || f.includes('İBADET')) return '#d8f5e0';
  if (f.includes('TİCARET') || f.includes('ÇARŞI') || f.includes('AVM')) return '#fed7aa';
  if (f.includes('SAĞLIK') || f.includes('HASTANE') || f.includes('KLİNİK')) return '#fce7f3';
  if (f.includes('SPOR') || f.includes('STADYUM') || f.includes('ARENA')) return '#e0e7ff';
  if (f.includes('PARK') || f.includes('YEŞİL') || f.includes('BAHÇE')) return '#bbf7d0';
  if (f.includes('KAMU') || f.includes('İDARİ') || f.includes('BELEDİYE')) return '#ede9fe';
  if (f.includes('SANAYİ') || f.includes('ENDÜSTRİ') || f.includes('FABRİKA')) return '#e2e8f0';
  return '#f1f5f9';
}

function getFunctionIcon(fn) {
  const f = fn.toUpperCase();
  if (f.includes('KONUT') || f.includes('YERLEŞİK')) return '🏠';
  if (f.includes('OKUL') || f.includes('EĞİTİM')) return '🏫';
  if (f.includes('CAMİ') || f.includes('DİNİ')) return '🕌';
  if (f.includes('TİCARET') || f.includes('AVM')) return '🏪';
  if (f.includes('SAĞLIK') || f.includes('HASTANE')) return '🏥';
  if (f.includes('SPOR')) return '🏟️';
  if (f.includes('PARK') || f.includes('YEŞİL')) return '🌳';
  if (f.includes('KAMU') || f.includes('İDARİ')) return '🏛️';
  return '🏢';
}

async function buildBuildingLayer(yapilar) {
  clearGroup(buildingGroup);
  buildingFunctionMaterials.clear();

  const defaultFuncColors = ['#f1f5f9', '#dbeafe', '#fee2e2', '#dcfce7', '#fef3c7', '#ede9fe'];
  const facadeOptions = Object.keys(textureSets.facade);
  const functions = [...new Set(yapilar.features.map((f) => String(buildingFunctionValue(f.properties || {}))))];

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    if (!functionColorState[fn]) functionColorState[fn] = getSemanticColor(fn) || defaultFuncColors[i % defaultFuncColors.length];
    if (!functionFacadeState[fn]) functionFacadeState[fn] = facadeOptions[i % facadeOptions.length];
  }

  const roofTex = createRoofPresetTexture(settings.roofTexture);
  const roofTextureCache = { [settings.roofTexture]: roofTex };
  const facadeCache = {};
  for (const fn of functions) {
    const key = functionFacadeState[fn];
    if (!facadeCache[key]) {
      const src = textureSets.facade[key];
      if (src) facadeCache[key] = await loadTexture(src, 0.22, 0.22);
    }
  }
  // Per-building texture scale cache keyed by (facade_type + floor_count)
  const facadeScaleCache = {};

  for (const f of yapilar.features) {
    const props = f.properties || {};
    const fn = String(buildingFunctionValue(props));
    const levels = parseLevel(f.properties?.katadedi);
    const height = buildingHeightFromProps(props, levels);
    const featureColor = normalizeHexColor(propFirst(props, ['planx_color', 'planx_renk', 'color', 'renk']), functionColorState[fn]);
    const featureFacade = presetValue(propFirst(props, ['planx_facade', 'planx_texture', 'facade', 'cephe', 'doku']), textureSets.facade, functionFacadeState[fn]);
    const featureRoofTexture = presetValue(propFirst(props, ['planx_roof_texture', 'roof_texture', 'cati_doku', 'cati_texture']), textureSets.roof, settings.roofTexture);
    const featureRoofShape = roofShapeValue(propFirst(props, ['planx_roof_shape', 'roof_shape', 'cati_tipi']), settings.roofShape);
    const featureRoofColor = normalizeHexColor(propFirst(props, ['planx_roof_color', 'roof_color', 'cati_renk']), '#ffffff');

    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = new THREE.Shape();
      const footprint = [];
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < outer.length; i++) {
        const [x, z] = metersToLocal(outer[i][0], outer[i][1]);
        sx += outer[i][0];
        sy += outer[i][1];
        footprint.push(new THREE.Vector3(x, 0, z));
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
      }

      const baseY = buildingBaseYForOuterRing(outer);
      const footprintArea = parseNumberProp(props, ['taban_alani', 'footprint_area', 'aream2'], polygonAreaGeo(outer));
      const floorArea = parseNumberProp(props, namesWithMapping('building_floor_area_field', ['toplam_insaat', 'insaat_alani', 'floor_area', 'gross_area']), footprintArea * levels);
      const dwellings = parseNumberProp(props, namesWithMapping('building_dwelling_field', ['daire', 'daire_sayisi', 'dwelling', 'dwellings']), Math.max(1, Math.round(floorArea / 115)));
      const population = parseNumberProp(props, ['nufus', 'nüfus', 'population', 'pop'], Math.round(dwellings * 3.1));
      const vehicles = parseNumberProp(props, ['arac', 'araç', 'vehicle', 'cars'], Math.round(dwellings * 0.7));

      if (settings.buildingMode === 'Footprint only') {
        const fpGeo = new THREE.ShapeGeometry(shape);
        fpGeo.rotateX(Math.PI / 2);
        const fpMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(featureColor),
          roughness: 0.82,
          side: THREE.DoubleSide
        });
        const fp = new THREE.Mesh(fpGeo, fpMat);
        fp.position.y = baseY + 0.035;
        fp.receiveShadow = true;
        fp.renderOrder = 34;
        fp.userData = { ...(f.properties || {}), planx_calc_footprint_area: footprintArea, planx_calc_floor_area: floorArea, planx_calc_dwellings: dwellings, planx_calc_population: population, planx_calc_vehicles: vehicles };
        buildingGroup.add(fp);
        continue;
      }

      const extrude = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      extrude.rotateX(Math.PI / 2);
      extrude.computeBoundingBox();
      const minY = extrude.boundingBox ? extrude.boundingBox.min.y : 0;
      if (minY !== 0) extrude.translate(0, -minY, 0);

      // Clone texture per (facade_type, floor_count) so Y-repeat matches floor count
      if (!facadeCache[featureFacade]) {
        const src = textureSets.facade[featureFacade];
        if (src) facadeCache[featureFacade] = await loadTexture(src, 0.22, 0.22);
      }
      const texKey = `${featureFacade}_${levels}`;
      if (!facadeScaleCache[texKey]) {
        const base = facadeCache[featureFacade];
        if (base) {
          const t = base.clone();
          t.repeat.set(0.22, levels * 0.0275);
          t.needsUpdate = true;
          facadeScaleCache[texKey] = t;
        }
      }
      const facadeTex = facadeScaleCache[texKey] || facadeCache[featureFacade];
      if (!roofTextureCache[featureRoofTexture]) {
        roofTextureCache[featureRoofTexture] = createRoofPresetTexture(featureRoofTexture);
      }
      const featureRoofTex = roofTextureCache[featureRoofTexture];
      const isNight = settings.timeOfDay < 6.5 || settings.timeOfDay > 17.5;
      const matRoof = new THREE.MeshStandardMaterial({ map: featureRoofTex, color: new THREE.Color(featureRoofColor), roughness: 0.85 });
      const matWall = new THREE.MeshStandardMaterial({ 
        map: facadeTex, 
        color: new THREE.Color(featureColor), 
        roughness: 0.72,
        emissive: isNight ? new THREE.Color(0x333322) : new THREE.Color(0x000000),
        emissiveIntensity: isNight ? (Math.random() * 0.8 + 0.2) : 0
      });

      const b = new THREE.Mesh(extrude, [matRoof, matWall]);
      b.position.y = baseY;
      b.castShadow = true;
      b.receiveShadow = true;
      b.userData = {
        ...(f.properties || {}),
        planx_calc_footprint_area: footprintArea,
        planx_calc_floor_area: floorArea,
        planx_calc_dwellings: dwellings,
        planx_calc_population: population,
        planx_calc_vehicles: vehicles
      };
      buildingGroup.add(b);

      if (settings.buildingMode === 'Extruded + roof') {
        const roof = roofMeshFor(shape, footprint, baseY, height, featureRoofShape);
        roof.material.map = featureRoofTex;
        roof.material.color = new THREE.Color(featureRoofColor);
        roof.material.needsUpdate = true;
        roof.userData = b.userData;
        buildingGroup.add(roof);
      }
    }
  }
}

function createPedestrianModel(index = 0) {
  const variants = assetPoolVariants('pedestrians');
  const variant = variants[index % Math.max(1, variants.length)] || 'Commuter';
  const outfit = assetColor(variant, [0x1e293b, 0x334155, 0x475569, 0x0f766e][index % 4]);
  const accent = new THREE.Color(outfit).offsetHSL(0.02, -0.08, 0.08).getHex();
  const skin = [0xf2c7a0, 0xd7a67f, 0xb9825d, 0x8d5a3b][index % 4];
  const clothMat = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.82 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.88 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const root = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.82, 0.22), clothMat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skinMat);
  head.position.y = 1.58;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8), skinMat);
  neck.position.y = 1.39;
  root.add(body, head, neck);

  const makeLimb = (mat, length, width, yOffset, zOffset = 0) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), mat);
    mesh.position.y = -length * 0.5;
    mesh.position.z = zOffset;
    pivot.position.y = yOffset;
    pivot.add(mesh);
    return pivot;
  };
  const leftArm = makeLimb(clothMat, 0.62, 0.08, 1.34, 0);
  leftArm.position.x = -0.25;
  const rightArm = makeLimb(clothMat, 0.62, 0.08, 1.34, 0);
  rightArm.position.x = 0.25;
  const leftLeg = makeLimb(pantsMat, 0.72, 0.10, 0.68, 0);
  leftLeg.position.x = -0.11;
  const rightLeg = makeLimb(pantsMat, 0.72, 0.10, 0.68, 0);
  rightLeg.position.x = 0.11;
  root.add(leftArm, rightArm, leftLeg, rightLeg);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.24), shoeMat);
  leftShoe.position.set(-0.11, 0.02, -0.04);
  const rightShoe = leftShoe.clone();
  rightShoe.position.x = 0.11;
  root.add(leftShoe, rightShoe);
  root.scale.setScalar(0.95 + (index % 5) * 0.025);
  return { mesh: root, limbRefs: { leftArm, rightArm, leftLeg, rightLeg, leftShoe, rightShoe } };
}

async function buildRoadsAndTraffic(yollar) {
  clearGroup(roadGroup);
  clearGroup(carGroup);
  clearGroup(pedestrianGroup);
  roadCurves = [];
  vehicleRoadCurves = [];
  cars = [];
  pedestrians = [];

  let roadTex = null;
  if (settings.roadStyle === 'Asphalt') {
    roadTex = createAsphaltTexture();
  } else if (settings.roadStyle === 'Cobblestone') {
    roadTex = await loadTexture(textureSets.road.Cobblestone, 2, 20);
  }

  const roadMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.roadColor),
    map: roadTex,
    roughness: 0.97,
    transparent: !settings.showRoads,
    opacity: settings.showRoads ? 1.0 : 0.0
  });
  const amenityPoints = settings.roadColorMode === 'Amenity distance' ? estimateAmenityPoints() : [];

  for (const f of yollar.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const xzPts = [];
    for (const c of f.geometry.coordinates) {
      const [x, z] = metersToLocal(c[0], c[1]);
      xzPts.push(new THREE.Vector3(x, 0, z));
    }
    if (xzPts.length < 2) continue;

    // Resample XZ path every ~3 m and bake terrain Y so the curve hugs DEM surface
    const xzCurve = new THREE.CatmullRomCurve3(xzPts, false, 'centripetal');
    const roadLen = xzCurve.getLength();
    const nSamples = Math.max(xzPts.length, Math.ceil(roadLen / 3) + 1);
    const terrainPts = [];
    for (let i = 0; i <= nSamples; i++) {
      const tp = xzCurve.getPointAt(i / nSamples);
      tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.road;
      terrainPts.push(tp);
    }
    const curve = new THREE.CatmullRomCurve3(terrainPts, false, 'centripetal');
    roadCurves.push(curve);
    if (roadAllowsCars(f)) vehicleRoadCurves.push(curve);
    const segments = Math.max(24, terrainPts.length * 3);
    const centers = curve.getPoints(segments);
    const left = [];
    const right = [];
    for (let i = 0; i < centers.length; i++) {
      const p = centers[i];
      const t = curve.getTangent(i / (centers.length - 1));
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(settings.roadWidth * 0.5);
      left.push(new THREE.Vector3(p.x + n.x, p.y, p.z + n.z));
      right.push(new THREE.Vector3(p.x - n.x, p.y, p.z - n.z));
    }
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i < left.length; i++) {
      positions.push(left[i].x, left[i].y, left[i].z);
      positions.push(right[i].x, right[i].y, right[i].z);
      const v = i / Math.max(1, left.length - 1);
      uvs.push(0, v, 1, v);
    }
    for (let i = 0; i < left.length - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, c, d, b);
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();
    const featureRoadMat = roadMat.clone();
    featureRoadMat.color = roadVisualColor(f, amenityPoints);
    const mesh = new THREE.Mesh(roadGeo, featureRoadMat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 30;
    roadGroup.add(mesh);
  }

  if (settings.showCars && vehicleRoadCurves.length > 0) {
    const carVariants = assetPoolVariants('cars');
    const carColors = carVariants.length
      ? carVariants.map((name, index) => assetColor(name, [0x1f2937, 0x334155, 0x475569, 0x64748b, 0x0f766e][index % 5]))
      : [0x1f2937, 0x334155, 0x475569, 0x64748b, 0x0f766e];
    const spawnCount = Math.min(300, vehicleRoadCurves.length * Math.floor(10 * settings.carDensity));
    for (let i = 0; i < spawnCount; i++) {
      const curve = vehicleRoadCurves[Math.floor(Math.random() * vehicleRoadCurves.length)];
      const car = new THREE.Group();
      const cMat = new THREE.MeshStandardMaterial({ color: carColors[i % carColors.length], roughness: 0.25, metalness: 0.4 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    
    // Base body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4.2), cMat);
    body.position.y = 0.4;
    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), cMat);
    cabin.position.set(0, 0.95, 0.2);
    // Windows
    const winF = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), glassMat);
    winF.position.set(0, 0.95, -0.91);
    winF.rotation.x = -Math.PI + 0.3;
    const winB = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), glassMat);
    winB.position.set(0, 0.95, 1.31);
    winB.rotation.x = -0.3;

    const isNight = settings.timeOfDay < 6.5 || settings.timeOfDay > 17.5;
    const hMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: isNight ? 0xffffff : 0x000000, emissiveIntensity: isNight ? 5.0 : 0 });
    const bMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: isNight ? 0xff0000 : 0x000000, emissiveIntensity: isNight ? 5.0 : 0 });
    
    // Headlights (Front: -Z)
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), hMat);
    hlR.position.set(0.6, 0.5, -2.15);
    const hlL = hlR.clone();
    hlL.position.set(-0.6, 0.5, -2.15);

    // Headlight Beams (Fakelight cone)
    if (isNight) {
      const beamGeo = new THREE.ConeGeometry(1.5, 6, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffee, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
      const beamR = new THREE.Mesh(beamGeo, beamMat);
      beamR.position.set(0.6, 0.2, -5.0);
      beamR.rotation.x = -Math.PI / 2;
      const beamL = beamR.clone();
      beamL.position.set(-0.6, 0.2, -5.0);
      car.add(beamR, beamL);
    }

    // Brake lights (Back: +Z)
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.1), bMat);
    blR.position.set(0.6, 0.5, 2.15);
    const blL = blR.clone();
    blL.position.set(-0.6, 0.5, 2.15);

      car.add(body, cabin, winF, winB, hlR, hlL, blR, blL);
      carGroup.add(car);
      car.renderOrder = 40;
      cars.push({ car, curve, t: Math.random(), speed: 0.0002 + Math.random() * 0.0006 });
    }
  }

  if (!settings.showPedestrians || roadCurves.length === 0) return;
  const pedCount = Math.min(600, roadCurves.length * Math.floor(20 * settings.pedestrianDensity));
  for (let i = 0; i < pedCount; i++) {
    const curve = roadCurves[Math.floor(Math.random() * roadCurves.length)];
    const { mesh: pedGeo, limbRefs } = createPedestrianModel(i);
    pedestrianGroup.add(pedGeo);
    pedGeo.renderOrder = 41;
    pedestrians.push({
      mesh: pedGeo,
      limbRefs,
      curve: curve,
      t: Math.random(),
      speed: 0.0001 + Math.random() * 0.0001, // Slower than cars
      phase: Math.random() * Math.PI * 2,
      walkAmplitude: 0.45 + Math.random() * 0.15,
      offsetDir: (Math.random() > 0.5 ? 1 : -1) // Right or left sidewalk
    });
  }
}

function buildSidewalkPolygonLayer(sidewalks) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd8d2c2,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  for (const f of sidewalks.features || []) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = new THREE.Shape();
      outer.forEach((c, i) => {
        const [x, z] = metersToLocal(c[0], c[1]);
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
      });
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const vz = pos.getZ(vi);
        const isTop = pos.getY(vi) > -0.09;
        const baseDem = terrainLocalYAt(vx, vz);
        pos.setY(vi, baseDem + LAYER.road + (isTop ? 0.14 : 0.02));
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      mesh.renderOrder = 33;
      sidewalkGroup.add(mesh);
    }
  }
}

function buildSidewalkLayer(yollar, sidewalks = EMPTY_GEOJSON) {
  clearGroup(sidewalkGroup);
  if (!settings.showSidewalks) return;
  if (sidewalks?.features?.length) {
    buildSidewalkPolygonLayer(sidewalks);
    return;
  }

  const swWidth = 1.3;
  const swMat = new THREE.MeshStandardMaterial({ color: 0xc9bfa2, roughness: 0.95, metalness: 0.0 });

  for (const f of yollar.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const xzPtsW = [];
    for (const c of f.geometry.coordinates) {
      const [x, z] = metersToLocal(c[0], c[1]);
      xzPtsW.push(new THREE.Vector3(x, 0, z));
    }
    if (xzPtsW.length < 2) continue;
    const xzCurveW = new THREE.CatmullRomCurve3(xzPtsW, false, 'centripetal');
    const wLen = xzCurveW.getLength();
    const nW = Math.max(xzPtsW.length, Math.ceil(wLen / 6) + 1);
    const wPts = [];
    for (let i = 0; i <= nW; i++) {
      const tp = xzCurveW.getPointAt(i / nW);
      tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.road + 0.13;
      wPts.push(tp);
    }
    const curve = new THREE.CatmullRomCurve3(wPts, false, 'centripetal');
    const segments = Math.max(24, wPts.length * 3);
    const centers = curve.getPoints(segments);

    for (const side of [-1, 1]) {
      const innerOff = settings.roadWidth * 0.5 * side;
      const outerOff = (settings.roadWidth * 0.5 + swWidth) * side;
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i < centers.length; i++) {
        const p = centers[i];
        const tang = curve.getTangent(i / (centers.length - 1));
        const n = new THREE.Vector3(-tang.z, 0, tang.x).normalize();
        const li = new THREE.Vector3(p.x + n.x * innerOff, p.y, p.z + n.z * innerOff);
        const ri = new THREE.Vector3(p.x + n.x * outerOff, p.y, p.z + n.z * outerOff);
        positions.push(li.x, li.y, li.z, ri.x, ri.y, ri.z);
        const v = i / Math.max(1, centers.length - 1);
        uvs.push(0, v, 1, v);
      }

      for (let i = 0; i < centers.length - 1; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, c, b, c, d, b);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, swMat);
      mesh.receiveShadow = true;
      mesh.renderOrder = 32;
      sidewalkGroup.add(mesh);
    }
  }
}

function buildCrosswalkLayer(yollar) {
  clearGroup(crosswalkGroup);
  if (!settings.showCrosswalks) return;

  const cwMat = new THREE.MeshStandardMaterial({ color: 0xf0ede5, roughness: 0.85 });
  const stripeW = 0.38;
  const stripeGap = 0.30;
  const stripeCount = 5;
  const cwLen = settings.roadWidth + 2.6;
  const totalLen = stripeCount * stripeW + (stripeCount - 1) * stripeGap;

  for (const f of yollar.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;

    const [px, pz] = metersToLocal(coords[0][0], coords[0][1]);
    const [nx, nz] = metersToLocal(coords[1][0], coords[1][1]);
    const y = terrainLocalYAt(px, pz) + LAYER.road + 0.018;

    const dx = nx - px;
    const dz = nz - pz;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) continue;

    const rdx = dx / len;
    const rdz = dz / len;
    const roadAngle = Math.atan2(rdx, rdz);

    for (let s = 0; s < stripeCount; s++) {
      const offset = -totalLen / 2 + s * (stripeW + stripeGap) + stripeW / 2;
      const stripeGeo = new THREE.BoxGeometry(cwLen, 0.02, stripeW);
      const stripe = new THREE.Mesh(stripeGeo, cwMat);
      stripe.position.set(px + rdx * offset, y, pz + rdz * offset);
      stripe.rotation.y = roadAngle;
      stripe.renderOrder = 35;
      crosswalkGroup.add(stripe);
    }
  }
}

function buildRoiBoundary(roi) {
  clearGroup(roiBoundaryGroup);
  if (!roi || !roi.features.length) return;
  const mat = new THREE.LineBasicMaterial({ color: 0xff4444, linewidth: 2, depthTest: false });
  for (const f of roi.features) {
    if (!f.geometry) continue;
    const rings = f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates;
    for (const poly of rings) {
      for (const ring of poly) {
        const pts = [];
        for (const c of ring) {
          const [lx, lz] = metersToLocal(c[0], c[1]);
          const y = terrainLocalYAt(lx, lz) + 2.5;
          pts.push(new THREE.Vector3(lx, y, lz));
        }
        if (pts.length < 2) continue;
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        roiBoundaryGroup.add(new THREE.Line(geo, mat));
      }
    }
  }
}

async function rebuildScene() {
  const loadingText = document.getElementById('loading-text');
  loadingText.innerText = t('loadingData');
  setSceneState('Veri yukleniyor');

  if (!layerDataCache) {
    loadingText.innerText = 'GeoJSON yukleniyor...';
    projectManifest = await loadManifest();
    applyManifestDefaults();
    const rasterMode = isRasterTextureMode();
    const adalar = await loadGeoJson('../data/yerlesim/myblocks.geojson', { required: !rasterMode, label: 'Blocks' });
    const yapilar = await loadGeoJson('../data/yerlesim/mybuildings.geojson', { required: true, label: 'Buildings' });
    const yollar = await loadGeoJson('../data/yerlesim/myroads.geojson', { required: true, label: 'Roads' });
    const agaclar = await loadGeoJson('../data/yerlesim/mytrees.geojson', { label: 'Trees' });
    const lights = await loadGeoJson('../data/yerlesim/mylights.geojson', { label: 'Lights' });
    const benches = await loadGeoJson('../data/yerlesim/mybenches.geojson', { label: 'Benches' });
    const bins = await loadGeoJson('../data/yerlesim/mytrashbins.geojson', { label: 'Trash bins' });
    const busstops = await loadGeoJson('../data/yerlesim/mybusstops.geojson', { label: 'Bus stops' });
    
    const roi = await loadGeoJson('../data/yerlesim/roi.geojson', { required: true, label: 'ROI' });
    layerDataCache = {
       adalar, yapilar, yollar, agaclar, parseller: null, hardscape: null, sidewalks: null,
       furniture: { lights, benches, bins, busstops }, roi
    };
  }
  if (settings.showParcels && !layerDataCache.parseller) {
    layerDataCache.parseller = await loadGeoJson('../data/yerlesim/myparcels.geojson', { required: !isRasterTextureMode(), label: 'Parcels' });
  }
  if (settings.showHardscape && !layerDataCache.hardscape) {
    layerDataCache.hardscape = await loadGeoJson('../data/yerlesim/myhardscape.geojson', { label: 'Hardscape' });
  }
  if (settings.showWindPlumes && !layerDataCache.hardscape) {
    layerDataCache.hardscape = await loadGeoJson('../data/yerlesim/myhardscape.geojson', { label: 'Hardscape' });
  }
  if (settings.showSidewalks && !layerDataCache.sidewalks) {
    layerDataCache.sidewalks = await loadGeoJson('../data/yerlesim/mysidewalks.geojson', { label: 'Sidewalks' });
  }
  
  const { adalar, yapilar, yollar, agaclar } = layerDataCache;
  const parseller = layerDataCache.parseller;
  const hardscape = layerDataCache.hardscape;
  const sidewalks = layerDataCache.sidewalks;
  updateDashboard(layerDataCache);

  // Calculate and update stats
  const statDiv = document.getElementById('stats-content');
  if (statDiv) {
    const blockCount = adalar.features.length;
    const parcelCount = parseller ? parseller.features.length : '-';
    const bldCount = yapilar.features.length;
    let totalFloors = 0;
    const funcMap = {};
    yapilar.features.forEach(f => {
       const fn = buildingFunctionValue(f.properties || {});
       funcMap[fn] = (funcMap[fn] || 0) + 1;
       totalFloors += parseLevel(f.properties?.katadedi);
    });
    const avgFlr = (bldCount > 0 ? (totalFloors / bldCount).toFixed(1) : 0);
    
    let html = `<div class="stat-row"><span>${t('statBld')}</span><span class="stat-val">${bldCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statBlock')}</span><span class="stat-val">${blockCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statFlr')}</span><span class="stat-val">${avgFlr}</span></div>`;
    if (parseller) html += `<div class="stat-row"><span>${t('statParcel')}</span><span class="stat-val">${parcelCount}</span></div>`;
    const topFuncs = Object.entries(funcMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    topFuncs.forEach(([k, v]) => {
      const icon = getFunctionIcon(k);
      html += `<div class="stat-row stat-func"><span>${icon} ${k.slice(0, 20)}</span><span class="stat-val">${v}</span></div>`;
    });
    statDiv.innerHTML = html;
  }

  if (layerDataCache.roi && layerDataCache.roi.features.length > 0) {
    bounds = geometryBounds(layerDataCache.roi.features);
  } else {
    const islandBounds = geometryBounds(adalar.features);
    const roadBounds = geometryBounds(yollar.features);
    bounds = mergeBounds(islandBounds, roadBounds);
  }
  centerX = (bounds.minX + bounds.maxX) / 2;
  centerY = (bounds.minY + bounds.maxY) / 2;

  if (!demReady && !demLoadingStarted) {
    demLoadingStarted = true;
    loadingText.innerText = 'DEM okunuyor...';
    setSceneState('DEM okunuyor');
    loadProjectDem()
      .then(() => rebuildScene())
      .catch((err) => {
        console.error('DEM yükleme hatası:', err);
        setStatus(t('demFail'));
      });
  }
  if (terrainMesh) {
    world.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    terrainMesh = null;
  }
  clearGroup(terrainSideGroup);
  if (isRasterTextureMode() && settings.showTerrainTexture && !terrainTexture) {
    try {
      loadingText.innerText = 'Plan texture okunuyor...';
      setSceneState('Plan texture');
      terrainTexture = await loadTerrainTextureFromGeoTiff();
    } catch (err) {
      console.warn('Plan texture yuklenemedi, pavement ile devam ediliyor.', err);
      setStatus('Plan texture yuklenemedi; varsayilan zeminle devam.');
    }
  }
  if (settings.showXyzTiles && projectManifest?.baseMapTexture && !baseMapTexture) {
    try {
      loadingText.innerText = 'QGIS basemap texture okunuyor...';
      setSceneState('Basemap');
      baseMapTexture = await loadBaseMapTexture();
    } catch (err) {
      console.warn('QGIS basemap texture yuklenemedi, zemin dokusu ile devam ediliyor.', err);
      setStatus('QGIS basemap texture yuklenemedi; varsayilan zeminle devam.');
    }
  }
  loadingText.innerText = 'Terrain kuruluyor...';
  setSceneState('Terrain');
  await buildTerrain(adalar);

  loadingText.innerText = t('processing');
  setSceneState('Katmanlar');
  if (!isRasterTextureMode() || adalar.features.length) await buildIslandLayer(adalar); else clearGroup(islandGroup);
  if (settings.showParcels && parseller) buildParcelLayer(parseller); else clearGroup(parcelGroup);
  if (settings.showHardscape && hardscape) await buildHardscapeLayer(hardscape); else clearGroup(hardscapeGroup);
  buildWindPlumeLayer();
  if (settings.showBuildings) await buildBuildingLayer(yapilar); else clearGroup(buildingGroup);
  await buildRoadsAndTraffic(yollar);
  if (settings.showSidewalks) buildSidewalkLayer(yollar, sidewalks); else clearGroup(sidewalkGroup);
  if (settings.showCrosswalks) buildCrosswalkLayer(yollar); else clearGroup(crosswalkGroup);
  if (settings.showTrees) buildTreeLayer(agaclar); else clearGroup(treeGroup);
  if (settings.showFurniture) buildFurnitureLayer(); else clearGroup(furnitureGroup);
  rebuildMinimapBg();
  updateDockControls();
  renderFunctionStyleDock();
  updateDashboard(layerDataCache);
  setSceneState('Hazir');

  document.getElementById('loading').style.opacity = 0;
  setTimeout(() => (document.getElementById('loading').style.display = 'none'), 450);
}

let globalGui = null;
let functionGuiRefs = null;

function setSceneState(text, kind = 'ok') {
  const pill = document.getElementById('scene-state');
  if (!pill) return;
  pill.textContent = text;
  pill.style.background = kind === 'warn' ? '#fef3c7' : '#dff7ef';
  pill.style.color = kind === 'warn' ? '#92400e' : '#0f766e';
}

function updateDashboard(data) {
  if (!data) return;
  const adalar = data.adalar || EMPTY_GEOJSON;
  const yapilar = data.yapilar || EMPTY_GEOJSON;
  const yollar = data.yollar || EMPTY_GEOJSON;
  const agaclar = data.agaclar || EMPTY_GEOJSON;
  const parseller = data.parseller || EMPTY_GEOJSON;
  const hardscape = data.hardscape || EMPTY_GEOJSON;
  const sidewalks = data.sidewalks || EMPTY_GEOJSON;
  const furniture = data.furniture || {};

  const bldCount = yapilar.features.length;
  const blockCount = adalar.features.length;
  const parcelCount = parseller?.features?.length || 0;
  let totalFloors = 0;
  let totalPopulation = 0;
  let totalDwellings = 0;
  let totalVehicles = 0;
  const funcMap = {};
  yapilar.features.forEach((f) => {
    const fn = buildingFunctionValue(f.properties || {});
    funcMap[fn] = (funcMap[fn] || 0) + 1;
    totalFloors += parseLevel(f.properties?.katadedi);
    const metrics = estimateBuildingFeatureMetrics(f);
    totalPopulation += metrics.population || 0;
    totalDwellings += metrics.dwellings || 0;
    totalVehicles += metrics.vehicles || 0;
  });
  const avgFlr = bldCount > 0 ? (totalFloors / bldCount).toFixed(1) : '-';

  const setMetric = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setMetric('metric-buildings', bldCount);
  setMetric('metric-blocks', isRasterTextureMode() && !blockCount ? 'texture' : blockCount);
  setMetric('metric-parcels', isRasterTextureMode() && !parcelCount ? 'texture' : (parcelCount || '-'));
  setMetric('metric-floors', avgFlr);
  setMetric('metric-population', Math.round(totalPopulation));
  setMetric('metric-dwellings', Math.round(totalDwellings));
  setMetric('metric-vehicles', Math.round(totalVehicles));

  const meta = document.getElementById('project-meta');
  if (meta) {
    if (projectManifest) {
      const title = projectManifest.project?.title || 'PlanX 3D City Project';
      const exportedAt = projectManifest.exportedAt ? new Date(projectManifest.exportedAt).toLocaleString() : '-';
      const crs = projectManifest.summary?.crs?.length ? projectManifest.summary.crs.join(', ') : 'CRS bilgisi yok';
      const modeLabel = isRasterTextureMode() ? 'Raster Plan Texture' : 'Vector Plan';
      const accessField = projectManifest.roadAccess?.field ? `<br>Traffic filter: ${projectManifest.roadAccess.field}` : '';
      const themeLabel = projectManifest.assetTheme || settings.assetTheme || 'Modern Urban';
      meta.innerHTML = `<strong>${title}</strong><br>Mode: ${modeLabel}<br>Asset theme: ${themeLabel}<br>Export: ${exportedAt}<br>CRS: ${crs}${accessField}`;
    } else {
      meta.textContent = 'Manifest yok: veri klasoru eski bir export olabilir, viewer yine yuklenir.';
    }
  }

  const health = document.getElementById('data-health');
  if (health) {
    const manifestEmpty = new Set(projectManifest?.summary?.emptyOptionalInputs || []);
    const optional = [
      ['blocks', 'Blocks', adalar.features.length],
      ['parcels', 'Parcels', parcelCount],
      ['roads', 'Roads', yollar.features.length],
      ['trees', 'Trees', agaclar.features.length],
      ['hardscape', 'Hardscape', hardscape?.features?.length || 0],
      ['sidewalks', 'Sidewalks', sidewalks?.features?.length || 0],
      ['lights', 'Lights', furniture.lights?.features?.length || 0],
      ['benches', 'Benches', furniture.benches?.features?.length || 0],
      ['busstops', 'Stops', furniture.busstops?.features?.length || 0],
    ];
    health.innerHTML = optional.map(([key, name, count]) =>
      `<span class="health-chip ${count ? 'ok' : 'empty'}">${name}: ${count || (manifestEmpty.has(key) ? 'bos export' : 'yok')}</span>`
    ).join('');
  }

  const topFuncs = Object.entries(funcMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const statDiv = document.getElementById('stats-content');
  if (statDiv) {
    let html = `<div class="stat-row"><span>${t('statBld')}</span><span class="stat-val">${bldCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statBlock')}</span><span class="stat-val">${blockCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statParcel')}</span><span class="stat-val">${parcelCount || '-'}</span></div>`;
    html += `<div class="stat-row"><span>${t('statFlr')}</span><span class="stat-val">${avgFlr}</span></div>`;
    topFuncs.forEach(([k, v]) => {
      const icon = getFunctionIcon(k);
      html += `<div class="stat-row stat-func"><span>${icon} ${String(k).slice(0, 20)}</span><span class="stat-val">${v}</span></div>`;
    });
    statDiv.innerHTML = html;
  }
}

function addGui() {
  if (globalGui) globalGui.destroy();
  globalGui = new GUI({ title: t('guiTitle') });

  const env = globalGui.addFolder(t('env'));
  env.add(settings, 'fogDensity', 0.0001, 0.002, 0.0001).name(t('fog')).onChange(checkTimeChange);

  const fx = globalGui.addFolder(t('fxFolder'));
  fx.add(settings, 'timeOfDay', 0, 24, 0.1).name(t('timeOfDay')).onChange(checkTimeChange);
  fx.add(settings, 'autoTime').name(t('autoTime'));
  fx.add(settings, 'autoTimeSpeed', 0.5, 8, 0.5).name(t('autoTimeSpd'));
  fx.add(settings, 'weather', ['Clear', 'Rain', 'Snow']).name(t('weather')).onChange(updateWeather);
  fx.add(settings, 'enableSSAO').name(t('sSsa'));
  fx.add(settings, 'enableBloom').name(t('sBloom')).onChange(checkTimeChange);

  const terrain = globalGui.addFolder(t('terrain'));
  terrain.add(settings, 'showTerrainTexture').name('Plan texture').onChange(rebuildScene);
  terrain.add(settings, 'terrainTextureOpacity', 0.1, 1.0, 0.05).name('Texture opacity').onChange(rebuildScene);
  terrain.add(settings, 'terrainTextureBrightness', 0.5, 1.5, 0.05).name('Texture brightness').onChange(() => { terrainTexture = null; rebuildScene(); });
  terrain.add(settings, 'terrainTextureContrast', 0.5, 1.8, 0.05).name('Texture contrast').onChange(() => { terrainTexture = null; rebuildScene(); });
  terrain.add(settings, 'showTerrainSides').name('Build sides').onChange(rebuildScene);
  terrain.add(settings, 'terrainSideDrop', 0, 40, 0.5).name('Side drop from DEM min').onChange(rebuildScene);
  terrain.addColor(settings, 'terrainSideColor').name('Side color').onChange(rebuildScene);
  terrain.add(settings, 'demMeshQuality', 48, 360, 8).name('DEM mesh quality').onChange(rebuildScene);
  terrain.add(settings, 'terrainAnalysisMode', ['Texture', 'Elevation tint', 'Slope tint']).name('Topography view').onChange(rebuildScene);
  terrain.add(settings, 'pavementStyle', Object.keys(textureSets.pavement)).name(t('pavement')).onChange(rebuildScene);
  terrain.add(settings, 'showHardscape').name(t('showHardscape')).onChange(rebuildScene);
  terrain.add(settings, 'hardscapeStyle', Object.keys(textureSets.hardscape)).name(t('hardTex')).onChange(rebuildScene);
  terrain.add(settings, 'hardscapeHeight', 0.0, 2.0, 0.05).name(t('hardH')).onChange(rebuildScene);
  terrain.addColor(settings, 'islandColor').name(t('islCol')).onChange(rebuildScene);
  terrain.add(settings, 'islandTexture', Object.keys(textureSets.island)).name(t('islTex')).onChange(rebuildScene);

  const parcels = globalGui.addFolder(t('parcels'));
  parcels.add(settings, 'showParcels').name(t('showParcels')).onChange(rebuildScene);
  parcels.addColor(settings, 'parcelBoundaryColor').name(t('boundCol')).onChange(rebuildScene);
  parcels.add(settings, 'parcelBoundaryOpacity', 0.05, 1.0, 0.01).name(t('boundOp')).onChange(rebuildScene);

  const bld = globalGui.addFolder(t('bld'));
  bld.add(settings, 'buildingMode', ['Footprint only', 'Extruded', 'Extruded + roof']).name('Building mode').onChange(rebuildScene);
  bld.add(settings, 'floorHeight', 2.8, 3.6, 0.05).name(t('floorH')).onChange(rebuildScene);
  bld.add(settings, 'roofShape', ['Flat', 'Pyramid', 'Gable', 'Cone', 'Prism']).name(t('roofShape')).onChange(rebuildScene);
  bld.add(settings, 'roofHeight', 0.5, 6.0, 0.1).name(t('roofH')).onChange(rebuildScene);
  bld.add(settings, 'roofTexture', Object.keys(textureSets.roof)).name(t('roofTex')).onChange(rebuildScene);

  const roads = globalGui.addFolder(t('roads'));
  roads.add(settings, 'roadStyle', Object.keys(textureSets.road)).name('Asphalt Style').onChange(rebuildScene);
  roads.add(settings, 'showCars').name(t('showCars')).onChange(rebuildScene);
  roads.add(settings, 'carDensity', 0.0, 1.0, 0.1).name(t('carDensity')).onChange(rebuildScene);
  roads.add(settings, 'showRoads').name(t('showRoads')).onChange(rebuildScene);
  roads.add(settings, 'roadColorMode', ['Default', 'Amenity distance', 'Access / traffic']).name('Road analysis').onChange(rebuildScene);
  roads.addColor(settings, 'roadColor').name(t('roadCol')).onChange(rebuildScene);
  roads.add(settings, 'roadWidth', 2.8, 8.0, 0.1).name(t('roadW')).onChange(rebuildScene);
  roads.add(settings, 'trafficSpeed', 0, 5, 0.1).name(t('trafficSpd'));
  roads.add(settings, 'showSidewalks').name(t('showSidewalks')).onChange(rebuildScene);
  roads.add(settings, 'showCrosswalks').name(t('showCrosswalks')).onChange(rebuildScene);
  roads.add(settings, 'showPedestrians').onChange(rebuildScene);
  roads.add(settings, 'pedestrianDensity', 0.0, 1.0, 0.1).name(t('pedDensity')).onChange(rebuildScene);

  const analysis = globalGui.addFolder('Plan Analysis');
  analysis.add(settings, 'showWindPlumes').name('Wind plume risk').onChange(rebuildScene);
  analysis.add(settings, 'windDirectionDeg', 0, 359, 1).name('Wind direction').onChange(rebuildScene);
  analysis.add(settings, 'windPlumeDistance', 40, 600, 10).name('Plume distance').onChange(rebuildScene);
  
  const sfGroup = globalGui.addFolder(t('sfFolder'));
  sfGroup.add(settings, 'showLights').name(t('sfLights')).onChange(rebuildScene);
  sfGroup.add(settings, 'lightStyle', ['Modern Arc', 'Classic Post', 'Dual Head']).onChange(rebuildScene);
  sfGroup.add(settings, 'showBenches').name(t('sfBenches')).onChange(rebuildScene);
  sfGroup.add(settings, 'benchStyle', ['Wood Plank', 'Concrete Slab', 'Curved Metal']).onChange(rebuildScene);
  sfGroup.add(settings, 'showBins').name(t('sfBins')).onChange(rebuildScene);
  sfGroup.add(settings, 'binStyle', ['Square Box', 'Cylinder', 'Dual Recycle']).onChange(rebuildScene);
  sfGroup.add(settings, 'showBusStops').name(t('sfStops')).onChange(rebuildScene);
  sfGroup.add(settings, 'stopStyle', ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin']).onChange(rebuildScene);

  const style = globalGui.addFolder(t('funcCol'));
  const facade = globalGui.addFolder(t('funcFac'));
  const refreshFunctionGui = async () => {
    while (style.controllers.length) style.controllers[0].destroy();
    while (facade.controllers.length) facade.controllers[0].destroy();
    const keys = Object.keys(functionColorState);
    keys.forEach((k) => {
      style.addColor(functionColorState, k).name(k.slice(0, 16)).onFinishChange(rebuildScene);
      facade.add(functionFacadeState, k, Object.keys(textureSets.facade)).name(k.slice(0, 16)).onFinishChange(rebuildScene);
    });
  };

  functionGuiRefs = { refreshFunctionGui };
  if (Object.keys(functionColorState).length > 0) refreshFunctionGui();
  globalGui.close();
  if (globalGui.domElement) globalGui.domElement.style.display = 'none';
}

addGui();

// Building hover highlight helpers
function _unhoverBuilding() {
  if (!_hoveredBldg) return;
  const mat = Array.isArray(_hoveredBldg.material) ? _hoveredBldg.material[1] : _hoveredBldg.material;
  mat.emissive.copy(_hovEmissive);
  mat.emissiveIntensity = _hovEmissiveIntensity;
  _hoveredBldg = null;
}
function _doHoverBuilding(mesh) {
  if (mesh === _hoveredBldg) return;
  _unhoverBuilding();
  _hoveredBldg = mesh;
  const mat = Array.isArray(mesh.material) ? mesh.material[1] : mesh.material;
  _hovEmissive.copy(mat.emissive);
  _hovEmissiveIntensity = mat.emissiveIntensity;
  mat.emissive.setHex(0x1a5c44);
  mat.emissiveIntensity = 1.4;
}

// Hover tooltip (DOM-based, no CSS2DRenderer overhead)
const hoverTip = document.getElementById('bldg-hover-tip');
let _hoverThrottle = 0;
window.addEventListener('mousemove', (e) => {
  if (isWalkMode || isGameMode) { if (hoverTip) hoverTip.style.display = 'none'; _unhoverBuilding(); return; }
  if (e.target.closest('#ui-container') || e.target.closest('.lil-gui') || e.target.closest('#recording-container')) {
    if (hoverTip) hoverTip.style.display = 'none'; _unhoverBuilding(); return;
  }
  const now = performance.now();
  if (now - _hoverThrottle < 40) return;
  _hoverThrottle = now;

  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const hits = rc.intersectObjects(buildingGroup.children);

  if (!hits.length) {
    _unhoverBuilding();
    if (hoverTip) hoverTip.style.display = 'none';
    return;
  }
  _doHoverBuilding(hits[0].object);
  if (hoverTip) {
    const p = hits[0].object.userData || {};
    const icon = getFunctionIcon(p.uipfonksiyon || '');
    const floors = p.katadedi ? `${p.katadedi} ${t('biKat').toLowerCase()}` : '-';
    hoverTip.innerHTML = `<div class="tooltip-title">${icon} ${(p.uipfonksiyon || '-').slice(0, 26)}</div><div class="tooltip-row"><span>${t('biKat')}</span><span>${floors}</span></div>`;
    hoverTip.style.display = 'block';
    const tx = Math.min(e.clientX + 16, innerWidth - 200);
    const ty = Math.max(e.clientY - 60, 8);
    hoverTip.style.left = tx + 'px';
    hoverTip.style.top = ty + 'px';
  }
});
window.addEventListener('mouseleave', () => { _unhoverBuilding(); if (hoverTip) hoverTip.style.display = 'none'; });

// Click: show full detail panel
const detailTip = document.getElementById('bldg-detail-tip');
let _detailOpen = false;
window.addEventListener('click', (e) => {
  if (isWalkMode || isGameMode) return;
  if (e.target.closest('#ui-container') || e.target.closest('.lil-gui') || e.target.closest('#recording-container')) return;
  if (e.target.closest('#bldg-detail-tip')) return;

  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const hits = rc.intersectObjects(buildingGroup.children);

  if (!hits.length) {
    if (detailTip) { detailTip.style.display = 'none'; _detailOpen = false; }
    return;
  }
  const p = hits[0].object.userData || {};
  const icon = getFunctionIcon(p.uipfonksiyon || '');
  const areaStr = p.aream2 ? `${parseFloat(p.aream2).toFixed(0)} m²` : '-';
  const calcFootprintArea = parseNumberProp(p, ['planx_calc_footprint_area', 'taban_alani', 'footprint_area'], null);
  const calcFloorArea = parseNumberProp(p, ['planx_calc_floor_area', 'toplam_insaat', 'insaat_alani'], null);
  const calcPopulation = parseNumberProp(p, ['planx_calc_population', 'nufus', 'nüfus', 'population'], null);
  const calcDwellings = parseNumberProp(p, ['planx_calc_dwellings', 'daire', 'daire_sayisi', 'dwellings'], null);
  const calcVehicles = parseNumberProp(p, ['planx_calc_vehicles', 'arac', 'araç', 'vehicle', 'cars'], null);
  const styleRows = [
    ['Renk', p.planx_color || p.renk],
    ['Cephe', p.planx_facade],
    ['Cati', p.planx_roof_shape],
    ['Cati doku', p.planx_roof_texture],
  ].filter(([, value]) => value);
  if (detailTip) {
    detailTip.innerHTML = `
      <div class="tooltip-title">${icon} ${t('binaInfo')} <span class="tip-close" onclick="this.closest('#bldg-detail-tip').style.display='none'">✕</span></div>
      <div class="tooltip-row"><span>${t('biFonk')}</span><span>${(p.uipfonksiyon || '-').slice(0, 24)}</span></div>
      <div class="tooltip-row"><span>${t('biKat')}</span><span>${p.katadedi || '-'}</span></div>
      <div class="tooltip-row"><span>${t('biNiz')}</span><span>${p.nizam || '-'}</span></div>
      ${p.taks != null ? `<div class="tooltip-row"><span>TAKS</span><span>${p.taks}</span></div>` : ''}
      ${p.kaks != null ? `<div class="tooltip-row"><span>KAKS</span><span>${p.kaks}</span></div>` : ''}
      <div class="tooltip-row"><span>Taban alanı</span><span>${areaStr}</span></div>
      ${calcFootprintArea ? `<div class="tooltip-row"><span>Hesaplanan taban</span><span>${calcFootprintArea.toFixed(0)} m²</span></div>` : ''}
      ${calcFloorArea ? `<div class="tooltip-row"><span>Toplam inşaat</span><span>${calcFloorArea.toFixed(0)} m²</span></div>` : ''}
      ${calcPopulation !== null ? `<div class="tooltip-row"><span>Tahmini nüfus</span><span>${calcPopulation.toFixed(0)}</span></div>` : ''}
      ${calcDwellings !== null ? `<div class="tooltip-row"><span>Tahmini daire</span><span>${calcDwellings.toFixed(0)}</span></div>` : ''}
      ${calcVehicles !== null ? `<div class="tooltip-row"><span>Tahmini araç</span><span>${calcVehicles.toFixed(0)}</span></div>` : ''}
      ${styleRows.map(([label, value]) => `<div class="tooltip-row"><span>${label}</span><span>${value}</span></div>`).join('')}
    `;
    detailTip.style.display = 'block';
    _detailOpen = true;
  }
});

// Double-click: fly camera to building
window.addEventListener('dblclick', (e) => {
  if (isWalkMode || isGameMode) return;
  if (e.target.closest('#ui-container') || e.target.closest('.lil-gui') || e.target.closest('#recording-container')) return;
  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const hits = rc.intersectObjects(buildingGroup.children);
  if (!hits.length) return;
  const pt = hits[0].point.clone();
  const dir = camera.position.clone().sub(pt).normalize();
  _flyOrigin = camera.position.clone();
  _flyTarget = pt.clone().addScaledVector(dir, 70).add(new THREE.Vector3(0, 25, 0));
  _flyControlsTarget = pt.clone();
  _flyT = 0;
  _lastCameraMove = performance.now();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


const walkBtn = document.getElementById('walk-toggle');
if (walkBtn) {
  walkBtn.addEventListener('click', () => {
    if (!isWalkMode) walkControls.lock();
    else walkControls.unlock();
  });
}
walkControls.addEventListener('lock', () => {
  isWalkMode = true;
  controls.enabled = false;
  if(walkBtn) walkBtn.classList.add('active');
  document.getElementById('walk-hud')?.classList.remove('hidden');
  const ty = terrainLocalYAt(camera.position.x, camera.position.z);
  camera.position.y = ty + 1.8;
});
walkControls.addEventListener('unlock', () => {
  isWalkMode = false;
  controls.enabled = true;
  moveForward = moveBackward = moveLeft = moveRight = false;
  sprintWalk = false;
  crouchWalk = false;
  if(walkBtn) walkBtn.classList.remove('active');
  document.getElementById('walk-hud')?.classList.add('hidden');
  // Also exit game mode if pointer unlocked
  if (isGameMode) {
    isGameMode = false;
    const gameBtn = document.getElementById('game-toggle');
    if (gameBtn) gameBtn.classList.remove('active');
    const gameHud = document.getElementById('game-hud');
    if (gameHud) gameHud.classList.add('hidden');
  }
});

const gameBtn = document.getElementById('game-toggle');
if (gameBtn) {
  gameBtn.addEventListener('click', () => {
    if (!isGameMode) {
      // Enter walk mode first, then game mode
      if (!isWalkMode) walkControls.lock();
      isGameMode = true;
      gameBtn.classList.add('active');
      const gameHud = document.getElementById('game-hud');
      if (gameHud) gameHud.classList.remove('hidden');
      const scoreEl = document.getElementById('game-score');
      if (scoreEl) scoreEl.textContent = gameScore;
    } else {
      isGameMode = false;
      gameBtn.classList.remove('active');
      const gameHud = document.getElementById('game-hud');
      if (gameHud) gameHud.classList.add('hidden');
    }
  });
}

function shootStone() {
  const geo = new THREE.SphereGeometry(0.12, 6, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  mesh.position.copy(camera.position).addScaledVector(dir, 0.5);

  const speed = 28;
  const vel = dir.clone().multiplyScalar(speed);
  vel.y += 2; // slight upward arc

  // Raycast against pedestrians for instant hit detection
  rc.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = rc.intersectObjects(pedestrianGroup.children, true);
  if (hits.length > 0 && hits[0].distance < 40) {
    const hitMesh = hits[0].object;
    gameScore++;
    const scoreEl = document.getElementById('game-score');
    if (scoreEl) scoreEl.textContent = gameScore;

    // Bounce animation: quick scale pulse
    const origScale = hitMesh.scale.clone();
    hitMesh.scale.set(1.5, 0.4, 1.5);
    setTimeout(() => {
      hitMesh.scale.set(0.8, 1.8, 0.8);
      setTimeout(() => hitMesh.scale.copy(origScale), 150);
    }, 100);

    // Show hit feedback
    const fb = document.getElementById('game-feedback');
    if (fb) {
      fb.textContent = t('sapanHit');
      fb.style.opacity = '1';
      setTimeout(() => { fb.style.opacity = '0'; }, 700);
    }
  }

  scene.add(mesh);
  stoneProjectiles.push({ mesh, velocity: vel, life: 1.8 });
}

// Click to shoot in game mode
window.addEventListener('click', (e) => {
  if (!isGameMode || !isWalkMode) return;
  shootStone();
});

document.addEventListener('keydown', (e) => {
  // W enters walk mode from orbit mode; inside walk mode it remains forward movement.
  if (e.code === 'KeyW' && !e.repeat && !isWalkMode) {
    walkControls.lock();
    return;
  }
  if (e.code === 'Escape' && isWalkMode) {
    walkControls.unlock();
    return;
  }
  // Ctrl+Space = stop recording from anywhere (including pointer-lock)
  if (e.code === 'Space' && e.ctrlKey) {
    stopRecording();
    return;
  }
  if (!isWalkMode) return;
  switch (e.code) {
    case 'ArrowUp':  case 'KeyW': moveForward  = true; break;
    case 'ArrowLeft':  case 'KeyA': moveLeft  = true; break;
    case 'ArrowDown':  case 'KeyS': moveBackward = true; break;
    case 'ArrowRight': case 'KeyD': moveRight = true; break;
    case 'ShiftLeft': case 'ShiftRight': sprintWalk = true; break;
    case 'KeyC': crouchWalk = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  if (!isWalkMode) return;
  switch (e.code) {
    case 'ArrowUp':  case 'KeyW': moveForward  = false; break;
    case 'ArrowLeft':  case 'KeyA': moveLeft  = false; break;
    case 'ArrowDown':  case 'KeyS': moveBackward = false; break;
    case 'ArrowRight': case 'KeyD': moveRight = false; break;
    case 'ShiftLeft': case 'ShiftRight': sprintWalk = false; break;
    case 'KeyC': crouchWalk = false; break;
  }
});

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  if (isWalkMode) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // consistent speed
    
    const wSpd = 92.0 * settings.walkSpeed * (sprintWalk ? 1.85 : 1.0) * (crouchWalk ? 0.45 : 1.0);
    if (moveForward || moveBackward) velocity.z -= direction.z * wSpd * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * wSpd * delta;
    
    walkControls.moveRight(-velocity.x * delta);
    walkControls.moveForward(-velocity.z * delta);
    
    const ty = terrainLocalYAt(camera.position.x, camera.position.z);
    const eyeHeight = crouchWalk ? 1.18 : 1.72;
    camera.position.y += ((ty + eyeHeight) - camera.position.y) * Math.min(1, delta * 12);
  } else {
    controls.update();
  }
  prevTime = time;

  if (weatherParticles) {
    const positions = weatherParticles.geometry.attributes.position.array;
    const isRain = settings.weather === 'Rain';
    const speedY = isRain ? 15 : 2;
    const speedX = isRain ? 1.5 : 1.0;
    for(let i=1; i<positions.length; i+=3) {
      positions[i] -= speedY;
      positions[i-1] -= speedX;
      if (positions[i] < 0) {
        positions[i] = 400;
        positions[i-1] = (Math.random() - 0.5) * 800;
        positions[i+1] = (Math.random() - 0.5) * 800;
      }
    }
    weatherParticles.geometry.attributes.position.needsUpdate = true;
    weatherParticles.position.x = camera.position.x;
    weatherParticles.position.z = camera.position.z;
  }
  
  for (const c of cars) {
    c.t += c.speed * settings.trafficSpeed;
    if (c.t > 1) c.t = 0;
    const safe = Math.min(Math.max(c.t, 0.01), 0.99);
    const pos = c.curve.getPointAt(safe);
    const tan = c.curve.getTangentAt(safe);
    const roadY = terrainLocalYAt(pos.x, pos.z) + LAYER.road + LAYER.carExtra;
    c.car.position.set(pos.x, roadY, pos.z);
    // Flatten tangent (no Y tilt) and negate (car front faces -Z)
    const horiz = Math.sqrt(tan.x * tan.x + tan.z * tan.z);
    if (horiz > 0.001) {
      c.car.lookAt(pos.x - tan.x / horiz, roadY, pos.z - tan.z / horiz);
    }
  }
  for (const p of pedestrians) {
    p.t += p.speed;
    if (p.t > 1) p.t = 0;
    const safe = Math.min(Math.max(p.t, 0.01), 0.99);
    const pos = p.curve.getPointAt(safe);
    const tan = p.curve.getTangentAt(safe);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    // Offset by roadWidth/2 + 0.3m for outer edge of road
    const offsetMag = (settings.roadWidth * 0.5 + 0.3) * p.offsetDir;
    pos.add(right.multiplyScalar(offsetMag));

    const pedY = terrainLocalYAt(pos.x, pos.z) + LAYER.road + 0.03;
    const walkT = time * 0.006 + p.phase;
    const swing = Math.sin(walkT) * p.walkAmplitude;
    const counter = -swing;
    if (p.limbRefs) {
      p.limbRefs.leftArm.rotation.x = counter;
      p.limbRefs.rightArm.rotation.x = swing;
      p.limbRefs.leftLeg.rotation.x = swing;
      p.limbRefs.rightLeg.rotation.x = counter;
      p.limbRefs.leftShoe.position.z = -0.04 + Math.max(0, swing) * 0.08;
      p.limbRefs.rightShoe.position.z = -0.04 + Math.max(0, counter) * 0.08;
    }
    p.mesh.position.set(pos.x, pedY + Math.abs(Math.sin(walkT * 2)) * 0.025, pos.z);
    p.mesh.lookAt(pos.clone().add(tan.clone().multiplyScalar(p.offsetDir))); // look along direction
  }

  // Stone projectile update (Sapan Modu)
  for (let i = stoneProjectiles.length - 1; i >= 0; i--) {
    const s = stoneProjectiles[i];
    s.mesh.position.addScaledVector(s.velocity, delta);
    s.velocity.y -= 9.8 * delta; // gravity arc
    s.life -= delta;
    if (s.life <= 0) {
      scene.remove(s.mesh);
      stoneProjectiles.splice(i, 1);
    }
  }
  
  // Auto-orbit (only in non-walk mode)
  if (settings.autoOrbit && !isWalkMode) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = settings.autoOrbitSpeed;
  } else {
    controls.autoRotate = false;
  }

  // Auto time-lapse (solar animation)
  if (settings.autoTime) {
    settings.timeOfDay = (settings.timeOfDay + settings.autoTimeSpeed * delta) % 24;
    checkTimeChange();
  }

  // Fly-to animation
  if (_flyT < 1.0) {
    _flyT = Math.min(_flyT + delta * 1.0, 1.0);
    const ease = 1 - Math.pow(1 - _flyT, 3);
    camera.position.lerpVectors(_flyOrigin, _flyTarget, ease);
    if (_flyControlsTarget) controls.target.lerp(_flyControlsTarget, ease * 0.12);
  }

  applyTourPlayback();

  // SSAO settle: run full SSAO only when camera has been still 300ms
  // → smooth orbit at 60fps, quality rendering when static
  const _now = performance.now();
  const _camMoving = (_now - _lastCameraMove) < 300;
  const _hasAnim = isWalkMode || cars.length > 0 || pedestrians.length > 0
    || settings.weather !== 'Clear' || stoneProjectiles.length > 0 || _flyT < 1.0;
  if (isRecording) {
    renderer.render(scene, camera);
  } else if (settings.enableSSAO && !_camMoving && !_hasAnim && (_now - _lastSSAORender) > 120) {
    composer.render();
    _lastSSAORender = _now;
  } else {
    renderer.render(scene, camera);
  }

  // Compass
  const compassCanvas = document.getElementById('compass-canvas');
  if (compassCanvas) {
    const ctx = compassCanvas.getContext('2d');
    const cDir = new THREE.Vector3();
    camera.getWorldDirection(cDir);
    const ang = Math.atan2(cDir.x, cDir.z);
    ctx.clearRect(0, 0, 48, 48);
    ctx.save();
    ctx.translate(24, 24);
    ctx.rotate(-ang);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(4, 2); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(4, -2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 24, 10);
  }

  // Minimap + scale bar (throttled ~30fps)
  if (time - _mmLastUpdate > 33) {
    _mmLastUpdate = time;
    const mmWrap = document.getElementById('minimap-wrap');
    if (mmWrap && !mmWrap.classList.contains('collapsed')) updateMinimapCamera();
    if (time - _sbLastUpdate > 300) { _sbLastUpdate = time; updateScaleBar(); }
  }
}

function updateHtmlLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[currentLang][key]) el.innerText = i18n[currentLang][key];
  });
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.innerText = currentLang === 'TR' ? 'EN' : 'TR';
  renderFunctionStyleDock();
}

const panelToggleBtn = document.getElementById('panel-toggle');
if (panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => {
    const mainPanel = document.getElementById('main-panel');
    if (mainPanel) mainPanel.classList.toggle('collapsed');
  });
}

const langToggleBtn = document.getElementById('lang-toggle');
if (langToggleBtn) {
  langToggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'TR' ? 'EN' : 'TR';
    updateHtmlLang();
    addGui(); // Rebuild GUI with new language
  });
}

// Initialize UI text
updateHtmlLang();

rebuildScene().then(() => {
  if (functionGuiRefs) functionGuiRefs.refreshFunctionGui();
}).catch((e) => {
  console.error(e);
  setStatus(e?.message || t('demFail'));
});
animate();

// --- Cinematic Recording Tool ---
let mediaRecorder;
let recordedChunks = [];
let recordingInterval;
let startTime;

const btnRecord = document.getElementById('btn-record');
const btnStop = document.getElementById('btn-stop');
const recTime = document.getElementById('recording-time');
const uiContainer = document.getElementById('ui-container');
const recordingPanel = document.getElementById('recording-panel');
const btnToggleRec = document.getElementById('btn-toggle-rec');
const recQuality = document.getElementById('rec-quality');

if (btnToggleRec && recordingPanel) {
  btnToggleRec.addEventListener('click', () => {
    recordingPanel.classList.toggle('hidden');
  });
}

// Elements hidden during recording (everything except recording-container)
const _recHideEls = ['panel-toggle','lang-toggle','scene-toggle','layers-toggle','style-toggle','mobility-toggle','furniture-toggle','analysis-toggle','narrative-toggle','advanced-toggle','walk-toggle','game-toggle','main-panel','layer-dock','scene-dock','style-dock','mobility-dock','furniture-dock','analysis-dock','narrative-dock'];

function _recHideUi() {
  _recHideEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.visibility = 'hidden';
  });
  if (globalGui) globalGui.domElement.style.visibility = 'hidden';
}
function _recShowUi() {
  _recHideEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.visibility = '';
  });
  if (globalGui) globalGui.domElement.style.visibility = '';
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  isRecording = false;
  mediaRecorder.stop();
  clearInterval(recordingInterval);
  _recShowUi();
  if (btnRecord) btnRecord.style.display = 'inline-block';
  if (btnStop)   btnStop.style.display   = 'none';
  if (recTime)   recTime.style.display   = 'none';
  if (recordingPanel) {
    recordingPanel.style.removeProperty('background');
    recordingPanel.style.removeProperty('border');
  }
  if (btnToggleRec) btnToggleRec.classList.remove('recording');
}

if (btnRecord && btnStop) {
  btnRecord.addEventListener('click', () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Hide non-recording UI, keep recording-container visible
    isRecording = true;
    _recHideUi();
    recordingPanel.classList.remove('hidden'); // ensure panel is open

    // Switch record ↔ stop buttons
    btnRecord.style.display = 'none';
    btnStop.style.display = 'inline-block';
    recTime.style.display = 'inline-block';
    btnToggleRec.classList.add('recording');

    // Start timer
    startTime = Date.now();
    recTime.innerText = '00:00';
    recordingInterval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      recTime.innerText = `${m}:${s}`;
    }, 1000);

    // Setup recorder
    const stream = canvas.captureStream(30);
    const bps = recQuality ? parseInt(recQuality.value, 10) : 5000000;
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
      videoBitsPerSecond: bps
    });
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      isRecording = false;
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planx_3d_city_${Date.now()}.webm`;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); a.remove();
    };
    mediaRecorder.start();
  });

  btnStop.addEventListener('click', stopRecording);
}

// --- Screenshot ---
function takeScreenshot() {
  // Render one clean frame first (without UI)
  uiContainer.style.visibility = 'hidden';
  if (globalGui) globalGui.domElement.style.visibility = 'hidden';
  if (settings.enableSSAO) composer.render(); else renderer.render(scene, camera);

  const canvas = document.querySelector('canvas');
  const link = document.createElement('a');
  link.download = `planx_3d_city_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  uiContainer.style.visibility = '';
  if (globalGui) globalGui.domElement.style.visibility = '';
}

const btnScreenshot = document.getElementById('btn-screenshot');
if (btnScreenshot) btnScreenshot.addEventListener('click', takeScreenshot);

// --- FOV ---
const fovSlider = document.getElementById('fov-slider');
const fovVal   = document.getElementById('fov-val');
if (fovSlider) {
  fovSlider.value = settings.fov;
  fovSlider.addEventListener('input', () => {
    settings.fov = parseInt(fovSlider.value);
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
    savePersistedSettings();
    if (fovVal) fovVal.textContent = settings.fov + '°';
  });
}

// --- Walk Speed ---
const walkSpeedSlider = document.getElementById('walk-speed-slider');
const walkSpeedVal   = document.getElementById('walk-speed-val');
if (walkSpeedSlider) {
  walkSpeedSlider.value = settings.walkSpeed;
  walkSpeedSlider.addEventListener('input', () => {
    settings.walkSpeed = parseFloat(walkSpeedSlider.value);
    savePersistedSettings();
    if (walkSpeedVal) walkSpeedVal.textContent = settings.walkSpeed.toFixed(1) + 'x';
  });
}

// --- Auto-orbit ---
// Minimap toggle on click
const mmWrapEl = document.getElementById('minimap-wrap');
if (mmWrapEl) {
  document.getElementById('minimap-header')?.addEventListener('click', () => {
    mmWrapEl.classList.toggle('collapsed');
  });
}

const autoOrbitBtn = document.getElementById('btn-auto-orbit');
if (autoOrbitBtn) {
  autoOrbitBtn.addEventListener('click', () => {
    settings.autoOrbit = !settings.autoOrbit;
    autoOrbitBtn.classList.toggle('active', settings.autoOrbit);
  });
}

let selectedTourIndex = -1;

const TOUR_SETTING_KEYS = [
  'showParcels', 'showHardscape', 'showBuildings', 'showTrees', 'showFurniture',
  'showCars', 'showRoads', 'showSidewalks', 'showCrosswalks', 'showPedestrians',
  'roadColorMode', 'showWindPlumes', 'windDirectionDeg', 'windPlumeDistance',
  'showTerrainTexture', 'showTerrainSides'
];

function vectorToPlain(v) {
  return { x: v.x, y: v.y, z: v.z };
}

function plainToVector(v) {
  return new THREE.Vector3(Number(v?.x) || 0, Number(v?.y) || 0, Number(v?.z) || 0);
}

function captureTourFrame() {
  const sceneSettings = {};
  TOUR_SETTING_KEYS.forEach((key) => { sceneSettings[key] = settings[key]; });
  return {
    camera: vectorToPlain(camera.position),
    target: vectorToPlain(controls.target),
    timeOfDay: settings.timeOfDay,
    settings: sceneSettings,
    caption: document.getElementById('tour-caption')?.value?.trim() || `Keyframe ${tourState.keyframes.length + 1}`
  };
}

function applyTourFrame(frame, rebuild = true) {
  if (!frame) return;
  if (frame.settings) Object.assign(settings, frame.settings);
  if (Number.isFinite(frame.timeOfDay)) settings.timeOfDay = frame.timeOfDay;
  camera.position.copy(plainToVector(frame.camera));
  controls.target.copy(plainToVector(frame.target));
  camera.lookAt(controls.target);
  checkTimeChange();
  updateDockControls();
  if (rebuild) rebuildScene();
}

function renderTourList() {
  const list = document.getElementById('tour-list');
  if (!list) return;
  list.innerHTML = tourState.keyframes.map((frame, index) => (
    `<div class="tour-item ${index === selectedTourIndex ? 'active' : ''}" data-tour-index="${index}">
      <strong>${index + 1}. ${frame.caption || 'Keyframe'}</strong><br>
      <span>${Number(frame.timeOfDay || 0).toFixed(1)}h - ${frame.settings?.roadColorMode || 'Default'}</span>
    </div>`
  )).join('') || '<div class="tour-item">No keyframes yet.</div>';
  list.querySelectorAll('[data-tour-index]').forEach((item) => {
    item.addEventListener('click', () => {
      selectedTourIndex = Number(item.dataset.tourIndex);
      const frame = tourState.keyframes[selectedTourIndex];
      const input = document.getElementById('tour-caption');
      if (input) input.value = frame.caption || '';
      applyTourFrame(frame, true);
      renderTourList();
    });
  });
}

function updateTourControls() {
  document.querySelectorAll('[data-tour-setting]').forEach((el) => {
    const key = el.dataset.tourSetting;
    if (!(key in tourState)) return;
    if (el.type === 'checkbox') el.checked = !!tourState[key];
    else el.value = tourState[key];
  });
}

function addTourKeyframe() {
  tourState.keyframes.push(captureTourFrame());
  selectedTourIndex = tourState.keyframes.length - 1;
  saveTourState();
  renderTourList();
}

function updateTourKeyframe() {
  if (selectedTourIndex < 0 || selectedTourIndex >= tourState.keyframes.length) return;
  tourState.keyframes[selectedTourIndex] = captureTourFrame();
  saveTourState();
  renderTourList();
}

function deleteTourKeyframe() {
  if (selectedTourIndex < 0 || selectedTourIndex >= tourState.keyframes.length) return;
  tourState.keyframes.splice(selectedTourIndex, 1);
  selectedTourIndex = Math.min(selectedTourIndex, tourState.keyframes.length - 1);
  saveTourState();
  renderTourList();
}

function playTour() {
  if (tourState.keyframes.length < 2) return;
  settings.autoOrbit = false;
  tourState.playing = true;
  tourState.startTime = performance.now() - tourState.currentTime * 1000;
  controls.enabled = false;
}

function pauseTour() {
  tourState.playing = false;
  controls.enabled = !isWalkMode;
  document.getElementById('tour-caption-overlay')?.classList.add('hidden');
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function applyTourPlayback() {
  if (!tourState.playing || tourState.keyframes.length < 2) return;
  const duration = Math.max(1, Number(tourState.duration) || 18);
  tourState.currentTime = (performance.now() - tourState.startTime) / 1000;
  if (tourState.currentTime > duration) {
    if (tourState.loop) {
      tourState.startTime = performance.now();
      tourState.currentTime = 0;
    } else {
      pauseTour();
      tourState.currentTime = duration;
    }
  }
  const frames = tourState.keyframes;
  const totalSegments = frames.length - 1;
  const progress = Math.min(1, Math.max(0, tourState.currentTime / duration));
  const segmentFloat = progress * totalSegments;
  const idx = Math.min(totalSegments - 1, Math.floor(segmentFloat));
  const localT = easeInOutCubic(segmentFloat - idx);
  const a = frames[idx];
  const b = frames[idx + 1];
  camera.position.lerpVectors(plainToVector(a.camera), plainToVector(b.camera), localT);
  controls.target.lerpVectors(plainToVector(a.target), plainToVector(b.target), localT);
  camera.lookAt(controls.target);
  settings.timeOfDay = (Number(a.timeOfDay) || 0) + ((Number(b.timeOfDay) || 0) - (Number(a.timeOfDay) || 0)) * localT;
  const active = localT < 0.5 ? a : b;
  if (active.settings) Object.assign(settings, active.settings);
  checkTimeChange();
  const caption = document.getElementById('tour-caption-overlay');
  if (caption) {
    caption.textContent = active.caption || '';
    caption.classList.toggle('hidden', !active.caption);
  }
}

function exportTourJson() {
  const blob = new Blob([JSON.stringify({ version: 'planx-tour/v1', ...tourState }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'planx_tour.json';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

function initTourUi() {
  updateTourControls();
  renderTourList();
  document.getElementById('tour-add')?.addEventListener('click', addTourKeyframe);
  document.getElementById('tour-update')?.addEventListener('click', updateTourKeyframe);
  document.getElementById('tour-delete')?.addEventListener('click', deleteTourKeyframe);
  document.getElementById('tour-play')?.addEventListener('click', playTour);
  document.getElementById('tour-pause')?.addEventListener('click', pauseTour);
  document.getElementById('tour-export')?.addEventListener('click', exportTourJson);
  document.getElementById('tour-import')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    tourState.keyframes = Array.isArray(data.keyframes) ? data.keyframes : [];
    tourState.duration = Number(data.duration) || tourState.duration;
    tourState.loop = !!data.loop;
    selectedTourIndex = tourState.keyframes.length ? 0 : -1;
    saveTourState();
    updateTourControls();
    renderTourList();
  });
  document.querySelectorAll('[data-tour-setting]').forEach((el) => {
    const handler = () => {
      const key = el.dataset.tourSetting;
      tourState[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
      saveTourState();
    };
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', handler);
  });
}

function populateDockSelects() {
  const selectOptions = {
    islandTexture: Object.keys(textureSets.island),
    roofShape: ['Flat', 'Pyramid', 'Gable', 'Cone', 'Prism'],
    roofTexture: Object.keys(textureSets.roof),
    pavementStyle: Object.keys(textureSets.pavement),
    terrainAnalysisMode: ['Texture', 'Elevation tint', 'Slope tint'],
    buildingMode: ['Footprint only', 'Extruded', 'Extruded + roof'],
    hardscapeStyle: Object.keys(textureSets.hardscape),
    roadStyle: Object.keys(textureSets.road),
    roadColorMode: ['Default', 'Amenity distance', 'Access / traffic'],
    assetTheme: Object.keys(assetThemePresets),
    lightStyle: ['Modern Arc', 'Classic Post', 'Dual Head'],
    benchStyle: ['Wood Plank', 'Concrete Slab', 'Curved Metal'],
    binStyle: ['Square Box', 'Cylinder', 'Dual Recycle'],
    stopStyle: ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin'],
    weather: ['Clear', 'Rain', 'Snow']
  };
  document.querySelectorAll('.dock-panel select[data-setting]').forEach((select) => {
    const key = select.dataset.setting;
    if (!selectOptions[key]) return;
    select.innerHTML = selectOptions[key].map((value) => `<option value="${value}">${value}</option>`).join('');
  });
}

function updateDockControls() {
  document.querySelectorAll('.dock-panel [data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    if (!(key in settings)) return;
    if (el.type === 'checkbox') el.checked = !!settings[key];
    else el.value = settings[key];
  });
}

function renderFunctionStyleDock() {
  const host = document.getElementById('function-style-controls');
  if (!host) return;
  const keys = Object.keys(functionColorState).sort();
  if (!keys.length) {
    host.innerHTML = `<p class="dock-note">${currentLang === 'TR' ? 'Fonksiyon stilleri veri yuklendikten sonra gorunur.' : 'Function styles appear after data is loaded.'}</p>`;
    return;
  }
  host.innerHTML = '';
  keys.forEach((key) => {
    const row = document.createElement('div');
    row.className = 'function-style-row';
    const name = document.createElement('span');
    name.textContent = key.slice(0, 18);
    const color = document.createElement('input');
    color.type = 'color';
    color.value = functionColorState[key] || '#f1f5f9';
    color.title = key;
    color.addEventListener('input', () => {
      functionColorState[key] = color.value;
      rebuildScene();
    });
    const facade = document.createElement('select');
    Object.keys(textureSets.facade).forEach((value) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      facade.appendChild(opt);
    });
    facade.value = functionFacadeState[key] || Object.keys(textureSets.facade)[0];
    facade.addEventListener('change', () => {
      functionFacadeState[key] = facade.value;
      rebuildScene();
    });
    row.append(name, color, facade);
    host.appendChild(row);
  });
}

function applyDockSetting(key, value, inputType) {
  if (!(key in settings)) return;
  if (inputType === 'checkbox') {
    settings[key] = !!value;
  } else if (typeof settings[key] === 'number') {
    settings[key] = parseFloat(value);
  } else {
    settings[key] = value;
  }
  if (key === 'terrainTextureBrightness' || key === 'terrainTextureContrast' || key === 'terrainAnalysisMode') {
    terrainTexture = null;
  }
  if (key === 'showXyzTiles' || key === 'xyzTileUrl') {
    baseMapTexture = null;
  }
  savePersistedSettings();
  if (key === 'timeOfDay' || key === 'weather' || key === 'fogDensity' || key === 'enableBloom' || key === 'enableSSAO') {
    if (key === 'weather') updateWeather();
    checkTimeChange();
  } else if (key === 'autoTime' || key === 'autoTimeSpeed' || key === 'trafficSpeed') {
    updateDockControls();
  } else {
    rebuildScene();
  }
}

let dockUiInitialized = false;

function initDockUi() {
  if (dockUiInitialized) return;
  dockUiInitialized = true;
  populateDockSelects();
  updateDockControls();
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dock-target]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.dockTarget);
    if (!target) return;
    event.preventDefault();
    document.querySelectorAll('.dock-panel').forEach((dock) => {
      if (dock !== target) dock.classList.add('hidden');
    });
    target.classList.toggle('hidden');
  });
  document.getElementById('advanced-toggle')?.addEventListener('click', () => {
    if (!globalGui?.domElement) return;
    globalGui.domElement.style.display = globalGui.domElement.style.display === 'none' ? '' : 'none';
  });
  document.querySelectorAll('.dock-close').forEach((btn) => {
    btn.addEventListener('click', () => document.getElementById(btn.dataset.close)?.classList.add('hidden'));
  });
  document.querySelectorAll('.dock-panel [data-setting]').forEach((el) => {
    const handler = () => applyDockSetting(el.dataset.setting, el.type === 'checkbox' ? el.checked : el.value, el.type);
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', handler);
  });
}

initDockUi();
initTourUi();
