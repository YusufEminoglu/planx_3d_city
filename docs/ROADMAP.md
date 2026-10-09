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

> **Durum (Ekim 2026):**
> - **1. DEM:** yerel DEM, görüntüleyicinin sahne sınırına (+32 px + %2 pay)
>   kırpılıp DEFLATE/PREDICTOR/TILED olarak yazılıyor; GDAL hatasında eski
>   kopyalamaya dönülüyor. Örnek: 4,6 MB → 327 KB, görüntü aynı. Yeniden
>   örnekleme (çözünürlük seçimi) yapılmadı.
> - **2. GeoJSON:** `COORDINATE_PRECISION=3` (mm). Alan budama yapılmadı:
>   ipuçları ve stil alanları keyfi öznitelik okuyor.
> - **5. Artımlı export:** dosya tabanlı OGR katmanları ve DEM parmak izi
>   ile atlanıyor (`web/data/.planx_export_cache.json`).
> - **4. QgsTask — ertelendi:** katmanlara iş parçacığından erişim güvenli
>   değil; QGIS içinde test edilmeden yapılmamalı.
> - **6. Gzip — gerek yok:** sunucu yalnızca localhost; GitHub Pages vb.
>   zaten sıkıştırıyor.
> - **3. İkili format:** worker'lı geometri üretimiyle (Faz 2) öncelik düştü.

