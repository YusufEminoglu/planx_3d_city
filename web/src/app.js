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

let currentLang = 'EN';
const i18n = {
  TR: {
    guiTitle: 'Kentsel Kontroller',
    env: 'Çevre', fog: 'Sis', sunDir: 'Güneş Yönü', sunElev: 'Güneş Yük.',
    terrain: 'Zemin & Yüzey', pavement: 'Yol Kaplaması', showHardscape: 'Sert Zemin Göster',
    hardTex: 'Sert Zemin Dokusu', hardH: 'Sert Zemin Yüksekliği', islCol: 'Ada Rengi', islTex: 'Ada Dokusu',
    parkCol: 'Park Rengi', parkTex: 'Park Dokusu', sportCol: 'Spor Alani Rengi',
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
    showSidewalks: 'Kaldırımlar', showCrosswalks: 'Yaya Geçitleri', showPedestrianPaths: 'Ada İçi Patikalar',
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
    parkCol: 'Park Color', parkTex: 'Park Texture', sportCol: 'Sport Area Color',
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
    showSidewalks: 'Sidewalks', showCrosswalks: 'Crosswalks', showPedestrianPaths: 'Block Paths',
    binaInfo: 'Building Info', biFonk: 'Function', biKat: 'Floors', biNiz: 'Type', biAlan: 'Area',
    sapanMode: 'Slingshot Mode', sapanHit: 'Hit! +1', sapanScoreLbl: 'Score',
    autoTime: '⏱ Solar Animation', autoTimeSpd: 'Speed (h/s)',
    minimap: 'Minimap'
  }
};
function t(key) { return i18n[currentLang]?.[key] ?? i18n.EN?.[key] ?? key; }

Object.assign(i18n.TR, {
  dockLayers: 'Katmanlar', dockScene: 'Sahne', dockStyle: 'Stil', dockMobility: 'Hareketlilik',
  dockFurniture: 'Kent Mobilyalari', dockAnalysis: 'Analiz',
  lblRoads: 'Yollar', lblSidewalks: 'Kaldirimlar', lblCrosswalks: 'Yaya gecitleri', lblPedestrianPaths: 'Ada ici patikalar',
  lblBlocks: 'Adalar / bloklar', lblParcels: 'Parseller', lblHardscape: 'Sert zemin', lblBuildings: 'Binalar',
  lblTrees: 'Agaclar', lblFurniture: 'Kent mobilyalari', lblCars: 'Araclar', lblPedestrians: 'Yayalar',
  lblPlanTexture: 'Plan texture', lblOutsideRoiTerrain: 'ROI disi zemin', lblTextureOpacity: 'Texture opakligi',
  lblTextureBrightness: 'Texture parlakligi', lblTextureContrast: 'Texture kontrasti',
  lblModelBase: 'ROI model altligi', lblSideDrop: 'Altlik dususu', lblSideColor: 'Altlik rengi',
  lblDemQuality: 'DEM mesh kalitesi', lblFog: 'Sis', lblTime: 'Zaman',
  flattenIslands: 'Ada alti duzlestirme', islandPlateauTransition: 'Plato kenar rampi (m)',
  dayOfYear: 'Yilin gunu (1-365)', latitude: 'Enlem (derece)',
  shadowStudyTitle: 'Golge analizi',
  shadowStudyNote: 'Gundonum ve ekinokslara atla, sonra günü oynat ki golgelerin nasil hareket ettigini gor.',
  shadowWinter: 'Kıs gundonumu', shadowSpring: 'Bahar ekinoksu',
  shadowSummer: 'Yaz gundonumu', shadowAutumn: 'Güz ekinoksu',
  shadowPlayDay: 'Günü oynat (gündogumu-günbatimi)', shadowStop: 'Durdur',
  shadowPlaySpeed: 'Gün-oynat hizi',
  shadowCompute: 'Gunluk golge haritasi hesapla', shadowClear: 'Haritayi temizle',
  timeDawn: 'Şafak 6', timeNoon: 'Öğle 12', timeSunset: 'Günbatımı 19', timeNight: 'Gece 22',
  lblThemeMode: 'Tema', themeAuto: 'Otomatik (sistem)', themeLight: 'Aydınlık', themeDark: 'Karanlık',
  lblTerrainTileMeters: 'Doku karo boyutu (m)',
  lblBookmarks: 'Kamera yer imleri', bookmarkSave: 'Bu görünümü kaydet',
  bookmarkEmpty: 'Henüz kaydedilmiş görünüm yok.',
  bookmarkPrompt: 'Görünüm için bir isim verin:',
  bookmarkGotoTitle: 'Bu görünüme uç', bookmarkDeleteTitle: 'Yer imini sil',
  lblAutoTime: 'Gunes animasyonu', lblAutoTimeSpeed: 'Animasyon hizi',
  lblWeather: 'Hava', lblSSAO: 'Golge kalitesi', lblBloom: 'Bloom/parlama',
  lblIslandColor: 'Ada rengi', lblIslandTexture: 'Ada dokusu', lblIslandTransparency: 'Ada transparanligi',
  lblParcelColor: 'Parsel sinir rengi', lblParcelOpacity: 'Parsel sinir opakligi',
  lblRoadColor: 'Yol rengi', lblRoadStyle: 'Yol dokusu', lblPavementStyle: 'Zemin dokusu',
  lblHardscapeStyle: 'Sert zemin dokusu', lblHardscapeHeight: 'Sert zemin yuksekligi',
  lblBuildingMode: 'Bina modu', lblFacadeTextureScale: 'Cephe olcegi', lblTerrainAnalysis: 'Topoğrafya görünümü', lblAssetTheme: 'Asset theme',
  lblTreeRenderMode: 'Agac render modu',
  lblTreeRandomize: 'Agaclari rastgele dagit', lblTreeVariantCount: 'Agac cesit sayisi', lblTreeHeightRandom: 'Agac yukseklik ifadesi',
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
  lblRoads: 'Roads', lblSidewalks: 'Sidewalks', lblCrosswalks: 'Crosswalks', lblPedestrianPaths: 'Block paths',
  lblBlocks: 'Blocks', lblParcels: 'Parcels', lblHardscape: 'Hardscape', lblBuildings: 'Buildings',
  lblTrees: 'Trees', lblFurniture: 'Street furniture', lblCars: 'Cars', lblPedestrians: 'Pedestrians',
  lblPlanTexture: 'Plan texture', lblOutsideRoiTerrain: 'Outside ROI terrain', lblTextureOpacity: 'Texture opacity',
  lblTextureBrightness: 'Texture brightness', lblTextureContrast: 'Texture contrast',
  lblModelBase: 'ROI model base', lblSideDrop: 'Base drop', lblSideColor: 'Base color',
  lblDemQuality: 'DEM mesh quality', lblFog: 'Fog', lblTime: 'Time',
  flattenIslands: 'Flatten DEM under islands', islandPlateauTransition: 'Plateau edge ramp (m)',
  dayOfYear: 'Day of year (1-365)', latitude: 'Latitude (deg)',
  shadowStudyTitle: 'Shadow study',
  shadowStudyNote: 'Jump to solstices & equinoxes, then play the day to see how shadows move across the site.',
  shadowWinter: 'Winter solstice', shadowSpring: 'Spring equinox',
  shadowSummer: 'Summer solstice', shadowAutumn: 'Autumn equinox',
  shadowPlayDay: 'Play day (sunrise-sunset)', shadowStop: 'Stop',
  shadowPlaySpeed: 'Day playback speed',
  shadowCompute: 'Compute shadow heatmap', shadowClear: 'Clear heatmap',
  timeDawn: 'Dawn 6', timeNoon: 'Noon 12', timeSunset: 'Sunset 19', timeNight: 'Night 22',
  lblThemeMode: 'Theme', themeAuto: 'Auto (system)', themeLight: 'Light', themeDark: 'Dark',
  lblTerrainTileMeters: 'Texture tile size (m)',
  lblBookmarks: 'Camera bookmarks', bookmarkSave: 'Save current view',
  bookmarkEmpty: 'No bookmarks yet.',
  bookmarkPrompt: 'Name this view:',
  bookmarkGotoTitle: 'Fly to this view', bookmarkDeleteTitle: 'Delete bookmark',
  lblAutoTime: 'Solar animation', lblAutoTimeSpeed: 'Animation speed',
  lblWeather: 'Weather', lblSSAO: 'Shadow quality', lblBloom: 'Bloom/glow',
  lblIslandColor: 'Block color', lblIslandTexture: 'Block texture', lblIslandTransparency: 'Block transparency',
  lblParcelColor: 'Parcel boundary color', lblParcelOpacity: 'Parcel boundary opacity',
  lblRoadColor: 'Road color', lblRoadStyle: 'Road texture', lblPavementStyle: 'Ground texture',
  lblHardscapeStyle: 'Hardscape texture', lblHardscapeHeight: 'Hardscape height',
  lblBuildingMode: 'Building mode', lblFacadeTextureScale: 'Facade scale', lblTerrainAnalysis: 'Topography view', lblAssetTheme: 'Asset theme',
  lblTreeRenderMode: 'Tree render mode',
  lblTreeRandomize: 'Randomize trees', lblTreeVariantCount: 'Tree variant count', lblTreeHeightRandom: 'Tree height expression',
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

Object.assign(i18n.EN, {
  title: 'PlanX 3D City',
  desc: 'A production-ready 3D urban cockpit for DEM, plan, road, block, parcel, building and street-life data.',
  htmlTitle: 'PlanX 3D City',
  loadingData: 'Loading project data...',
  processing: 'Processing city layers...',
  scenePreparing: 'Preparing',
  sceneLoading: 'Loading data',
  sceneGeojson: 'Loading GeoJSON',
  sceneDem: 'Reading DEM',
  scenePlanTexture: 'Plan texture',
  sceneBasemap: 'Basemap',
  sceneTerrain: 'Terrain',
  sceneLayers: 'Layers',
  sceneReady: 'Ready',
  metricBuildings: 'Buildings',
  metricBlocks: 'Blocks',
  metricParcels: 'Parcels',
  metricFloors: 'Avg. floors',
  metricPopulation: 'Population',
  metricDwellings: 'Dwellings',
  metricVehicles: 'Vehicles',
  projectWaiting: 'Waiting for project metadata',
  manifestMissing: 'No manifest found: this may be an older export, but the viewer will still try to load it.',
  crsUnknown: 'CRS not listed',
  emptyExport: 'empty export',
  notAvailable: 'not available',
  statsLoading: 'Loading...',
  cameraPanel: 'Camera panel',
  screenshot: 'Screenshot',
  orbit: 'Orbit',
  walkSpeedShort: 'Walk speed',
  record: 'Record',
  stop: 'Stop',
  togglePanel: 'Toggle dashboard',
  toggleLanguage: 'Switch to Turkish',
  dockTitleScene: 'Scene dock',
  dockTitleLayers: 'Layer dock',
  dockTitleStyle: 'Style dock',
  dockTitleMobility: 'Mobility dock',
  dockTitleFurniture: 'Street furniture dock',
  dockTitleAnalysis: 'Analysis dock',
  dockTitleNarrative: 'Narrative Studio',
  dockTitleAdvanced: 'Advanced controls',
  dockTitleWalk: 'Walk mode',
  dockTitleGame: 'Slingshot mode',
  narrativeNote1: 'Save camera, layer, sun and analysis states as keyframes, then record the tour from the camera panel.',
  narrativeNote2: 'Tour JSON stores the route and states only. It does not embed imagery, DEM, GeoJSON, or the full viewer package.',
  tourDuration: 'Tour duration',
  loopTour: 'Loop tour',
  tourCaptionPlaceholder: 'Caption / scene note',
  addKeyframe: 'Add keyframe',
  updateKeyframe: 'Update',
  deleteKeyframe: 'Delete',
  playTour: 'Play',
  pauseTour: 'Pause',
  exportJson: 'Export JSON',
  tourEmpty: 'No keyframes yet.',
  tourLoaded: 'Narrative tour loaded from portable package.',
  walkHud: 'WASD move · Shift sprint · C crouch · Esc exit',
  gameHint: 'Left click: throw stone',
  demLoading: 'Loading DEM...',
  demLoaded: 'DEM loaded',
  planTextureFail: 'Plan texture could not be loaded; using the default ground material.',
  basemapFail: 'QGIS basemap texture could not be loaded; using the default ground material.',
  funcStylesPending: 'Function styles appear after data is loaded.',
  minimap: 'Minimap'
});

Object.assign(i18n.TR, {
  title: 'PlanX 3D City',
  desc: 'DEM, plan, yol, ada, parsel, bina ve sokak yasami verileri icin uretim hazir 3B kent kokpiti.',
  htmlTitle: 'PlanX 3D City',
  loadingData: 'Proje verisi yukleniyor...',
  processing: 'Kent katmanlari isleniyor...',
  scenePreparing: 'Hazirlaniyor',
  sceneLoading: 'Veri yukleniyor',
  sceneGeojson: 'GeoJSON yukleniyor',
  sceneDem: 'DEM okunuyor',
  scenePlanTexture: 'Plan texture',
  sceneBasemap: 'Basemap',
  sceneTerrain: 'Terrain',
  sceneLayers: 'Katmanlar',
  sceneReady: 'Hazir',
  metricBuildings: 'Bina',
  metricBlocks: 'Ada',
  metricParcels: 'Parsel',
  metricFloors: 'Ort. kat',
  metricPopulation: 'Nufus',
  metricDwellings: 'Daire',
  metricVehicles: 'Arac',
  projectWaiting: 'Proje bilgisi bekleniyor',
  manifestMissing: 'Manifest yok: bu eski bir export olabilir, viewer yine de yuklemeyi dener.',
  crsUnknown: 'CRS bilgisi yok',
  emptyExport: 'bos export',
  notAvailable: 'yok',
  statsLoading: 'Yukleniyor...',
  cameraPanel: 'Kamera paneli',
  screenshot: 'Fotograf',
  orbit: 'Orbit',
  walkSpeedShort: 'Yurume hizi',
  record: 'Kayit',
  stop: 'Dur',
  togglePanel: 'Dashboard panelini ac/kapat',
  toggleLanguage: 'Ingilizceye gec',
  dockTitleScene: 'Sahne paneli',
  dockTitleLayers: 'Katman paneli',
  dockTitleStyle: 'Stil paneli',
  dockTitleMobility: 'Hareketlilik paneli',
  dockTitleFurniture: 'Kent mobilyalari paneli',
  dockTitleAnalysis: 'Analiz paneli',
  dockTitleNarrative: 'Narrative Studio',
  dockTitleAdvanced: 'Gelistirilmis kontroller',
  dockTitleWalk: 'Walk mode',
  dockTitleGame: 'Sapan modu',
  narrativeNote1: 'Kamera, katman, gunes ve analiz durumlarini keyframe olarak kaydedin; turu kamera panelinden kaydedin.',
  narrativeNote2: 'Tour JSON yalniz rota ve durumlari saklar. Goruntu, DEM, GeoJSON veya tam viewer paketini icine gommez.',
  tourDuration: 'Tur suresi',
  loopTour: 'Turu donguye al',
  tourCaptionPlaceholder: 'Baslik / sahne notu',
  addKeyframe: 'Keyframe ekle',
  updateKeyframe: 'Guncelle',
  deleteKeyframe: 'Sil',
  playTour: 'Oynat',
  pauseTour: 'Duraklat',
  exportJson: 'JSON export',
  tourEmpty: 'Henuz keyframe yok.',
  tourLoaded: 'Narrative tur portable paketten yuklendi.',
  walkHud: 'WASD hareket · Shift hizli · C alcak · Esc cikis',
  gameHint: 'Sol tik: tas at',
  demLoading: 'DEM yukleniyor...',
  demLoaded: 'DEM yuklendi',
  planTextureFail: 'Plan texture yuklenemedi; varsayilan zeminle devam ediliyor.',
  basemapFail: 'QGIS basemap texture yuklenemedi; varsayilan zeminle devam ediliyor.',
  funcStylesPending: 'Fonksiyon stilleri veri yuklendikten sonra gorunur.',
  minimap: 'Mini Harita'
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
let shadowHeatmapMesh = null;
let carGroup = new THREE.Group();
let furnitureGroup = new THREE.Group();
let pedestrianGroup = new THREE.Group();
let sidewalkGroup = new THREE.Group();
let pedestrianPathGroup = new THREE.Group();
let crosswalkGroup = new THREE.Group();
let terrainSideGroup = new THREE.Group();
let windPlumeGroup = new THREE.Group();
let roiBoundaryGroup = new THREE.Group();
world.add(islandGroup);
world.add(parcelGroup);
world.add(hardscapeGroup);
world.add(buildingGroup);
world.add(sidewalkGroup);
world.add(pedestrianPathGroup);
world.add(crosswalkGroup);
world.add(terrainSideGroup);
world.add(windPlumeGroup);
world.add(roadGroup);
world.add(treeGroup);
world.add(carGroup);
world.add(furnitureGroup);
world.add(pedestrianGroup);
world.add(roiBoundaryGroup);

/* Layer Elevation Hierarchy
 * DEM < islands < block paths < buildings/trees < parcels < hardscape slab < roads < sidewalks < cars.
 * Offsets are relative to the final visible terrain surface.
 */
const LAYER = {
  island:    0.60,
  path:      0.72,
  content:   0.78,
  parcel:    0.94,
  hardscape: 0.98,
  road:      1.36,
  sidewalk:  1.52,
  carExtra:  0.08
};
const FACADE_TEXTURE_SCALE_MULTIPLIER = 4.85;
const SETTINGS_SCHEMA_VERSION = 9;

// Match the viewer's local X axis to the QGIS map orientation.
const LOCAL_X_SIGN = -1;
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
let terrainOverlayMesh = null;
let roadCurves = [];
let vehicleRoadCurves = [];
let pedestrianPathCurves = [];
let cars = [];
let pedestrians = [];
let buildingFunctionMaterials = new Map();
let manifestDefaultsApplied = false;
let terrainHeightStats = { min: 0, max: 0, avg: 0, p02: 0, p98: 0 };
let terrainSurfaceCache = null;
let sceneBuildToken = 0;
const islandPlateauCache = [];

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

const BOOKMARK_STORAGE_KEY = 'planx_3d_city_camera_bookmarks';
let cameraBookmarks = [];

function loadCameraBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    cameraBookmarks = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cameraBookmarks)) cameraBookmarks = [];
  } catch (_err) {
    cameraBookmarks = [];
  }
}

function saveCameraBookmarks() {
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(cameraBookmarks));
  } catch (_err) {
    /* localStorage quota etc. — fail silently */
  }
}

function addCameraBookmark(name) {
  const label = (name || '').trim() || `View ${cameraBookmarks.length + 1}`;
  cameraBookmarks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: label,
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    fov: camera.fov,
    timeOfDay: settings.timeOfDay,
    createdAt: Date.now()
  });
  saveCameraBookmarks();
  renderCameraBookmarks();
}

function removeCameraBookmark(id) {
  cameraBookmarks = cameraBookmarks.filter((b) => b.id !== id);
  saveCameraBookmarks();
  renderCameraBookmarks();
}

function gotoCameraBookmark(id) {
  const bm = cameraBookmarks.find((b) => b.id === id);
  if (!bm) return;
  _flyOrigin = camera.position.clone();
  _flyTarget = new THREE.Vector3(bm.position[0], bm.position[1], bm.position[2]);
  _flyControlsTarget = new THREE.Vector3(bm.target[0], bm.target[1], bm.target[2]);
  _flyT = 0;
  if (Number.isFinite(bm.fov) && bm.fov > 0) {
    camera.fov = bm.fov;
    camera.updateProjectionMatrix();
    settings.fov = bm.fov;
  }
  if (Number.isFinite(bm.timeOfDay)) {
    settings.timeOfDay = bm.timeOfDay;
    updateTimeOfDay();
  }
}

function renderCameraBookmarks() {
  const host = document.getElementById('bookmark-list');
  if (!host) return;
  host.innerHTML = '';
  if (!cameraBookmarks.length) {
    const empty = document.createElement('div');
    empty.className = 'bookmark-empty';
    empty.textContent = t('bookmarkEmpty');
    host.appendChild(empty);
    return;
  }
  cameraBookmarks.forEach((bm) => {
    const row = document.createElement('div');
    row.className = 'bookmark-row';
    const gotoBtn = document.createElement('button');
    gotoBtn.className = 'bookmark-goto';
    gotoBtn.textContent = bm.name;
    gotoBtn.title = t('bookmarkGotoTitle');
    gotoBtn.addEventListener('click', () => gotoCameraBookmark(bm.id));
    const delBtn = document.createElement('button');
    delBtn.className = 'bookmark-del';
    delBtn.textContent = '×';
    delBtn.title = t('bookmarkDeleteTitle');
    delBtn.addEventListener('click', () => removeCameraBookmark(bm.id));
    row.appendChild(gotoBtn);
    row.appendChild(delBtn);
    host.appendChild(row);
  });
}

