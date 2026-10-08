# PlanX 3D City — Yol Haritası (v1.1 → v2.0)

Hedef: QGIS ekosistemindeki en hızlı, en güzel ve en çok işe yarayan 3D şehir
yayıncısı olmak. Bu plan mevcut kodun (v1.0.3) incelenmesine dayanır; her madde
somut bir dosyaya/fonksiyona bağlanır ve ölçülebilir bir hedefle biter.

---

## 0. Bugünkü durum — tespit edilen darboğazlar

| # | Bulgu | Yer | Etki |
|---|-------|-----|------|
| B1 | Her bina ayrı `THREE.Mesh` + ayrı `MeshStandardMaterial`; her kat döşemesi (ledge) ayrı mesh + **yeni materyal** | `web/src/app.js` `buildBuildingLayer` (~7433–7710) | 5.000 bina × 6 kat ≈ 35.000+ draw call → orta GPU'da < 15 FPS |
| B2 | Sahne her karede render ediliyor (hareket yokken bile) | `animate()` (~9620) | Boşta %100 GPU, laptop fanı, pil |
| B3 | `preserveDrawingBuffer: true` sürekli açık | renderer kurulumu (~432) | Tile-based GPU'larda belirgin FPS kaybı |
| B4 | GeoJSON katmanları **sırayla** `await` ile yükleniyor | ~8700–8720 | Açılış süresi = tüm dosyaların toplamı |
| B5 | GeoJSON parse, DEM `readRasters`, `ExtrudeGeometry` ana thread'de | `loadGeoJson`, ~3870/3970 | Büyük şehirlerde UI donması |
| B6 | DEM tam boyutuyla kopyalanıyor (ROI'ye kırpılmıyor), GeoJSON koordinat hassasiyeti sınırsız | `exporter.py` `_export_dem`, `_export_vector` | Dışa aktarım boyutu 5–20× gereğinden büyük |
| B7 | Doku PNG'leri 0.7–1.2 MB, sıkıştırılmamış GPU formatı | `web/src/assets/*.png` | ~8 MB indirme, ~150 MB+ VRAM |
| B8 | `intersectObjects(buildingGroup.children)` → binlerce mesh üzerinde lineer raycast | ~9318, 9351, 9398 | Hover/tıklamada takılma |
| B9 | Gölge haritası tek kaskad 2048², ±1600 m kutu | ~484–488 | Yakın planda bulanık, uzakta israf |
| B10 | `app.js` tek dosya 10.6k satır, test yok | `web/src/app.js` | Hız regresyonları fark edilmiyor |

---

## Faz 1 — "Anında hız" (1–2 hafta, risk düşük, en yüksek getiri)

> **Durum (Ekim 2026):** 1.1–1.7 uygulandı. Ölçüm: `tests/bench`, 10.000 bina,
> headless Chromium (SwiftShader): draw call 44.249 → 1.848, sahne hazır
> 33,5 sn → 16,0 sn, kare süresi 3,8 sn → 2,4 sn, bina seçimi 13,4 ms → 1,1 ms.
> SwiftShader CPU ile çizdiği için mutlak FPS gerçek GPU'yu yansıtmaz; draw
> call ve süre oranları yansıtır.

**Hedef:** 10.000 binalık sahnede orta seviye laptop'ta 60 FPS, açılış < 3 sn.

1. **Bina batching (B1)** — en büyük kazanç.
   - Materyalleri `(fonksiyon, cephe, kat-sayısı-ölçeği, çatı)` anahtarıyla önbelleğe al; bina başına `new MeshStandardMaterial` yok.
   - Aynı materyali paylaşan duvar/çatı geometrilerini `BufferGeometryUtils.mergeGeometries` ile tek mesh'e birleştir (veya r159+ `BatchedMesh`).
   - Kat döşemelerini (`showLedges`) tek `InstancedMesh` veya birleşik geometri yap.
   - Bina kimliğini `feature_id` vertex attribute'u olarak sakla → seçim/vurgulama shader'da (`uSelectedId`), ayrı mesh gerekmez.
   - Beklenen: draw call 35.000 → < 100.
2. **On-demand render (B2)** — `needsRender` bayrağı; kontroller, animasyon, ayar değişimi, trafik/yaya simülasyonu açıkken render et, aksi halde dur. SSAO "settle" mantığı zaten var, ona bağlanır.
3. **`preserveDrawingBuffer` (B3)** — kapat; ekran görüntüsü/kayıt anında `renderer.render()` sonrası `toBlob` ile al.
4. **Paralel yükleme (B4)** — tüm `loadGeoJson` çağrılarını `Promise.all`; bina katmanı önce, mobilya sonra (progressive reveal).
5. **BVH raycast (B8)** — `three-mesh-bvh` vendor'a eklenir (MIT, bağımsız ESM) → merged mesh üzerinde O(log n) pick; gölge ısı haritasındaki (`localRaycaster` ~5755) hesap da 10–50× hızlanır.
6. **Adaptif çözünürlük** — FPS < 45 iken `pixelRatio`'yu dinamik düşür, hareket bitince geri al.
7. **Performans HUD** — `?perf=1` ile FPS, draw call, üçgen, VRAM, yükleme süreleri (`renderer.info`).

## Faz 2 — "Büyük şehir" ölçeği (2–4 hafta)

**Hedef:** 100.000+ bina, ilçe ölçeğinde DEM; tarayıcı donmadan.

> **Durum (Ekim 2026, ilk tur):** Ölçüm önce geldi (`__planxPerf.timings()` /
> `breakdown()`), ve asıl yükün beklenen yerde olmadığı görüldü:
> - Bina katmanı 13,7 sn → ~4 sn: döşemeler her kat için yeniden extrude
>   ediliyordu (artık bina başına bir kez), birleştirme döngüsü typed-array'e
>   geçti, 85 bin mesh'in `remove()` ile karesel ayrılması doğrusal oldu.
> - Üçgenlerin çoğu binalarda değil **yollardaydı** (1,84M / toplam 2,9M):
>   şeritler metre başına bir quad üretiyordu → 3 m'de bir. Yollar 0,61M.
> - Döşeme karoları 550 m'den uzakta gizleniyor (2. madde, kısmi).
> - 4. madde yerine **görünüme oturan tek gölge kamerası**: gölgeler aslında
>   hiç çizilmiyordu (güneş 1300 m, gölge kamerası `far` 500 m; harita da
>   sahne yüklendikten sonra yenilenmiyordu). Artık yakın planda keskin.
> - 5. madde: 9 fotoğrafik doku WebP (8,2 MB → 1,5 MB). Boyutları küçük
>   (768–1024 px) olduğundan KTX2'nin VRAM kazancı önemsiz.
>
> 10.000 bina, orijinal → şimdi: sahne hazır 32,8 sn → 9,3 sn, kare 3,7 sn →
> 1,5 sn, üçgen 2,88M → 1,17M, draw call 44.249 → 1.763.

> **Durum (ikinci tur):**
> - **1. Worker:** Bina katmanı artık mesh/materyal üretip sonradan
>   birleştirmiyor; ana thread her binayı düz bir "spec"e çeviriyor,
>   `building_geometry.js` extrude/döşeme/çatıyı üretip (görünüm, karo)
>   buffer'larını doğrudan yazıyor. Karolar 6'ya kadar modül worker'ına
>   dağıtılıyor; worker yoksa aynı kod ana thread'de çalışıyor.
> - **Yollar/bloklar/kaldırımlar da birleştirildi** (`mesh_merge.js`): 10k
>   şehirde draw call 1.763 → 450.
> - **Ölçekte bulunan karesel hata:** `terrainLocalYAt` her çağrıda tüm blok
>   platolarını tarıyordu (50k şehirde 14 sn); ızgara indeksiyle çözüldü.
> - Birleştirilmiş köşe verisi sıkıştırıldı (normal int16, renk/ışıma byte,
>   UV yalnızca dokuluda): ~52 → ~26 bayt/köşe.
> - Yükleme ekranı açıkken sahne çizilmiyor (build ve worker'larla
>   yarışıyordu).
> - **3. Terrain LOD — ertelendi:** arazi ağı en fazla 420² segment (~353k
>   üçgen; varsayılan 120² ≈ 29k), tek mesh; yükseklik sorguları ağdan değil
>   DEM'den. Bugünkü sınırlarla LOD ölçülebilir kazanç getirmiyor. DEM
>   çözünürlüğü/alanı büyütülürse (Faz 3.1 ile) yeniden ele alınmalı.
> - **6. Occlusion culling — ertelendi:** draw call 450'ye indikten sonra
>   ölçülebilir bir darboğaz değil.
>
> 50.000 bina (4 vCPU, SwiftShader): sahne hazır 61,5 sn → 29,0 sn; bina
> katmanı 30 sn → 7,4 sn.

1. **Web Worker pipeline (B5)** — GeoJSON parse + üçgenleme (earcut) + extrude + merge worker'da; ana thread'e `Transferable` `ArrayBuffer` gelir. GeoTIFF decode `geotiff.js` pool ile worker'da.
2. **Mekânsal tiling + LOD** — veri 250 m'lik karolara bölünür; uzak karolar LOD1 (düz kutu, dokusuz), yakın karolar LOD2 (çatı tipi, cephe dokusu, döşeme). Kamera frustum'una göre karo yükle/boşalt.
3. **Terrain LOD** — DEM için quadtree / chunked LOD (yakında yüksek çözünürlük, uzakta seyrek), etek (skirt) ile çatlaksız.
4. **Cascaded Shadow Maps (B9)** — 3 kaskad (`three/addons/csm/CSM.js`); yakın planda keskin gölge, uzakta ucuz. Gölge yalnızca güneş/kamera değişince güncellenir (`autoUpdate=false`).
5. **Sıkıştırılmış dokular (B7)** — PNG → KTX2/Basis (UASTC/ETC1S) + `KTX2Loader`; yedek olarak WebP. Cephe dokularını tek **texture array / atlas**'ta topla → tek materyal, tek draw call.
6. **Occlusion culling (opsiyonel)** — yoğun şehir merkezlerinde hiyerarşik Z veya karo tabanlı görünürlük.

## Faz 3 — Dışa aktarım (QGIS tarafı) hızlandırma (1–2 hafta)

**Hedef:** Dışa aktarım süresi ve boyutu 5× azalsın.

1. **DEM'i ROI + tampon ile kırp ve yeniden örnekle (B6)** — `gdal.Translate`/`QgsRasterPipe` ile `-projwin`, hedef çözünürlük (örn. 1–5 m seçilebilir), `COMPRESS=DEFLATE`, `PREDICTOR=3`, `TILED=YES`.
2. **GeoJSON küçültme** — `COORDINATE_PRECISION=2` (metrik CRS'de cm), `WRITE_BBOX`, kullanılmayan alanları at (`field_mappings` zaten biliniyor).
3. **İkili format** — opsiyonel olarak binaları sunucu tarafında önceden üçgenleyip **glTF/GLB (meshopt + Draco)** veya FlatGeobuf olarak yaz → tarayıcıda parse/extrude süresi sıfıra iner.
4. **Arka plan görevi** — export `QgsTask` ile çalışsın, QGIS arayüzü donmasın, ilerleme çubuğu ve iptal.
5. **Artımlı export** — katman değişmediyse (hash/mtime) yeniden yazma.
6. **Gzip/Brotli** — `server.py` önceden sıkıştırılmış `.gz` dosyaları `Content-Encoding` ile sunsun.

## Faz 4 — Görsel kalite: "dünyanın en iyisi" (3–6 hafta)

1. **Fiziksel gökyüzü + IBL** — `Sky` → PMREM ortam haritası; saat/enlem ile senkron (enlem zaten DEM'den türetiliyor). Gece için şehir ışıkları + yıldız.
2. **Modern post-process zinciri** — SSAO yerine **GTAO/N8AO**, TAA veya SMAA, ACES/AgX tone mapping, hafif bloom, yükseklik sisi, DoF (sunum modu).
3. **Prosedürel cephe shader'ı** — dokuya bağlı kalmadan kat/pencere ızgarası, gece rastgele yanan pencereler (şu an `Math.random()` emissive per-material), cam yansıması — hepsi tek shader, sıfır ek doku.
4. **Gerçekçi çatılar** — straight-skeleton ile her çokgen için doğru hip/gable çatı; güneş paneli, yeşil çatı varyantları.
5. **Su, bitki örtüsü** — yansıtıcı su yüzeyi, rüzgârda sallanan ağaç shader'ı (vertex wind), çim instancing.
6. **WebGPU yolu** — Three.js `WebGPURenderer` (r16x+) ile opsiyonel arka uç; destek yoksa WebGL2'ye düşer. Three.js'in r160'tan güncel sürüme yükseltilmesi bu fazın ön koşulu.

## Faz 5 — Planlamacılar için katil özellikler (sürekli)

1. **Gerçek zamanlı analizler (GPU)** — gökyüzü görüş faktörü (SVF), güneşlenme saatleri ısı haritası (21 Aralık / 21 Haziran), görüş alanı (viewshed), gölge süresi — hepsi GPU render-to-texture ile saniyeler içinde.
2. **İmar senaryoları** — TAKS/KAKS/Hmax parametreleriyle "ne olur" modu; A/B senaryo kaydırıcılı karşılaştırma (split-screen).
3. **3D Tiles / CityGML / CityJSON içe-dışa aktarım** — OGC 3D Tiles 1.1 çıktısı (Cesium, ArcGIS, Unreal ile uyum); Google Photorealistic 3D Tiles bağlam katmanı (API anahtarı kullanıcıdan).
4. **Paylaşım** — tek tıkla statik web paketi (zaten ZIP var) + GitHub/GitLab Pages yayınlama; sahne URL'sine kamera durumu gömme.
5. **Video/görsel çıktısı** — keyframe turundan 4K MP4 (WebCodecs), yüksek çözünürlüklü tiled screenshot (8K+).
6. **VR/AR** — WebXR ile sahnede yürüme (Quest tarayıcısı).
7. **QGIS içi önizleme** — `QWebEngineView` paneli; QGIS'te seçilen obje 3D'de vurgulansın (çift yönlü senkron).

## Faz 6 — Mühendislik altyapısı (Faz 1 ile paralel başlamalı)

1. **`app.js`'i modüllere böl** — `scene/`, `layers/buildings.js`, `layers/terrain.js`, `analysis/`, `ui/`, `workers/`. Build aracı gerektirmeden native ES modules + import map (mevcut "Node.js gerektirmez" ilkesi korunur).
2. **Benchmark sahnesi** — `sample_generator.py` ile 1k / 10k / 100k binalık deterministik veri; Playwright + headless Chromium ile FPS, draw call, açılış süresi ölçümü CI'da (`.github/workflows/quality.yml`'a yeni job). Regresyon > %10 ise kırmızı.
3. **Görsel regresyon testleri** — sabit kameradan ekran görüntüsü karşılaştırma.
4. **JS lint** (ESLint) ve tip kontrolü (JSDoc + `tsc --checkJs`) CI'da.

---

## Önceliklendirme (etki / efor)

| Öncelik | İş | Etki | Efor |
|---|---|---|---|
| P0 | Bina batching + materyal önbelleği (F1.1) | ★★★★★ | Orta |
| P0 | On-demand render (F1.2) | ★★★★ | Düşük |
| P0 | Paralel yükleme (F1.4) | ★★★ | Çok düşük |
| P0 | Benchmark + perf HUD (F6.2, F1.7) | ★★★★ (ölçmeden hızlandırılmaz) | Düşük |
| P1 | Worker pipeline (F2.1) | ★★★★ | Orta |
| P1 | DEM kırpma + GeoJSON hassasiyeti (F3.1–3.2) | ★★★★ | Düşük |
| P1 | BVH raycast (F1.5) | ★★★ | Düşük |
| P1 | KTX2 + doku atlası (F2.5) | ★★★ | Orta |
| P2 | Tiling + LOD, CSM, terrain LOD | ★★★★ | Yüksek |
| P2 | Görsel kalite paketi (Faz 4) | ★★★★ | Yüksek |
| P3 | 3D Tiles, WebXR, WebGPU, QGIS içi önizleme | ★★★ | Yüksek |

## Başarı ölçütleri (v2.0)

- 10k bina: ≥ 60 FPS (Intel Iris Xe), açılış < 3 sn
- 100k bina: ≥ 30 FPS, UI hiç donmuyor
- Boşta GPU kullanımı ≈ %0
- Export boyutu ilk sürüme göre ≥ 5× küçük
- Sıfır harici bağımlılık kuralı korunuyor (Node.js / pip paketi yok)

## Önerilen ilk sprint (PR sırası)

1. Perf HUD + benchmark veri üreticisi (ölçüm tabanı)
2. Paralel `loadGeoJson` + on-demand render + `preserveDrawingBuffer` kapatma
3. Materyal önbelleği + bina/döşeme geometrisi birleştirme + `feature_id` tabanlı seçim
4. DEM ROI kırpma + GeoJSON koordinat hassasiyeti
5. `three-mesh-bvh` ile raycast ve gölge ısı haritası hızlandırma