1. **DEM'i ROI + tampon ile kırp ve yeniden örnekle (B6)** — `gdal.Translate`/`QgsRasterPipe` ile `-projwin`, hedef çözünürlük (örn. 1–5 m seçilebilir), `COMPRESS=DEFLATE`, `PREDICTOR=3`, `TILED=YES`.
2. **GeoJSON küçültme** — `COORDINATE_PRECISION=2` (metrik CRS'de cm), `WRITE_BBOX`, kullanılmayan alanları at (`field_mappings` zaten biliniyor).
3. **İkili format** — opsiyonel olarak binaları sunucu tarafında önceden üçgenleyip **glTF/GLB (meshopt + Draco)** veya FlatGeobuf olarak yaz → tarayıcıda parse/extrude süresi sıfıra iner.
4. **Arka plan görevi** — export `QgsTask` ile çalışsın, QGIS arayüzü donmasın, ilerleme çubuğu ve iptal.
5. **Artımlı export** — katman değişmediyse (hash/mtime) yeniden yazma.
6. **Gzip/Brotli** — `server.py` önceden sıkıştırılmış `.gz` dosyaları `Content-Encoding` ile sunsun.

## Faz 4 — Görsel kalite: "dünyanın en iyisi" (3–6 hafta)

> **Durum (Ekim 2026, ilk tur):** 4.1, 4.2'nin büyük kısmı ve 4.3'ün gece
> penceresi kısmı uygulandı.
> - **Atmosfer (`web/src/atmosphere.js`):** "Cinematic" modu fiziksel `Sky`
>   çizer ve aynı gökyüzünden PMREM ortam haritası pişirir (güneş 1.5°'den
>   fazla dönerse yeniden). Kare geneli ACES renkleri soldurduğu için gökyüzü
>   kendi shader'ında pozlama + ACES ile tone-map ediliyor; ortam ışığı
>   malzeme başına `envMapIntensity` 0.32 + ambient 0.16. Sis ufuk rengini
>   alıyor. "Clean" modu eski düz sunum arka planını korur (Efektler menüsü).
> - **Post-process:** SSAOPass sahneyi MSAA'sız yeniden çiziyor ve RenderPass'i
>   yok sayıyordu. Yerine 4x MSAA HalfFloat hedef → GTAOPass (metre ölçekli
>   yarıçap, Poisson denoise) → bloom (yalnız gece) → OutputPass. Yalnız
>   kamera durunca çizilen "settled" karede çalışır; SwiftShader'da settled kare
>   ~0.95 s → ~1.45 s (GTAO'nun normal/derinlik çizimi), hareket karesi değişmedi.
>   `__planxPerf.timeComposer()` eklendi.
> - **Gece pencereleri:** cephe dokusunun pencere ızgarası (sütun/satır sayısı,
>   faz, pencere dikdörtgeni) yüklemede parlaklık profillerinden tahmin
>   ediliyor (otokorelasyon + hücre ortalaması; foto ve prosedürel dokular için
>   metadata gerekmez). Duvar shader'ı her binanın `planxGlow` oranı kadar
>   rastgele pencereyi sıcak/soğuk ışıkla yakıyor; bloom'a yetecek parlaklıkta.
> - Kalan: TAA/SMAA (hareket karesi için), DoF, cam yansıması, 4.4–4.6.
>
> **Durum (ikinci tur):**
> - **TAA/SMAA gereksiz:** hareket kareleri zaten varsayılan çerçeve
>   tamponunun MSAA'sıyla (`antialias: true`) çiziliyor, durağan kare 4x MSAA
>   composer'dan geçiyor. Vendor'daki kullanılmayan SMAA/SSAO dosyaları silindi.
> - **4.4 Çatılar:** `web/src/roof_skeleton.js` — basit çokgen için straight
>   skeleton (kinetik dalga cephesi; kenar ve bölünme olayları kuyruktan
>   alınırken canlı cepheye karşı doğrulanıyor, sıfır genişlikli bölgeler
>   seviye mahyaya dönüşüyor). Hip/Gable artık her saçak kenarına aynı eğimde
>   kendi düzlemini veriyor: L/T/U planlarda doğru mahya ve dereler. Gable,
>   hip ucundaki tepe noktasını mahya boyunca duvara kaydırıyor. Çatı dokusu
>   satırları her yüzün saçağına paralel. Başarısızlıkta (yüz alanı ayak izini
>   tam örtmezse) eski tek mahyalı çözüme düşüyor. `tests/js` altında
>   kare/dikdörtgen/L/T/U/düzensiz ve 200 rastgele blok testi; 6.000 rastgele
>   çokgenlik stres testinde hata yok. CI artık Python ve JS birim testlerini
>   çalıştırıyor.
> - **Cam yansıması:** pencere maskesi (ızgara + pencere dikdörtgeni) piksel
>   başına bir kez hesaplanıyor; gündüz camı parlak yapıp gökyüzü yansımasını
>   artırıyor, gece aynı maske pencereleri yakıyor.
> - **DoF (sunum):** Efektler → Depth of field. Durağan karede BokehPass;
>   odak ekran merkezinin zemindeki noktası, bulanıklık göreli derinliğe göre
>   (sokakta da şehir üstünde de aynı his). Kapalıyken maliyeti yok.
> - **4.5 Su ve bitki:** su hatları daha parlak ve tam gökyüzü yansıması
>   alıyor (normal map birleştirmeyi bozacağı için eklenmedi). Ağaç tepeleri
>   için isteğe bağlı rüzgâr salınımı (vertex shader, ağaç başına faz, analiz
>   rüzgâr yönü); açıkken görüntüleyici kare çizmeye devam eder, gölgeler
>   sabit kalır. Çim instancing yapılmadı (veri modelinde çim alanı yok).
> - **4.6 WebGPU — ertelendi:** r160 → r17x yükseltmesi ve `onBeforeCompile`
>   ile yapılan tüm shader yamalarının (bina batch'i, pencereler, gökyüzü,
>   rüzgâr) TSL/node malzemelerine yeniden yazılmasını gerektiriyor; WebGL2
>   yolu bugün darboğaz değil. Ayrı bir faz olarak ele alınmalı.

1. **Fiziksel gökyüzü + IBL** — `Sky` → PMREM ortam haritası; saat/enlem ile senkron (enlem zaten DEM'den türetiliyor). Gece için şehir ışıkları + yıldız.
2. **Modern post-process zinciri** — SSAO yerine **GTAO/N8AO**, TAA veya SMAA, ACES/AgX tone mapping, hafif bloom, yükseklik sisi, DoF (sunum modu).
3. **Prosedürel cephe shader'ı** — dokuya bağlı kalmadan kat/pencere ızgarası, gece rastgele yanan pencereler (şu an `Math.random()` emissive per-material), cam yansıması — hepsi tek shader, sıfır ek doku.
4. **Gerçekçi çatılar** — straight-skeleton ile her çokgen için doğru hip/gable çatı; güneş paneli, yeşil çatı varyantları.
5. **Su, bitki örtüsü** — yansıtıcı su yüzeyi, rüzgârda sallanan ağaç shader'ı (vertex wind), çim instancing.
6. **WebGPU yolu** — Three.js `WebGPURenderer` (r16x+) ile opsiyonel arka uç; destek yoksa WebGL2'ye düşer. Three.js'in r160'tan güncel sürüme yükseltilmesi bu fazın ön koşulu.

## Faz 5 — Planlamacılar için katil özellikler (sürekli)

> **Durum (Ekim 2026, ilk tur):** 5.1 (güneş saatleri + SVF), 5.2, 5.3 (3D
> Tiles), 5.4 (görünüm linki) ve 5.5'in yüksek çözünürlüklü görüntü kısmı.
> - **Düzeltme (önemli):** güneş yanlış yarıküredeydi. Veri kuzeyi +Z, doğuyu
>   −X'e koyuyor; güneş kuzeyi −Z, doğuyu +X sayıyordu, yani 180° dönüktü
>   (sabah gölgeleri doğuya, öğlen gölgeleri güneye düşüyordu). Pusula doğruydu.
>   Güneş, rüzgâr bulutları ve ağaç rüzgârı artık tek bir pusula→sahne
>   dönüşümünü kullanıyor. Ayrıca `setStatus` mesajları sayfada olmayan bir
>   öğeye yazılıyordu; artık köşede bildirim olarak görünüyor.
> - **5.1 GPU maruziyet analizi** (`web/src/exposure_analysis.js`): üstten
>   yükseklik haritası + her güneş konumu (15 dk) ya da gökyüzü yönü (128,
>   kosinüs ağırlıklı) için derinlik haritası; tam ekran geçişle float hedefe
>   toplanıyor. Sokak, meydan ve çatılar ~1,5 m çözünürlükte. Örnek şehirde
>   SwiftShader'da 17 s (güneş saatleri) / 31 s (SVF); eski 48×48 ışın
>   izleme ısı haritasının yerini aldı. Sonuç sahneye örtülüyor (duvar
>   üçgenleri atılıyor), lejant ve ortalama ile. Görüş alanı (viewshed) ve
>   cephe analizi kaldı.
> - **5.2 İmar senaryoları** (`web/src/zoning_scenario.js`): TAKS (taban
>   alanı oranı), KAKS (emsal), Hmax ve çekme mesafesi ile her parsel (yoksa
>   ada) için izin verilen kütle; mevcut binalarla karşılaştırmalı tablo
>   (inşaat alanı, emsal, TAKS, nüfus tahmini) ve renkli kütleler. "Split"
>   görünümü: solda mevcut, sağda senaryo, sürüklenebilir ayırıcı. Kurallar
>   değişince sadece senaryo yeniden çiziliyor. A/B iki senaryo karşılaştırması
>   kaldı (şu an mevcut ↔ senaryo).
> - **5.3 3D Tiles 1.1 dışa aktarım** (`tiles_math.js`, `tiles_export.js`):
>   QGIS dışa aktarımı manifeste coğrafi referans yazıyor (CRS + merkez,
>   1 km doğu, 1 km kuzey için WGS84 kontrol noktaları). Görüntüleyici
>   800 m'lik karolar halinde GLB + tileset.json üretip zip'liyor; kök dönüşüm
>   afin uydurma → meridyen yakınsaması/ölçek → WGS84 ENU→ECEF. Ağaçlar
>   EXT_mesh_gpu_instancing. Jeoit için yükseklik ofseti alanı var. Testler:
>   UTM'e karşı < 10 cm; GLB'ler Khronos glTF doğrulayıcısından hatasız.
>   CityJSON ve Google Photorealistic 3D Tiles bağlamı kaldı.
> - **5.4 Görünüm linki:** kamera (+ saat) URL hash'inde (`#view=`), "Copy
>   view link" ile kopyalanıyor; link açılınca o görünüme gidiyor.
>   GitHub/GitLab Pages yayınlama kaldı.
> - **5.5 Yüksek çözünürlüklü görüntü:** ekran / 2x / 4K / 8K; ekran boyutlu
>   karolar (`setViewOffset`) birleştiriliyor, ek yok. 4K MP4 (WebCodecs)
>   kaldı.
> - **Kalan:** 5.6 WebXR, 5.7 QGIS içi önizleme paneli.
>
> **Durum (ikinci tur) — Faz 5'in kalanı:**
> - **Görüş alanı (viewshed):** Analiz → "Viewshed from a point", sahnede
>   gözlemci noktası tıklanıyor; göz yüksekliğinde (1,6 m) altı adet 90°
>   derinlik görünümü (küp) ile yarıçap içindeki tüm sokak/meydan/çatılar
>   görünür/görünmez işaretleniyor, lejantta görünür oran. Aynı GPU hattı,
>   perspektif görünümler için doğrusal mesafe testi.
> - **İki senaryo karşılaştırması:** B kural seti (TAKS, KAKS, Hmax, çekme)
>   ve "Split: B | A"; tablo mevcut / A / B.
> - **Düzeltme:** imar zarfları (Show Zoning Envelopes) hiç çizilmiyordu
>   (çokgen listesi tek çokgen yerine geçiyordu); her parça kendi zemininde.
> - **CityJSON 2.0:** binalar LoD1 katı (avlular, çok parçalı binalar
>   MultiSolid), dışa aktarım CRS'inde, öznitelikleriyle. Testler kapalı ve
>   dışa dönük kabuk kontrol ediyor; örnek çıktı CityJSON 2.0.2 şemasından
>   hatasız geçiyor, cjio okuyor.
> - **MP4 tur videosu:** keyframe turu her kare kendi zamanında (t = i/fps)
>   çiziliyor, WebCodecs ile tarayıcıda kodlanıp MP4'e paketleniyor
>   (mp4-muxer, MIT), altyazılar karelere işleniyor; 720p / 1080p / 4K.
>   H.264 yoksa VP9/AV1 (MP4 içinde). Test: 180 kare, 6 s, ffmpeg hatasız
>   çözüyor.
> - **Statik yayın:** taşınabilir paket kökte index.html (#view= korunur),
>   .nojekyll ve .gitlab-ci.yml ile GitHub/GitLab Pages ve Netlify'a olduğu
>   gibi yüklenebiliyor; README adımları anlatıyor.
> - **WebXR:** tarayıcı immersive VR destekliyorsa "Enter VR"; sokak
>   seviyesinde, mevcut bakış yönünde başlıyor, kumanda ile ışınlanma.
>   Gözlük olmadan yalnızca buton/geri düşüş test edildi.
> - **QGIS içi önizleme + canlı seçim:** eklenti menüsünde "3D preview
>   panel"; QtWebEngine varsa görüntüleyici QGIS içinde, yoksa tarayıcıda.
>   Seçim iki yönlü: QGIS'te seçilen bina 3D'de turuncu vurgulanıp kameraya
>   alınıyor; görüntüleyicide tıklanan bina QGIS'te seçilip harita ona
>   kayıyor. Eşleştirme konuma göre (çokgen içi nokta, dışa aktarım CRS'i),
>   kimlik gerekmiyor. Sunucu tarafı köprü Python testli; uçtan uca test
>   gerçek PlanX sunucusuyla yapıldı. QGIS paneli burada QGIS olmadığı için
>   denenmedi.

1. **Gerçek zamanlı analizler (GPU)** — gökyüzü görüş faktörü (SVF), güneşlenme saatleri ısı haritası (21 Aralık / 21 Haziran), görüş alanı (viewshed), gölge süresi — hepsi GPU render-to-texture ile saniyeler içinde.
2. **İmar senaryoları** — TAKS/KAKS/Hmax parametreleriyle "ne olur" modu; A/B senaryo kaydırıcılı karşılaştırma (split-screen).
3. **3D Tiles / CityGML / CityJSON içe-dışa aktarım** — OGC 3D Tiles 1.1 çıktısı (Cesium, ArcGIS, Unreal ile uyum); Google Photorealistic 3D Tiles bağlam katmanı (API anahtarı kullanıcıdan).
4. **Paylaşım** — tek tıkla statik web paketi (zaten ZIP var) + GitHub/GitLab Pages yayınlama; sahne URL'sine kamera durumu gömme.
5. **Video/görsel çıktısı** — keyframe turundan 4K MP4 (WebCodecs), yüksek çözünürlüklü tiled screenshot (8K+).
6. **VR/AR** — WebXR ile sahnede yürüme (Quest tarayıcısı).
7. **QGIS içi önizleme** — `QWebEngineView` paneli; QGIS'te seçilen obje 3D'de vurgulansın (çift yönlü senkron).

## Faz 6 — Mühendislik altyapısı (Faz 1 ile paralel başlamalı)

> **Durum (Ekim 2026, ilk tur):**
> - **6.4 Lint + tip kontrolü:** `package.json` (yalnız geliştirme; eklenti
>   zip'ine girmez) ile ESLint, TypeScript ve Playwright sabit sürümlü.
>   ESLint bir yinelenen renk anahtarı ('Olive') ve ölü kod buldu (91 satır
>   silindi). `tsc --checkJs` `// @ts-check` ile işaretli 16+ modülü JSDoc
>   tipleriyle kontrol ediyor (vendor kütüphaneler tipsiz sayılıyor).
> - **6.2 Benchmark CI'da:** 1000 binalık deterministik şehir; çizim
>   çağrısı, üçgen ve mesh sayısı tabandan %10'dan fazla artarsa CI kırmızı
>   (`tests/bench/baseline.json`); süreler raporlanıyor, yalnız 3 kat
>   yavaşlamada kırmızı (CI makineleri değişken).
> - **6.3 Görsel regresyon:** dört sabit kamera (gündüz, sokak, gece,
>   Clean), doğrudan WebGL tuvalinden (arayüz/yazı tipi yok), trafik/insan
>   ve GTAO kapalı (rastgelelik yok); 24 seviye / %1,5 piksel toleransı,
>   fark görüntüleri CI artefaktı. Ardışık çalıştırmalarda piksel aynı.
> - **6.1 app.js bölme (ilk tur):** 11.157 → 9.691 satır; kod olduğu gibi
>   `ui_text.js`, `catalog.js`, `geo.js`, `props.js`, `textures.js`
>   modüllerine taşındı (döngüsel import yok: alan eşlemesi ve anizotropi
>   enjekte ediliyor). Görsel testler piksel aynı, yapı metrikleri aynı.
>
> **Durum (Ekim 2026, ikinci tur — Faz 6 tamamlandı):**
> - **6.1 app.js bölme (tamam):** 9.691 → ~900 satır (yalnız açılış, yürüme
>   modu ve kare döngüsü). Birden çok modülün değiştirdiği 50 değişken
>   (sahne merkezi, yüklenen veri, arazi, trafik verisi, etkileşim modları)
>   `core/state.js` içindeki `state` nesnesine taşındı; yerinde değişen
>   nesneler (sahne, katman grupları, ayarlar) kendi modüllerinden sabit
>   olarak dışa aktarılıyor. Yeni klasörler: `core/` (sahne, durum, ayarlar,
>   çizim, veri yükleme, sahne kurulumu, sahne durumu senkronu, model
>   deposu), `terrain/`, `layers/` (bina, zemin, ağaç, anıt, donatı,
>   ulaşım, imar, emisyon, çevre), `analysis/`, `ui/` (dock'lar, Model
>   Studio, tur, seçim, görünüm bağlantıları, dışa aktarma, kayıt, minimap,
>   gösterge paneli, yer imleri, QGIS bağlantısı). Döngüsel import yok:
>   sahne kurulumu arayüzü kancalarla (`setSceneBuildHooks`), ayar
>   kaydı sahne durumu senkronunu `setAfterSave` ile çağırıyor. Taşıma
>   kapsam analizine dayalı bir araçla yapıldı (kod metni aynen taşındı);
>   görsel testler piksel aynı, yapı metrikleri aynı.
> - **UI duman testi (`tests/smoke`, CI'da):** tüm dock'ları açar, her
>   dock ayarını değiştirir, güneş/gökyüzü/görüş analizlerini, senaryo
>   görünümlerini, yer imlerini, tur düzenleyiciyi, Model Studio'yu, bina
>   seçimini, ekran görüntüsünü, CityJSON ve 3D Tiles dışa aktarımını
>   çalıştırır; herhangi bir sayfa veya konsol hatasında kırmızı. Bölme
>   sırasında modül yoluna göre çözülen `import()` yollarının kırıldığını
>   bu test yakaladı; artık bir birim testi tüm göreli import'ları
>   denetliyor. Benchmark verisi de coğrafi referans taşıyor (3D Tiles
>   dışa aktarımı test edilebiliyor).
> - Kalan Türkçe iki yorum ("Sapan Modu") temizlendi.

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