// --- Minimap ---
let _mmBg = null;           // pre-rendered static canvas
let _mmScale = 1, _mmOx = 0, _mmOy = 0;
const _mmW = 160, _mmH = 160;
let _mmLastUpdate = 0;
let _fpsLastSample = 0;
let _fpsFrames = 0;
let _fpsValue = 0;

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
  if (layerDataCache.roi?.features?.length) {
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
  for (const f of layerDataCache.adalar?.features || []) {
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
  for (const f of layerDataCache.yollar?.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    ctx.beginPath();
    f.geometry.coordinates.forEach(([cx, cy], i) => {
      const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
      i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
    });
    ctx.stroke();
  }

  ctx.strokeStyle = '#b7ad93'; ctx.lineWidth = 0.9;
  for (const f of layerDataCache.pedestrianPaths?.features || []) {
    for (const line of lineSetsFromGeometry(f.geometry)) {
      ctx.beginPath();
      line.forEach(([cx, cy], i) => {
        const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      });
      ctx.stroke();
    }
  }

  // Buildings (colored by function)
  for (const f of layerDataCache.yapilar?.features || []) {
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
  for (const f of layerDataCache.agaclar?.features || []) {
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
const functionBuildingStyleState = {};
const FUNCTION_STYLE_STORAGE_KEY = 'planx_3d_city_function_styles';
const ROOF_SHAPE_OPTIONS = ['Flat', 'Pyramid', 'Hip', 'Gable', 'Shed'];

const textureSets = {
  pavement: {
    Asphalt: null,
    StoneA: 'assets/pavement.png',
    StoneB: 'StoneB',
    Concrete: 'Concrete',
    Cobble: 'Cobble',
    WarmStone: 'WarmStone',
    CampusPaver: 'CampusPaver',
    Permeable: 'Permeable',
    Grid: 'Grid'
  },
  road: {
    Plain: null,
    Asphalt: 'Asphalt',
    Cobblestone: 'assets/pavement.png',
    SharedStreet: 'SharedStreet'
  },
  island: {
    None: null,
    SoftNoise: 'SoftNoise',
    FineGrid: 'FineGrid',
    ParkGreen: 'ParkGreen',
    ResidentialBeige: 'ResidentialBeige',
    CivicGravel: 'CivicGravel',
    CoastalSand: 'CoastalSand'
  },
  hardscape: {
    Cobble: 'assets/pavement.png',
    Concrete: 'Concrete',
    Tile: 'Tile',
    WarmStone: 'WarmStone',
    CampusPaver: 'CampusPaver',
    Permeable: 'Permeable',
    PlazaGranite: 'PlazaGranite'
  },
  facade: {
    UrbanA: 'assets/facade.png',
    UrbanB: 'assets/facade2.png',
    UrbanC: 'assets/facade3.png',
    UrbanD: 'assets/facade4.png',
    UrbanE: 'UrbanE',
    CampusGlass: 'CampusGlass',
    EcoTimber: 'EcoTimber',
    CivicStone: 'CivicStone',
    DenseBrick: 'DenseBrick',
    CoastalWhite: 'CoastalWhite',
    MediterraneanStucco: 'MediterraneanStucco'
  },
  roof: {
    RoofA: 'assets/roof.png',
    RoofB: 'RoofB',
    RoofC: 'RoofC',
    RoofD: 'RoofD',
    GermanTile: 'GermanTile',
    TurkishTile: 'TurkishTile',
    USShingle: 'USShingle',
    StandingSeam: 'StandingSeam',
    GreenRoof: 'GreenRoof',
    SolarRoof: 'SolarRoof',
    CeramicLight: 'CeramicLight'
  }
};

const TURKISH_FACADE_TYPES = ['A', 'B', 'C', 'D', 'E', 'F'];
const TURKISH_FACADE_BASE_KEYS = TURKISH_FACADE_TYPES.map((type) => `Urban_TR_${type}`);
const TURKISH_FACADE_ASSETS = {
  A: 'assets/facade_tr_a.png',
  B: 'assets/facade_tr_b.png',
  C: 'assets/facade_tr_c.png',
  D: 'assets/facade_tr_d.png',
  E: 'assets/facade_tr_e.png',
  F: 'assets/facade_tr_f.png'
};
for (const type of TURKISH_FACADE_TYPES) {
  const baseKey = `Urban_TR_${type}`;
  textureSets.facade[baseKey] = TURKISH_FACADE_ASSETS[type];
}

const assetThemePresets = {
  'Modern Urban': {
    pedestrians: ['Commuter', 'Urban Casual', 'Office', 'Student', 'Evening'],
    cars: ['Graphite', 'Slate', 'Teal', 'White', 'Navy', 'Silver'],
    trees: ['Street Linden', 'Plane', 'Compact Maple', 'Columnar', 'Broadleaf', 'Pine', 'Olive', 'Cypress'],
    lights: ['Modern Arc', 'Dual Head', 'Slim Post', 'Bollard Path', 'Classic Post'],
    benches: ['Wood Plank', 'Concrete Slab', 'Curved Metal', 'Slim Urban', 'Stone Seat'],
    bins: ['Square Box', 'Dual Recycle', 'Cylinder', 'Compact', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy', 'Wood Cabin', 'Compact Marker'],
    facades: ['UrbanA', 'UrbanB', 'UrbanC', 'UrbanD', 'UrbanE'],
    roofs: ['RoofA', 'RoofB', 'GermanTile', 'USShingle', 'StandingSeam'],
    paving: ['Asphalt', 'StoneA', 'Cobble', 'Concrete', 'PlazaGranite']
  },
  'Modern Turkish': {
    pedestrians: ['Commuter', 'Urban Casual', 'Office', 'Student', 'Visitor'],
    cars: ['White', 'Graphite', 'Silver', 'Navy', 'Slate', 'Burgundy'],
    trees: ['Plane', 'Street Linden', 'Compact Maple', 'Columnar', 'Olive', 'Cypress', 'Jacaranda', 'Pine'],
    lights: ['Modern Arc', 'Slim Post', 'Dual Head', 'Classic Post'],
    benches: ['Wood Plank', 'Concrete Slab', 'Slim Urban', 'Stone Seat'],
    bins: ['Square Box', 'Dual Recycle', 'Cylinder', 'Compact'],
    busstops: ['Glass Shelter', 'Steel Canopy', 'Minimal Canopy', 'Compact Marker'],
    facades: TURKISH_FACADE_BASE_KEYS,
    roofs: ['TurkishTile', 'CeramicLight', 'StandingSeam', 'RoofA'],
    paving: ['Concrete', 'StoneA', 'WarmStone', 'Asphalt', 'PlazaGranite']
  },
  Mediterranean: {
    pedestrians: ['Casual Linen', 'Warm Neutral', 'Student', 'Visitor'],
    cars: ['Ivory', 'Terracotta', 'Olive', 'Slate', 'Sand'],
    trees: ['Olive', 'Cypress', 'Plane', 'Palm', 'Jacaranda', 'Broadleaf', 'Compact Maple', 'Street Linden'],
    lights: ['Classic Post', 'Slim Post', 'Heritage Lantern', 'Modern Arc'],
    benches: ['Wood Plank', 'Curved Metal', 'Stone Seat', 'Classic Iron'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle', 'Compact'],
    busstops: ['Minimal Canopy', 'Wood Cabin', 'Glass Shelter', 'Compact Marker'],
    facades: ['MediterraneanStucco', 'UrbanB', 'UrbanD', 'CoastalWhite'],
    roofs: ['TurkishTile', 'CeramicLight', 'GermanTile', 'RoofA'],
    paving: ['StoneA', 'WarmStone', 'Cobble', 'Concrete']
  },
  Campus: {
    pedestrians: ['Student', 'Academic', 'Sport', 'Visitor'],
    cars: ['Slate', 'Navy', 'White', 'Graphite', 'Silver'],
    trees: ['Plane', 'Pine', 'Compact Maple', 'Street Linden', 'Broadleaf', 'Columnar', 'Olive', 'Cypress'],
    lights: ['Slim Post', 'Campus Twin', 'Modern Arc', 'Dual Head'],
    benches: ['Wood Plank', 'Concrete Slab', 'Slim Urban', 'Eco Timber'],
    bins: ['Dual Recycle', 'Square Box', 'Compact', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy'],
    facades: ['CampusGlass', 'UrbanC', 'UrbanA', 'UrbanB'],
    roofs: ['RoofA', 'RoofC', 'USShingle', 'SolarRoof'],
    paving: ['Concrete', 'CampusPaver', 'StoneA', 'Asphalt']
  },
  Eco: {
    pedestrians: ['Outdoor', 'Casual Green', 'Student', 'Visitor'],
    cars: ['Teal', 'Olive', 'White', 'Slate', 'Moss'],
    trees: ['Broadleaf', 'Pine', 'Street Linden', 'Compact Maple', 'Olive', 'Jacaranda', 'Cypress', 'Plane'],
    lights: ['Slim Post', 'Bollard Path', 'Modern Arc', 'Classic Post'],
    benches: ['Eco Timber', 'Wood Plank', 'Stone Seat', 'Concrete Slab'],
    bins: ['Dual Recycle', 'Compact', 'Cylinder', 'Solar Compactor'],
    busstops: ['Wood Cabin', 'Minimal Canopy', 'Glass Shelter'],
    facades: ['EcoTimber', 'UrbanD', 'UrbanB', 'UrbanA'],
    roofs: ['GreenRoof', 'SolarRoof', 'RoofA', 'TurkishTile'],
    paving: ['Permeable', 'Cobble', 'StoneA', 'Concrete']
  },
  'Dense Urban': {
    pedestrians: ['Commuter', 'Office', 'Evening', 'Urban Casual', 'Visitor'],
    cars: ['Graphite', 'Black', 'Navy', 'White', 'Slate', 'Burgundy'],
    trees: ['Columnar', 'Compact Maple', 'Street Linden', 'Plane', 'Broadleaf', 'Pine', 'Olive', 'Cypress'],
    lights: ['Dual Head', 'Modern Arc', 'Slim Post', 'Bollard Path'],
    benches: ['Concrete Slab', 'Curved Metal', 'Slim Urban', 'Stone Seat'],
    bins: ['Square Box', 'Compact', 'Dual Recycle', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Steel Canopy', 'Minimal Canopy', 'Compact Marker'],
    facades: ['DenseBrick', 'UrbanA', 'UrbanC', 'UrbanD'],
    roofs: ['StandingSeam', 'RoofA', 'RoofB', 'USShingle'],
    paving: ['Asphalt', 'Concrete', 'Grid', 'PlazaGranite']
  },
  'Civic Heritage': {
    pedestrians: ['Visitor', 'Academic', 'Warm Neutral', 'Commuter'],
    cars: ['Graphite', 'Ivory', 'Slate', 'Burgundy', 'Black'],
    trees: ['Plane', 'Cypress', 'Street Linden', 'Columnar', 'Olive', 'Broadleaf', 'Jacaranda', 'Pine'],
    lights: ['Heritage Lantern', 'Classic Post', 'Slim Post', 'Bollard Path'],
    benches: ['Classic Iron', 'Stone Seat', 'Wood Plank', 'Concrete Slab'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle', 'Compact'],
    busstops: ['Steel Canopy', 'Glass Shelter', 'Minimal Canopy'],
    facades: ['CivicStone', 'MediterraneanStucco', 'UrbanB', 'UrbanC'],
    roofs: ['GermanTile', 'CeramicLight', 'TurkishTile', 'StandingSeam'],
    paving: ['WarmStone', 'StoneA', 'Cobble', 'PlazaGranite']
  },
  'Coastal Light': {
    pedestrians: ['Casual Linen', 'Visitor', 'Student', 'Outdoor'],
    cars: ['White', 'Ivory', 'Teal', 'Sand', 'Slate'],
    trees: ['Palm', 'Plane', 'Olive', 'Broadleaf', 'Jacaranda', 'Street Linden', 'Compact Maple', 'Cypress'],
    lights: ['Slim Post', 'Modern Arc', 'Bollard Path', 'Classic Post'],
    benches: ['Wood Plank', 'Eco Timber', 'Stone Seat', 'Slim Urban'],
    bins: ['Cylinder', 'Dual Recycle', 'Compact', 'Square Box'],
    busstops: ['Minimal Canopy', 'Glass Shelter', 'Wood Cabin'],
    facades: ['CoastalWhite', 'MediterraneanStucco', 'UrbanD', 'CampusGlass'],
    roofs: ['CeramicLight', 'RoofA', 'SolarRoof', 'TurkishTile'],
    paving: ['WarmStone', 'Permeable', 'StoneA', 'Concrete']
  }
};

const namedAssetColors = {
  Graphite: 0x1f2937, Slate: 0x475569, Teal: 0x0f766e, White: 0xe5e7eb, Navy: 0x1d4ed8,
  Ivory: 0xf8f1df, Terracotta: 0x9f5b3f, Olive: 0x556b2f, Black: 0x111827,
  Silver: 0xcbd5e1, Sand: 0xd8c3a5, Moss: 0x3f6212, Burgundy: 0x7f1d1d,
  Commuter: 0x334155, 'Urban Casual': 0x475569, Office: 0x1f2937, Student: 0x0f766e,
  Evening: 0x374151, 'Casual Linen': 0xd8c3a5, 'Warm Neutral': 0x8b6f47, Visitor: 0x64748b,
  Academic: 0x243044, Sport: 0x2563eb, Outdoor: 0x365314, 'Casual Green': 0x15803d,
  Broadleaf: 0x2f7d32, Pine: 0x1f5f3a, 'Street Linden': 0x3f8f3b, Plane: 0x4b9c45,
  'Compact Maple': 0x5a8f35, Columnar: 0x2c6e3f, Cypress: 0x174d32, Palm: 0x3d8b44,
  Olive: 0x667a2d, Jacaranda: 0x3f7f46
};

const TREE_VARIANT_CATALOG = ['Street Linden', 'Plane', 'Compact Maple', 'Columnar', 'Olive', 'Cypress', 'Palm', 'Jacaranda', 'Pine', 'Broadleaf'];
const TREE_PROFILE_DEFAULT = { shape: 'round', trunkRatio: 0.22, crownWidth: 0.46, crownHeight: 0.72, crownLift: 0.36, crownEmbed: 0.08 };
const TREE_VARIANT_PROFILES = {
  'Street Linden': { shape: 'linden', trunkRatio: 0.23, crownWidth: 0.44, crownHeight: 0.74, crownLift: 0.34, crownEmbed: 0.08 },
  Plane: { shape: 'plane', trunkRatio: 0.21, crownWidth: 0.52, crownHeight: 0.68, crownLift: 0.33, crownEmbed: 0.09 },
  'Compact Maple': { shape: 'compact', trunkRatio: 0.2, crownWidth: 0.45, crownHeight: 0.69, crownLift: 0.36, crownEmbed: 0.08 },
  Columnar: { shape: 'columnar', trunkRatio: 0.24, crownWidth: 0.29, crownHeight: 0.92, crownLift: 0.4, crownEmbed: 0.14 },
  Olive: { shape: 'olive', trunkRatio: 0.23, crownWidth: 0.43, crownHeight: 0.62, crownLift: 0.33, crownEmbed: 0.09 },
  Cypress: { shape: 'cypress', trunkRatio: 0.26, crownWidth: 0.25, crownHeight: 1.02, crownLift: 0.46, crownEmbed: 0.2 },
  Palm: { shape: 'palm', trunkRatio: 0.45, crownWidth: 0.35, crownHeight: 0.48, crownLift: 0.55, crownEmbed: 0.06 },
  Jacaranda: { shape: 'jacaranda', trunkRatio: 0.2, crownWidth: 0.52, crownHeight: 0.7, crownLift: 0.31, crownEmbed: 0.08 },
  Pine: { shape: 'pine', trunkRatio: 0.28, crownWidth: 0.32, crownHeight: 1.0, crownLift: 0.47, crownEmbed: 0.18 },
  Broadleaf: { shape: 'broadleaf', trunkRatio: 0.22, crownWidth: 0.5, crownHeight: 0.76, crownLift: 0.34, crownEmbed: 0.09 }
};
const treeLeafTextureCache = new Map();

function activeAssetTheme() {
  const name = settings.assetTheme || projectManifest?.assetTheme || 'Modern Urban';
  return assetThemePresets[name] ? name : 'Modern Urban';
}

function assetPoolVariants(category) {
  const fromManifest = settings.assetTheme === projectManifest?.assetTheme ? projectManifest?.assetPools?.[category]?.variants : null;
  if (Array.isArray(fromManifest) && fromManifest.length) return fromManifest;
  return assetThemePresets[activeAssetTheme()]?.[category] || assetThemePresets['Modern Urban'][category] || [];
}

function firstAssetVariant(category, fallback) {
  const variants = assetPoolVariants(category);
  return variants.length ? variants[0] : fallback;
}

function applyThemeDefaultsToSettings(resetFunctionFacades = true) {
  settings.lightStyle = firstAssetVariant('lights', settings.lightStyle);
  settings.benchStyle = firstAssetVariant('benches', settings.benchStyle);
  settings.binStyle = firstAssetVariant('bins', settings.binStyle);
  settings.stopStyle = firstAssetVariant('busstops', settings.stopStyle);
  const roof = firstAssetVariant('roofs', settings.roofTexture);
  if (Object.prototype.hasOwnProperty.call(textureSets.roof, roof)) settings.roofTexture = roof;
  const paving = firstAssetVariant('paving', settings.pavementStyle);
  if (Object.prototype.hasOwnProperty.call(textureSets.pavement, paving)) settings.pavementStyle = paving;
  if (resetFunctionFacades) {
    const facades = assetPoolVariants('facades').filter((value) => Object.prototype.hasOwnProperty.call(textureSets.facade, value));
    Object.keys(functionFacadeState).forEach((key, index) => {
      const facade = normalizeFacadeKey(facades[index % Math.max(1, facades.length)] || functionFacadeState[key]);
      functionFacadeState[key] = facade;
      if (functionBuildingStyleState[key]) functionBuildingStyleState[key].facade = facade;
    });
    saveFunctionBuildingStyles();
  }
}

function assetColor(name, fallback = 0x64748b) {
  return namedAssetColors[name] ?? fallback;
}

function uniqueAssetVariants(category, fallback = []) {
  const values = [];
  const add = (items) => {
    for (const item of items || []) {
      if (item && !values.includes(item)) values.push(item);
    }
  };
  add(fallback);
  Object.values(assetThemePresets).forEach((preset) => add(preset[category]));
  return values;
}

function turkishFacadeMatch(key) {
  return /^Urban_TR_([A-F])(?:_(\d{1,2}))?$/i.exec(String(key || ''));
}

function normalizeFacadeKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return 'UrbanA';
  const exact = Object.keys(textureSets.facade).find((name) => name.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const tr = turkishFacadeMatch(raw);
  if (tr) {
    const normalized = `Urban_TR_${tr[1].toUpperCase()}`;
    if (Object.prototype.hasOwnProperty.call(textureSets.facade, normalized)) return normalized;
  }
  // Legacy fallback: keep the scene drawable even when stored facade keys are stale.
  return 'UrbanA';
}

function resolveFacadeForLevels(key, _levels) {
  const normalized = normalizeFacadeKey(key);
  const match = turkishFacadeMatch(normalized);
  if (!match) return normalized;
  const type = match[1].toUpperCase();
  return `Urban_TR_${type}`;
}

function isTurkishFacadeFamily(key) {
  return !!turkishFacadeMatch(key);
}

function facadeTextureFloorRows(_key, fallback = 10) {
  return fallback;
}

function drawWindowedFacade(ctx, size, palette, opts) {
  const floors = Math.max(3, opts.floorRows | 0);
  const cols = Math.max(2, opts.windowCols | 0);
  const groundShop = !!opts.groundShop;
  const aspect = Math.max(0.2, Math.min(1, opts.windowAspect || 0.6));
  const accent = opts.accent || palette[1];
  const frame = opts.windowFrameColor || palette[1];
  const glassPattern = opts.glassPattern || 'uniform';
  const columnPattern = opts.columnPattern || 'flat';

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, size, size);

  if (columnPattern === 'brick') {
    const brickH = 8;
    const brickW = 22;
    for (let y = 0; y < size; y += brickH) {
      const offset = ((y / brickH) % 2) * (brickW * 0.5);
      for (let x = -brickW; x < size + brickW; x += brickW) {
        ctx.fillStyle = ((x + y) % 7 === 0) ? palette[2] : palette[0];
        ctx.fillRect(x + offset, y, brickW - 1, brickH - 1);
        ctx.strokeStyle = `${accent}aa`;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x + offset + 0.5, y + 0.5, brickW - 1, brickH - 1);
      }
    }
  } else if (columnPattern === 'timber') {
    const plankW = size / cols;
    for (let c = 0; c < cols; c++) {
      const grad = ctx.createLinearGradient(c * plankW, 0, c * plankW + plankW, 0);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(0.5, palette[2]);
      grad.addColorStop(1, palette[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(c * plankW, 0, plankW, size);
      ctx.strokeStyle = `${accent}66`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(c * plankW, 0);
      ctx.lineTo(c * plankW, size);
      ctx.stroke();
    }
  } else if (columnPattern === 'pilaster') {
    const pilW = (size / cols) * 0.18;
    for (let c = 0; c <= cols; c++) {
      const x = c * (size / cols) - pilW * 0.5;
      const grad = ctx.createLinearGradient(x, 0, x + pilW, 0);
      grad.addColorStop(0, accent);
      grad.addColorStop(0.5, palette[2]);
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, pilW, size);
    }
  }

  const groundH = groundShop ? (size / (floors + 1)) * 1.6 : 0;
  const upperArea = size - groundH;
  const floorH = upperArea / floors;
  const colW = size / cols;

  ctx.strokeStyle = `${accent}99`;
  ctx.lineWidth = opts.floorLineWidth || 1.2;
  for (let f = 0; f <= floors; f++) {
    const y = groundH + f * floorH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let f = 0; f < floors; f++) {
    const yTop = groundH + f * floorH;
    for (let c = 0; c < cols; c++) {
      const xLeft = c * colW;
      const padX = colW * (1 - aspect) * 0.5;
      const padY = floorH * 0.18;
      const wx = xLeft + padX;
      const wy = yTop + padY;
      const ww = colW - padX * 2;
      const wh = floorH - padY * 2;
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
      if (glassPattern === 'horizontal-bands') {
        const grad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(0.45, accent);
        grad.addColorStop(0.55, palette[2]);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, ww, wh);
      } else if (glassPattern === 'striped') {
        const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = `${frame}66`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy);
        ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.stroke();
      } else if (glassPattern === 'shutters') {
        const half = ww * 0.5;
        ctx.fillStyle = palette[2];
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = accent;
        ctx.fillRect(wx, wy, half * 0.42, wh);
        ctx.fillRect(wx + ww - half * 0.42, wy, half * 0.42, wh);
        ctx.strokeStyle = `${frame}88`;
        ctx.lineWidth = 0.5;
        for (let s = 1; s < 4; s++) {
          const sy = wy + (wh / 4) * s;
          ctx.beginPath();
          ctx.moveTo(wx, sy);
          ctx.lineTo(wx + ww, sy);
          ctx.stroke();
        }
      } else {
        const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  if (groundShop && groundH > 0) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, size, groundH);
    const bay = size / Math.max(2, Math.floor(cols * 1.2));
    for (let i = 0; i < size; i += bay) {
      const bw = bay * 0.85;
      const bh = groundH * 0.78;
      const bx = i + (bay - bw) * 0.5;
      const by = (groundH - bh) * 0.5;
      const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
      grad.addColorStop(0, palette[2]);
      grad.addColorStop(1, palette[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = `${frame}cc`;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    }
    ctx.strokeStyle = `${accent}cc`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, groundH);
    ctx.lineTo(size, groundH);
    ctx.stroke();
  }

  for (let i = 0; i < 360; i++) {
    const v = 130 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgba(${v},${v},${v},0.05)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
}

const FACADE_RECIPES = {
  CampusGlass:         { floorRows: 14, windowCols: 5, groundShop: true,  windowAspect: 0.82, glassPattern: 'horizontal-bands', columnPattern: 'flat',     accent: '#3d6b85' },
  EcoTimber:           { floorRows: 10, windowCols: 4, groundShop: true,  windowAspect: 0.55, glassPattern: 'uniform',          columnPattern: 'timber',   accent: '#6b4a2a' },
  CivicStone:          { floorRows: 12, windowCols: 5, groundShop: false, windowAspect: 0.35, glassPattern: 'shutters',         columnPattern: 'pilaster', accent: '#8a7a62' },
  DenseBrick:          { floorRows: 11, windowCols: 6, groundShop: true,  windowAspect: 0.62, glassPattern: 'uniform',          columnPattern: 'brick',    accent: '#4a1f15' },
  CoastalWhite:        { floorRows:  9, windowCols: 3, groundShop: true,  windowAspect: 0.95, glassPattern: 'striped',          columnPattern: 'flat',     accent: '#bcd1dc' },
  MediterraneanStucco: { floorRows: 10, windowCols: 4, groundShop: true,  windowAspect: 0.50, glassPattern: 'shutters',         columnPattern: 'flat',     accent: '#a05a3c' },
  UrbanE:              { floorRows: 13, windowCols: 6, groundShop: true,  windowAspect: 0.78, glassPattern: 'horizontal-bands', columnPattern: 'flat',     accent: '#2f3e52' }
};

function proceduralTextureCanvas(name, size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const palette = {
    StoneB: ['#d7d0c2', '#b8ad9c', '#efe8d8'],
    Concrete: ['#bfc4c9', '#9da5ad', '#d8dde1'],
    Cobble: ['#a99f90', '#7f7468', '#c8bdad'],
    WarmStone: ['#d8c7a6', '#b99d72', '#f2e4c8'],
    CampusPaver: ['#c6cbd0', '#8e98a3', '#e5e7eb'],
    Permeable: ['#9db489', '#657b57', '#cbd9bf'],
    PlazaGranite: ['#c8cdd2', '#8d949c', '#eef1f3'],
    Tile: ['#d7d3c9', '#8f8a80', '#f4f0e7'],
    Grid: ['#dbeafe', '#64748b', '#f8fafc'],
    SharedStreet: ['#3a3f44', '#6b7280', '#eef2f7'],
    UrbanE: ['#d8dee7', '#536171', '#f3f6f9'],
    CampusGlass: ['#a9d6e8', '#2f5f73', '#e8f6fb'],
    EcoTimber: ['#9a6b3a', '#4f3824', '#d5b07c'],
    CivicStone: ['#c8c2b6', '#7c7468', '#eee8dd'],
    DenseBrick: ['#8f3f2d', '#55261d', '#c2694f'],
    CoastalWhite: ['#f5f1e8', '#92a7b4', '#ffffff'],
    MediterraneanStucco: ['#ead8bd', '#b78b64', '#fff4df']
  }[name] || ['#cbd5e1', '#94a3b8', '#f8fafc'];

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, size, size);

  if (['StoneB', 'Cobble', 'WarmStone', 'PlazaGranite'].includes(name)) {
    const cell = name === 'Cobble' ? 26 : 34;
    for (let y = -cell; y < size + cell; y += cell) {
      const offset = ((y / cell) % 2) * (cell * 0.45);
      for (let x = -cell; x < size + cell; x += cell) {
        const w = cell * (0.75 + ((x + y) % 5) * 0.04);
        const h = cell * (0.58 + ((x - y) % 4) * 0.05);
        ctx.fillStyle = ((x + y) / cell) % 3 === 0 ? palette[2] : palette[0];
        ctx.fillRect(x + offset + 1, y + 1, w, h);
        ctx.strokeStyle = `${palette[1]}99`;
        ctx.strokeRect(x + offset + 1, y + 1, w, h);
      }
    }
  } else if (['Concrete', 'CampusPaver', 'Tile', 'Grid', 'SharedStreet'].includes(name)) {
    ctx.strokeStyle = `${palette[1]}88`;
    ctx.lineWidth = 1;
    const step = name === 'Grid' ? 16 : name === 'Tile' ? 32 : 42;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    for (let i = 0; i < 700; i++) {
      const v = 130 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${v},${v},${v},0.08)`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
  } else if (name === 'Permeable') {
    for (let y = 0; y < size; y += 20) {
      for (let x = 0; x < size; x += 20) {
        ctx.fillStyle = palette[(x + y) % 40 === 0 ? 2 : 0];
        ctx.fillRect(x + 1, y + 1, 18, 18);
        ctx.fillStyle = 'rgba(54,83,20,0.28)';
        ctx.fillRect(x + 7, y + 7, 6, 6);
      }
    }
  } else {
    const isFacade = Object.prototype.hasOwnProperty.call(textureSets.facade, name);
    if (isFacade && FACADE_RECIPES[name]) {
      drawWindowedFacade(ctx, size, palette, FACADE_RECIPES[name]);
    } else {
      const cols = isFacade ? 6 : 10;
      const rows = isFacade ? 11 : 10;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = (col / cols) * size;
          const y = (r / rows) * size;
          const w = size / cols;
          const h = size / rows;
          ctx.fillStyle = (r + col) % 3 === 0 ? palette[2] : palette[0];
          ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
          ctx.strokeStyle = `${palette[1]}77`;
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
          if (isFacade && r % 2 === 0 && col % 2 === 0) {
            ctx.fillStyle = 'rgba(50,80,100,0.18)';
            ctx.fillRect(x + w * 0.22, y + h * 0.28, w * 0.42, h * 0.32);
          }
        }
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function textureFromSet(setName, key, repeatX = 1, repeatY = 1) {
  const token = textureSets[setName]?.[key];
  if (!token) return null;
  if (typeof token === 'string' && (token.startsWith('assets/') || token.startsWith('http'))) {
    return loadTexture(token, repeatX, repeatY);
  }
  const tex = proceduralTextureCanvas(token || key);
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
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
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  const legacy = { Cone: 'Pyramid', Prism: 'Hip' };
  const candidate = legacy[raw] || raw;
  return ROOF_SHAPE_OPTIONS.find((key) => key.toLowerCase() === candidate.toLowerCase()) || fallback;
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
  showOutsideRoiTerrain: true,
  terrainTextureOpacity: 1.0,
  terrainTextureBrightness: 1.0,
  terrainTextureContrast: 1.0,
  terrainOutsideColor: '#edf2ef',
  terrainSmoothingPasses: 2,
  terrainSmoothingStrength: 0.45,
  terrainMaxSlope: 0.75,
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
  roadWidth: 8.0,
  trafficSpeed: 1.0,
  showWindPlumes: false,
  windDirectionDeg: 315,
  windPlumeDistance: 180,
  showUrbanComfort: false,
  carDensity: 0.2,
  showIslands: true,
  showParcels: true,
  showHardscape: false,
  showBuildings: true,
  facadeTextureScale: FACADE_TEXTURE_SCALE_MULTIPLIER,
  showTrees: true,
  treeRenderMode: 'Stylized',
  treeRandomize: true,
  treeVariantCount: 8,
  treeHeightRandomExpr: '',
  showFurniture: true,
  showCars: false,
  showRoads: true,
  showSidewalks: true,
  showPedestrianPaths: true,
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
  autoTimeSpeed: 2.0,
  flattenIslands: true,
  islandPlateauTransition: 6,
  islandTransparency: 0,
  dayOfYear: 172,
  latitude: 39.0,
  parkColor: '#5e9e3e',
  parkTexture: 'ParkGreen',
  sportColor: '#4a8c30',
  furnitureGroundOffset: 0.02,
  terrainTileMeters: 60
};

const PERSISTED_SETTING_KEYS = [
  'islandColor', 'islandTexture', 'islandTransparency', 'parcelBoundaryColor', 'parcelBoundaryOpacity',
  'showTerrainTexture', 'showOutsideRoiTerrain', 'terrainTextureOpacity', 'terrainTextureBrightness', 'terrainTextureContrast',
  'terrainOutsideColor', 'terrainSmoothingPasses', 'terrainSmoothingStrength', 'terrainMaxSlope',
  'showTerrainSides', 'terrainSideDrop', 'terrainSideColor',
  'fogDensity', 'autoTime', 'autoTimeSpeed', 'enableSSAO', 'enableBloom',
  'pavementStyle', 'hardscapeStyle', 'hardscapeHeight', 'buildingMode', 'facadeTextureScale', 'terrainAnalysisMode', 'showXyzTiles', 'xyzTileUrl',
  'assetTheme',
  'floorHeight', 'roofTexture', 'roofShape', 'roofHeight', 'roadStyle', 'roadColor', 'roadColorMode', 'roadWidth',
  'showLights', 'lightStyle', 'showBenches', 'benchStyle', 'showBins', 'binStyle', 'showBusStops', 'stopStyle',
  'showIslands', 'showParcels', 'showHardscape', 'showBuildings', 'showTrees', 'showFurniture',
  'treeRenderMode', 'treeRandomize', 'treeVariantCount', 'treeHeightRandomExpr',
  'showCars', 'showRoads', 'showSidewalks', 'showPedestrianPaths', 'showCrosswalks', 'showPedestrians',
  'showWindPlumes', 'windDirectionDeg', 'windPlumeDistance', 'showUrbanComfort',
  'demMeshQuality', 'timeOfDay', 'weather', 'fov', 'walkSpeed',
  'flattenIslands', 'islandPlateauTransition',
  'dayOfYear', 'latitude',
  'parkColor', 'parkTexture', 'sportColor',
  'terrainTileMeters'
];

function loadPersistedSettings() {
  try {
    const raw = localStorage.getItem('planx_3d_city_settings');
    if (!raw) return;
    const saved = JSON.parse(raw);
    const schemaVersion = Number(saved._schemaVersion || 0);
    for (const key of PERSISTED_SETTING_KEYS) {
      if (!(key in saved) || !(key in settings)) continue;
      if (typeof settings[key] === 'number') settings[key] = Number(saved[key]);
      else if (typeof settings[key] === 'boolean') settings[key] = Boolean(saved[key]);
      else settings[key] = saved[key];
    }
    if (schemaVersion < SETTINGS_SCHEMA_VERSION) {
      if (!('facadeTextureScale' in saved)) settings.facadeTextureScale = FACADE_TEXTURE_SCALE_MULTIPLIER;
      if (!('showOutsideRoiTerrain' in saved)) settings.showOutsideRoiTerrain = true;
      if (!('showIslands' in saved)) settings.showIslands = true;
      if (!('islandTransparency' in saved)) settings.islandTransparency = 0;
      settings.flattenIslands = true;
      if (!('treeRenderMode' in saved)) settings.treeRenderMode = 'Stylized';
      if (!('treeRandomize' in saved)) settings.treeRandomize = true;
      if (!('treeVariantCount' in saved)) settings.treeVariantCount = 8;
      if (!('treeHeightRandomExpr' in saved)) settings.treeHeightRandomExpr = '';
      if (schemaVersion < 9) {
        settings.showIslands = true;
        settings.islandTransparency = 0;
        settings.buildingMode = 'Extruded + roof';
      }
    }
    settings.roofShape = roofShapeValue(settings.roofShape, 'Pyramid');
    settings.roofTexture = presetValue(settings.roofTexture, textureSets.roof, 'RoofA');
  } catch (err) {
    console.warn('Could not restore PlanX viewer settings', err);
  }
}

function defaultFunctionBuildingStyle(fn, index = 0) {
  const facadeOptions = uniqueAssetVariants('facades', Object.keys(textureSets.facade))
    .filter((name) => Object.prototype.hasOwnProperty.call(textureSets.facade, name));
  return {
    color: getSemanticColor(fn) || ['#f1f5f9', '#dbeafe', '#fee2e2', '#dcfce7', '#fef3c7', '#ede9fe'][index % 6],
    facade: normalizeFacadeKey(facadeOptions[index % Math.max(1, facadeOptions.length)] || 'UrbanA'),
    facadeScale: settings.facadeTextureScale,
    floorHeight: settings.floorHeight,
    roofShape: roofShapeValue(settings.roofShape, 'Pyramid'),
    roofHeight: settings.roofHeight,
    roofTexture: presetValue(settings.roofTexture, textureSets.roof, 'RoofA')
  };
}

function sanitizeFunctionBuildingStyle(style, fallback) {
  const base = { ...fallback, ...(style || {}) };
  return {
    color: normalizeHexColor(base.color, fallback.color),
    facade: normalizeFacadeKey(base.facade || fallback.facade),
    facadeScale: Math.max(1, Math.min(8, Number(base.facadeScale) || fallback.facadeScale)),
    floorHeight: Math.max(2.4, Math.min(6, Number(base.floorHeight) || fallback.floorHeight)),
    roofShape: roofShapeValue(base.roofShape, fallback.roofShape),
    roofHeight: Math.max(0, Math.min(8, Number(base.roofHeight) || fallback.roofHeight)),
    roofTexture: presetValue(base.roofTexture, textureSets.roof, fallback.roofTexture)
  };
}

function ensureFunctionBuildingStyle(fn, index = 0) {
  const fallback = defaultFunctionBuildingStyle(fn, index);
  functionBuildingStyleState[fn] = sanitizeFunctionBuildingStyle(functionBuildingStyleState[fn], fallback);
  functionColorState[fn] = functionBuildingStyleState[fn].color;
  functionFacadeState[fn] = functionBuildingStyleState[fn].facade;
  return functionBuildingStyleState[fn];
}

function syncLegacyFunctionStyle(fn) {
  if (!functionBuildingStyleState[fn]) return;
  functionBuildingStyleState[fn].color = functionColorState[fn] || functionBuildingStyleState[fn].color;
  functionBuildingStyleState[fn].facade = normalizeFacadeKey(functionFacadeState[fn] || functionBuildingStyleState[fn].facade);
}

function loadFunctionBuildingStyles() {
  try {
    const raw = localStorage.getItem(FUNCTION_STYLE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.entries(parsed || {}).forEach(([key, value]) => {
      functionBuildingStyleState[key] = value;
    });
  } catch (err) {
    console.warn('Could not restore function building styles', err);
  }
}

function saveFunctionBuildingStyles() {
  try {
    localStorage.setItem(FUNCTION_STYLE_STORAGE_KEY, JSON.stringify(functionBuildingStyleState));
  } catch (err) {
    console.warn('Could not save function building styles', err);
  }
}

function savePersistedSettings() {
  try {
    const payload = {};
    for (const key of PERSISTED_SETTING_KEYS) payload[key] = settings[key];
    payload._schemaVersion = SETTINGS_SCHEMA_VERSION;
    localStorage.setItem('planx_3d_city_settings', JSON.stringify(payload));
  } catch (err) {
    console.warn('Could not save PlanX viewer settings', err);
  }
}

loadPersistedSettings();
loadFunctionBuildingStyles();

const tourState = {
  keyframes: [],
  duration: 18,
  loop: false,
  playing: false,
  currentTime: 0,
  startedAt: 0,
  startTime: 0
};
let selectedTourIndex = -1;

function loadTourState() {
  try {
    const raw = localStorage.getItem('planx_3d_city_tour');
    if (!raw) return;
    applyTourData(JSON.parse(raw), false);
  } catch (err) {
    console.warn('Could not restore PlanX tour', err);
  }
}

function applyTourData(data, persist = true) {
  tourState.keyframes = Array.isArray(data?.keyframes) ? data.keyframes : [];
  tourState.duration = Number(data?.duration) || tourState.duration || 18;
  tourState.loop = !!data?.loop;
  selectedTourIndex = tourState.keyframes.length ? 0 : -1;
  if (persist) saveTourState();
  updateTourControls();
  renderTourList();
}

async function loadBundledTourStateIfAvailable() {
  if (tourState.keyframes.length) return false;
  try {
    const r = await fetch('../data/planx_tour.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const data = await r.json();
    applyTourData(data, true);
    setStatus(t('tourLoaded'));
    return true;
  } catch (err) {
    console.warn('Bundled PlanX tour could not be loaded', err);
    return false;
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
  const islandPalette = {
    ParkGreen:        { base: '#6f9c52', shadow: '#3f6b2c', highlight: '#a6c982' },
    ResidentialBeige: { base: '#d6c8a6', shadow: '#a18c63', highlight: '#efe6cf' },
    CivicGravel:      { base: '#b6b3a8', shadow: '#7b7a72', highlight: '#dad7ce' },
    CoastalSand:      { base: '#ecd9b0', shadow: '#b39361', highlight: '#fff1d2' }
  }[name];
  if (islandPalette) {
    ctx.fillStyle = islandPalette.base;
    ctx.fillRect(0, 0, 256, 256);
    if (name === 'ParkGreen') {
      for (let i = 0; i < 2200; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 0.6 + Math.random() * 1.6;
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '63,107,44' : '166,201,130'},${0.10 + Math.random() * 0.18})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = `rgba(63,107,44,${0.10 + Math.random() * 0.10})`;
        ctx.lineWidth = 0.6 + Math.random() * 0.5;
        ctx.beginPath();
        const sx = Math.random() * 256;
        const sy = Math.random() * 256;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 30);
        ctx.stroke();
      }
    } else if (name === 'ResidentialBeige') {
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(161,140,99,${0.06 + Math.random() * 0.12})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.strokeStyle = 'rgba(161,140,99,0.18)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 256; i += 36) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
    } else if (name === 'CivicGravel') {
      for (let i = 0; i < 1800; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 0.4 + Math.random() * 1.2;
        const tone = Math.random() < 0.5 ? '123,122,114' : '218,215,206';
        ctx.fillStyle = `rgba(${tone},${0.18 + Math.random() * 0.20})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (name === 'CoastalSand') {
      for (let i = 0; i < 1600; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(179,147,97,${0.05 + Math.random() * 0.12})`;
        ctx.fillRect(x, y, 1, 1);
      }
      for (let band = 0; band < 6; band++) {
        ctx.strokeStyle = 'rgba(255,241,210,0.22)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const yBand = band * 42 + 8 + Math.random() * 6;
        ctx.moveTo(0, yBand);
        for (let x = 0; x <= 256; x += 8) {
          ctx.lineTo(x, yBand + Math.sin(x * 0.18 + band) * 2.2);
        }
        ctx.stroke();
      }
    }
  } else {
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

/* Solar position via simplified NOAA formula.
 * timeHours = local solar time (0-24), dayOfYear = 1-365, latitudeDeg = WGS84 lat.
 * Returns elevation + azimuth in RADIANS. Azimuth follows compass convention:
 * 0 = North, π/2 = East, π = South, 3π/2 = West. */
function solarPosition(timeHours, dayOfYear, latitudeDeg) {
  const declRad = THREE.MathUtils.degToRad(23.45) *
    Math.sin(THREE.MathUtils.degToRad((360 / 365) * (284 + dayOfYear)));
  const hourAngleRad = THREE.MathUtils.degToRad(15 * (timeHours - 12));
  const latRad = THREE.MathUtils.degToRad(latitudeDeg);
  const sinElev = Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElev)));
  const cosElev = Math.cos(elevation) || 1e-9;
  const cosLat = Math.cos(latRad) || 1e-9;
  const cosAz = (Math.sin(declRad) - Math.sin(elevation) * Math.sin(latRad)) / (cosElev * cosLat);
  const azRaw = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  const azimuth = hourAngleRad > 0 ? (2 * Math.PI - azRaw) : azRaw;
  return { elevation, azimuth };
}

let _solarCache = { elevationDeg: 30, azimuthDeg: 180 };

function updateTimeOfDay() {
  const t = settings.timeOfDay;
  const dayOfYear = Math.max(1, Math.min(365, settings.dayOfYear || 172));
  const latitude = Math.max(-66, Math.min(66, settings.latitude == null ? 39 : settings.latitude));

  const { elevation, azimuth } = solarPosition(t, dayOfYear, latitude);
  const elevationDeg = THREE.MathUtils.radToDeg(elevation);
  const azimuthDeg = (THREE.MathUtils.radToDeg(azimuth) + 360) % 360;
  _solarCache = { elevationDeg, azimuthDeg };

  /* Three.js convention: phi from +Y axis (0 = up), theta from +Z around +Y.
   * Compass azimuth 0=N(-Z), 90=E(+X), 180=S(+Z), 270=W(-X) → theta = π - azimuth. */
  const phi = Math.PI / 2 - elevation;
  const theta = Math.PI - azimuth;
  const pos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);

  sun.position.copy(pos).multiplyScalar(1300);
  // Smooth intensity ramp at horizon (golden hour feel)
  sun.intensity = elevationDeg > 0 ? 1.25 * Math.min(1, elevationDeg / 18) : 0;
  sun.shadow.needsUpdate = true;

  sky.material.uniforms.sunPosition.value.copy(pos);
  scene.fog.density = settings.fogDensity;

  // Night Mode effects
  const isNight = elevationDeg < -3;
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
  const isNight = (_solarCache.elevationDeg ?? 30) < -3;
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
  const isNight = (_solarCache.elevationDeg ?? 30) < -3;
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
  return [(x - centerX) * LOCAL_X_SIGN, y - centerY];
}

function localToMeters(localX, localZ) {
  return [centerX + localX * LOCAL_X_SIGN, centerY + localZ];
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
const DATA_FETCH_TIMEOUT_MS = 20000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DATA_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function loadGeoJson(path, options = {}) {
  const { required = false, label = path } = options;
  try {
    const r = await fetchWithTimeout(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data || !Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON FeatureCollection');
    }
    return data;
  } catch (err) {
    if (required) {
      throw new Error(`${label} could not be loaded: ${path}`);
    }
    if (!String(err?.message || err).includes('HTTP 404')) {
      console.warn(`Optional layer skipped: ${path}`, err);
    }
    return { ...EMPTY_GEOJSON, name: label };
  }
}

async function loadManifest() {
  try {
    const r = await fetchWithTimeout('../data/planx_manifest.json', { cache: 'no-store' });
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
      const schemaVersion = Number(persisted._schemaVersion || 0);
      const defaults = { ...(projectManifest.viewerDefaults || {}), ...(projectManifest.analysisDefaults || {}) };
      if (projectManifest.assetTheme && !defaults.assetTheme) defaults.assetTheme = projectManifest.assetTheme;
      for (const [key, value] of Object.entries(defaults)) {
        if (key in settings && !(key in persisted) && value !== null && value !== undefined) settings[key] = value;
      }
      if (schemaVersion < SETTINGS_SCHEMA_VERSION) {
        if (!('facadeTextureScale' in persisted)) settings.facadeTextureScale = FACADE_TEXTURE_SCALE_MULTIPLIER;
        if (!('showOutsideRoiTerrain' in persisted)) settings.showOutsideRoiTerrain = true;
        if (!('showIslands' in persisted)) settings.showIslands = true;
        if (!('islandTransparency' in persisted)) settings.islandTransparency = 0;
        if (!('showPedestrianPaths' in persisted)) settings.showPedestrianPaths = true;
        settings.flattenIslands = true;
        if (schemaVersion < 9) {
          settings.showIslands = true;
          settings.islandTransparency = 0;
          settings.buildingMode = 'Extruded + roof';
        }
      }
      if (!persisted.assetTheme && projectManifest.assetTheme) settings.assetTheme = projectManifest.assetTheme;
    } catch (_err) {
      if (projectManifest.assetTheme) settings.assetTheme = projectManifest.assetTheme;
    }
    applyThemeDefaultsToSettings(false);
    return;
  }
  const defaults = { ...(projectManifest.viewerDefaults || {}), ...(projectManifest.analysisDefaults || {}) };
  if (projectManifest.assetTheme && !defaults.assetTheme) defaults.assetTheme = projectManifest.assetTheme;
  for (const [key, value] of Object.entries(defaults)) {
    if (key in settings && value !== null && value !== undefined) settings[key] = value;
  }
  applyThemeDefaultsToSettings(false);
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

function manifestRequiresInput(key) {
  const required = projectManifest?.requiredInputs;
  if (Array.isArray(required)) return required.includes(key);
  if (isRasterTextureMode()) return ['roi', 'roads', 'buildings'].includes(key);
  return false;
}

function asFeatureCollection(data, name = 'Layer') {
  return data && Array.isArray(data.features) ? data : { ...EMPTY_GEOJSON, name };
}

function demSamplerBounds() {
  if (!demSampler) return null;
  if (demSampler.flat && demSampler.bounds) return { ...demSampler.bounds };
  const x0 = demSampler.originX;
  const x1 = demSampler.originX + demSampler.resX * demSampler.width;
  const y0 = demSampler.originY;
  const y1 = demSampler.originY + demSampler.resY * demSampler.height;
  return {
    minX: Math.min(x0, x1),
    maxX: Math.max(x0, x1),
    minY: Math.min(y0, y1),
    maxY: Math.max(y0, y1)
  };
}

function deriveVectorBounds(data) {
  const roi = asFeatureCollection(data?.roi, 'ROI');
  if (roi.features.length) return geometryBounds(roi.features);
  const candidates = [
    asFeatureCollection(data?.adalar, 'Blocks').features,
    asFeatureCollection(data?.yollar, 'Roads').features,
    asFeatureCollection(data?.yapilar, 'Buildings').features,
    asFeatureCollection(data?.parseller, 'Parcels').features,
    asFeatureCollection(data?.sidewalks, 'Sidewalks').features,
    asFeatureCollection(data?.pedestrianPaths, 'Pedestrian paths').features
  ]
    .filter((features) => features.length)
    .map((features) => geometryBounds(features))
    .filter(Boolean);
  return candidates.length ? candidates.reduce((acc, b) => acc ? mergeBounds(acc, b) : b, null) : null;
}

function fallbackSceneBounds() {
  return { minX: -500, maxX: 500, minY: -500, maxY: 500 };
}

function activateFlatTerrainFallback(sourceBounds = null, height = 0) {
  const b = sourceBounds || bounds || deriveVectorBounds(layerDataCache) || fallbackSceneBounds();
  bounds = { ...b };
  demSampler = {
    flat: true,
    flatHeight: height,
    bounds: { ...b },
    originX: b.minX,
    originY: b.minY,
    resX: Math.max(1, b.maxX - b.minX),
    resY: Math.max(1, b.maxY - b.minY),
    width: 1,
    height: 1,
    noData: null
  };
  terrainHeightStats = { min: height, max: height, avg: height, p02: height, p98: height, median: height, mad: 1 };
  demReady = true;
  demLoadingStarted = false;
  _lastTerrainY = height;
  setStatus('DEM not found; using a flat presentation plane.');
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

function terrainTextureRasterOrientation(image) {
  let resolution = null;
  try {
    resolution = image?.getResolution ? image.getResolution() : null;
  } catch (err) {
    resolution = null;
  }
  const resX = Array.isArray(resolution) ? Number(resolution[0]) : NaN;
  const resY = Array.isArray(resolution) ? Number(resolution[1]) : NaN;
  const rasterXSign = Number.isFinite(resX) && resX !== 0 ? Math.sign(resX) : 1;
  const rasterYSign = Number.isFinite(resY) && resY !== 0 ? Math.sign(resY) : -1;
  return {
    mirrorX: rasterXSign !== LOCAL_X_SIGN,
    mirrorY: rasterYSign > 0
  };
}

function geoTiffImageBounds(image) {
  try {
    const b = image?.getBoundingBox ? image.getBoundingBox() : null;
    if (Array.isArray(b) && b.length >= 4 && b.every(Number.isFinite)) {
      return {
        minX: Math.min(b[0], b[2]),
        maxX: Math.max(b[0], b[2]),
        minY: Math.min(b[1], b[3]),
        maxY: Math.max(b[1], b[3])
      };
    }
  } catch (err) {
    // Fall back to origin/resolution below.
  }

  try {
    const origin = image?.getOrigin ? image.getOrigin() : null;
    const resolution = image?.getResolution ? image.getResolution() : null;
    if (Array.isArray(origin) && Array.isArray(resolution)) {
      const x0 = Number(origin[0]);
      const y0 = Number(origin[1]);
      const x1 = x0 + Number(resolution[0]) * image.getWidth();
      const y1 = y0 + Number(resolution[1]) * image.getHeight();
      if ([x0, y0, x1, y1].every(Number.isFinite)) {
        return {
          minX: Math.min(x0, x1),
          maxX: Math.max(x0, x1),
          minY: Math.min(y0, y1),
          maxY: Math.max(y0, y1)
        };
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

function terrainTexturePixelForProjected(x, y, canvasWidth, canvasHeight) {
  const width = Math.max(1e-6, bounds.maxX - bounds.minX);
  const depth = Math.max(1e-6, bounds.maxY - bounds.minY);
  const [localX, localZ] = metersToLocal(x, y);
  const px = ((localX + width * 0.5) / width) * canvasWidth;
  const py = ((depth * 0.5 - localZ) / depth) * canvasHeight;
  return [px, py];
}

function terrainTextureAtlasSize(maxSize = 4096) {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const depth = Math.max(1, bounds.maxY - bounds.minY);
  if (width >= depth) {
    return [maxSize, Math.max(1, Math.round(maxSize * depth / width))];
  }
  return [Math.max(1, Math.round(maxSize * width / depth)), maxSize];
}

function alignTerrainTextureCanvas(sourceCanvas, textureBounds) {
  if (!bounds || !textureBounds) return sourceCanvas;
  const terrainWidth = Math.max(1e-6, bounds.maxX - bounds.minX);
  const terrainDepth = Math.max(1e-6, bounds.maxY - bounds.minY);
  const texWidth = Math.max(1e-6, textureBounds.maxX - textureBounds.minX);
  const texDepth = Math.max(1e-6, textureBounds.maxY - textureBounds.minY);
  const sameExtent =
    Math.abs(textureBounds.minX - bounds.minX) <= terrainWidth * 0.001 &&
    Math.abs(textureBounds.maxX - bounds.maxX) <= terrainWidth * 0.001 &&
    Math.abs(textureBounds.minY - bounds.minY) <= terrainDepth * 0.001 &&
    Math.abs(textureBounds.maxY - bounds.maxY) <= terrainDepth * 0.001;
  if (sameExtent) return sourceCanvas;

  const [atlasW, atlasH] = terrainTextureAtlasSize();
  const atlas = document.createElement('canvas');
  atlas.width = atlasW;
  atlas.height = atlasH;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = settings.terrainOutsideColor || '#edf2ef';
  ctx.fillRect(0, 0, atlasW, atlasH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const [xA, yA] = terrainTexturePixelForProjected(textureBounds.minX, textureBounds.maxY, atlasW, atlasH);
  const [xB, yB] = terrainTexturePixelForProjected(textureBounds.maxX, textureBounds.minY, atlasW, atlasH);
  const dx = Math.min(xA, xB);
  const dy = Math.min(yA, yB);
  const dw = Math.abs(xB - xA);
  const dh = Math.abs(yB - yA);
  if (dw < 1 || dh < 1 || texWidth <= 0 || texDepth <= 0) return sourceCanvas;

  ctx.drawImage(sourceCanvas, dx, dy, dw, dh);
  return atlas;
}

async function loadTerrainTextureFromGeoTiff() {
  const target = projectManifest?.terrainTexture?.target;
  if (!target || !settings.showTerrainTexture) return null;
  const res = await fetchWithTimeout(`../data/${target}`, { cache: 'no-store' }, 30000);
  if (!res.ok) throw new Error(`Terrain texture not found: ${target}`);
  const file = await res.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(file);
  const image = await tiff.getImage();
  const w = image.getWidth();
  const h = image.getHeight();
  const maxSize = 4096;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const samples = image.getSamplesPerPixel ? image.getSamplesPerPixel() : 1;
  const raster = await image.readRasters({ interleave: true, width: outW, height: outH });
  const orientation = terrainTextureRasterOrientation(image);
  const textureBounds = geoTiffImageBounds(image);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = outW;
  sourceCanvas.height = outH;
  const ctx = sourceCanvas.getContext('2d');
  const img = ctx.createImageData(outW, outH);
  for (let y = 0; y < outH; y++) {
    const srcY = orientation.mirrorY ? outH - 1 - y : y;
    for (let x = 0; x < outW; x++) {
      const srcX = orientation.mirrorX ? outW - 1 - x : x;
      const src = (srcY * outW + srcX) * samples;
      const dst = (y * outW + x) * 4;
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
  }
  ctx.putImageData(img, 0, 0);
  const canvas = alignTerrainTextureCanvas(sourceCanvas, textureBounds);
  const tex = new THREE.CanvasTexture(canvas);
  // The canvas is normalized to the corrected local map axes; terrain UVs use it directly.
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
  if (demSampler.flat) return Number.isFinite(demSampler.flatHeight) ? demSampler.flatHeight : fallback;
  const px = Math.floor((x - demSampler.originX) / demSampler.resX);
  const py = Math.floor((y - demSampler.originY) / demSampler.resY);
  if (px < 0 || px >= demSampler.width || py < 0 || py >= demSampler.height) return fallback;
  const idx = py * demSampler.width + px;
  const v = demSampler.raster[idx];
  if (!Number.isFinite(v)) return fallback;
  if (demSampler.noData !== null && String(v) === String(demSampler.noData)) return fallback;
  return v;
}

function demHeightMedianAtProjected(x, y, fallback = null, radius = 1) {
  if (!demSampler) return fallback;
  if (demSampler.flat) return Number.isFinite(demSampler.flatHeight) ? demSampler.flatHeight : fallback;
  const px = Math.floor((x - demSampler.originX) / demSampler.resX);
  const py = Math.floor((y - demSampler.originY) / demSampler.resY);
  const values = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = px + dx;
      const sy = py + dy;
      if (sx < 0 || sx >= demSampler.width || sy < 0 || sy >= demSampler.height) continue;
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
  setStatus(t('demLoading'));
  const res = await fetchWithTimeout('../data/dem/mydem.tif', { cache: 'no-store' }, 30000);
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
  setStatus(`${t('demLoaded')} (Bergama_Elevation_Cropped.tif).`);
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
  const [wx, wy] = localToMeters(localX, localZ);
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
  const base = Number.isFinite(fallback) ? fallback : (Number.isFinite(terrainHeightStats.avg) ? terrainHeightStats.avg : 0);
  let z = demHeightMedianAtProjected(x, y, null, 1);
  if (z === null) z = base;
  const lo = Number.isFinite(terrainHeightStats.p02) ? terrainHeightStats.p02 : base - 20;
  const hi = Number.isFinite(terrainHeightStats.p98) ? terrainHeightStats.p98 : base + 20;
  return Math.max(lo, Math.min(hi, z));
}

function terrainHeightStatsFromPositions(pos) {
  const values = [];
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (Number.isFinite(z)) values.push(z);
  }
  if (!values.length) {
    return { min: 0, max: 0, avg: 0, p02: 0, p98: 0, median: 0, mad: 1 };
  }
  values.sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const median = values[Math.floor(values.length / 2)];
  const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  return {
    min: values[0],
    max: values[values.length - 1],
    avg: sum / values.length,
    p02: values[Math.max(0, Math.floor((values.length - 1) * 0.02))],
    p98: values[Math.min(values.length - 1, Math.floor((values.length - 1) * 0.98))],
    median,
    mad: Math.max(0.5, deviations[Math.floor(deviations.length / 2)] || 1)
  };
}

function smoothTerrainSurface(pos, segments, width, depth) {
  const passes = Math.max(0, Math.min(6, Math.round(Number(settings.terrainSmoothingPasses) || 0)));
  if (!passes) return;
  const strength = Math.max(0, Math.min(0.9, Number(settings.terrainSmoothingStrength) || 0));
  if (strength <= 0) return;

  const cols = segments + 1;
  const rows = segments + 1;
  const count = cols * rows;
  let current = new Float32Array(count);
  for (let i = 0; i < count; i++) current[i] = pos.getZ(i);

  const gridStep = Math.max(width / Math.max(1, segments), depth / Math.max(1, segments));
  const maxSlope = Math.max(0.1, Math.min(3.0, Number(settings.terrainMaxSlope) || 0.75));
  const maxDelta = Math.max(0.5, Math.min(16, gridStep * maxSlope));

  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(count);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const values = [];
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const rr = row + dy;
          if (rr < 0 || rr >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const cc = col + dx;
            if (cc < 0 || cc >= cols) continue;
            const v = current[rr * cols + cc];
            if (!Number.isFinite(v)) continue;
            values.push(v);
            sum += v;
            n++;
          }
        }
        if (!values.length) {
          next[idx] = current[idx];
          continue;
        }
        values.sort((a, b) => a - b);
        const med = values[Math.floor(values.length / 2)];
        const mean = sum / n;
        let clamped = current[idx];
        if (clamped > med + maxDelta) clamped = med + maxDelta;
        else if (clamped < med - maxDelta) clamped = med - maxDelta;
        const target = med * 0.62 + mean * 0.25 + clamped * 0.13;
        next[idx] = current[idx] * (1 - strength) + target * strength;
      }
    }
    current = next;
  }

  for (let i = 0; i < count; i++) pos.setZ(i, current[i]);
  pos.needsUpdate = true;
}

function buildTerrainSurfaceCache(pos, segments, width, depth) {
  const values = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) values[i] = pos.getZ(i);
  terrainSurfaceCache = {
    values,
    segments,
    cols: segments + 1,
    rows: segments + 1,
    width,
    depth
  };
}

function terrainSurfaceCacheYAt(localX, localZ) {
  const cache = terrainSurfaceCache;
  if (!cache) return null;
  const fx = ((localX + cache.width * 0.5) / cache.width) * cache.segments;
  const fz = ((localZ + cache.depth * 0.5) / cache.depth) * cache.segments;
  if (fx < 0 || fz < 0 || fx > cache.segments || fz > cache.segments) return null;
  const c0 = Math.max(0, Math.min(cache.segments, Math.floor(fx)));
  const r0 = Math.max(0, Math.min(cache.segments, Math.floor(fz)));
  const c1 = Math.min(cache.segments, c0 + 1);
  const r1 = Math.min(cache.segments, r0 + 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const z00 = cache.values[r0 * cache.cols + c0];
  const z10 = cache.values[r0 * cache.cols + c1];
  const z01 = cache.values[r1 * cache.cols + c0];
  const z11 = cache.values[r1 * cache.cols + c1];
  if (![z00, z10, z01, z11].every(Number.isFinite)) return null;
  const za = z00 * (1 - tx) + z10 * tx;
  const zb = z01 * (1 - tx) + z11 * tx;
  return za * (1 - tz) + zb * tz;
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
  const band = Math.max(8, Math.min(width, depth) * 0.035);
  if (edgeDistance >= band) return 0;
  return 1 - Math.max(0, edgeDistance) / band;
}

function pointInRingLocal(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1];
    const xj = ring[j][0], zj = ring[j][1];
    const crosses = (zi > z) !== (zj > z);
    if (crosses) {
      const xAtZ = ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi;
      if (x < xAtZ) inside = !inside;
    }
  }
  return inside;
}

function roiLocalPolygons() {
  const polygons = [];
  for (const feature of layerDataCache?.roi?.features || []) {
    for (const poly of getPolygonRings(feature.geometry)) {
      if (!poly?.[0]?.length) continue;
      polygons.push(poly.map((ring) => ring.map((coord) => metersToLocal(coord[0], coord[1]))));
    }
  }
  return polygons;
}

function pointInRoiLocal(x, z, polygons) {
  if (!polygons.length) return true;
  for (const poly of polygons) {
    if (!pointInRingLocal(x, z, poly[0])) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) {
      if (pointInRingLocal(x, z, poly[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

function limitTerrainBoundarySpikes(pos, segments, width, depth, fallback, roiPolyCache) {
  const cols = segments + 1;
  const rows = segments + 1;
  const count = cols * rows;
  const original = new Float32Array(count);
  const inside = new Uint8Array(count);
  const polygons = roiPolyCache || roiLocalPolygons();
  const hasRoi = polygons.length > 0;
  for (let i = 0; i < count; i++) {
    original[i] = pos.getZ(i);
    inside[i] = pointInRoiLocal(pos.getX(i), -pos.getY(i), polygons) ? 1 : 0;
  }
  const range = Math.max(1, (terrainHeightStats.p98 || fallback) - (terrainHeightStats.p02 || fallback));
  const riseLimit = Math.max(1.2, Math.min(7.5, range * 0.055));
  const dropLimit = Math.max(1.8, Math.min(10.0, range * 0.080));
  const bboxBand = Math.max(2, Math.ceil(cols * 0.035));
  const radius = 3;

  const medianAround = (row, col) => {
    const values = [];
    for (let dy = -radius; dy <= radius; dy++) {
      const rr = row + dy;
      if (rr < 0 || rr >= rows) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const cc = col + dx;
        if (cc < 0 || cc >= cols) continue;
        const v = original[rr * cols + cc];
        if (Number.isFinite(v)) values.push(v);
      }
    }
    if (!values.length) return fallback;
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      let boundary = row < bboxBand || col < bboxBand || row >= rows - bboxBand || col >= cols - bboxBand;
      if (hasRoi && !boundary) {
        const here = inside[idx];
        boundary =
          inside[Math.max(0, row - 1) * cols + col] !== here ||
          inside[Math.min(rows - 1, row + 1) * cols + col] !== here ||
          inside[row * cols + Math.max(0, col - 1)] !== here ||
          inside[row * cols + Math.min(cols - 1, col + 1)] !== here;
      }
      if (!boundary) continue;
      const z = original[idx];
      const med = medianAround(row, col);
      if (!Number.isFinite(z) || !Number.isFinite(med)) continue;
      if (z > med + riseLimit) {
        pos.setZ(idx, med + riseLimit * 0.30);
      } else if (z < med - dropLimit) {
        pos.setZ(idx, med - dropLimit * 0.50);
      }
    }
  }
  pos.needsUpdate = true;
}

function distanceToRingLocal(x, z, ring) {
  let minD2 = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], az = ring[j][1];
    const bx = ring[i][0], bz = ring[i][1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = ax + t * dx, pz = az + t * dz;
    const dxp = x - px, dzp = z - pz;
    const d2 = dxp * dxp + dzp * dzp;
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

function pointInLocalPolys(x, z, localPolys) {
  for (const localRings of localPolys) {
    const outer = localRings[0];
    if (!outer || outer.length < 3) continue;
    if (pointInRingLocal(x, z, outer)) {
      let inHole = false;
      for (let h = 1; h < localRings.length; h++) {
        if (pointInRingLocal(x, z, localRings[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

function shapeFromLocalPolygon(poly) {
  const outer = poly?.[0];
  if (!outer || outer.length < 3) return null;
  const shape = new THREE.Shape();
  outer.forEach((c, i) => {
    const [x, z] = metersToLocal(c[0], c[1]);
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  });
  for (let h = 1; h < poly.length; h++) {
    const ring = poly[h];
    if (!ring || ring.length < 3) continue;
    const path = new THREE.Path();
    ring.forEach((c, i) => {
      const [x, z] = metersToLocal(c[0], c[1]);
      if (i === 0) path.moveTo(x, z); else path.lineTo(x, z);
    });
    shape.holes.push(path);
  }
  return shape;
}

function isSceneBuildStale(token) {
  return token !== sceneBuildToken;
}

function islandOpacityValue() {
  const transparency = Math.max(0, Math.min(0.95, Number(settings.islandTransparency) || 0));
  return Math.max(0.05, 1 - transparency);
}

function applyIslandMaterialVisibility(material) {
  const opacity = islandOpacityValue();
  material.opacity = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = opacity >= 0.999;
  return material;
}

function shouldApplyIslandPlateaus(adalar) {
  if (!settings.flattenIslands || !adalar?.features?.length) return false;
  return !!(settings.showIslands || settings.showBuildings || settings.showHardscape || settings.showTrees || settings.showFurniture);
}

function applyIslandPlateaus(pos, segments, width, depth, adalar, transitionM) {
  islandPlateauCache.length = 0;
  if (!adalar?.features?.length) return;
  const count = pos.count;

  for (const feature of adalar.features) {
    const rings = getPolygonRings(feature.geometry);
    if (!rings.length) continue;
    const localPolys = rings.map((poly) => poly.map((ring) => ring.map((c) => metersToLocal(c[0], c[1]))));

    let bboxMinX = Infinity, bboxMaxX = -Infinity, bboxMinZ = Infinity, bboxMaxZ = -Infinity;
    for (const localRings of localPolys) {
      for (const r of localRings) {
        for (let p = 0; p < r.length; p++) {
          const px = r[p][0];
          const pz = r[p][1];
          if (px < bboxMinX) bboxMinX = px;
          if (px > bboxMaxX) bboxMaxX = px;
          if (pz < bboxMinZ) bboxMinZ = pz;
          if (pz > bboxMaxZ) bboxMaxZ = pz;
        }
      }
    }
    if (!Number.isFinite(bboxMinX)) continue;

    const insideIdx = [];
    const heights = [];
    for (let i = 0; i < count; i++) {
      const lx = pos.getX(i);
      const lz = -pos.getY(i);
      if (lx < bboxMinX || lx > bboxMaxX || lz < bboxMinZ || lz > bboxMaxZ) continue;
      if (pointInLocalPolys(lx, lz, localPolys)) {
        insideIdx.push(i);
        heights.push(pos.getZ(i));
      }
    }
    if (!heights.length) continue;
    heights.sort((a, b) => a - b);
    const plateauY = heights[Math.floor(heights.length / 2)];

    for (let k = 0; k < insideIdx.length; k++) {
      pos.setZ(insideIdx[k], plateauY);
    }

    if (transitionM > 0) {
      const expMinX = bboxMinX - transitionM;
      const expMaxX = bboxMaxX + transitionM;
      const expMinZ = bboxMinZ - transitionM;
      const expMaxZ = bboxMaxZ + transitionM;
      for (let i = 0; i < count; i++) {
        const lx = pos.getX(i);
        const lz = -pos.getY(i);
        if (lx < expMinX || lx > expMaxX || lz < expMinZ || lz > expMaxZ) continue;
        if (pointInLocalPolys(lx, lz, localPolys)) continue;
        let minDist = Infinity;
        for (const localRings of localPolys) {
          for (const r of localRings) {
            const d = distanceToRingLocal(lx, lz, r);
            if (d < minDist) minDist = d;
          }
        }
        if (minDist < transitionM) {
          let t = 1 - minDist / transitionM;
          t = t * t * (3 - 2 * t);
          const z = pos.getZ(i);
          pos.setZ(i, z * (1 - t) + plateauY * t);
        }
      }
    }

    islandPlateauCache.push({
      feature,
      localRings: localPolys,
      plateauY,
      bbox: { minX: bboxMinX, maxX: bboxMaxX, minZ: bboxMinZ, maxZ: bboxMaxZ },
      transition: transitionM
    });
  }

  pos.needsUpdate = true;
}

async function buildTerrain(adalar, buildToken = sceneBuildToken) {
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
    const [wx, wy] = localToMeters(lx, -ly);
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
  const medianZ = validHeights.length ? validHeights[Math.floor(validHeights.length / 2)] : avgZ;
  let madZ = 1;
  if (validHeights.length) {
    const deviations = validHeights.map((v) => Math.abs(v - medianZ));
    deviations.sort((a, b) => a - b);
    madZ = Math.max(0.5, deviations[Math.floor(deviations.length / 2)] || 1);
  }
  terrainHeightStats = {
    min: zMin,
    max: zMax,
    avg: avgZ,
    p02: percentile(0.02, zMin),
    p98: percentile(0.98, zMax),
    median: medianZ,
    mad: madZ
  };
  const lowFloor = medianZ - 3 * madZ;

  const roiPolyCache = roiLocalPolygons();
  const hasRoiCache = roiPolyCache.length > 0;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const [wx, wy] = localToMeters(lx, -ly);
    let z = robustTerrainHeightAtProjected(wx, wy, avgZ);
    if (z === null) z = avgZ;
    if (hasRoiCache && !pointInRoiLocal(lx, -ly, roiPolyCache)) {
      const outsideZ = demHeightMedianAtProjected(wx, wy, avgZ, 3);
      z = Number.isFinite(outsideZ) ? outsideZ : avgZ;
    }
    if (z < lowFloor) {
      const repaired = demHeightMedianAtProjected(wx, wy, lowFloor, 3);
      z = Number.isFinite(repaired) && repaired >= lowFloor ? repaired : lowFloor;
    }
    const edgeBlend = terrainVertexBoundaryBlend(lx, ly, width, depth);
    if (edgeBlend > 0) {
      const smoothZ = demHeightMedianAtProjected(wx, wy, z, 3);
      z = z * (1 - edgeBlend) + smoothZ * edgeBlend;
    }
    pos.setZ(i, z);
  }
  limitTerrainBoundarySpikes(pos, segments, width, depth, avgZ, roiPolyCache);
  smoothTerrainSurface(pos, segments, width, depth);
  if (shouldApplyIslandPlateaus(adalar)) {
    applyIslandPlateaus(pos, segments, width, depth, adalar, settings.islandPlateauTransition);
  } else {
    islandPlateauCache.length = 0;
  }
  const finalStats = terrainHeightStatsFromPositions(pos);
  terrainHeightStats = finalStats;
  zMin = finalStats.min;
  zMax = finalStats.max;
  buildTerrainSurfaceCache(pos, segments, width, depth);
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

  const useBaseMapTexture = settings.showXyzTiles && baseMapTexture;
  const useRasterTexture = !useBaseMapTexture && isRasterTextureMode() && settings.showTerrainTexture && terrainTexture;
  const groundTex = useBaseMapTexture
    ? baseMapTexture
    : (useRasterTexture
      ? terrainTexture
    : (settings.pavementStyle === 'Asphalt'
      ? createAsphaltTexture()
      : await textureFromSet('pavement', settings.pavementStyle,
        width / Math.max(2, settings.terrainTileMeters || 60),
        depth / Math.max(2, settings.terrainTileMeters || 60))));
  if (isSceneBuildStale(buildToken)) {
    geo.dispose();
    return false;
  }
  const terrainOpacity = useRasterTexture ? settings.terrainTextureOpacity : 1;
  const roiMaskTexture = createRoiMaskTexture(width, depth);
  const clipTerrainToRoi = !settings.showOutsideRoiTerrain && !!roiMaskTexture;
  const maskTextureToRoi = settings.showOutsideRoiTerrain && !useTopoTint && !!roiMaskTexture && !!groundTex;
  const materialOptions = {
    color: maskTextureToRoi ? new THREE.Color(settings.terrainOutsideColor || '#edf2ef') : 0xffffff,
    map: useTopoTint || maskTextureToRoi ? null : groundTex,
    alphaMap: clipTerrainToRoi ? roiMaskTexture : null,
    alphaTest: clipTerrainToRoi ? 0.02 : 0,
    vertexColors: useTopoTint,
    transparent: clipTerrainToRoi || (!maskTextureToRoi && terrainOpacity < 1),
    opacity: maskTextureToRoi ? 1 : terrainOpacity,
    roughness: (useRasterTexture || useBaseMapTexture) ? 0.82 : 0.95,
    metalness: 0.02,
    depthWrite: true
  };
  const mat = new THREE.MeshStandardMaterial(materialOptions);
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.rotation.x = -Math.PI / 2;
  terrainMesh.receiveShadow = true;
  terrainMesh.renderOrder = -30;
  world.add(terrainMesh);
  if (maskTextureToRoi) {
    const overlayMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      alphaMap: roiMaskTexture,
      alphaTest: 0.02,
      transparent: true,
      opacity: terrainOpacity,
      roughness: (useRasterTexture || useBaseMapTexture) ? 0.82 : 0.95,
      metalness: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    terrainOverlayMesh = new THREE.Mesh(geo.clone(), overlayMat);
    terrainOverlayMesh.rotation.x = -Math.PI / 2;
    terrainOverlayMesh.receiveShadow = false;
    terrainOverlayMesh.renderOrder = -29;
    world.add(terrainOverlayMesh);
  }
  buildTerrainSideSkirt(width, depth, zMin, finalStats.avg);
  _lastTerrainY = finalStats.avg;   // fallback için kararlı terrain yüksekliğini başlat
  const terrainLabel = demSampler?.flat ? 'Flat terrain plane' : 'mydem.tif';
  setStatus(`${t('demLoaded')} (${terrainLabel}). Z: ${zMin.toFixed(1)} - ${zMax.toFixed(1)} m`);
  return true;
}

/* terrainLocalYAt: DEM'den doğrudan yükseklik okur.
 * Raycasting KULLANMAZ — demHeightAtProjected ile aynı kaynağı kullanır.
 * Terrain mesh segment çözünürlüğüne bağımlılık ortadan kalkar. */
let _lastTerrainY = 0;
function terrainLocalYAt(localX, localZ) {
  if (islandPlateauCache.length) {
    for (const cache of islandPlateauCache) {
      const t = cache.transition || 0;
      if (localX < cache.bbox.minX - t || localX > cache.bbox.maxX + t) continue;
      if (localZ < cache.bbox.minZ - t || localZ > cache.bbox.maxZ + t) continue;
      if (pointInLocalPolys(localX, localZ, cache.localRings)) {
        _lastTerrainY = cache.plateauY;
        return cache.plateauY;
      }
    }
  }
  const cachedY = terrainSurfaceCacheYAt(localX, localZ);
  if (cachedY !== null) {
    _lastTerrainY = cachedY;
    return cachedY;
  }
  if (!demSampler || demSampler.flat) return _lastTerrainY;
  const [wx, wy] = localToMeters(localX, localZ);
  const z = robustTerrainHeightAtProjected(wx, wy, null);
  if (z !== null) {
    _lastTerrainY = z;
    return z;
  }
  return _lastTerrainY;
}

/* Collapse coincident vertices of a non-indexed BufferGeometry into an indexed
 * one with shared vertices, so computeVertexNormals can produce smooth shading
 * across shared edges. Tolerance in scene units. */
function indexAndMergeNonIndexed(geometry, tolerance = 0.01) {
  if (geometry.index) return geometry;
  const posAttr = geometry.attributes.position;
  const uvAttr = geometry.attributes.uv;
  if (!posAttr) return geometry;
  const positions = posAttr.array;
  const uvs = uvAttr ? uvAttr.array : null;
  const count = positions.length / 3;
  const inv = 1 / Math.max(tolerance, 1e-6);
  const uniquePositions = [];
  const uniqueUvs = uvs ? [] : null;
  const indices = new Array(count);
  const map = new Map();
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x * inv)}|${Math.round(y * inv)}|${Math.round(z * inv)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = uniquePositions.length / 3;
      uniquePositions.push(x, y, z);
      if (uvs) uniqueUvs.push(uvs[i * 2], uvs[i * 2 + 1]);
      map.set(key, idx);
    }
    indices[i] = idx;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(uniquePositions, 3));
  if (uniqueUvs) out.setAttribute('uv', new THREE.Float32BufferAttribute(uniqueUvs, 2));
  out.setIndex(indices);
  return out;
}

function subdivideShapeGeometry(geometry, maxEdgeLen) {
  // Conforming 4-1 (Loop-style) subdivision: every triangle is split into 4
  // children at the midpoints of ALL three edges. Because two neighbouring
  // triangles share an edge, both compute the exact same midpoint, so the
  // resulting mesh is watertight (no T-vertices, no gaps). Earlier code
  // bisected only the longest edge per triangle, which produced T-vertex
  // cracks visible after DEM drape.
  let geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const maxIterations = 6;
  for (let iter = 0; iter < maxIterations; iter++) {
    const positions = geo.attributes.position.array;
    const uvs = geo.attributes.uv ? geo.attributes.uv.array : null;
    const triCount = positions.length / 9;

    // Decide whether further subdivision is needed (longest edge > target).
    let maxEdge = 0;
    for (let i = 0; i < triCount; i++) {
      const ax = positions[i * 9],     az = positions[i * 9 + 2];
      const bx = positions[i * 9 + 3], bz = positions[i * 9 + 5];
      const cx = positions[i * 9 + 6], cz = positions[i * 9 + 8];
      const d1 = Math.hypot(ax - bx, az - bz);
      const d2 = Math.hypot(bx - cx, bz - cz);
      const d3 = Math.hypot(cx - ax, cz - az);
      if (d1 > maxEdge) maxEdge = d1;
      if (d2 > maxEdge) maxEdge = d2;
      if (d3 > maxEdge) maxEdge = d3;
    }
    if (maxEdge <= maxEdgeLen) break;

    const newPos = new Array(triCount * 4 * 9);
    const newUv = uvs ? new Array(triCount * 4 * 6) : null;
    let pi = 0;
    let ui = 0;
    for (let i = 0; i < triCount; i++) {
      const ax = positions[i * 9],     ay = positions[i * 9 + 1], az = positions[i * 9 + 2];
      const bx = positions[i * 9 + 3], by = positions[i * 9 + 4], bz = positions[i * 9 + 5];
      const cx = positions[i * 9 + 6], cy = positions[i * 9 + 7], cz = positions[i * 9 + 8];
      const mabx = (ax + bx) / 2, maby = (ay + by) / 2, mabz = (az + bz) / 2;
      const mbcx = (bx + cx) / 2, mbcy = (by + cy) / 2, mbcz = (bz + cz) / 2;
      const mcax = (cx + ax) / 2, mcay = (cy + ay) / 2, mcaz = (cz + az) / 2;
      // 4 triangles: corner_a, corner_b, corner_c, central
      // [A, Mab, Mca]
      newPos[pi++] = ax;   newPos[pi++] = ay;   newPos[pi++] = az;
      newPos[pi++] = mabx; newPos[pi++] = maby; newPos[pi++] = mabz;
      newPos[pi++] = mcax; newPos[pi++] = mcay; newPos[pi++] = mcaz;
      // [Mab, B, Mbc]
      newPos[pi++] = mabx; newPos[pi++] = maby; newPos[pi++] = mabz;
      newPos[pi++] = bx;   newPos[pi++] = by;   newPos[pi++] = bz;
      newPos[pi++] = mbcx; newPos[pi++] = mbcy; newPos[pi++] = mbcz;
      // [Mca, Mbc, C]
      newPos[pi++] = mcax; newPos[pi++] = mcay; newPos[pi++] = mcaz;
      newPos[pi++] = mbcx; newPos[pi++] = mbcy; newPos[pi++] = mbcz;
      newPos[pi++] = cx;   newPos[pi++] = cy;   newPos[pi++] = cz;
      // [Mab, Mbc, Mca] central
      newPos[pi++] = mabx; newPos[pi++] = maby; newPos[pi++] = mabz;
      newPos[pi++] = mbcx; newPos[pi++] = mbcy; newPos[pi++] = mbcz;
      newPos[pi++] = mcax; newPos[pi++] = mcay; newPos[pi++] = mcaz;
      if (uvs) {
        const au = uvs[i * 6],     av = uvs[i * 6 + 1];
        const bu = uvs[i * 6 + 2], bv = uvs[i * 6 + 3];
        const cu = uvs[i * 6 + 4], cv = uvs[i * 6 + 5];
        const mabu = (au + bu) / 2, mabv = (av + bv) / 2;
        const mbcu = (bu + cu) / 2, mbcv = (bv + cv) / 2;
        const mcau = (cu + au) / 2, mcav = (cv + av) / 2;
        newUv[ui++] = au;   newUv[ui++] = av;
        newUv[ui++] = mabu; newUv[ui++] = mabv;
        newUv[ui++] = mcau; newUv[ui++] = mcav;
        newUv[ui++] = mabu; newUv[ui++] = mabv;
        newUv[ui++] = bu;   newUv[ui++] = bv;
        newUv[ui++] = mbcu; newUv[ui++] = mbcv;
        newUv[ui++] = mcau; newUv[ui++] = mcav;
        newUv[ui++] = mbcu; newUv[ui++] = mbcv;
        newUv[ui++] = cu;   newUv[ui++] = cv;
        newUv[ui++] = mabu; newUv[ui++] = mabv;
        newUv[ui++] = mbcu; newUv[ui++] = mbcv;
        newUv[ui++] = mcau; newUv[ui++] = mcav;
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    if (newUv) next.setAttribute('uv', new THREE.Float32BufferAttribute(newUv, 2));
    geo = next;
  }
  return geo;
}

async function buildIslandLayer(adalar, buildToken = sceneBuildToken) {
  clearGroup(islandGroup);
  if (!adalar?.features?.length) return;
  const t = createIslandTexturePreset(settings.islandTexture);
  const defaultMat = applyIslandMaterialVisibility(new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.islandColor),
    map: t,
    roughness: 0.92,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  }));
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
      customMaterials[key] = applyIslandMaterialVisibility(new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        map: createIslandTexturePreset(textureName),
        roughness: 0.92,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }));
    }
    return customMaterials[key];
  };
  const parkTex = createIslandTexturePreset(settings.parkTexture || 'ParkGreen');
  const parkMat = applyIslandMaterialVisibility(new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.parkColor || '#5e9e3e'),
    map: parkTex,
    roughness: 0.90,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  }));
  const sportMat = applyIslandMaterialVisibility(new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.sportColor || '#4a8c30'),
    roughness: 0.88,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  }));

  for (const f of adalar.features) {
    const fn = ((f.properties?.uipfonksiyon || f.properties?.arazi_kull || '')).toString().toUpperCase();
    const isPark = fn.includes('PARK') || fn.includes('YEŞİL') || fn.includes('ORMAN') || fn.includes('BAHÇE');
    const isSport = fn.includes('SPOR') || fn.includes('STADYUM');
    const mat = materialForIsland(f, isPark ? parkMat : (isSport ? sportMat : defaultMat));

    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = shapeFromLocalPolygon(poly);
      if (!shape) continue;
      const rawGeo = new THREE.ShapeGeometry(shape);
      rawGeo.rotateX(Math.PI / 2);
      const cacheEntry = settings.flattenIslands ? islandPlateauCache.find((c) => c.feature === f) : null;
      const plateauY = cacheEntry?.plateauY;
      let g;
      if (plateauY != null) {
        g = rawGeo;
      } else {
        // Conforming 4-1 subdivision down to ~6 m edges, then merge coincident
        // vertices so computeVertexNormals can produce smooth shading across
        // shared edges. Output is watertight (every shared edge agrees on its
        // midpoint), so DEM drape lands on a continuous surface.
        const subdivided = subdivideShapeGeometry(rawGeo, 6);
        g = indexAndMergeNonIndexed(subdivided, 0.1);
      }
      const pos = g.attributes.position;
      if (plateauY != null) {
        const flatY = plateauY + LAYER.island;
        for (let vi = 0; vi < pos.count; vi++) {
          pos.setY(vi, flatY);
        }
      } else {
        for (let vi = 0; vi < pos.count; vi++) {
          const vx = pos.getX(vi);
          const vz = pos.getZ(vi);
          pos.setY(vi, terrainLocalYAt(vx, vz) + LAYER.island);
        }
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
  if (!parseller?.features?.length) return;
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

async function buildHardscapeLayer(hardscape, buildToken = sceneBuildToken) {
  clearGroup(hardscapeGroup);
  if (!hardscape?.features?.length) return;
  const t = await textureFromSet('hardscape', settings.hardscapeStyle, 8, 8);
  if (isSceneBuildStale(buildToken)) return;
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
      const shape = shapeFromLocalPolygon(poly);
      if (!shape) continue;
      const raw = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
      raw.rotateX(Math.PI / 2);
      const g = indexAndMergeNonIndexed(subdivideShapeGeometry(raw, 8), 0.1);
      /* -- Per-vertex DEM elevation -- */
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const vz = pos.getZ(vi);
        const isTop = pos.getY(vi) > -0.5;
        const baseDem = terrainLocalYAt(vx, vz);
        const yVal = isTop ? (baseDem + LAYER.hardscape + settings.hardscapeHeight) : (baseDem + LAYER.hardscape);
        pos.setY(vi, yVal);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      if (isSceneBuildStale(buildToken)) return;
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
  const population = parseNumberProp(props, namesWithMapping('building_population_field', ['nufus', 'nüfus', 'nÃ¼fus', 'population', 'pop']), Math.round(dwellings * 3.1));
  const vehicles = parseNumberProp(props, namesWithMapping('building_vehicle_field', ['arac', 'araç', 'araÃ§', 'vehicle', 'cars']), Math.round(dwellings * 0.7));
  return { footprint, floorArea, dwellings, population, vehicles };
}

function buildingGroundOffset() {
  return isRasterTextureMode() ? 0.08 : LAYER.content + 0.03;
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
  const groundOffset = buildingGroundOffset();
  if (!valid.length) return terrainLocalYAt(0, 0) + groundOffset;
  const mid = valid[Math.floor(valid.length / 2)];
  const high = valid[Math.max(0, Math.ceil(valid.length * 0.72) - 1)];
  return Math.max(mid, high - 0.35) + groundOffset;
}

/* Compute a cumulative shadow heatmap across the scene:
 * sample N hours of solar position, raycast from each grid point toward the sun,
 * count how many samples are blocked by buildings/trees/blocks. Score 0 (always
 * sun) .. 1 (always shaded) drives a colour overlay quad above the terrain.
 * Useful for solar access screening of plans. */
async function computeShadowHeatmap() {
  if (!bounds || !terrainMesh) return;
  removeShadowHeatmap();
  const setProgress = (msg) => setStatus(msg);
  setProgress('Computing shadow heatmap... (raycasting)');
  await new Promise((r) => setTimeout(r, 16));

  const gridN = 48;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const dx = width / (gridN - 1);
  const dz = depth / (gridN - 1);
  const sampleHours = [7, 9, 11, 13, 15, 17];
  const dayOfYear = settings.dayOfYear || 172;
  const latitude = settings.latitude == null ? 39 : settings.latitude;

  const blockers = [];
  buildingGroup.traverse((o) => { if (o.isMesh) blockers.push(o); });
  treeGroup.traverse((o) => { if (o.isMesh) blockers.push(o); });

  const scores = new Float32Array(gridN * gridN);
  const local = new THREE.Vector3();
  const localRaycaster = new THREE.Raycaster();
  localRaycaster.firstHitOnly = true;
  localRaycaster.far = Math.max(800, Math.max(width, depth));

  const sunDirs = [];
  for (const hour of sampleHours) {
    const { elevation, azimuth } = solarPosition(hour, dayOfYear, latitude);
    if (elevation <= 0) continue;
    const phi = Math.PI / 2 - elevation;
    const theta = Math.PI - azimuth;
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    sunDirs.push(dir);
  }
  if (!sunDirs.length) {
    setProgress('Shadow heatmap: no daylight in current day-of-year — skipping.');
    return;
  }

  for (let gi = 0; gi < gridN; gi++) {
    if (gi % 8 === 0) {
      setProgress(`Computing shadow heatmap... ${Math.round((gi / gridN) * 100)}%`);
      await new Promise((r) => setTimeout(r, 0));
    }
    for (let gj = 0; gj < gridN; gj++) {
      const lx = -width * 0.5 + gj * dx;
      const lz = -depth * 0.5 + gi * dz;
      const y = terrainLocalYAt(lx, lz) + 0.5;
      local.set(lx, y, lz);
      let shaded = 0;
      for (const dir of sunDirs) {
        localRaycaster.set(local, dir);
        const hits = localRaycaster.intersectObjects(blockers, false);
        if (hits.length) shaded++;
      }
      scores[gi * gridN + gj] = shaded / sunDirs.length;
    }
  }

  // Build overlay grid mesh — one quad per cell, vertex-coloured
  const geo = new THREE.PlaneGeometry(width, depth, gridN - 1, gridN - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainLocalYAt(x, z) + 0.45;
    pos.setY(i, y);
    const gj = Math.min(gridN - 1, Math.max(0, Math.round((x + width * 0.5) / dx)));
    const gi = Math.min(gridN - 1, Math.max(0, Math.round((z + depth * 0.5) / dz)));
    const score = scores[gi * gridN + gj];
    // Colour ramp: bright golden (no shadow) → deep cool blue (full shadow)
    const c = new THREE.Color().setHSL(0.13 + score * 0.45, 0.7, 0.55 - score * 0.20);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
  shadowHeatmapMesh = new THREE.Mesh(geo, mat);
  shadowHeatmapMesh.renderOrder = 100;
  world.add(shadowHeatmapMesh);
  setProgress(`Shadow heatmap ready — ${sunDirs.length} solar samples, ${gridN}x${gridN} grid.`);
}

function removeShadowHeatmap() {
  if (!shadowHeatmapMesh) return;
  world.remove(shadowHeatmapMesh);
  shadowHeatmapMesh.geometry.dispose();
  shadowHeatmapMesh.material.dispose();
  shadowHeatmapMesh = null;
}

function featureRoadWidth(feature) {
  const widthField = mappedField('road_width_field');
  if (widthField && feature?.properties) {
    const raw = feature.properties[widthField];
    const value = parseFloat(raw);
    if (Number.isFinite(value) && value > 0) {
      // Right-of-way width minus ~1.5 m sidewalk on each side, clamped to 5-20 m road surface.
      return Math.max(5, Math.min(20, value - 3));
    }
  }
  return Math.max(5, Math.min(20, settings.roadWidth));
}

function buildingHeightFromProps(props, levels, floorHeight = settings.floorHeight) {
  const explicit = parseNumberProp(props || {}, ['planx_height', 'height', 'yukseklik', 'yükseklik', 'yÃ¼kseklik', 'bina_yuksekligi', 'building_height'], null);
  if (explicit !== null && explicit > 0) return explicit;
  return levels * Math.max(2.4, Math.min(6, Number(floorHeight) || settings.floorHeight));
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
    GermanTile: '#3d4a5c', TurkishTile: '#b94a1a', USShingle: '#2d3340',
    StandingSeam: '#506070', GreenRoof: '#587642', SolarRoof: '#26364c', CeramicLight: '#d1a16d'
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
  } else if (name === 'StandingSeam') {
    ctx.fillStyle = '#506070';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 22) {
      const grad = ctx.createLinearGradient(x, 0, x + 18, 0);
      grad.addColorStop(0, 'rgba(25,34,45,0.42)');
      grad.addColorStop(0.5, 'rgba(120,135,150,0.18)');
      grad.addColorStop(1, 'rgba(20,28,38,0.36)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 18, 256);
      ctx.strokeStyle = 'rgba(210,220,230,0.35)';
      ctx.beginPath(); ctx.moveTo(x + 18, 0); ctx.lineTo(x + 18, 256); ctx.stroke();
    }
  } else if (name === 'GreenRoof') {
    ctx.fillStyle = '#587642';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const g = 80 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.38)},0.35)`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(235,245,220,0.16)';
    for (let x = 0; x < 256; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 256); ctx.stroke();
    }
  } else if (name === 'SolarRoof') {
    ctx.fillStyle = '#26364c';
    ctx.fillRect(0, 0, 256, 256);
    const pw = 42, ph = 26;
    for (let y = 8; y < 256; y += ph + 5) {
      for (let x = 8; x < 256; x += pw + 5) {
        const grad = ctx.createLinearGradient(x, y, x + pw, y + ph);
        grad.addColorStop(0, '#172033');
        grad.addColorStop(0.55, '#2c4f75');
        grad.addColorStop(1, '#111827');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, pw, ph);
        ctx.strokeStyle = 'rgba(180,210,240,0.35)';
        ctx.strokeRect(x, y, pw, ph);
      }
    }
  } else if (name === 'CeramicLight') {
    ctx.fillStyle = '#d1a16d';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 280; y += 22) {
      for (let x = -14; x < 270; x += 28) {
        const shade = 185 + ((x + y) % 38);
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.62)},${Math.floor(shade * 0.34)})`;
        ctx.beginPath();
        ctx.ellipse(x + ((y / 22) % 2) * 14, y + 11, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(105,65,30,0.38)';
        ctx.stroke();
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

function roofGeometryFromTriangles(points, faces) {
  const verts = [];
  const uvs = [];
  const bb = new THREE.Box2();
  points.forEach((p) => bb.expandByPoint(new THREE.Vector2(p.x, p.z)));
  const sx = Math.max(1e-6, bb.max.x - bb.min.x);
  const sz = Math.max(1e-6, bb.max.y - bb.min.y);
  const pushVertex = (p) => {
    verts.push(p.x, p.y, p.z);
    uvs.push((p.x - bb.min.x) / sx, (p.z - bb.min.y) / sz);
  };
  faces.forEach((face) => {
    if (face.length === 3) {
      face.forEach(pushVertex);
    } else if (face.length === 4) {
      pushVertex(face[0]); pushVertex(face[1]); pushVertex(face[2]);
      pushVertex(face[0]); pushVertex(face[2]); pushVertex(face[3]);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function roofMeshFor(shape, footprintPoints, hBase, height, roofShape = settings.roofShape, roofHeight = settings.roofHeight) {
  const ring = footprintPoints.filter((_, i) => i === 0 || footprintPoints[i - 1].distanceTo(footprintPoints[i]) > 1e-6);
  const safeShape = roofShapeValue(roofShape, 'Pyramid');
  const rh = Math.max(0, Number(roofHeight) || 0);
  let roofGeo;

  if (safeShape === 'Flat' || rh <= 0.05 || ring.length < 3) {
    roofGeo = new THREE.ShapeGeometry(shape);
    roofGeo.rotateX(Math.PI / 2);
  } else if (safeShape === 'Pyramid') {
    const center = polygonCentroid(ring);
    center.y = rh;
    const faces = ring.map((a, i) => [a, ring[(i + 1) % ring.length], center]);
    roofGeo = roofGeometryFromTriangles(ring.concat([center]), faces);
  } else {
    const bb = new THREE.Box3().setFromPoints(ring);
    const minX = bb.min.x;
    const maxX = bb.max.x;
    const minZ = bb.min.z;
    const maxZ = bb.max.z;
    const midX = (minX + maxX) * 0.5;
    const midZ = (minZ + maxZ) * 0.5;
    const width = Math.max(0.1, maxX - minX);
    const depth = Math.max(0.1, maxZ - minZ);
    const c1 = new THREE.Vector3(minX, 0, minZ);
    const c2 = new THREE.Vector3(maxX, 0, minZ);
    const c3 = new THREE.Vector3(maxX, 0, maxZ);
    const c4 = new THREE.Vector3(minX, 0, maxZ);
    let points;
    let faces;
    if (safeShape === 'Gable') {
      if (width >= depth) {
        const r1 = new THREE.Vector3(minX, rh, midZ);
        const r2 = new THREE.Vector3(maxX, rh, midZ);
        points = [c1, c2, c3, c4, r1, r2];
        faces = [[c1, c2, r2, r1], [c4, r1, r2, c3], [c1, r1, c4], [c2, c3, r2]];
      } else {
        const r1 = new THREE.Vector3(midX, rh, minZ);
        const r2 = new THREE.Vector3(midX, rh, maxZ);
        points = [c1, c2, c3, c4, r1, r2];
        faces = [[c1, r1, r2, c4], [c2, c3, r2, r1], [c1, c2, r1], [c4, r2, c3]];
      }
    } else if (safeShape === 'Shed') {
      const high = new THREE.Vector3(maxX, rh, maxZ);
      const high2 = new THREE.Vector3(maxX, rh, minZ);
      points = [c1, c2, c3, c4, high, high2];
      faces = [[c1, high2, high, c4], [c1, c2, high2], [c4, high, c3], [c2, c3, high, high2]];
    } else {
      const inset = 0.22;
      const t1 = new THREE.Vector3(minX + width * inset, rh, minZ + depth * inset);
      const t2 = new THREE.Vector3(maxX - width * inset, rh, minZ + depth * inset);
      const t3 = new THREE.Vector3(maxX - width * inset, rh, maxZ - depth * inset);
      const t4 = new THREE.Vector3(minX + width * inset, rh, maxZ - depth * inset);
      points = [c1, c2, c3, c4, t1, t2, t3, t4];
      faces = [[c1, c2, t2, t1], [c2, c3, t3, t2], [c3, c4, t4, t3], [c4, c1, t1, t4], [t1, t2, t3, t4]];
    }
    roofGeo = roofGeometryFromTriangles(points, faces);
  }

  roofGeo.computeBoundingBox();
  const minY = roofGeo.boundingBox ? roofGeo.boundingBox.min.y : 0;
  if (minY !== 0) roofGeo.translate(0, -minY, 0);

  const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({
    color: 0xc8b089,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  }));
  roof.position.y = hBase + height + 0.04;
  roof.castShadow = true;
  roof.renderOrder = 36;
  return roof;
}

// Legacy tree renderer retained only for regression reference.
function buildTreeLayerLegacy(agaclar) {
  clearGroup(treeGroup);
  if (!agaclar?.features?.length) return;
  const feats = agaclar.features.filter(f => f.geometry?.type === 'Point');
  if (!feats.length) return;
  const heightFields = namesWithMapping('tree_height_field', ['planx_tree_height', 'tree_height', 'height', 'boy', 'agac_boyu', 'ağaç_boyu', 'aÄŸaÃ§_boyu', 'yukseklik', 'yükseklik', 'yÃ¼kseklik']);

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

function parseRandRangeExpr(expr) {
  const text = String(expr || '').trim();
  if (!text) return null;
  const match = /^rand\s*\(\s*([-+]?\d+(?:[.,]\d+)?)\s*,\s*([-+]?\d+(?:[.,]\d+)?)\s*\)$/i.exec(text);
  if (!match) return null;
  let min = Number(match[1].replace(',', '.'));
  let max = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max < min) [min, max] = [max, min];
  return { min, max };
}

function deterministicUnitHash(x, z, salt = 0) {
  const raw = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453123;
  return raw - Math.floor(raw);
}

function treeLeafTextureForVariant(variantName) {
  const key = String(variantName || 'default');
  const cached = treeLeafTextureCache.get(key);
  if (cached) return cached;
  const baseColor = assetColor(variantName, 0x3b6e2e);
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(c);
    treeLeafTextureCache.set(key, fallback);
    return fallback;
  }
  const grad = ctx.createRadialGradient(64, 56, 8, 64, 64, 62);
  grad.addColorStop(0, `rgba(${Math.min(255, r + 20)},${Math.min(255, g + 24)},${Math.min(255, b + 18)},0.98)`);
  grad.addColorStop(0.7, `rgba(${Math.max(0, r - 12)},${Math.max(0, g - 14)},${Math.max(0, b - 12)},0.94)`);
  grad.addColorStop(1, `rgba(${Math.max(0, r - 28)},${Math.max(0, g - 30)},${Math.max(0, b - 26)},0.88)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const radius = 1.0 + Math.random() * 2.4;
    const alpha = 0.08 + Math.random() * 0.16;
    ctx.fillStyle = `rgba(${Math.max(0, r - 20 + Math.random() * 26)},${Math.max(0, g - 18 + Math.random() * 24)},${Math.max(0, b - 18 + Math.random() * 24)},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
  treeLeafTextureCache.set(key, tex);
  return tex;
}

function treeLeafMaterial(variantName, profile, realisticMode = false) {
  if (!realisticMode) {
    return new THREE.MeshStandardMaterial({
      color: assetColor(variantName, 0x3b6e2e),
      roughness: profile.shape === 'columnar' || profile.shape === 'cypress' ? 0.86 : 0.9
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: treeLeafTextureForVariant(variantName),
    roughness: 0.88,
    metalness: 0.02
  });
}

function treeCrownGeometry(shape, realisticMode = false) {
  switch (shape) {
    case 'linden': return new THREE.SphereGeometry(1, realisticMode ? 16 : 8, realisticMode ? 12 : 6);
    case 'plane': return realisticMode ? new THREE.SphereGeometry(1, 14, 10) : new THREE.DodecahedronGeometry(1, 1);
    case 'compact': return realisticMode ? new THREE.IcosahedronGeometry(1, 2) : new THREE.IcosahedronGeometry(1, 1);
    case 'columnar': return new THREE.CylinderGeometry(0.62, 0.78, 2.1, realisticMode ? 14 : 10);
    case 'olive': return new THREE.SphereGeometry(1, realisticMode ? 14 : 7, realisticMode ? 10 : 5);
    case 'cypress': return new THREE.ConeGeometry(1, 2.8, realisticMode ? 14 : 10);
    case 'palm': return new THREE.ConeGeometry(1, 1.2, realisticMode ? 10 : 6);
    case 'jacaranda': return realisticMode ? new THREE.SphereGeometry(1, 14, 10) : new THREE.DodecahedronGeometry(1, 0);
    case 'pine': return new THREE.ConeGeometry(1, 2.5, realisticMode ? 14 : 9);
    case 'broadleaf': return new THREE.SphereGeometry(1, realisticMode ? 16 : 10, realisticMode ? 12 : 7);
    default: return new THREE.SphereGeometry(1, realisticMode ? 16 : 8, realisticMode ? 12 : 6);
  }
}

function crownGeometryMinY(geometry, fallback = -1) {
  if (!geometry) return fallback;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return Number.isFinite(geometry.boundingBox?.min?.y) ? geometry.boundingBox.min.y : fallback;
}

function activeTreeVariantsForBuild() {
  const fromTheme = assetPoolVariants('trees');
  const unique = [];
  const addUnique = (name) => {
    const clean = String(name || '').trim();
    if (clean && !unique.includes(clean)) unique.push(clean);
  };
  fromTheme.forEach(addUnique);
  TREE_VARIANT_CATALOG.forEach(addUnique);
  let count = Math.round(Number(settings.treeVariantCount) || 8);
  if (!Number.isFinite(count)) count = 8;
  count = Math.max(1, Math.min(TREE_VARIANT_CATALOG.length, count));
  return unique.slice(0, Math.max(1, Math.min(count, unique.length)));
}

function isFiniteCoord(coord) {
  return Array.isArray(coord) && coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
}

function centroidFromCoords(coords) {
  const pts = (coords || []).filter(isFiniteCoord);
  if (!pts.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return [(minX + maxX) * 0.5, (minY + maxY) * 0.5];
}

function representativeTreeCoords(geometry) {
  if (!geometry || !geometry.type) return [];
  const c = geometry.coordinates;
  if (geometry.type === 'Point') return isFiniteCoord(c) ? [c] : [];
  if (geometry.type === 'MultiPoint') return Array.isArray(c) ? c.filter(isFiniteCoord) : [];
  if (geometry.type === 'LineString') {
    if (!Array.isArray(c) || !c.length) return [];
    const mid = c[Math.floor(c.length / 2)];
    return isFiniteCoord(mid) ? [mid] : [];
  }
  if (geometry.type === 'MultiLineString') {
    if (!Array.isArray(c) || !c.length) return [];
    for (const line of c) {
      if (!Array.isArray(line) || !line.length) continue;
      const mid = line[Math.floor(line.length / 2)];
      if (isFiniteCoord(mid)) return [mid];
    }
    return [];
  }
  if (geometry.type === 'Polygon') {
    const ring = Array.isArray(c) && c.length ? c[0] : null;
    const centroid = centroidFromCoords(ring);
    return centroid ? [centroid] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(c) || !c.length) return [];
    for (const poly of c) {
      const ring = Array.isArray(poly) && poly.length ? poly[0] : null;
      const centroid = centroidFromCoords(ring);
      if (centroid) return [centroid];
    }
    return [];
  }
  if (geometry.type === 'GeometryCollection') {
    const geoms = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    for (const g of geoms) {
      const coords = representativeTreeCoords(g);
      if (coords.length) return coords;
    }
  }
  return [];
}

// InstancedMesh trees — dynamic variant buckets (up to 10 presets) with optional randomize + rand(min,max) heights.
function buildTreeLayer(agaclar) {
  clearGroup(treeGroup);
  if (!agaclar?.features?.length) return;
  const treeSamples = [];
  for (const feat of agaclar.features || []) {
    const coords = representativeTreeCoords(feat?.geometry);
    if (!coords.length) continue;
    for (const coord of coords) treeSamples.push({ feature: feat, coord });
  }
  if (!treeSamples.length) {
    setStatus('Trees layer has no usable coordinates (Point/MultiPoint/Polygon centroid).', true);
    return;
  }
  const mappedHeightField = mappedField('tree_height_field');
  const fallbackHeightFields = ['planx_tree_height', 'tree_height', 'height', 'boy', 'agac_boyu', 'ağaç_boyu', 'aÄŸaÃ§_boyu', 'yukseklik', 'yükseklik', 'yÃ¼kseklik'];
  const heightFields = mappedHeightField ? [mappedHeightField, ...fallbackHeightFields] : fallbackHeightFields;
  const randomHeightExpr = parseRandRangeExpr(settings.treeHeightRandomExpr);
  const randomizeTrees = !!settings.treeRandomize;
  const realisticTrees = String(settings.treeRenderMode || 'Stylized') === 'Realistic';
  const mustUseDefaultHeightRandom = !mappedHeightField && !randomHeightExpr;
  const treeVariants = activeTreeVariantsForBuild();
  if (!treeVariants.length) return;

  const variantsForBuild = randomizeTrees ? treeVariants : treeVariants.slice(0, 1);
  const buckets = variantsForBuild.map(() => []);
  treeSamples.forEach((entry, i) => {
    const coord = entry.coord;
    const feature = entry.feature;
    if (!isFiniteCoord(coord)) return;
    const [x, z] = metersToLocal(coord[0], coord[1]);
    const y = terrainLocalYAt(x, z) + LAYER.content;
    const baseRandom = 1 + deterministicUnitHash(x, z, i + 101) * 6;
    const sourceHeight = parseNumberProp(feature?.properties || {}, heightFields, NaN);
    let treeH = Number.isFinite(sourceHeight) && sourceHeight > 0.5 ? sourceHeight : baseRandom;
    if (randomHeightExpr) {
      const ratio = deterministicUnitHash(x, z, i + 11);
      treeH = randomHeightExpr.min + ratio * (randomHeightExpr.max - randomHeightExpr.min);
    } else if (mustUseDefaultHeightRandom) {
      treeH = baseRandom;
    }
    treeH = Math.max(0.8, treeH);
    const variantIndex = randomizeTrees
      ? Math.floor(deterministicUnitHash(x, z, i + 5) * variantsForBuild.length) % variantsForBuild.length
      : i % variantsForBuild.length;
    buckets[variantIndex].push({ x, y, z, h: treeH });
  });

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 });
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1, 6);
  const dummy = new THREE.Object3D();

  buckets.forEach((trees, vi) => {
    if (!trees.length) return;
    const variantName = variantsForBuild[vi] || TREE_VARIANT_CATALOG[0];
    const profile = TREE_VARIANT_PROFILES[variantName] || TREE_PROFILE_DEFAULT;
    const crownGeo = treeCrownGeometry(profile.shape, realisticTrees);
    const crownMinY = crownGeometryMinY(crownGeo, -1);
    const leafMat = treeLeafMaterial(variantName, profile, realisticTrees);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    trunkInst.frustumCulled = false;
    trunkInst.castShadow = true;
    const crownInst = new THREE.InstancedMesh(crownGeo, leafMat, trees.length);
    crownInst.frustumCulled = false;
    crownInst.castShadow = true;
    crownInst.userData.planxTreeVariant = variantName;
    let canopyUpperInst = null;
    if (realisticTrees && profile.shape !== 'palm') {
      const upperGeo = treeCrownGeometry(profile.shape, true);
      const upperMat = treeLeafMaterial(variantName, profile, true);
      canopyUpperInst = new THREE.InstancedMesh(upperGeo, upperMat, trees.length);
      canopyUpperInst.frustumCulled = false;
      canopyUpperInst.castShadow = true;
      canopyUpperInst.userData.planxTreeVariant = `${variantName}-upper`;
    }

    trees.forEach(({ x, y, z, h }, idx) => {
      const trunkH = Math.max(1.1, h * profile.trunkRatio);
      const crownH = Math.max(1.4, h - trunkH);
      const rot = ((x * 13.7 + z * 7.3) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

      dummy.position.set(x, y + trunkH * 0.5, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, trunkH, 1);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      const crownRadius = crownH * profile.crownWidth;
      const crownVertical = crownH * profile.crownHeight;
      const crownEmbed = Number.isFinite(profile.crownEmbed) ? profile.crownEmbed : 0.08;
      const coneLike = profile.shape === 'cypress' || profile.shape === 'pine' || profile.shape === 'palm';
      const crownY = coneLike
        ? (y + trunkH - crownH * crownEmbed - crownMinY * crownVertical)
        : (y + trunkH + crownVertical * 0.5 - crownH * crownEmbed);
      dummy.position.set(x, crownY, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(crownRadius, crownVertical, crownRadius);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);
      if (canopyUpperInst) {
        const upperRadius = crownRadius * 0.76;
        const upperVertical = crownVertical * 0.62;
        const upperY = crownY + upperVertical * 0.56;
        dummy.position.set(x, upperY, z);
        dummy.rotation.set(0, rot + 0.45, 0);
        dummy.scale.set(upperRadius, upperVertical, upperRadius);
        dummy.updateMatrix();
        canopyUpperInst.setMatrixAt(idx, dummy.matrix);
      }
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownInst.computeBoundingSphere();
    if (canopyUpperInst) {
      canopyUpperInst.instanceMatrix.needsUpdate = true;
      canopyUpperInst.computeBoundingSphere();
      treeGroup.add(trunkInst, crownInst, canopyUpperInst);
    } else {
      treeGroup.add(trunkInst, crownInst);
    }
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
    'heading', 'bearing', 'azimuth', 'direction', 'yon', 'yön', 'yÃ¶n'
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
    const isNight = (_solarCache.elevationDeg ?? 30) < -3;
    const lampMat = new THREE.MeshStandardMaterial({
      color: isNight ? 0xffffee : 0xdddddd, 
      emissive: isNight ? 0xffcc88 : 0x000000,
      emissiveIntensity: isNight ? 2.0 : 0
    });
    if (activeLightStyle === 'Classic Post') {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), lampMat);
      lamp.position.set(0, 4.2, 0);
      g.add(pole, lamp);
    } else if (activeLightStyle === 'Heritage Lantern') {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 6), metalMat);
      cap.position.y = 4.35;
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), lampMat);
      lantern.position.y = 4.08;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 16), metalMat);
      ring.position.y = 4.34;
      g.add(pole, cap, lantern, ring);
    } else if (activeLightStyle === 'Slim Post') {
      pole.scale.set(0.62, 0.88, 0.62);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.55), lampMat);
      head.position.set(0.18, 3.55, 0);
      g.add(pole, head);
    } else if (activeLightStyle === 'Bollard Path') {
      pole.scale.set(1.05, 0.32, 1.05);
      pole.position.y = 0.65;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12), lampMat);
      cap.position.y = 1.32;
      g.add(pole, cap);
    } else if (activeLightStyle === 'Campus Twin') {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), metalMat);
      cross.position.y = 3.7;
      const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 8), lampMat);
      l1.position.set(0.42, 3.65, 0);
      const l2 = l1.clone();
      l2.position.set(-0.42, 3.65, 0);
      g.add(pole, cross, l1, l2);
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
    } else if (activeBenchStyle === 'Stone Seat') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.58), new THREE.MeshStandardMaterial({ color: 0xb9b0a2, roughness: 0.96 }));
      b.position.y = 0.24;
      const groove = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0x8e8578, roughness: 0.98 }));
      groove.position.set(0, 0.47, -0.18);
      g.add(b, groove);
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
    } else if (activeBenchStyle === 'Slim Urban') {
      const mMat = new THREE.MeshStandardMaterial({ color: 0x3f464d, metalness: 0.55, roughness: 0.34 });
      for (let i = 0; i < 4; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.055, 0.08), mMat);
        slat.position.set(0, 0.42 + i * 0.1, -0.18 + i * 0.08);
        g.add(slat);
      }
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.36), mMat);
      leg1.position.set(0.62, 0.21, 0.02);
      const leg2 = leg1.clone();
      leg2.position.x = -0.62;
      g.add(leg1, leg2);
    } else if (activeBenchStyle === 'Eco Timber') {
      const ecoMat = new THREE.MeshStandardMaterial({ color: 0x8a6138, roughness: 0.94 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 0.55), ecoMat);
      seat.position.y = 0.42;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.58, 0.10), ecoMat);
      back.position.set(0, 0.76, -0.26);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 0.18), ecoMat);
      leg.position.set(0, 0.16, 0.06);
      g.add(seat, back, leg);
    } else if (activeBenchStyle === 'Classic Iron') {
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.72, roughness: 0.28 });
      for (let i = 0; i < 3; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.12), woodMat);
        slat.position.set(0, 0.42 + i * 0.18, -0.16 + i * 0.1);
        g.add(slat);
      }
      const side1 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 18, Math.PI), ironMat);
      side1.rotation.z = Math.PI / 2;
      side1.position.set(0.78, 0.3, 0.02);
      const side2 = side1.clone();
      side2.position.x = -0.78;
      g.add(side1, side2);
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
    } else if (activeBinStyle === 'Compact') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.42), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 }));
      body.position.y = 0.31;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.52), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 }));
      lid.position.y = 0.66;
      g.add(body, lid);
      return g;
    } else if (activeBinStyle === 'Solar Compactor') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.92, 0.48), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 }));
      body.position.y = 0.46;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.36), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.22 }));
      panel.position.set(0, 0.96, -0.02);
      panel.rotation.x = -0.22;
      g.add(body, panel);
      return g;
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
    if (activeStopStyle === 'Compact Marker') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2), metalMat);
      pole.position.y = 1.1;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.52, 0.06), new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.58 }));
      sign.position.y = 2.0;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10), metalMat);
      base.position.y = 0.04;
      g.add(pole, sign, base);
    } else if (activeStopStyle === 'Minimal Canopy') {
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
    } else if (activeStopStyle === 'Steel Canopy') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.55), metalMat);
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5), metalMat);
      pole1.position.set(-1.65, 1.25, -0.52);
      const pole2 = pole1.clone();
      pole2.position.x = 1.65;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.12, 1.95), new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.45, roughness: 0.38 }));
      roof.position.y = 2.55;
      roof.rotation.x = -0.08;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.42), woodMat);
      bench.position.set(0, 0.48, 0.18);
      g.add(base, pole1, pole2, roof, bench);
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
      // Furniture meshes are modelled pivot-at-base; place directly on terrain
      // with a tiny anti-z-fighting offset. Earlier (LAYER.content + LAYER.road)
      // sum lifted them ~1 m into the air.
      const y = terrainLocalYAt(x, z) + (settings.furnitureGroundOffset ?? 0.02);
      const m = modelTemplate.clone();
      m.position.set(x, y, z);
      m.rotation.y = furnitureRotationY(f, x, z, angleFieldKeyByKind[kind]);
      furnitureGroup.add(m);
    });
  };

  const isNight = (_solarCache.elevationDeg ?? 30) < -3;
  if (settings.showLights) {
    placeItem(lights, lightGeo, 'lights');
    if (isNight && lights && lights.features) {
      lights.features.forEach((f) => {
        if (!f.geometry || f.geometry.type !== 'Point') return;
        const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const y = terrainLocalYAt(x, z) + (settings.furnitureGroundOffset ?? 0.02) + 4.2;
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

async function buildBuildingLayer(yapilar, buildToken = sceneBuildToken) {
  clearGroup(buildingGroup);
  buildingFunctionMaterials.clear();
  if (!yapilar?.features?.length) return;

  const functions = [...new Set(yapilar.features.map((f) => String(buildingFunctionValue(f.properties || {}))))];

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    ensureFunctionBuildingStyle(fn, i);
  }

  const roofTex = createRoofPresetTexture(settings.roofTexture);
  const roofTextureCache = { [settings.roofTexture]: roofTex };
  const facadeCache = {};
  for (const fn of functions) {
    const style = ensureFunctionBuildingStyle(fn, functions.indexOf(fn));
    const key = normalizeFacadeKey(style.facade);
    if (isTurkishFacadeFamily(key)) continue;
    if (!facadeCache[key]) {
      const scale = Math.max(1, Math.min(8, Number(style.facadeScale) || FACADE_TEXTURE_SCALE_MULTIPLIER));
      facadeCache[key] = await textureFromSet('facade', key, 0.55 / scale, 0.55 / scale);
      if (isSceneBuildStale(buildToken)) return;
    }
  }
  // Per-building texture scale cache keyed by (facade_type + floor_count)
  const facadeScaleCache = {};

  for (const f of yapilar.features) {
    const props = f.properties || {};
    const fn = String(buildingFunctionValue(props));
    const fnIndex = Math.max(0, functions.indexOf(fn));
    const fnStyle = ensureFunctionBuildingStyle(fn, fnIndex);
    const levels = parseLevel(f.properties?.katadedi);
    const featureFloorHeight = parseNumberProp(props, ['planx_floor_height', 'floor_height', 'kat_yuksekligi', 'kat_yüksekliği'], fnStyle.floorHeight);
    const height = buildingHeightFromProps(props, levels, featureFloorHeight);
    const featureColor = normalizeHexColor(propFirst(props, ['planx_color', 'planx_renk', 'color', 'renk']), fnStyle.color);
    const selectedFacadeRaw = presetValue(propFirst(props, ['planx_facade', 'planx_texture', 'facade', 'cephe', 'doku']), textureSets.facade, fnStyle.facade);
    const selectedFacade = normalizeFacadeKey(selectedFacadeRaw);
    const featureFacade = resolveFacadeForLevels(selectedFacade, levels);
    const featureFacadeScale = Math.max(1, Math.min(8, parseNumberProp(props, ['planx_facade_scale', 'facade_scale', 'cephe_olcegi'], fnStyle.facadeScale)));
    const featureRoofTexture = presetValue(propFirst(props, ['planx_roof_texture', 'roof_texture', 'cati_doku', 'cati_texture']), textureSets.roof, fnStyle.roofTexture);
    const featureRoofShape = roofShapeValue(propFirst(props, ['planx_roof_shape', 'roof_shape', 'cati_tipi']), fnStyle.roofShape);
    const featureRoofHeight = parseNumberProp(props, ['planx_roof_height', 'roof_height', 'cati_yuksekligi', 'çatı_yüksekliği'], fnStyle.roofHeight);
    const featureRoofColor = normalizeHexColor(propFirst(props, ['planx_roof_color', 'roof_color', 'cati_renk']), '#ffffff');

    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = shapeFromLocalPolygon(poly);
      if (!shape) continue;
      const footprint = [];
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < outer.length; i++) {
        const [x, z] = metersToLocal(outer[i][0], outer[i][1]);
        sx += outer[i][0];
        sy += outer[i][1];
        footprint.push(new THREE.Vector3(x, 0, z));
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
        if (isSceneBuildStale(buildToken)) return;
        buildingGroup.add(fp);
        continue;
      }

      const extrude = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
      extrude.rotateX(Math.PI / 2);
      extrude.computeBoundingBox();
      const minY = extrude.boundingBox ? extrude.boundingBox.min.y : 0;
      if (minY !== 0) extrude.translate(0, -minY, 0);

      // Clone texture per (facade_type, floor_count) so the texture's floor
      // grid lines up with the actual number of building levels. The vertical
      // repeat equals levels / texture_floor_rows so a 4-storey building shows
      // 4 floor rows on the procedural facade instead of squashing the whole
      // pattern into ~1.3 rows.
      if (!facadeCache[featureFacade]) {
        facadeCache[featureFacade] = await textureFromSet('facade', featureFacade, 0.5 / featureFacadeScale, 0.5 / featureFacadeScale);
        if (isSceneBuildStale(buildToken)) return;
      }
      const texKey = `${featureFacade}_${levels}_${height.toFixed(2)}_${featureFacadeScale.toFixed(2)}`;
      if (!facadeScaleCache[texKey]) {
        const base = facadeCache[featureFacade];
        if (base) {
          const recipe = (typeof FACADE_RECIPES !== 'undefined') ? FACADE_RECIPES[featureFacade] : null;
          const textureFloorRows = facadeTextureFloorRows(featureFacade, recipe?.floorRows || 10);
          const repeatV = Math.max(0.025, Math.min(3.0, levels / textureFloorRows / featureFacadeScale));
          const t = base.clone();
          t.repeat.set(0.5 / featureFacadeScale, repeatV);
          t.needsUpdate = true;
          facadeScaleCache[texKey] = t;
        }
      }
      const facadeTex = facadeScaleCache[texKey] || facadeCache[featureFacade];
      if (!roofTextureCache[featureRoofTexture]) {
        roofTextureCache[featureRoofTexture] = createRoofPresetTexture(featureRoofTexture);
      }
      const featureRoofTex = roofTextureCache[featureRoofTexture];
      const isNight = (_solarCache.elevationDeg ?? 30) < -3;
      const matRoof = new THREE.MeshStandardMaterial({ map: featureRoofTex, color: new THREE.Color(featureRoofColor), roughness: 0.85 });
      const matHiddenCap = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const matWall = new THREE.MeshStandardMaterial({ 
        map: facadeTex, 
        color: new THREE.Color(featureColor), 
        roughness: 0.72,
        emissive: isNight ? new THREE.Color(0x333322) : new THREE.Color(0x000000),
        emissiveIntensity: isNight ? (Math.random() * 0.8 + 0.2) : 0
      });

      const useSeparateRoofMesh = settings.buildingMode === 'Extruded + roof';
      const b = new THREE.Mesh(extrude, useSeparateRoofMesh ? [matHiddenCap, matWall] : [matRoof, matWall]);
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
      if (isSceneBuildStale(buildToken)) return;
      buildingGroup.add(b);

      if (useSeparateRoofMesh) {
        const roof = roofMeshFor(shape, footprint, baseY, height, featureRoofShape, featureRoofHeight);
        roof.material.map = featureRoofTex;
        roof.material.color = new THREE.Color(featureRoofColor);
        roof.material.needsUpdate = true;
        roof.userData = b.userData;
        if (isSceneBuildStale(buildToken)) return;
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

async function buildRoadsAndTraffic(yollar, buildToken = sceneBuildToken) {
  clearGroup(roadGroup);
  clearGroup(carGroup);
  clearGroup(pedestrianGroup);
  roadCurves = [];
  vehicleRoadCurves = [];
  cars = [];
  pedestrians = [];
  if (!yollar?.features?.length) return;

  let roadTex = null;
  if (settings.roadStyle === 'Asphalt') {
    roadTex = createAsphaltTexture();
  } else if (settings.roadStyle === 'Cobblestone') {
    roadTex = await textureFromSet('road', 'Cobblestone', 2, 20);
  } else if (settings.roadStyle === 'SharedStreet') {
    roadTex = await textureFromSet('road', 'SharedStreet', 2, 16);
  }
  if (isSceneBuildStale(buildToken)) return;

  const roadMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.roadColor),
    map: roadTex,
    roughness: 0.97,
    transparent: !settings.showRoads,
    opacity: settings.showRoads ? 1.0 : 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
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
    const featureWidth = featureRoadWidth(f);

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
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(featureWidth * 0.5);
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
    if (isSceneBuildStale(buildToken)) return;
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

    const isNight = (_solarCache.elevationDeg ?? 30) < -3;
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

}

function buildPedestrianLayer() {
  clearGroup(pedestrianGroup);
  pedestrians = [];
  if (!settings.showPedestrians) return;
  const candidateRoutes = roadCurves.map((curve) => ({ curve, surface: 'sidewalk' }))
    .concat(settings.showPedestrianPaths ? pedestrianPathCurves.map((curve) => ({ curve, surface: 'path' })) : []);
  if (!candidateRoutes.length) return;
  const pedCount = Math.min(600, candidateRoutes.length * Math.floor(20 * settings.pedestrianDensity));
  for (let i = 0; i < pedCount; i++) {
    const route = candidateRoutes[Math.floor(Math.random() * candidateRoutes.length)];
    const { mesh: pedGeo, limbRefs } = createPedestrianModel(i);
    pedestrianGroup.add(pedGeo);
    pedGeo.renderOrder = 41;
    pedestrians.push({
      mesh: pedGeo,
      limbRefs,
      curve: route.curve,
      surface: route.surface,
      t: Math.random(),
      speed: 0.0001 + Math.random() * 0.0001,
      phase: Math.random() * Math.PI * 2,
      walkAmplitude: 0.45 + Math.random() * 0.15,
      offsetDir: (Math.random() > 0.5 ? 1 : -1),
      lateralOffset: route.surface === 'path' ? (Math.random() - 0.5) * 0.45 : null
    });
  }
}

function buildSidewalkPolygonLayer(sidewalks, buildToken = sceneBuildToken) {
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
        pos.setY(vi, baseDem + LAYER.sidewalk + (isTop ? 0.05 : -0.08));
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      if (isSceneBuildStale(buildToken)) return;
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      mesh.renderOrder = 33;
      sidewalkGroup.add(mesh);
    }
  }
}

function buildSidewalkLayer(yollar, sidewalks = EMPTY_GEOJSON, buildToken = sceneBuildToken) {
  clearGroup(sidewalkGroup);
  if (!settings.showSidewalks) return;
  if (sidewalks?.features?.length) {
    buildSidewalkPolygonLayer(sidewalks, buildToken);
    return;
  }
  if (!yollar?.features?.length) return;

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
    const featureWidth = featureRoadWidth(f);
    const xzCurveW = new THREE.CatmullRomCurve3(xzPtsW, false, 'centripetal');
    const wLen = xzCurveW.getLength();
    const nW = Math.max(xzPtsW.length, Math.ceil(wLen / 6) + 1);
    const wPts = [];
    for (let i = 0; i <= nW; i++) {
      const tp = xzCurveW.getPointAt(i / nW);
      tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.sidewalk;
      wPts.push(tp);
    }
    const curve = new THREE.CatmullRomCurve3(wPts, false, 'centripetal');
    const segments = Math.max(24, wPts.length * 3);
    const centers = curve.getPoints(segments);

    for (const side of [-1, 1]) {
      const innerOff = featureWidth * 0.5 * side;
      const outerOff = (featureWidth * 0.5 + swWidth) * side;
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

function pedestrianPathWidth(feature) {
  const width = parseNumberProp(
    feature?.properties || {},
    ['width', 'genislik', 'genişlik', 'path_width', 'walkway_width', 'yaya_yolu_genisligi'],
    2.2
  );
  return Math.max(0.8, Math.min(6.0, width || 2.2));
}

function lineSetsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates || [];
  return [];
}

function buildPedestrianPathStrip(coords, width, mat, buildToken) {
  const xzPts = [];
  for (const c of coords || []) {
    if (!c || c.length < 2) continue;
    const [x, z] = metersToLocal(c[0], c[1]);
    xzPts.push(new THREE.Vector3(x, 0, z));
  }
  if (xzPts.length < 2) return;
  const xzCurve = new THREE.CatmullRomCurve3(xzPts, false, 'centripetal');
  const pathLen = xzCurve.getLength();
  const nSamples = Math.max(xzPts.length, Math.ceil(pathLen / 3) + 1);
  const terrainPts = [];
  for (let i = 0; i <= nSamples; i++) {
    const tp = xzCurve.getPointAt(i / nSamples);
    tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.path + 0.04;
    terrainPts.push(tp);
  }
  const curve = new THREE.CatmullRomCurve3(terrainPts, false, 'centripetal');
  pedestrianPathCurves.push(curve);
  const centers = curve.getPoints(Math.max(16, terrainPts.length * 3));
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < centers.length; i++) {
    const p = centers[i];
    const tng = curve.getTangent(i / Math.max(1, centers.length - 1));
    const n = new THREE.Vector3(-tng.z, 0, tng.x).normalize().multiplyScalar(width * 0.5);
    positions.push(p.x + n.x, p.y, p.z + n.z, p.x - n.x, p.y, p.z - n.z);
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
  if (isSceneBuildStale(buildToken)) return;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 31;
  pedestrianPathGroup.add(mesh);
}

function buildPedestrianPathLayer(paths = EMPTY_GEOJSON, buildToken = sceneBuildToken) {
  clearGroup(pedestrianPathGroup);
  pedestrianPathCurves = [];
  if (!settings.showPedestrianPaths || !paths?.features?.length) return;
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0xb7ad93,
    roughness: 0.98,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });

  for (const f of paths.features) {
    if (!f.geometry) continue;
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      for (const poly of getPolygonRings(f.geometry)) {
        const shape = shapeFromLocalPolygon(poly);
        if (!shape) continue;
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        const pos = geo.attributes.position;
        for (let vi = 0; vi < pos.count; vi++) {
          const vx = pos.getX(vi);
          const vz = pos.getZ(vi);
          const isTop = pos.getY(vi) > -0.04;
          pos.setY(vi, terrainLocalYAt(vx, vz) + LAYER.path + (isTop ? 0.06 : -0.02));
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        if (isSceneBuildStale(buildToken)) return;
        const mesh = new THREE.Mesh(geo, pathMat);
        mesh.receiveShadow = true;
        mesh.renderOrder = 31;
        pedestrianPathGroup.add(mesh);
      }
      continue;
    }

    const width = pedestrianPathWidth(f);
    for (const line of lineSetsFromGeometry(f.geometry)) {
      buildPedestrianPathStrip(line, width, pathMat, buildToken);
    }
  }
}

function buildCrosswalkLayer(yollar) {
  clearGroup(crosswalkGroup);
  if (!settings.showCrosswalks) return;
  if (!yollar?.features?.length) return;

  const cwMat = new THREE.MeshStandardMaterial({ color: 0xf0ede5, roughness: 0.85 });
  const stripeW = 0.38;
  const stripeGap = 0.30;
  const stripeCount = 5;
  const totalLen = stripeCount * stripeW + (stripeCount - 1) * stripeGap;

  for (const f of yollar.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    const cwLen = featureRoadWidth(f) + 2.6;

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
  if (!roi?.features?.length) return;
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

function hideLoadingOverlay(delay = 450) {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.style.opacity = 0;
  setTimeout(() => { loading.style.display = 'none'; }, delay);
}

async function runLayerBuild(label, buildFn, clearFn = null) {
  try {
    await buildFn();
    return true;
  } catch (err) {
    console.warn(`${label} layer skipped`, err);
    if (clearFn) clearFn();
    setStatus(`${label} layer skipped: ${err?.message || err}`, true);
    return false;
  }
}

async function rebuildScene() {
  const buildToken = ++sceneBuildToken;
  const loadingText = document.getElementById('loading-text');
  loadingText.innerText = t('loadingData');
  setSceneState('sceneLoading');

  if (!layerDataCache) {
    loadingText.innerText = t('sceneGeojson') + '...';
    projectManifest = await loadManifest();
    applyManifestDefaults();
    const adalar = await loadGeoJson('../data/yerlesim/myblocks.geojson', { required: manifestRequiresInput('blocks'), label: 'Blocks' });
    const yapilar = await loadGeoJson('../data/yerlesim/mybuildings.geojson', { required: manifestRequiresInput('buildings'), label: 'Buildings' });
    const yollar = await loadGeoJson('../data/yerlesim/myroads.geojson', { required: manifestRequiresInput('roads'), label: 'Roads' });
    const agaclar = await loadGeoJson('../data/yerlesim/mytrees.geojson', { label: 'Trees' });
    const lights = await loadGeoJson('../data/yerlesim/mylights.geojson', { label: 'Lights' });
    const benches = await loadGeoJson('../data/yerlesim/mybenches.geojson', { label: 'Benches' });
    const bins = await loadGeoJson('../data/yerlesim/mytrashbins.geojson', { label: 'Trash bins' });
    const busstops = await loadGeoJson('../data/yerlesim/mybusstops.geojson', { label: 'Bus stops' });
    
    const roi = await loadGeoJson('../data/yerlesim/roi.geojson', { required: manifestRequiresInput('roi'), label: 'ROI' });
    layerDataCache = {
       adalar: asFeatureCollection(adalar, 'Blocks'),
       yapilar: asFeatureCollection(yapilar, 'Buildings'),
       yollar: asFeatureCollection(yollar, 'Roads'),
       agaclar: asFeatureCollection(agaclar, 'Trees'),
       parseller: null,
       hardscape: null,
       sidewalks: null,
       pedestrianPaths: null,
       furniture: {
         lights: asFeatureCollection(lights, 'Lights'),
         benches: asFeatureCollection(benches, 'Benches'),
         bins: asFeatureCollection(bins, 'Trash bins'),
         busstops: asFeatureCollection(busstops, 'Bus stops')
       },
       roi: asFeatureCollection(roi, 'ROI')
    };
  }
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showParcels && !layerDataCache.parseller) {
    const parseller = await loadGeoJson('../data/yerlesim/myparcels.geojson', { required: manifestRequiresInput('parcels'), label: 'Parcels' });
    layerDataCache.parseller = asFeatureCollection(parseller, 'Parcels');
  }
  if (settings.showHardscape && !layerDataCache.hardscape) {
    const hardscape = await loadGeoJson('../data/yerlesim/myhardscape.geojson', { label: 'Hardscape' });
    layerDataCache.hardscape = asFeatureCollection(hardscape, 'Hardscape');
  }
  if (settings.showWindPlumes && !layerDataCache.hardscape) {
    const hardscape = await loadGeoJson('../data/yerlesim/myhardscape.geojson', { label: 'Hardscape' });
    layerDataCache.hardscape = asFeatureCollection(hardscape, 'Hardscape');
  }
  if (settings.showSidewalks && !layerDataCache.sidewalks) {
    const sidewalks = await loadGeoJson('../data/yerlesim/mysidewalks.geojson', { label: 'Sidewalks' });
    layerDataCache.sidewalks = asFeatureCollection(sidewalks, 'Sidewalks');
  }
  if (settings.showPedestrianPaths && !layerDataCache.pedestrianPaths) {
    const pedestrianPaths = await loadGeoJson('../data/yerlesim/mypedestrian_paths.geojson', { label: 'Pedestrian paths' });
    layerDataCache.pedestrianPaths = asFeatureCollection(pedestrianPaths, 'Pedestrian paths');
  }
  
  const adalar = asFeatureCollection(layerDataCache.adalar, 'Blocks');
  const yapilar = asFeatureCollection(layerDataCache.yapilar, 'Buildings');
  const yollar = asFeatureCollection(layerDataCache.yollar, 'Roads');
  const agaclar = asFeatureCollection(layerDataCache.agaclar, 'Trees');
  const parseller = layerDataCache.parseller ? asFeatureCollection(layerDataCache.parseller, 'Parcels') : null;
  const hardscape = layerDataCache.hardscape ? asFeatureCollection(layerDataCache.hardscape, 'Hardscape') : null;
  const sidewalks = layerDataCache.sidewalks ? asFeatureCollection(layerDataCache.sidewalks, 'Sidewalks') : null;
  const pedestrianPaths = layerDataCache.pedestrianPaths ? asFeatureCollection(layerDataCache.pedestrianPaths, 'Pedestrian paths') : null;
  Object.assign(layerDataCache, { adalar, yapilar, yollar, agaclar, parseller, hardscape, sidewalks, pedestrianPaths });
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

  const vectorBounds = deriveVectorBounds(layerDataCache);
  bounds = vectorBounds || (demReady ? demSamplerBounds() : null);
  if (isSceneBuildStale(buildToken)) return;

  if (!demReady && !demLoadingStarted) {
    demLoadingStarted = true;
    loadingText.innerText = t('sceneDem') + '...';
    setSceneState('sceneDem');
    loadProjectDem()
      .then(() => rebuildSceneSafe())
      .catch((err) => {
        if (isSceneBuildStale(buildToken)) return;
        const demMissing = String(err?.message || err).includes('DEM not found');
        if (demMissing) console.info('DEM not found; using flat terrain fallback.');
        else console.warn('DEM could not be loaded; using flat terrain fallback:', err);
        activateFlatTerrainFallback(vectorBounds || bounds);
        rebuildSceneSafe();
      });
    return;
  }
  if (!demReady) return;
  if (!bounds) {
    setStatus('No vector bounds or DEM extent found; using fallback terrain bounds.');
    bounds = { minX: -500, maxX: 500, minY: -500, maxY: 500 };
  }
  if (isSceneBuildStale(buildToken)) return;
  centerX = (bounds.minX + bounds.maxX) / 2;
  centerY = (bounds.minY + bounds.maxY) / 2;
  if (terrainMesh) {
    world.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    terrainMesh.material.dispose();
    terrainMesh = null;
  }
  if (terrainOverlayMesh) {
    world.remove(terrainOverlayMesh);
    terrainOverlayMesh.geometry.dispose();
    terrainOverlayMesh.material.dispose();
    terrainOverlayMesh = null;
  }
  terrainSurfaceCache = null;
  clearGroup(terrainSideGroup);
  if (isRasterTextureMode() && settings.showTerrainTexture && !terrainTexture) {
    try {
      loadingText.innerText = t('scenePlanTexture') + '...';
      setSceneState('scenePlanTexture');
      terrainTexture = await loadTerrainTextureFromGeoTiff();
    } catch (err) {
      console.warn('Plan texture yuklenemedi, pavement ile devam ediliyor.', err);
      setStatus(t('planTextureFail'));
    }
  }
  if (settings.showXyzTiles && projectManifest?.baseMapTexture && !baseMapTexture) {
    try {
      loadingText.innerText = t('sceneBasemap') + '...';
      setSceneState('sceneBasemap');
      baseMapTexture = await loadBaseMapTexture();
    } catch (err) {
      console.warn('QGIS basemap texture yuklenemedi, zemin dokusu ile devam ediliyor.', err);
      setStatus(t('basemapFail'));
    }
  }
  loadingText.innerText = t('sceneTerrain') + '...';
  setSceneState('sceneTerrain');
  const terrainBuilt = await buildTerrain(adalar, buildToken);
  if (!terrainBuilt || isSceneBuildStale(buildToken)) return;

  loadingText.innerText = t('processing');
  setSceneState('sceneLayers');
  if (settings.showIslands && (!isRasterTextureMode() || adalar.features.length)) {
    await runLayerBuild('Blocks', () => buildIslandLayer(adalar, buildToken), () => clearGroup(islandGroup));
  } else {
    clearGroup(islandGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showParcels && parseller) {
    await runLayerBuild('Parcels', () => buildParcelLayer(parseller), () => clearGroup(parcelGroup));
  } else {
    clearGroup(parcelGroup);
  }
  if (settings.showHardscape && hardscape) {
    await runLayerBuild('Hardscape', () => buildHardscapeLayer(hardscape, buildToken), () => clearGroup(hardscapeGroup));
  } else {
    clearGroup(hardscapeGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  await runLayerBuild('Wind plume', () => buildWindPlumeLayer(), () => clearGroup(windPlumeGroup));
  if (settings.showBuildings) {
    await runLayerBuild('Buildings', () => buildBuildingLayer(yapilar, buildToken), () => clearGroup(buildingGroup));
  } else {
    clearGroup(buildingGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  await runLayerBuild('Roads', () => buildRoadsAndTraffic(yollar, buildToken), () => { clearGroup(roadGroup); clearGroup(carGroup); clearGroup(pedestrianGroup); });
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showSidewalks) {
    await runLayerBuild('Sidewalks', () => buildSidewalkLayer(yollar, sidewalks, buildToken), () => clearGroup(sidewalkGroup));
  } else {
    clearGroup(sidewalkGroup);
  }
  if (settings.showPedestrianPaths) {
    await runLayerBuild('Pedestrian paths', () => buildPedestrianPathLayer(pedestrianPaths, buildToken), () => { clearGroup(pedestrianPathGroup); pedestrianPathCurves = []; });
  } else {
    clearGroup(pedestrianPathGroup);
    pedestrianPathCurves = [];
  }
  if (settings.showCrosswalks) {
    await runLayerBuild('Crosswalks', () => buildCrosswalkLayer(yollar), () => clearGroup(crosswalkGroup));
  } else {
    clearGroup(crosswalkGroup);
  }
  await runLayerBuild('Pedestrians', () => buildPedestrianLayer(), () => clearGroup(pedestrianGroup));
  if (settings.showTrees) {
    await runLayerBuild('Trees', () => buildTreeLayer(agaclar), () => clearGroup(treeGroup));
  } else {
    clearGroup(treeGroup);
  }
  if (settings.showFurniture) {
    await runLayerBuild('Street furniture', () => buildFurnitureLayer(), () => clearGroup(furnitureGroup));
  } else {
    clearGroup(furnitureGroup);
  }
  rebuildMinimapBg();
  updateDockControls();
  renderFunctionStyleDock();
  updateDashboard(layerDataCache);
  setSceneState('sceneReady');

  hideLoadingOverlay();
}

function handleSceneError(err) {
  console.error(err);
  setStatus(err?.message || t('demFail'));
  setSceneState(err?.message || 'Scene error', 'warn');
  hideLoadingOverlay(0);
}

function rebuildSceneSafe() {
  return rebuildScene().catch((err) => {
    handleSceneError(err);
  });
}

let globalGui = null;
let functionGuiRefs = null;

function setSceneState(textOrKey, kind = 'ok') {
  const pill = document.getElementById('scene-state');
  if (!pill) return;
  const translated = t(textOrKey);
  if (translated !== textOrKey) pill.dataset.sceneI18n = textOrKey;
  else delete pill.dataset.sceneI18n;
  const text = translated !== textOrKey ? translated : textOrKey;
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
  const pedestrianPaths = data.pedestrianPaths || EMPTY_GEOJSON;
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
      const crs = projectManifest.summary?.crs?.length ? projectManifest.summary.crs.join(', ') : t('crsUnknown');
      const modeLabel = isRasterTextureMode() ? 'Raster Plan Texture' : 'Vector Plan';
      const accessField = projectManifest.roadAccess?.field ? `<br>Traffic filter: ${projectManifest.roadAccess.field}` : '';
      const themeLabel = projectManifest.assetTheme || settings.assetTheme || 'Modern Urban';
      meta.innerHTML = `<strong>${title}</strong><br>Mode: ${modeLabel}<br>Asset theme: ${themeLabel}<br>Export: ${exportedAt}<br>CRS: ${crs}${accessField}`;
    } else {
      meta.textContent = t('manifestMissing');
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
      ['pedestrian_paths', 'Paths', pedestrianPaths?.features?.length || 0],
      ['lights', 'Lights', furniture.lights?.features?.length || 0],
      ['benches', 'Benches', furniture.benches?.features?.length || 0],
      ['busstops', 'Stops', furniture.busstops?.features?.length || 0],
    ];
    health.innerHTML = optional.map(([key, name, count]) =>
      `<span class="health-chip ${count ? 'ok' : 'empty'}">${name}: ${count || (manifestEmpty.has(key) ? t('emptyExport') : t('notAvailable'))}</span>`
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
  terrain.add(settings, 'showOutsideRoiTerrain').name(t('lblOutsideRoiTerrain')).onChange(rebuildScene);
  terrain.add(settings, 'terrainTextureOpacity', 0.1, 1.0, 0.05).name('Texture opacity').onChange(rebuildScene);
  terrain.add(settings, 'terrainTextureBrightness', 0.5, 1.5, 0.05).name('Texture brightness').onChange(() => { terrainTexture = null; rebuildScene(); });
  terrain.add(settings, 'terrainTextureContrast', 0.5, 1.8, 0.05).name('Texture contrast').onChange(() => { terrainTexture = null; rebuildScene(); });
  terrain.addColor(settings, 'terrainOutsideColor').name('Outside ROI color').onChange(rebuildScene);
  terrain.add(settings, 'showTerrainSides').name('Build sides').onChange(rebuildScene);
  terrain.add(settings, 'terrainSideDrop', 0, 40, 0.5).name('Side drop from DEM min').onChange(rebuildScene);
  terrain.addColor(settings, 'terrainSideColor').name('Side color').onChange(rebuildScene);
  terrain.add(settings, 'demMeshQuality', 48, 360, 8).name('DEM mesh quality').onChange(rebuildScene);
  terrain.add(settings, 'terrainSmoothingPasses', 0, 5, 1).name('DEM smooth passes').onChange(rebuildScene);
  terrain.add(settings, 'terrainSmoothingStrength', 0, 0.9, 0.05).name('DEM smooth strength').onChange(rebuildScene);
  terrain.add(settings, 'terrainMaxSlope', 0.1, 3.0, 0.05).name('DEM max slope').onChange(rebuildScene);
  terrain.add(settings, 'terrainAnalysisMode', ['Texture', 'Elevation tint', 'Slope tint']).name('Topography view').onChange(rebuildScene);
  terrain.add(settings, 'flattenIslands').name(t('flattenIslands')).onChange(rebuildScene);
  terrain.add(settings, 'islandPlateauTransition', 0, 20, 1).name(t('islandPlateauTransition')).onChange(rebuildScene);
  terrain.add(settings, 'dayOfYear', 1, 365, 1).name(t('dayOfYear')).onChange(updateTimeOfDay);
  terrain.add(settings, 'latitude', -60, 60, 0.5).name(t('latitude')).onChange(updateTimeOfDay);
  terrain.add(settings, 'pavementStyle', Object.keys(textureSets.pavement)).name(t('pavement')).onChange(rebuildScene);
  terrain.add(settings, 'showHardscape').name(t('showHardscape')).onChange(rebuildScene);
  terrain.add(settings, 'hardscapeStyle', Object.keys(textureSets.hardscape)).name(t('hardTex')).onChange(rebuildScene);
  terrain.add(settings, 'hardscapeHeight', 0.0, 2.0, 0.05).name(t('hardH')).onChange(rebuildScene);
  terrain.add(settings, 'showIslands').name(t('lblBlocks')).onChange(rebuildScene);
  terrain.addColor(settings, 'islandColor').name(t('islCol')).onChange(rebuildScene);
  terrain.add(settings, 'islandTexture', Object.keys(textureSets.island)).name(t('islTex')).onChange(rebuildScene);
  terrain.add(settings, 'islandTransparency', 0, 0.95, 0.05).name(t('lblIslandTransparency')).onChange(rebuildScene);
  terrain.addColor(settings, 'parkColor').name(t('parkCol')).onChange(rebuildScene);
  terrain.add(settings, 'parkTexture', Object.keys(textureSets.island)).name(t('parkTex')).onChange(rebuildScene);
  terrain.addColor(settings, 'sportColor').name(t('sportCol')).onChange(rebuildScene);

  const parcels = globalGui.addFolder(t('parcels'));
  parcels.add(settings, 'showParcels').name(t('showParcels')).onChange(rebuildScene);
  parcels.addColor(settings, 'parcelBoundaryColor').name(t('boundCol')).onChange(rebuildScene);
  parcels.add(settings, 'parcelBoundaryOpacity', 0.05, 1.0, 0.01).name(t('boundOp')).onChange(rebuildScene);

  const bld = globalGui.addFolder(t('bld'));
  bld.add(settings, 'buildingMode', ['Footprint only', 'Extruded', 'Extruded + roof']).name('Building mode').onChange(rebuildScene);
  bld.add(settings, 'facadeTextureScale', 1.0, 8.0, 0.05).name('Facade scale').onChange(rebuildScene);
  bld.add(settings, 'floorHeight', 2.5, 5.0, 0.05).name(t('floorH')).onChange(rebuildScene);
  bld.add(settings, 'roofShape', ROOF_SHAPE_OPTIONS).name(t('roofShape')).onChange(rebuildScene);
  bld.add(settings, 'roofHeight', 0.5, 6.0, 0.1).name(t('roofH')).onChange(rebuildScene);
  bld.add(settings, 'roofTexture', Object.keys(textureSets.roof)).name(t('roofTex')).onChange(rebuildScene);

  const roads = globalGui.addFolder(t('roads'));
  roads.add(settings, 'roadStyle', Object.keys(textureSets.road)).name('Asphalt Style').onChange(rebuildScene);
  roads.add(settings, 'showCars').name(t('showCars')).onChange(rebuildScene);
  roads.add(settings, 'carDensity', 0.0, 1.0, 0.1).name(t('carDensity')).onChange(rebuildScene);
  roads.add(settings, 'showRoads').name(t('showRoads')).onChange(rebuildScene);
  roads.add(settings, 'roadColorMode', ['Default', 'Amenity distance', 'Access / traffic']).name('Road analysis').onChange(rebuildScene);
  roads.addColor(settings, 'roadColor').name(t('roadCol')).onChange(rebuildScene);
  roads.add(settings, 'roadWidth', 5.0, 20.0, 0.5).name(t('roadW')).onChange(rebuildScene);
  roads.add(settings, 'trafficSpeed', 0, 5, 0.1).name(t('trafficSpd'));
  roads.add(settings, 'showSidewalks').name(t('showSidewalks')).onChange(rebuildScene);
  roads.add(settings, 'showPedestrianPaths').name(t('showPedestrianPaths')).onChange(rebuildScene);
  roads.add(settings, 'showCrosswalks').name(t('showCrosswalks')).onChange(rebuildScene);
  roads.add(settings, 'showPedestrians').onChange(rebuildScene);
  roads.add(settings, 'pedestrianDensity', 0.0, 1.0, 0.1).name(t('pedDensity')).onChange(rebuildScene);

  const analysis = globalGui.addFolder('Plan Analysis');
  analysis.add(settings, 'showWindPlumes').name('Wind plume risk').onChange(rebuildScene);
  analysis.add(settings, 'windDirectionDeg', 0, 359, 1).name('Wind direction').onChange(rebuildScene);
  analysis.add(settings, 'windPlumeDistance', 40, 600, 10).name('Plume distance').onChange(rebuildScene);
  
  const sfGroup = globalGui.addFolder(t('sfFolder'));
  sfGroup.add(settings, 'showLights').name(t('sfLights')).onChange(rebuildScene);
  sfGroup.add(settings, 'lightStyle', uniqueAssetVariants('lights', ['Modern Arc', 'Classic Post', 'Dual Head', 'Slim Post'])).onChange(rebuildScene);
  sfGroup.add(settings, 'showBenches').name(t('sfBenches')).onChange(rebuildScene);
  sfGroup.add(settings, 'benchStyle', uniqueAssetVariants('benches', ['Wood Plank', 'Concrete Slab', 'Curved Metal'])).onChange(rebuildScene);
  sfGroup.add(settings, 'showBins').name(t('sfBins')).onChange(rebuildScene);
  sfGroup.add(settings, 'binStyle', uniqueAssetVariants('bins', ['Square Box', 'Cylinder', 'Dual Recycle'])).onChange(rebuildScene);
  sfGroup.add(settings, 'showBusStops').name(t('sfStops')).onChange(rebuildScene);
  sfGroup.add(settings, 'stopStyle', uniqueAssetVariants('busstops', ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin'])).onChange(rebuildScene);

  const style = globalGui.addFolder(t('funcCol'));
  const facade = globalGui.addFolder(t('funcFac'));
  const refreshFunctionGui = async () => {
    while (style.controllers.length) style.controllers[0].destroy();
    while (facade.controllers.length) facade.controllers[0].destroy();
    const keys = Object.keys(functionColorState);
    keys.forEach((k) => {
      ensureFunctionBuildingStyle(k);
      style.addColor(functionColorState, k).name(k.slice(0, 16)).onFinishChange(() => {
        syncLegacyFunctionStyle(k);
        saveFunctionBuildingStyles();
        rebuildScene();
      });
      facade.add(functionFacadeState, k, uniqueAssetVariants('facades', Object.keys(textureSets.facade)).filter((value) => Object.prototype.hasOwnProperty.call(textureSets.facade, value))).name(k.slice(0, 16)).onFinishChange(() => {
        syncLegacyFunctionStyle(k);
        saveFunctionBuildingStyles();
        rebuildScene();
      });
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
    const offsetMag = p.surface === 'path'
      ? (p.lateralOffset || 0)
      : (settings.roadWidth * 0.5 + 0.3) * p.offsetDir;
    pos.add(right.multiplyScalar(offsetMag));

    const pedY = terrainLocalYAt(pos.x, pos.z) + (p.surface === 'path' ? LAYER.path + 0.10 : LAYER.sidewalk + 0.08);
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

    // Sun azimuth indicator on the compass ring
    if (_solarCache.elevationDeg > -3) {
      const sunAzRad = THREE.MathUtils.degToRad(_solarCache.azimuthDeg);
      const ringR = 19;
      // Compass already rotated by camera angle (-ang). We want sun's true bearing,
      // so add the camera angle back so the sun marker shows world-space azimuth.
      const drawAng = sunAzRad - ang;
      const sx = Math.sin(drawAng) * ringR + 24;
      const sy = -Math.cos(drawAng) * ringR + 24;
      const elevNorm = Math.max(0, Math.min(1, _solarCache.elevationDeg / 75));
      const sunRadius = 3.0 + elevNorm * 1.5;
      ctx.fillStyle = elevNorm > 0.4 ? '#fde68a' : '#f59e0b';
      ctx.strokeStyle = 'rgba(180,120,0,0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sunRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Minimap + scale bar (throttled ~30fps)
  if (time - _mmLastUpdate > 33) {
    _mmLastUpdate = time;
    const mmWrap = document.getElementById('minimap-wrap');
    if (mmWrap && !mmWrap.classList.contains('collapsed')) updateMinimapCamera();
    if (time - _sbLastUpdate > 300) { _sbLastUpdate = time; updateScaleBar(); }
  }

  // FPS HUD (sample once per second so the number is readable)
  _fpsFrames++;
  if (time - _fpsLastSample > 1000) {
    _fpsValue = Math.round((_fpsFrames * 1000) / (time - _fpsLastSample));
    _fpsFrames = 0;
    _fpsLastSample = time;
    const chip = document.getElementById('fps-chip');
    if (chip) {
      chip.textContent = `${_fpsValue} fps`;
      chip.classList.toggle('warn', _fpsValue < 45 && _fpsValue >= 25);
      chip.classList.toggle('bad', _fpsValue < 25);
    }
  }
}

function updateHtmlLang() {
  document.documentElement.lang = currentLang === 'TR' ? 'tr' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = t(key);
    if (value !== key) el.innerText = value;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const value = t(key);
    if (value !== key) el.setAttribute('title', value);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = t(key);
    if (value !== key) el.setAttribute('placeholder', value);
  });
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.innerText = currentLang === 'TR' ? 'EN' : 'TR';
    langBtn.setAttribute('aria-label', t('toggleLanguage'));
  }
  const scenePill = document.getElementById('scene-state');
  if (scenePill?.dataset.sceneI18n) scenePill.textContent = t(scenePill.dataset.sceneI18n);
  renderFunctionStyleDock();
  renderTourList();
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

window.addEventListener('error', (event) => {
  handleSceneError(event?.error || event?.message || new Error('Scene error'));
});
window.addEventListener('unhandledrejection', (event) => {
  handleSceneError(event?.reason || new Error('Unhandled scene promise rejection'));
});

rebuildSceneSafe().then(() => {
  if (functionGuiRefs) functionGuiRefs.refreshFunctionGui();
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

const TOUR_SETTING_KEYS = [
  'showIslands', 'islandTransparency', 'showParcels', 'showHardscape', 'showBuildings', 'showTrees', 'showFurniture',
  'showCars', 'showRoads', 'showSidewalks', 'showPedestrianPaths', 'showCrosswalks', 'showPedestrians',
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
  )).join('') || `<div class="tour-item">${t('tourEmpty')}</div>`;
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
  const payload = {
    version: 'planx-tour/v2',
    exportedAt: new Date().toISOString(),
    project: projectManifest?.project || null,
    manifestVersion: projectManifest?.version || null,
    mode: projectManifest?.mode || viewerMode(),
    ...tourState
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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
  loadBundledTourStateIfAvailable().then((loaded) => {
    if (loaded) {
      updateTourControls();
      renderTourList();
    }
  });
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
    applyTourData(data, true);
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
    roofShape: ROOF_SHAPE_OPTIONS,
    roofTexture: Object.keys(textureSets.roof),
    pavementStyle: Object.keys(textureSets.pavement),
    terrainAnalysisMode: ['Texture', 'Elevation tint', 'Slope tint'],
    buildingMode: ['Footprint only', 'Extruded', 'Extruded + roof'],
    hardscapeStyle: Object.keys(textureSets.hardscape),
    roadStyle: Object.keys(textureSets.road),
    roadColorMode: ['Default', 'Amenity distance', 'Access / traffic'],
    assetTheme: Object.keys(assetThemePresets),
    treeRenderMode: ['Stylized', 'Realistic'],
    treeVariantCount: Array.from({ length: TREE_VARIANT_CATALOG.length }, (_item, idx) => String(idx + 1)),
    lightStyle: uniqueAssetVariants('lights', ['Modern Arc', 'Classic Post', 'Dual Head', 'Slim Post']),
    benchStyle: uniqueAssetVariants('benches', ['Wood Plank', 'Concrete Slab', 'Curved Metal']),
    binStyle: uniqueAssetVariants('bins', ['Square Box', 'Cylinder', 'Dual Recycle']),
    stopStyle: uniqueAssetVariants('busstops', ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin']),
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

let functionStyleRebuildTimer = null;
function requestFunctionStyleRebuild() {
  window.clearTimeout(functionStyleRebuildTimer);
  functionStyleRebuildTimer = window.setTimeout(() => rebuildScene(), 140);
}

function renderFunctionStyleDock() {
  const host = document.getElementById('function-style-controls');
  if (!host) return;
  const keys = Object.keys(functionColorState).sort();
  if (!keys.length) {
    host.innerHTML = `<p class="dock-note">${t('funcStylesPending')}</p>`;
    return;
  }
  host.innerHTML = '';
  const facadeOptions = uniqueAssetVariants('facades', Object.keys(textureSets.facade))
    .filter((value) => Object.prototype.hasOwnProperty.call(textureSets.facade, value));
  const roofOptions = Object.keys(textureSets.roof);
  const makeSelect = (options, value) => {
    const select = document.createElement('select');
    options.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
    select.value = value;
    return select;
  };
  const makeRange = (min, max, step, value) => {
    const wrap = document.createElement('div');
    wrap.className = 'function-style-range';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    const out = document.createElement('output');
    out.value = String(value);
    out.textContent = String(value);
    wrap.append(input, out);
    return { wrap, input, out };
  };
  const makeField = (labelText, control) => {
    const label = document.createElement('label');
    label.className = 'function-style-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, control);
    return label;
  };
  keys.forEach((key, index) => {
    const style = ensureFunctionBuildingStyle(key, index);
    const card = document.createElement('div');
    card.className = 'function-style-card';

    const header = document.createElement('div');
    header.className = 'function-style-header';
    const name = document.createElement('strong');
    name.textContent = key;
    name.title = key;
    const color = document.createElement('input');
    color.type = 'color';
    color.value = style.color;
    color.title = 'Facade color';
    color.addEventListener('input', () => {
      style.color = color.value;
      functionColorState[key] = color.value;
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });
    header.append(name, color);

    const grid = document.createElement('div');
    grid.className = 'function-style-grid';

    const facade = makeSelect(facadeOptions, style.facade);
    facade.addEventListener('change', () => {
      style.facade = normalizeFacadeKey(facade.value);
      functionFacadeState[key] = style.facade;
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    const roofShape = makeSelect(ROOF_SHAPE_OPTIONS, style.roofShape);
    roofShape.addEventListener('change', () => {
      style.roofShape = roofShapeValue(roofShape.value, 'Pyramid');
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    const roofTexture = makeSelect(roofOptions, style.roofTexture);
    roofTexture.addEventListener('change', () => {
      style.roofTexture = presetValue(roofTexture.value, textureSets.roof, 'RoofA');
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    const roofHeight = makeRange(0, 8, 0.1, style.roofHeight);
    roofHeight.input.addEventListener('input', () => {
      style.roofHeight = Number(roofHeight.input.value);
      roofHeight.out.textContent = style.roofHeight.toFixed(1);
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    const facadeScale = makeRange(1, 8, 0.05, style.facadeScale);
    facadeScale.input.addEventListener('input', () => {
      style.facadeScale = Number(facadeScale.input.value);
      facadeScale.out.textContent = style.facadeScale.toFixed(2);
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    const floorHeight = makeRange(2.4, 6, 0.05, style.floorHeight);
    floorHeight.input.addEventListener('input', () => {
      style.floorHeight = Number(floorHeight.input.value);
      floorHeight.out.textContent = style.floorHeight.toFixed(2);
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    grid.append(
      makeField('Facade', facade),
      makeField('Roof shape', roofShape),
      makeField('Roof texture', roofTexture),
      makeField('Roof height', roofHeight.wrap),
      makeField('Facade scale', facadeScale.wrap),
      makeField('Floor height', floorHeight.wrap)
    );
    card.append(header, grid);
    host.appendChild(card);
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
  if (inputType === 'checkbox' && value === false) {
    if (key === 'showBuildings') clearGroup(buildingGroup);
    else if (key === 'showIslands') clearGroup(islandGroup);
    else if (key === 'showParcels') clearGroup(parcelGroup);
    else if (key === 'showHardscape') clearGroup(hardscapeGroup);
    else if (key === 'showTrees') clearGroup(treeGroup);
    else if (key === 'showFurniture') clearGroup(furnitureGroup);
    else if (key === 'showRoads') clearGroup(roadGroup);
    else if (key === 'showSidewalks') clearGroup(sidewalkGroup);
    else if (key === 'showPedestrianPaths') { clearGroup(pedestrianPathGroup); pedestrianPathCurves = []; }
    else if (key === 'showCrosswalks') clearGroup(crosswalkGroup);
    else if (key === 'showCars') clearGroup(carGroup);
    else if (key === 'showPedestrians') clearGroup(pedestrianGroup);
  }
  if (key === 'assetTheme') {
    applyThemeDefaultsToSettings(true);
    terrainTexture = null;
    baseMapTexture = null;
    updateDockControls();
  }
  if (key === 'showTerrainTexture' || key === 'terrainTextureBrightness' || key === 'terrainTextureContrast' || key === 'terrainAnalysisMode') {
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

  // Shadow study presets — jump dayOfYear to a solstice/equinox and clamp time to noon.
  const SHADOW_PRESETS = { winter: 355, spring: 79, summer: 172, autumn: 265 };
  document.querySelectorAll('[data-shadow-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.shadowPreset;
      const day = SHADOW_PRESETS[key];
      if (!day) return;
      settings.dayOfYear = day;
      settings.timeOfDay = 12;
      updateTimeOfDay();
      reflectDockSettings();
      document.querySelectorAll('[data-shadow-preset]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  document.getElementById('shadow-play-day')?.addEventListener('click', () => {
    settings.autoTime = true;
    if (settings.timeOfDay < 6 || settings.timeOfDay > 18) settings.timeOfDay = 6;
    reflectDockSettings();
  });
  document.getElementById('shadow-stop')?.addEventListener('click', () => {
    settings.autoTime = false;
    reflectDockSettings();
  });
  document.getElementById('shadow-compute')?.addEventListener('click', () => {
    computeShadowHeatmap();
  });
  document.getElementById('shadow-clear')?.addEventListener('click', () => {
    removeShadowHeatmap();
    setStatus('Shadow heatmap cleared.');
  });

  // Quick time-of-day presets
  document.querySelectorAll('[data-time-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = parseFloat(btn.dataset.timePreset);
      if (!Number.isFinite(t)) return;
      settings.timeOfDay = t;
      settings.autoTime = false;
      updateTimeOfDay();
      reflectDockSettings();
    });
  });

  // Theme override (auto/light/dark) — stored in localStorage
  const themeSelect = document.getElementById('theme-mode-select');
  if (themeSelect) {
    const applyTheme = (value) => {
      const root = document.documentElement;
      root.removeAttribute('data-theme');
      if (value === 'light' || value === 'dark') {
        root.setAttribute('data-theme', value);
      }
      try { localStorage.setItem('planx_3d_city_theme', value); } catch (_) {}
    };
    let saved = 'auto';
    try { saved = localStorage.getItem('planx_3d_city_theme') || 'auto'; } catch (_) {}
    themeSelect.value = ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto';
    applyTheme(themeSelect.value);
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
  }

  // Camera bookmarks
  loadCameraBookmarks();
  renderCameraBookmarks();
  document.getElementById('bookmark-save')?.addEventListener('click', () => {
    const name = window.prompt(t('bookmarkPrompt'), `View ${cameraBookmarks.length + 1}`);
    if (name === null) return;
    addCameraBookmark(name);
  });
}

initDockUi();
initTourUi();
