# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import unicodedata

from qgis.PyQt.QtCore import QDateTime, Qt, QUrl, pyqtSignal
from qgis.PyQt.QtGui import QColor, QDesktopServices
from qgis.PyQt.QtWidgets import (
    QCheckBox,
    QColorDialog,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QApplication,
    QDoubleSpinBox,
    QFormLayout,
    QFrame,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QLineEdit,
    QScrollArea,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)
from qgis.core import (
    Qgis,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsMapLayerProxyModel,
    QgsProject,
    QgsWkbTypes,
)
from qgis.gui import QgsMapLayerComboBox

from .exporter import (
    LABELS,
    MODE_RASTER_TEXTURE,
    MODE_VECTOR,
    OPTIONAL_INPUTS,
    recommended_inputs_for_mode,
    required_inputs_for_mode,
    validate_inputs,
)
from .style_tools import (
    BLOCK_STYLE_FIELDS,
    BUILDING_STYLE_FIELDS,
    apply_values_to_selected,
    ensure_fields,
)


EXPECTED_GEOMETRIES = {
    "roi": "Polygon",
    "plan_texture": "Raster",
    "basemap": "Raster",
    "roads": "Line",
    "buildings": "Polygon",
    "blocks": "Polygon",
    "parcels": "Polygon",
    "trees": "Point",
    "hardscape": "Polygon",
    "sidewalks": "Polygon",
    "pedestrian_paths": "Line/Polygon",
    "bike_lanes": "Line/Polygon",
    "lights": "Point",
    "benches": "Point",
    "trashbins": "Point",
    "busstops": "Point",
    "fences": "Polygon",
    "waterlines": "Line",
    "mosques": "Point",
    "tumulus": "Point",
}

RECOMMENDED_BUILDING_FIELDS = ("katadedi", "uipfonksiyon")

FIELD_MAPPING_DEFS = (
    ("road_hierarchy_field", "roads", "Road hierarchy/type field", "Road class such as arterial, street, service road, pedestrian way. / Yol sinif bilgisi."),
    ("road_width_field", "roads", "Road width field (metres)", "Per-feature road width in metres. Sidewalks subtract ~3 m total (1.5 m each side) and final width is clamped to 5-20 m. / Metre cinsinden yol genisligi; kaldirim payi cikarilir."),
    ("building_population_field", "buildings", "Building population field", "Optional population value; otherwise the viewer estimates from dwellings and area. / Bina nufusu."),
    ("building_dwelling_field", "buildings", "Building dwelling field", "Dwelling or housing-unit count. / Daire veya konut birimi sayisi."),
    ("building_vehicle_field", "buildings", "Building vehicle field", "Estimated or calculated vehicle count. / Tahmini ya da hesapli arac sayisi."),
    ("building_floors_field", "buildings", "Building floor count field", "Number of storeys; building height = floor count x floor height. Fallback column names include katadedi, kat, floors, levels. / Kat sayisi; bina yuksekligi = kat sayisi x kat yuksekligi. Varsayilan sutun adlari: katadedi, kat."),
    ("building_floor_area_field", "buildings", "Building gross floor area field", "Gross floor area or FAR-derived area. / Toplam insaat ya da emsal alani."),
    ("landuse_function_field", "buildings", "Land-use/function field", "Building use/function; used when uipfonksiyon is not available. / Kullanim fonksiyonu."),
    ("odor_source_field", "buildings", "Odor/noise source field", "Helps detect industry, waste, storage or treatment sources for wind/noise screening. / Koku-gurultu kaynak ipucu."),
    ("tree_height_field", "trees", "Tree height field", "Tree height in meters; fallback names include height, boy and yukseklik. / Agac boyu."),
    ("light_angle_field", "lights", "Light direction field", "Direction angle in degrees; otherwise aligned to the nearest road axis. / Yon acisi."),
    ("bench_angle_field", "benches", "Bench direction field", "Direction angle in degrees; otherwise aligned beside the nearest road axis. / Bank yonu."),
    ("trashbin_angle_field", "trashbins", "Trash bin direction field", "Direction angle in degrees; otherwise aligned to the nearest road axis. / Cop kutusu yonu."),
    ("busstop_angle_field", "busstops", "Bus stop direction field", "Direction angle in degrees; otherwise aligned beside the nearest road axis. / Durak yonu."),
    ("block_category_field", "blocks", "Block category field", "Field containing block functions or landuse categories (e.g. residential, park, school, sport, water). / Ada kategori sutunu."),
    ("waterline_width_field", "waterlines", "Waterline width field (metres)", "Per-feature stream/waterline width in metres. / Akarsu/su hattı genişlik sütunu."),
)

ASSET_THEME_OPTIONS = (
    "Modern Urban",
    "Modern Turkish",
    "Mediterranean",
    "Campus",
    "Eco",
    "Dense Urban",
    "Civic Heritage",
    "Coastal Light",
)

ASSET_POOL_CATEGORIES = (
    ("pedestrians", "Pedestrians"),
    ("cars", "Cars"),
    ("trees", "Trees"),
    ("lights", "Lights"),
    ("benches", "Benches"),
    ("bins", "Trash bins"),
    ("busstops", "Bus stops"),
    ("facades", "Facades"),
    ("roofs", "Roofs"),
    ("paving", "Paving"),
)

TREE_VARIANT_OPTIONS = (
    "Street Linden",
    "Plane",
    "Compact Maple",
    "Columnar",
    "Olive",
    "Cypress",
    "Palm",
    "Jacaranda",
    "Pine",
    "Broadleaf",
)
TREE_VARIANT_DEFAULT_COUNT = 8
TREE_VARIANT_MIN_COUNT = 1
TREE_VARIANT_MAX_COUNT = len(TREE_VARIANT_OPTIONS)
TREE_RENDER_MODE_OPTIONS = (
    ("Stylized", "Stylized (Fast)"),
    ("Realistic", "Realistic (Enhanced)"),
    ("Model-based", "Model-based (3D GLB)"),
)

AUTO_MATCH_ALIASES = {
    "dem": ("dem", "mydem", "elevation", "yukseklik", "yukseklik modeli"),
    "plan_texture": ("plan", "siteplan", "yerlesim plani", "nazim", "uygulama", "texture", "pafta"),
    "basemap": ("basemap", "base map", "xyz", "tile", "tiles", "google", "osm", "openstreetmap", "uydu", "satellite", "altlik", "altlık"),
    "roi": ("roi", "sinir", "calisma", "alan", "boundary"),
    "roads": ("roads", "road", "yol", "yollar", "aks", "myroads"),
    "buildings": ("buildings", "building", "bina", "binalar", "yapi", "yapilar", "mybuildings"),
    "blocks": ("blocks", "block", "ada", "adalar", "myblocks"),
    "parcels": ("parcels", "parcel", "parsel", "parseller", "myparcels"),
    "trees": ("trees", "tree", "agac", "agaclar", "mytrees"),
    "hardscape": ("hardscape", "sert", "zemin", "myhardscape"),
    "sidewalks": ("sidewalk", "sidewalks", "kaldirim", "kaldirimlar", "kaldırım", "kaldırımlar", "yaya kaldirimi", "mysidewalks"),
    "pedestrian_paths": ("path", "paths", "patika", "patikalar", "walkway", "footpath", "pedestrian", "pedestrian_paths", "yaya yolu", "yaya yollari", "yaya yolları", "mypedestrian_paths"),
    "bike_lanes": ("bike", "bicycle", "cycleway", "cycle lane", "bike lane", "bisiklet", "bisiklet yolu", "bisiklet_yolu", "mybikelanes"),
    "lights": ("lights", "light", "aydinlatma", "lamba", "mylights"),
    "benches": ("benches", "bench", "bank", "mybenches"),
    "trashbins": ("trashbins", "trash", "bin", "cop", "mytrashbins"),
    "busstops": ("busstops", "bus", "durak", "mybusstops"),
    "fences": ("fences", "fence", "border", "borders", "wall", "walls", "cit", "çit", "myfences"),
    "waterlines": ("waterlines", "waterline", "stream", "streams", "river", "rivers", "dere", "akarsu", "mywaterlines"),
    "mosques": ("mosque", "mosques", "cami", "camiler", "mymosques"),
    "tumulus": ("tumulus", "tumuli", "tumulusler", "tümülüs", "tumulus noktalari", "hoyuk", "höyük", "mytumulus"),
}

SMART_FIELD_ALIASES = {
    "building_floors_field": ("katadedi", "kat", "kat_sayisi", "floors", "levels", "storeys", "floor_count"),
    "building_population_field": ("nufus", "nüfus", "population", "pop", "bina_nufus"),
    "building_dwelling_field": ("daire", "konut", "dwelling", "dwellings", "housing_units"),
    "building_floor_area_field": ("aream2", "area_m2", "floor_area", "insaat_alani", "gfa"),
    "tree_height_field": ("height", "boy", "yukseklik", "yükseklik", "tree_height"),
    "road_width_field": ("genislik", "genişlik", "width", "yol_genisligi", "right_of_way"),
    "landuse_function_field": ("uipfonksiyon", "fonksiyon", "landuse", "function", "kullanim", "kullanım"),
    "block_category_field": ("ada_kategori", "kategori", "block_type", "category"),
    "road_hierarchy_field": ("yol_turu", "yol_tipi", "hierarchy", "road_type", "class"),
    "waterline_width_field": ("width", "genislik", "genişlik", "stream_width"),
}


def _is_qgis4() -> bool:
    return int(getattr(Qgis, "QGIS_VERSION_INT", 0)) >= 40000


IS_QGIS4 = _is_qgis4()
DIALOG_DEFAULT_SIZE = (960, 700) if IS_QGIS4 else (980, 720)
NAV_WIDTH = 160 if IS_QGIS4 else 170
PAGE_MIN_HEIGHT = 360 if IS_QGIS4 else 420
GUIDE_SUMMARY_MIN_HEIGHT = 200 if IS_QGIS4 else 220
INPUT_LABEL_MIN_WIDTH = 216 if IS_QGIS4 else 240
DIALOG_ACCEPTED = int(getattr(getattr(QDialog, "DialogCode", QDialog), "Accepted", getattr(QDialog, "Accepted", 1)))
CHECKED_STATE = getattr(getattr(Qt, "CheckState", Qt), "Checked", getattr(Qt, "Checked", 2))
UNCHECKED_STATE = getattr(getattr(Qt, "CheckState", Qt), "Unchecked", getattr(Qt, "Unchecked", 0))
ITEM_FLAG_ENABLED = getattr(getattr(Qt, "ItemFlag", Qt), "ItemIsEnabled", getattr(Qt, "ItemIsEnabled", 32))
ITEM_FLAG_USER_CHECKABLE = getattr(
    getattr(Qt, "ItemFlag", Qt),
    "ItemIsUserCheckable",
    getattr(Qt, "ItemIsUserCheckable", 16),
)


class PlanX3DCityDialog(QDialog):
    exportRequested = pyqtSignal(dict)
    stopServerRequested = pyqtSignal()
    reopenViewerRequested = pyqtSignal()
    portableExportRequested = pyqtSignal()
    portableZipRequested = pyqtSignal()

    def __init__(self, iface, web_root: str, parent=None):
        super().__init__(parent)
        self.iface = iface
        self.web_root = web_root
        self.layer_boxes = {}
        self.badge_labels = {}
        self.field_mapping_combos = {}
        self.last_url = ""
        self.setWindowTitle("PlanX 3D City Publisher")
        self.resize(*DIALOG_DEFAULT_SIZE)
        self._build_ui()
        self._auto_match_layers_quiet()
        self._refresh_report()

    def selected_layers(self) -> dict:
        payload = {key: box.currentLayer() for key, box in self.layer_boxes.items()}
        payload["mode"] = self._current_mode()
        if hasattr(self, "basemap_size_combo"):
            payload["basemap_export_size"] = int(self.basemap_size_combo.currentData() or 4096)
        if hasattr(self, "road_access_field_combo"):
            payload["road_access_field"] = self.road_access_field_combo.currentData() or ""
        if hasattr(self, "road_no_car_values"):
            payload["road_no_car_values"] = self.road_no_car_values.text().strip()
        if hasattr(self, "road_vehicle_values"):
            payload["road_vehicle_values"] = self.road_vehicle_values.text().strip()
        for key, combo in getattr(self, "field_mapping_combos", {}).items():
            payload[key] = combo.currentData() or ""
        if hasattr(self, "asset_theme_combo"):
            payload["asset_theme"] = self.asset_theme_combo.currentData() or "Modern Urban"
        if hasattr(self, "flatten_islands_check"):
            payload["flatten_islands"] = bool(self.flatten_islands_check.isChecked())
        if hasattr(self, "plateau_transition_spin"):
            payload["island_plateau_transition"] = float(self.plateau_transition_spin.value())
        asset_pool_counts = {}
        for key, combo in getattr(self, "asset_pool_count_combos", {}).items():
            asset_pool_counts[key] = int(combo.currentData() or 4)
        if asset_pool_counts:
            payload["asset_pool_counts"] = asset_pool_counts
        if hasattr(self, "tree_randomize_check"):
            payload["tree_randomize_enabled"] = bool(self.tree_randomize_check.isChecked())
        if hasattr(self, "tree_random_variant_count_combo"):
            try:
                payload["tree_random_variant_count"] = int(self.tree_random_variant_count_combo.currentData() or TREE_VARIANT_DEFAULT_COUNT)
            except (TypeError, ValueError):
                payload["tree_random_variant_count"] = TREE_VARIANT_DEFAULT_COUNT
        if hasattr(self, "tree_height_random_expr"):
            payload["tree_height_random_expr"] = self.tree_height_random_expr.text().strip()
        if hasattr(self, "tree_render_mode_combo"):
            payload["tree_render_mode"] = self.tree_render_mode_combo.currentData() or "Stylized"
        if hasattr(self, "tree_variant_list"):
            payload["tree_variants"] = self._selected_tree_variants()
        return payload

    def set_status(self, text: str, error: bool = False) -> None:
        self.status_label.setText(text)
        self.status_label.setProperty("error", error)
        self.status_label.style().unpolish(self.status_label)
        self.status_label.style().polish(self.status_label)

    def set_publish_summary(self, url: str, written: list[str], empty_optionals: list[str]) -> None:
        self.last_url = url
        self.url_label.setText(url or "-")
        self.url_label.setTextInteractionFlags(
            self.url_label.textInteractionFlags() | Qt.TextInteractionFlag.TextSelectableByMouse
        )
        self.publish_time_label.setText(QDateTime.currentDateTime().toString("yyyy-MM-dd HH:mm:ss"))
        self.files_label.setText(str(len(written)))
        self.empty_label.setText(", ".join(empty_optionals) if empty_optionals else "None")
        self.publish_report.setHtml(
            "<h3>Last publish summary</h3>"
            f"<p><b>Viewer:</b> {url}</p>"
            f"<p><b>Written files:</b> {len(written)}</p>"
            f"<p><b>Empty optional layers:</b> {', '.join(empty_optionals) if empty_optionals else 'None'}</p>"
        )

    def set_portable_summary(self, output_dir: str, file_count: int) -> None:
        self.publish_report.setHtml(
            "<h3>Portable viewer folder is ready</h3>"
            f"<p><b>Folder:</b> {output_dir}</p>"
            f"<p><b>Copied files:</b> {file_count}</p>"
            "<p>This folder contains the viewer app, vendor libraries and the latest exported data for presentation or handoff.</p>"
            "<p><b>Open command:</b> <code>py -3 -m http.server 8080</code>, then browse to "
            "<code>http://127.0.0.1:8080/src/</code></p>"
        )
        self.set_status(f"Portable viewer folder created: {output_dir}")

    def set_portable_zip_summary(self, zip_path: str, file_count: int) -> None:
        self.publish_report.setHtml(
            "<h3>Portable viewer ZIP is ready</h3>"
            f"<p><b>ZIP:</b> {zip_path}</p>"
            f"<p><b>Packaged files:</b> {file_count}</p>"
            "<p>This ZIP can be opened on another computer and launched with <code>Start-PlanX-Viewer.bat</code>. "
            "If a tour JSON was included, it will be ready in Narrative Studio when the viewer opens.</p>"
        )
        self.set_status(f"Portable viewer ZIP created: {zip_path}")

    def _build_ui(self) -> None:
        hero_title_size = 21 if IS_QGIS4 else 22
        group_radius = 7 if IS_QGIS4 else 8
        nav_item_padding = 10 if IS_QGIS4 else 12
        self.setStyleSheet("""
            QDialog { background: #f4f7fb; color: #243044; }
            QListWidget {
                background: #102027;
                color: #dce9ed;
                border: none;
                border-radius: 10px;
                padding: 8px;
                font-weight: 600;
            }
            QListWidget::item { padding: %(nav_item_padding)dpx 10px; border-radius: 7px; }
            QListWidget::item:selected { background: #0f766e; color: white; }
            QGroupBox {
                border: 1px solid #d8e0ea;
                border-radius: %(group_radius)dpx;
                margin-top: 12px;
                padding: 12px 10px 10px 10px;
                background: white;
                font-weight: 700;
            }
            QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 6px; }
            QLabel { color: #334155; }
            QLabel#heroTitle { font-size: %(hero_title_size)dpx; font-weight: 800; color: #12343b; }
            QLabel#heroSub { color: #64748b; }
            QLabel#statusLabel {
                background: #e9f7f3;
                color: #176b54;
                border: 1px solid #bfe8dc;
                border-radius: 8px;
                padding: 9px 12px;
            }
            QLabel#statusLabel[error="true"] {
                background: #fff1f2;
                color: #be123c;
                border-color: #fecdd3;
            }
            QLabel.badge {
                border-radius: 10px;
                padding: 3px 8px;
                font-weight: 700;
                min-width: 74px;
            }
            QPushButton {
                min-height: 32px;
                border-radius: 7px;
                padding: 6px 12px;
                background: white;
                border: 1px solid #cbd5e1;
            }
            QPushButton:hover { background: #eef6f4; border-color: #0f766e; }
            QPushButton#primaryButton {
                color: white;
                background: #0f766e;
                border: 1px solid #0f766e;
                font-weight: 700;
            }
            QPushButton#primaryButton:hover { background: #115e59; }
            QTextBrowser {
                border: 1px solid #d8e0ea;
                border-radius: %(group_radius)dpx;
                background: white;
                padding: 10px;
            }
        """ % {
            "hero_title_size": hero_title_size,
            "group_radius": group_radius,
            "nav_item_padding": nav_item_padding,
        })

        shell = QHBoxLayout(self)
        shell.setContentsMargins(8, 8, 8, 8)
        shell.setSpacing(10)
        self.nav = QListWidget()
        self.nav.setFixedWidth(NAV_WIDTH)
        for label in ("0 Guide", "1 Data", "2 Check", "3 Style", "4 Publish"):
            QListWidgetItem(label, self.nav)
        self.nav.setCurrentRow(0)
        shell.addWidget(self.nav)

        content = QVBoxLayout()
        content.setSpacing(8)
        hero = QVBoxLayout()
        title_row = QHBoxLayout()
        title = QLabel("PlanX 3D City Publisher")
        title.setObjectName("heroTitle")

        self.hero_export_btn = QPushButton("Export & Open 3D Viewer")
        self.hero_export_btn.setObjectName("primaryButton")
        self.hero_export_btn.setToolTip("Export currently mapped layers and open the 3D City Viewer in your browser.")
        self.hero_export_btn.clicked.connect(lambda: self.exportRequested.emit(self.selected_layers()))

        title_row.addWidget(title)
        title_row.addStretch(1)
        title_row.addWidget(self.hero_export_btn)

        subtitle = QLabel(
            "Validate QGIS layers, map attributes, style selected features and publish the 3D viewer in one workflow. "
            "Turkish guidance is included as secondary text where it helps data preparation."
        )
        subtitle.setObjectName("heroSub")
        subtitle.setWordWrap(True)
        hero.addLayout(title_row)
        hero.addWidget(subtitle)
        content.addLayout(hero)

        raw_pages = [
            self._make_guide_page(),
            self._make_data_page(),
            self._make_check_page(),
            self._make_style_page(),
            self._make_publish_page(),
        ]
        self.pages = [self._scrollable_page(page) for page in raw_pages]
        for i, page in enumerate(self.pages):
            page.setVisible(i == 0)
            content.addWidget(page)

        self.status_label = QLabel("Ready. Open the guide for the full workflow, or start from Data to publish a scene.")
        self.status_label.setObjectName("statusLabel")
        self.status_label.setWordWrap(True)
        content.addWidget(self.status_label)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        buttons.rejected.connect(self.reject)
        content.addWidget(buttons)
        shell.addLayout(content, 1)
        self.nav.currentRowChanged.connect(self._switch_page)

    def _scrollable_page(self, page: QWidget) -> QScrollArea:
        scroll = QScrollArea()
        scroll.setWidget(page)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setMinimumHeight(PAGE_MIN_HEIGHT)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        return scroll

    def _guide_path(self) -> str:
        return os.path.join(os.path.dirname(__file__), "docs", "user_guide.html")

    def _open_html_guide(self) -> None:
        path = self._guide_path()
        if not os.path.exists(path):
            self.set_status(f"Guide file was not found: {path}", error=True)
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))
        self.set_status("Opened the PlanX 3D City HTML user guide in your browser.")

    def _make_guide_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)

        guide_group = QGroupBox("Guide / Documentation")
        guide_layout = QVBoxLayout(guide_group)
        summary = QTextBrowser()
        summary.setOpenExternalLinks(True)
        summary.setHtml(
            "<h2>PlanX 3D City Viewer Guide</h2>"
            "<p>This plugin can publish a complete vector city model, a DEM-only terrain scene, "
            "or a DEM-less flat presentation plane. The full HTML guide explains layer preparation, "
            "OpenStreetMap import, terrain and ROI texture behavior, styling, publishing, portable export, "
            "and troubleshooting.</p>"
            "<p><b>Recommended reading order:</b> quick start, data contracts, terrain strategy, "
            "style controls, publish workflow, then troubleshooting.</p>"
        )
        summary.setMinimumHeight(GUIDE_SUMMARY_MIN_HEIGHT)
        self.open_guide_button = QPushButton("Open full HTML guide")
        self.open_guide_button.setObjectName("primaryButton")
        self.open_guide_button.clicked.connect(self._open_html_guide)
        guide_layout.addWidget(summary)
        guide_layout.addWidget(self.open_guide_button)
        root.addWidget(guide_group)
        root.addStretch(1)
        return page

    def _make_data_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)

        required_group = QGroupBox("Data layers / Veri katmanlari")
        required_grid = QGridLayout(required_group)
        mode_label = QLabel(
            "<b>Publish mode</b><br><span style='color:#64748b'>Vector plan workflow or raster plan texture workflow. / "
            "Vektor plan veya raster plan texture akisi.</span>"
        )
        self.mode_combo = QComboBox()
        self.mode_combo.addItem("Vector Plan Mode", MODE_VECTOR)
        self.mode_combo.addItem("Raster Plan Texture Mode", MODE_RASTER_TEXTURE)
        required_grid.addWidget(mode_label, 0, 0)
        required_grid.addWidget(self.mode_combo, 0, 1)
        required_grid.addWidget(QLabel(""), 0, 2)
        for row, key in enumerate(("dem", "plan_texture", "roi", "roads", "buildings", "blocks", "parcels"), start=1):
            self._add_layer_row(required_grid, row, key, required=(key != "plan_texture"))
        self._add_road_access_row(required_grid, 8)
        root.addWidget(required_group)

        mapping_group = QGroupBox("Field mapping / Analysis attributes")
        mapping_grid = QGridLayout(mapping_group)
        for row, (key, layer_key, label, help_text) in enumerate(FIELD_MAPPING_DEFS):
            self._add_field_mapping_row(mapping_grid, row, key, layer_key, label, help_text)
        root.addWidget(mapping_group)

        basemap_group = QGroupBox("Optional QGIS basemap / XYZ background")
        basemap_grid = QGridLayout(basemap_group)
        self._add_layer_row(basemap_grid, 0, "basemap", required=False)
        basemap_size_label = QLabel(
            "<b>Basemap export size</b><br><span style='color:#64748b'>Higher values are sharper but slower and produce larger PNG textures. / "
            "Yuksek deger daha net ama daha yavas ve buyuk PNG uretir.</span>"
        )
        basemap_size_label.setWordWrap(True)
        self.basemap_size_combo = QComboBox()
        for size in (1024, 2048, 4096, 8192):
            self.basemap_size_combo.addItem(f"{size} x {size}", size)
        self.basemap_size_combo.setCurrentIndex(2)
        basemap_grid.addWidget(basemap_size_label, 1, 0)
        basemap_grid.addWidget(self.basemap_size_combo, 1, 1)
        basemap_grid.addWidget(QLabel("Optional"), 1, 2)
        root.addWidget(basemap_group)

        optional_group = QGroupBox("Optional enrichment layers / Opsiyonel zenginlestirme")
        optional_grid = QGridLayout(optional_group)
        for row, key in enumerate(OPTIONAL_INPUTS):
            self._add_layer_row(optional_grid, row, key, required=False)
        root.addWidget(optional_group)

        actions = QHBoxLayout()
        self.sample_button = QPushButton("Try with sample data")
        self.sample_button.setToolTip(
            "Generate a tiny synthetic DEM + block + building + road dataset in EPSG:32635 "
            "and load it into the current QGIS project. Great for a first run."
        )
        self.save_preset_button = QPushButton("Save preset")
        self.save_preset_button.setToolTip(
            "Save the current layer mappings, field mappings, asset theme and viewer defaults "
            "to a .planx JSON file you can reuse on another QGIS project."
        )
        self.load_preset_button = QPushButton("Load preset")
        self.load_preset_button.setToolTip(
            "Load a .planx preset and match its layer names against the current QGIS project."
        )
        self.osm_button = QPushButton("Import from OpenStreetMap")
        self.osm_button.setToolTip(
            "Fetch buildings, roads, parks, and trees from OpenStreetMap for a chosen bounding box. "
            "Layers are reprojected to a local UTM CRS and added to the current project."
        )
        self.auto_match_button = QPushButton("Auto-match layers")
        self.check_button = QPushButton("Generate quality report")
        self.export_button = QPushButton("Export and open 3D Viewer")
        self.export_button.setObjectName("primaryButton")
        actions.addWidget(self.auto_match_button)
        actions.addWidget(self.sample_button)
        actions.addWidget(self.osm_button)
        actions.addWidget(self.check_button)
        actions.addWidget(self.export_button)
        actions.addStretch(1)
        actions.addWidget(self.save_preset_button)
        actions.addWidget(self.load_preset_button)
        root.addLayout(actions)
        root.addStretch(1)

        self.sample_button.clicked.connect(self._load_sample_project)
        self.osm_button.clicked.connect(self._import_from_osm)
        self.save_preset_button.clicked.connect(self._save_preset)
        self.load_preset_button.clicked.connect(self._load_preset)
        self.auto_match_button.clicked.connect(self._auto_match_layers)
        self.check_button.clicked.connect(self._refresh_report)
        self.export_button.clicked.connect(lambda: self.exportRequested.emit(self.selected_layers()))
        self.mode_combo.currentIndexChanged.connect(self._refresh_report)
        return page

    def _add_field_mapping_row(self, grid: QGridLayout, row: int, key: str, layer_key: str, label_text: str, help_text: str) -> None:
        label = QLabel(f"<b>{label_text}</b><br><span style='color:#64748b'>{help_text}</span>")
        label.setWordWrap(True)
        combo = QComboBox()
        combo.addItem("Auto / fallback", "")
        combo.currentIndexChanged.connect(self._refresh_report)
        self.field_mapping_combos[key] = combo
        grid.addWidget(label, row, 0)
        grid.addWidget(combo, row, 1)
        grid.addWidget(QLabel(layer_key), row, 2)
        if layer_key in self.layer_boxes:
            self.layer_boxes[layer_key].layerChanged.connect(lambda _layer=None: self._sync_field_mapping_fields())

    def _add_road_access_row(self, grid: QGridLayout, row: int) -> None:
        label = QLabel(
            "<b>Road access field</b><br>"
            "<span style='color:#64748b'>Optional field with pedestrian/vehicle access values. If selected, cars avoid no-car pedestrian roads. / "
            "Yaya-tasit bilgisini iceren sutun; secilirse arabalar yaya yollarindan gecmez.</span>"
        )
        label.setWordWrap(True)
        box = QComboBox()
        box.addItem("No road access filter", "")
        self.road_access_field_combo = box
        grid.addWidget(label, row, 0)
        grid.addWidget(box, row, 1)
        grid.addWidget(QLabel("Optional"), row, 2)

        values_label = QLabel(
            "<b>No-car / vehicle keywords</b><br>"
            "<span style='color:#64748b'>Separate with commas. No-car keywords block vehicles unless a vehicle keyword is present. / "
            "Virgulle ayirin; yaya anahtari arac uretimini engeller.</span>"
        )
        values_label.setWordWrap(True)
        editors = QVBoxLayout()
        self.road_no_car_values = QLineEdit("yaya,pedestrian,foot,walk,path")
        self.road_vehicle_values = QLineEdit("tasit,taşıt,vehicle,car,arac,araç,motorlu")
        self.road_no_car_values.setPlaceholderText("No-car keywords")
        self.road_vehicle_values.setPlaceholderText("Vehicle keywords")
        editors.addWidget(self.road_no_car_values)
        editors.addWidget(self.road_vehicle_values)
        holder = QWidget()
        holder.setLayout(editors)
        grid.addWidget(values_label, row + 1, 0)
        grid.addWidget(holder, row + 1, 1)
        grid.addWidget(QLabel("Optional"), row + 1, 2)

        self.layer_boxes["roads"].layerChanged.connect(lambda _layer=None: self._sync_road_access_fields())
        self.road_access_field_combo.currentIndexChanged.connect(self._refresh_report)

    def _add_layer_row(self, grid: QGridLayout, row: int, key: str, required: bool) -> None:
        role = self._role_for_key(key, self._current_mode() if hasattr(self, "mode_combo") else MODE_VECTOR)
        label = QLabel(self._input_label_html(key, role))
        label.setMinimumWidth(INPUT_LABEL_MIN_WIDTH)
        label.setWordWrap(True)
        box = QgsMapLayerComboBox()
        box.setAllowEmptyLayer(True)
        box.setFilters(QgsMapLayerProxyModel.RasterLayer if key == "dem" else QgsMapLayerProxyModel.VectorLayer)
        if key in ("plan_texture", "basemap"):
            box.setFilters(QgsMapLayerProxyModel.RasterLayer)
        if role == "required":
            badge_text = "Missing"
        elif role == "recommended":
            badge_text = "Recommended"
        else:
            badge_text = "Optional"
        badge = QLabel(badge_text)
        badge.setProperty("class", "badge")
        badge.setStyleSheet(self._badge_style("missing" if role == "required" else ("recommended" if role == "recommended" else "optional")))
        box.layerChanged.connect(lambda _layer=None: self._refresh_report())
        self.layer_boxes[key] = box
        self.badge_labels[key] = badge
        if not hasattr(self, "input_labels"):
            self.input_labels = {}
        self.input_labels[key] = label
        grid.addWidget(label, row, 0)
        grid.addWidget(box, row, 1)
        grid.addWidget(badge, row, 2)

    def _make_check_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)
        row = QHBoxLayout()
        refresh = QPushButton("Refresh report")
        refresh.clicked.connect(self._refresh_report)
        row.addWidget(refresh)
        row.addStretch(1)
        root.addLayout(row)
        self.report_browser = QTextBrowser()
        root.addWidget(self.report_browser)
        return page

    def _make_style_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)

        intro = QLabel(
            "Write PlanX style fields to selected blocks or buildings only. Re-export the viewer to see the result. "
            "Bu islem yalniz secili feature'lari etkiler."
        )
        intro.setWordWrap(True)
        root.addWidget(intro)

        prep = QGroupBox("Style field preparation")
        prep_row = QHBoxLayout(prep)
        self.prepare_block_fields_btn = QPushButton("Create block style fields")
        self.prepare_building_fields_btn = QPushButton("Create building style fields")
        prep_row.addWidget(self.prepare_block_fields_btn)
        prep_row.addWidget(self.prepare_building_fields_btn)
        root.addWidget(prep)

        asset_group = QGroupBox("Asset Theme / Material Pool")
        asset_root = QVBoxLayout(asset_group)
        asset_intro = QLabel(
            "Theme selection controls only the visual variant pool in the web viewer; it never edits GIS geometry "
            "or attribute data. Viewer uses only the selected theme and active variant counts. / "
            "Tema yalniz gorsel havuzu belirler."
        )
        asset_intro.setWordWrap(True)
        asset_root.addWidget(asset_intro)
        theme_row = QHBoxLayout()
        self.asset_theme_combo = QComboBox()
        for theme in ASSET_THEME_OPTIONS:
            self.asset_theme_combo.addItem(theme, theme)
        self.asset_theme_reset_btn = QPushButton("Reset theme defaults")
        theme_row.addWidget(QLabel("Theme"))
        theme_row.addWidget(self.asset_theme_combo, 1)
        theme_row.addWidget(self.asset_theme_reset_btn)
        asset_root.addLayout(theme_row)
        pool_grid = QGridLayout()
        self.asset_pool_count_combos = {}
        for row, (key, label) in enumerate(ASSET_POOL_CATEGORIES):
            combo = QComboBox()
            pool_values = range(1, TREE_VARIANT_MAX_COUNT + 1) if key == "trees" else (3, 4, 5)
            for count in pool_values:
                combo.addItem(str(count), count)
            if key == "trees":
                idx = combo.findData(TREE_VARIANT_DEFAULT_COUNT)
                combo.setCurrentIndex(idx if idx >= 0 else combo.count() - 1)
            else:
                combo.setCurrentIndex(1)
            self.asset_pool_count_combos[key] = combo
            pool_grid.addWidget(QLabel(label), row // 2, (row % 2) * 2)
            pool_grid.addWidget(combo, row // 2, (row % 2) * 2 + 1)
        asset_root.addLayout(pool_grid)

        tree_group = QGroupBox("Tree variants / randomization")
        tree_root = QVBoxLayout(tree_group)
        tree_help = QLabel(
            "Select tree types to include in the export. Randomization can mix multiple selected types, and "
            "height can be randomized with an expression like rand(1,7)."
        )
        tree_help.setWordWrap(True)
        tree_root.addWidget(tree_help)
        tree_mode_row = QHBoxLayout()
        tree_mode_row.addWidget(QLabel("Render mode"))
        self.tree_render_mode_combo = QComboBox()
        for value, label in TREE_RENDER_MODE_OPTIONS:
            self.tree_render_mode_combo.addItem(label, value)
        mode_idx = self.tree_render_mode_combo.findData("Stylized")
        self.tree_render_mode_combo.setCurrentIndex(mode_idx if mode_idx >= 0 else 0)
        tree_mode_row.addWidget(self.tree_render_mode_combo, 1)
        tree_root.addLayout(tree_mode_row)
        self.tree_variant_list = QListWidget()
        self.tree_variant_list.setMaximumHeight(160 if IS_QGIS4 else 180)
        for idx, name in enumerate(TREE_VARIANT_OPTIONS):
            item = QListWidgetItem(name)
            item.setFlags(item.flags() | ITEM_FLAG_ENABLED | ITEM_FLAG_USER_CHECKABLE)
            item.setCheckState(CHECKED_STATE if idx < TREE_VARIANT_DEFAULT_COUNT else UNCHECKED_STATE)
            self.tree_variant_list.addItem(item)
        tree_root.addWidget(self.tree_variant_list)

        tree_random_row = QHBoxLayout()
        self.tree_randomize_check = QCheckBox("Randomize trees")
        self.tree_randomize_check.setChecked(True)
        self.tree_random_variant_count_combo = QComboBox()
        for count in range(TREE_VARIANT_MIN_COUNT, TREE_VARIANT_MAX_COUNT + 1):
            self.tree_random_variant_count_combo.addItem(str(count), count)
        random_count_index = self.tree_random_variant_count_combo.findData(TREE_VARIANT_DEFAULT_COUNT)
        self.tree_random_variant_count_combo.setCurrentIndex(random_count_index if random_count_index >= 0 else 0)
        tree_random_row.addWidget(self.tree_randomize_check)
        tree_random_row.addWidget(QLabel("Variant count"))
        tree_random_row.addWidget(self.tree_random_variant_count_combo)
        tree_random_row.addStretch(1)
        tree_root.addLayout(tree_random_row)

        tree_height_row = QFormLayout()
        self.tree_height_random_expr = QLineEdit()
        self.tree_height_random_expr.setPlaceholderText("rand(1,7)")
        self.tree_height_random_expr.setToolTip("Examples: rand(1,7), rand(2.5,9)")
        tree_height_row.addRow("Height randomize", self.tree_height_random_expr)
        tree_root.addLayout(tree_height_row)
        asset_root.addWidget(tree_group)

        root.addWidget(asset_group)

        terrain_group = QGroupBox("Terrain shaping / Arazi sekillendirme")
        terrain_root = QVBoxLayout(terrain_group)
        terrain_intro = QLabel(
            "Optional viewer defaults for how block polygons sit on the DEM. The viewer can flatten the DEM under each block "
            "(plateau) and ramp back to surrounding terrain so blocks no longer interpenetrate sloped DEM. / "
            "Adalar altinda DEM duzlesir; kenarda yumusak ramp ile cevreye baglanir."
        )
        terrain_intro.setWordWrap(True)
        terrain_root.addWidget(terrain_intro)
        self.flatten_islands_check = QCheckBox("Flatten DEM under blocks (island plateau)")
        self.flatten_islands_check.setChecked(True)
        terrain_root.addWidget(self.flatten_islands_check)
        plateau_row = QHBoxLayout()
        plateau_row.addWidget(QLabel("Plateau edge ramp"))
        self.plateau_transition_spin = QDoubleSpinBox()
        self.plateau_transition_spin.setRange(0.0, 20.0)
        self.plateau_transition_spin.setSingleStep(1.0)
        self.plateau_transition_spin.setSuffix(" m")
        self.plateau_transition_spin.setValue(6.0)
        plateau_row.addWidget(self.plateau_transition_spin)
        plateau_row.addStretch(1)
        terrain_root.addLayout(plateau_row)
        root.addWidget(terrain_group)

        quick = QGroupBox("Quick style for selected features")
        form = QFormLayout(quick)
        self.block_texture_combo = QComboBox()
        self.block_texture_combo.addItems(["", "None", "SoftNoise", "FineGrid"])
        self.facade_combo = QComboBox()
        self.facade_combo.addItems(["", "UrbanA", "UrbanB", "UrbanC", "UrbanD"])
        self.roof_shape_combo = QComboBox()
        self.roof_shape_combo.addItems(["", "Flat", "Pyramid", "Gable", "Cone", "Prism"])
        self.roof_texture_combo = QComboBox()
        self.roof_texture_combo.addItems(["", "RoofA", "GermanTile", "TurkishTile", "USShingle"])
        self.color_btn = QPushButton("Pick color")
        self.roof_color_btn = QPushButton("Pick roof color")
        self.color_value = ""
        self.roof_color_value = ""
        form.addRow("Block/building color", self.color_btn)
        form.addRow("Block texture", self.block_texture_combo)
        form.addRow("Building facade", self.facade_combo)
        form.addRow("Roof shape", self.roof_shape_combo)
        form.addRow("Roof texture", self.roof_texture_combo)
        form.addRow("Roof color", self.roof_color_btn)
        root.addWidget(quick)

        apply_row = QHBoxLayout()
        self.apply_blocks_btn = QPushButton("Apply to selected blocks")
        self.apply_buildings_btn = QPushButton("Apply to selected buildings")
        self.apply_buildings_btn.setObjectName("primaryButton")
        apply_row.addWidget(self.apply_blocks_btn)
        apply_row.addWidget(self.apply_buildings_btn)
        root.addLayout(apply_row)

        self.style_report = QTextBrowser()
        self.style_report.setMaximumHeight(150)
        self.style_report.setHtml("<p>Style operations will be reported here.</p>")
        root.addWidget(self.style_report)
        root.addStretch(1)

        self.prepare_block_fields_btn.clicked.connect(self._prepare_block_fields)
        self.prepare_building_fields_btn.clicked.connect(self._prepare_building_fields)
        self.asset_theme_reset_btn.clicked.connect(self._reset_asset_theme_defaults)
        self.tree_randomize_check.toggled.connect(self._sync_tree_random_controls)
        self.tree_variant_list.itemChanged.connect(lambda _item=None: self._sync_tree_random_controls())
        self.tree_random_variant_count_combo.currentIndexChanged.connect(lambda _idx=None: self._sync_tree_random_controls())
        self._sync_tree_random_controls()
        self.apply_blocks_btn.clicked.connect(self._apply_block_style)
        self.apply_buildings_btn.clicked.connect(self._apply_building_style)
        self.color_btn.clicked.connect(lambda: self._pick_color("color"))
        self.roof_color_btn.clicked.connect(lambda: self._pick_color("roof"))
        return page

    def _make_publish_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)
        summary = QGroupBox("Last publish")
        form = QFormLayout(summary)
        self.url_label = QLabel("-")
        self.publish_time_label = QLabel("-")
        self.files_label = QLabel("0")
        self.empty_label = QLabel("-")
        form.addRow("Viewer URL", self.url_label)
        form.addRow("Published at", self.publish_time_label)
        form.addRow("Written files", self.files_label)
        form.addRow("Empty optionals", self.empty_label)
        root.addWidget(summary)

        actions = QHBoxLayout()
        self.copy_url_btn = QPushButton("Copy viewer URL")
        self.reopen_btn = QPushButton("Open in browser")
        self.open_folder_button = QPushButton("Open data folder")
        self.portable_button = QPushButton("Portable viewer folder")
        self.portable_zip_button = QPushButton("Portable ZIP")
        self.stop_button = QPushButton("Stop server")
        actions.addWidget(self.copy_url_btn)
        actions.addWidget(self.reopen_btn)
        actions.addWidget(self.open_folder_button)
        actions.addWidget(self.portable_button)
        actions.addWidget(self.portable_zip_button)
        actions.addWidget(self.stop_button)
        root.addLayout(actions)

        self.publish_report = QTextBrowser()
        self.publish_report.setHtml("<p>No publish has been created yet.</p>")
        root.addWidget(self.publish_report)
        root.addStretch(1)

        self.copy_url_btn.clicked.connect(self._copy_url)
        self.reopen_btn.clicked.connect(self.reopenViewerRequested.emit)
        self.open_folder_button.clicked.connect(self._open_output_folder)
        self.portable_button.clicked.connect(self.portableExportRequested.emit)
        self.portable_zip_button.clicked.connect(self.portableZipRequested.emit)
        self.stop_button.clicked.connect(self.stopServerRequested.emit)
        return page

    def _refresh_report(self) -> None:
        self._sync_road_access_fields()
        self._sync_field_mapping_fields()
        layer_map = self.selected_layers()
        html, has_error = self._build_quality_report(layer_map)
        if hasattr(self, "report_browser"):
            self.report_browser.setHtml(html)
        self._update_badges(layer_map)
        self.set_status(
            "Quality report updated." if not has_error else "Report contains warnings; review the Check page before publishing.",
            has_error,
        )

    def _save_preset(self) -> None:
        """Serialise the current dialog selections to a .planx JSON file."""
        import json
        from qgis.PyQt.QtWidgets import QFileDialog
        layer_map = self.selected_layers()
        # Replace QGIS layer objects with their display names (portable across projects).
        serialisable = {}
        for key, value in layer_map.items():
            if hasattr(value, "name") and callable(value.name):
                serialisable[key] = {"_layer_name": value.name()}
            elif isinstance(value, (str, int, float, bool, dict, list)) or value is None:
                serialisable[key] = value
            else:
                serialisable[key] = str(value)
        path, _ = QFileDialog.getSaveFileName(
            self,
            "Save PlanX preset",
            "planx_preset.planx",
            "PlanX preset (*.planx);;JSON (*.json)",
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as fh:
                json.dump({"planx_preset_version": 1, "data": serialisable}, fh, ensure_ascii=False, indent=2)
            self.set_status(f"Preset saved: {path}")
        except OSError as exc:
            QMessageBox.warning(self, "Save preset", f"Could not write preset: {exc}")

    def _load_preset(self) -> None:
        """Load a .planx preset and match its layer names to layers in the current project."""
        import json
        from qgis.PyQt.QtWidgets import QFileDialog
        path, _ = QFileDialog.getOpenFileName(
            self,
            "Load PlanX preset",
            "",
            "PlanX preset (*.planx);;JSON (*.json);;All files (*)",
        )
        if not path:
            return
        try:
            with open(path, "r", encoding="utf-8") as fh:
                payload = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            QMessageBox.warning(self, "Load preset", f"Invalid preset: {exc}")
            return

        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            QMessageBox.warning(self, "Load preset", "Preset payload missing or malformed.")
            return

        project_layers = list(QgsProject.instance().mapLayers().values())
        by_name = {layer.name(): layer for layer in project_layers}
        matched = []
        missing = []

        # Layer selections
        for key, box in self.layer_boxes.items():
            entry = data.get(key)
            if isinstance(entry, dict) and entry.get("_layer_name"):
                layer = by_name.get(entry["_layer_name"])
                if layer is not None:
                    box.setLayer(layer)
                    matched.append(f"{key}={entry['_layer_name']}")
                else:
                    missing.append(f"{key}({entry['_layer_name']})")

        # Mode
        if data.get("mode") and hasattr(self, "mode_combo"):
            idx = self.mode_combo.findData(data["mode"])
            if idx >= 0:
                self.mode_combo.setCurrentIndex(idx)

        # Asset theme
        if data.get("asset_theme") and hasattr(self, "asset_theme_combo"):
            idx = self.asset_theme_combo.findData(data["asset_theme"])
            if idx >= 0:
                self.asset_theme_combo.setCurrentIndex(idx)

        # Field mappings (FIELD_MAPPING_DEFS keys)
        for key, combo in getattr(self, "field_mapping_combos", {}).items():
            value = data.get(key)
            if value:
                idx = combo.findData(value)
                if idx >= 0:
                    combo.setCurrentIndex(idx)

        # Simple settings
        if hasattr(self, "flatten_islands_check") and "flatten_islands" in data:
            self.flatten_islands_check.setChecked(bool(data["flatten_islands"]))
        if hasattr(self, "plateau_transition_spin") and "island_plateau_transition" in data:
            try:
                self.plateau_transition_spin.setValue(float(data["island_plateau_transition"]))
            except (TypeError, ValueError):
                pass
        if hasattr(self, "basemap_size_combo") and "basemap_export_size" in data:
            idx = self.basemap_size_combo.findData(int(data["basemap_export_size"]))
            if idx >= 0:
                self.basemap_size_combo.setCurrentIndex(idx)
        if hasattr(self, "tree_randomize_check") and "tree_randomize_enabled" in data:
            self.tree_randomize_check.setChecked(bool(data["tree_randomize_enabled"]))
        if hasattr(self, "tree_random_variant_count_combo") and "tree_random_variant_count" in data:
            try:
                count = int(data["tree_random_variant_count"])
            except (TypeError, ValueError):
                count = TREE_VARIANT_DEFAULT_COUNT
            idx = self.tree_random_variant_count_combo.findData(count)
            if idx >= 0:
                self.tree_random_variant_count_combo.setCurrentIndex(idx)
        if hasattr(self, "tree_height_random_expr") and "tree_height_random_expr" in data:
            self.tree_height_random_expr.setText(str(data["tree_height_random_expr"] or ""))
        if hasattr(self, "tree_render_mode_combo") and "tree_render_mode" in data:
            idx = self.tree_render_mode_combo.findData(str(data["tree_render_mode"] or "Stylized"))
            if idx >= 0:
                self.tree_render_mode_combo.setCurrentIndex(idx)
        if hasattr(self, "tree_variant_list") and isinstance(data.get("tree_variants"), list):
            self._set_tree_variants([str(v) for v in data.get("tree_variants", []) if isinstance(v, str)])

        self._refresh_report()
        summary = f"Preset loaded ({len(matched)} layers matched"
        if missing:
            summary += f", missing in current project: {', '.join(missing[:5])}"
            if len(missing) > 5:
                summary += f" +{len(missing) - 5} more"
        summary += ")."
        self.set_status(summary, error=bool(missing))

    def _import_from_osm(self) -> None:
        try:
            from .osm_importer import OsmImportError, import_osm_bbox
        except Exception as exc:
            QMessageBox.critical(self, "OSM import", f"OSM importer unavailable: {exc}")
            return

        bbox = self._prompt_osm_bbox()
        if not bbox:
            return
        min_lon, min_lat, max_lon, max_lat = bbox

        self.set_status("Fetching OpenStreetMap data... (Overpass query in progress)")
        QApplication.processEvents()
        try:
            result = import_osm_bbox(min_lon, min_lat, max_lon, max_lat)
        except OsmImportError as exc:
            QMessageBox.warning(self, "OSM import", str(exc))
            self.set_status(f"OSM import failed: {exc}", error=True)
            return
        except Exception as exc:
            QMessageBox.critical(self, "OSM import", f"OSM import failed: {exc}")
            self.set_status(f"OSM import failed: {exc}", error=True)
            return

        layers = result.get("layers", {}) or {}
        for key, layer in layers.items():
            box = self.layer_boxes.get(key)
            if box is not None and layer is not None:
                box.setLayer(layer)
        self._refresh_report()
        counts = result.get("counts", {})
        bw, bh = result.get("bbox_km", (0, 0))
        summary = (
            f"OSM data loaded (EPSG:{result.get('epsg')}, ~{bw}x{bh} km). "
            f"Buildings {counts.get('buildings', 0)}, roads {counts.get('roads', 0)}, "
            f"greens {counts.get('greens', 0)}, trees {counts.get('trees', 0)}. "
            "Add your own DEM, then export."
        )
        self.set_status(summary)

    def _prompt_osm_bbox(self) -> tuple | None:
        """Small modal asking for an OSM bounding box (WGS84). Returns (minLon, minLat, maxLon, maxLat) or None."""
        dlg = QDialog(self)
        dlg.setWindowTitle("Import from OpenStreetMap")
        layout = QVBoxLayout(dlg)

        intro = QLabel(
            "Fetch OpenStreetMap data for a bounding box. Keep the box small (~3 km max side) "
            "so Overpass stays happy. Coordinates are WGS84 (EPSG:4326) longitudes/latitudes."
        )
        intro.setWordWrap(True)
        layout.addWidget(intro)

        canvas_btn = QPushButton("Use current QGIS canvas extent")
        layout.addWidget(canvas_btn)

        grid = QGridLayout()
        min_lon_edit = QLineEdit("28.9700")
        min_lat_edit = QLineEdit("41.0050")
        max_lon_edit = QLineEdit("29.0000")
        max_lat_edit = QLineEdit("41.0250")
        grid.addWidget(QLabel("Min longitude"), 0, 0)
        grid.addWidget(min_lon_edit, 0, 1)
        grid.addWidget(QLabel("Min latitude"), 0, 2)
        grid.addWidget(min_lat_edit, 0, 3)
        grid.addWidget(QLabel("Max longitude"), 1, 0)
        grid.addWidget(max_lon_edit, 1, 1)
        grid.addWidget(QLabel("Max latitude"), 1, 2)
        grid.addWidget(max_lat_edit, 1, 3)
        layout.addLayout(grid)

        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        layout.addWidget(buttons)
        buttons.accepted.connect(dlg.accept)
        buttons.rejected.connect(dlg.reject)

        def _fill_from_canvas():
            try:
                canvas = self.iface.mapCanvas()
                extent = canvas.extent()
                src_crs = QgsProject.instance().crs() if canvas.mapSettings().destinationCrs().authid() == "" else canvas.mapSettings().destinationCrs()
                wgs = QgsCoordinateReferenceSystem.fromEpsgId(4326)
                if src_crs.isValid() and src_crs.authid() != "EPSG:4326":
                    transform = QgsCoordinateTransform(src_crs, wgs, QgsProject.instance())
                    extent = transform.transformBoundingBox(extent)
                min_lon_edit.setText(f"{extent.xMinimum():.6f}")
                min_lat_edit.setText(f"{extent.yMinimum():.6f}")
                max_lon_edit.setText(f"{extent.xMaximum():.6f}")
                max_lat_edit.setText(f"{extent.yMaximum():.6f}")
            except Exception as exc:
                QMessageBox.warning(dlg, "Canvas extent", f"Could not read canvas extent: {exc}")

        canvas_btn.clicked.connect(_fill_from_canvas)

        if dlg.exec() != DIALOG_ACCEPTED:
            return None
        try:
            return (
                float(min_lon_edit.text().replace(",", ".")),
                float(min_lat_edit.text().replace(",", ".")),
                float(max_lon_edit.text().replace(",", ".")),
                float(max_lat_edit.text().replace(",", ".")),
            )
        except ValueError as exc:
            QMessageBox.warning(self, "OSM import", f"Invalid coordinate: {exc}")
            return None

    def _load_sample_project(self) -> None:
        try:
            from .sample_generator import generate_sample_project
        except Exception as exc:
            QMessageBox.critical(self, "Sample data", f"Sample generator unavailable: {exc}")
            return
        try:
            result = generate_sample_project()
        except Exception as exc:
            QMessageBox.critical(self, "Sample data", f"Sample generation failed: {exc}")
            return
        layers = result.get("layers", {})
        for key, layer in layers.items():
            box = self.layer_boxes.get(key)
            if box is not None and layer is not None:
                box.setLayer(layer)
        self._refresh_report()
        folder = result.get("folder", "")
        self.set_status(
            f"Sample data generated and loaded ({folder}). Click 'Export and open 3D Viewer' to publish."
        )

    def _auto_match_layers_quiet(self) -> None:
        """Run auto-matching on dialog opening if no layer is currently selected."""
        if any(box.currentLayer() is not None for box in self.layer_boxes.values()):
            return
        layers = list(QgsProject.instance().mapLayers().values())
        used_ids = set()
        matched = []
        for key in ("dem", "plan_texture", "basemap", "roi", "roads", "buildings", "blocks", "parcels") + OPTIONAL_INPUTS:
            candidate = self._best_layer_match(key, layers, used_ids)
            if candidate is None:
                continue
            self.layer_boxes[key].setLayer(candidate)
            used_ids.add(candidate.id())
            matched.append(LABELS[key])
        if matched:
            self.set_status("Auto-matched layers from current project: " + ", ".join(matched[:5]) + ("..." if len(matched) > 5 else "") + ". Ready to export!")

    def _auto_match_layers(self) -> None:
        layers = list(QgsProject.instance().mapLayers().values())
        used_ids = set()
        matched = []
        for key in ("dem", "plan_texture", "basemap", "roi", "roads", "buildings", "blocks", "parcels") + OPTIONAL_INPUTS:
            candidate = self._best_layer_match(key, layers, used_ids)
            if candidate is None:
                continue
            self.layer_boxes[key].setLayer(candidate)
            used_ids.add(candidate.id())
            matched.append(f"{LABELS[key]} = {candidate.name()}")
        self._refresh_report()
        if matched:
            self.set_status("Auto-match completed: " + "; ".join(matched[:6]) + (" ..." if len(matched) > 6 else ""))
        else:
            self.set_status("No suitable layer names were found for auto-match.", error=True)

    def _best_layer_match(self, key: str, layers: list, used_ids: set):
        aliases = AUTO_MATCH_ALIASES.get(key, ())
        best = None
        best_score = 0
        for layer in layers:
            if layer.id() in used_ids:
                continue
            if key in ("dem", "plan_texture", "basemap") and hasattr(layer, "featureCount"):
                continue
            if key not in ("dem", "plan_texture", "basemap") and not hasattr(layer, "featureCount"):
                continue
            name = self._normalize_name(layer.name())
            score = 0
            for alias in aliases:
                normalized_alias = self._normalize_name(alias)
                if name == normalized_alias:
                    score = max(score, 100)
                elif normalized_alias in name:
                    score = max(score, 40 + len(normalized_alias))
            if score > best_score:
                best = layer
                best_score = score
        return best

    def _normalize_name(self, value: str) -> str:
        lowered = (value or "").lower().replace("ı", "i")
        ascii_text = unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode("ascii")
        return ascii_text.replace("_", " ").replace("-", " ").strip()

    def _build_quality_report(self, layer_map: dict) -> tuple[str, bool]:
        rows = []
        warnings = []
        crs_values = []
        mode = self._current_mode()
        required_keys = required_inputs_for_mode(mode)
        recommended_keys = set(recommended_inputs_for_mode(mode))
        missing = validate_inputs(layer_map)
        if missing:
            warnings.append("Missing required inputs: " + ", ".join(missing))
        if mode == MODE_VECTOR:
            missing_recommended = [LABELS[k] for k in recommended_keys if layer_map.get(k) is None]
            if missing_recommended:
                warnings.append("Recommended layers missing (viewer will skip them): " + ", ".join(missing_recommended))
            warnings.append("Vector Plan Mode has no mandatory layer. DEM is recommended for real topography; without it, the viewer uses a flat presentation plane.")
        if mode == MODE_RASTER_TEXTURE:
            warnings.append("Raster Plan Texture mode expects the plan GeoTIFF, DEM and ROI to use the same metric CRS and clipped study area.")
        road_access_field = layer_map.get("road_access_field")
        if road_access_field:
            warnings.append(f"Road access filter active: cars will avoid no-car/pedestrian values in '{road_access_field}'.")
        mapped = [label for key, _layer_key, label, _help in FIELD_MAPPING_DEFS if layer_map.get(key)]
        if mapped:
            warnings.append("Viewer field mapping active: " + ", ".join(mapped))

        ordered_keys = ("dem", "plan_texture", "basemap", "roi", "roads", "buildings", "blocks", "parcels") + OPTIONAL_INPUTS
        for key in ordered_keys:
            layer = layer_map.get(key)
            if key in required_keys:
                role = "Required"
            elif key in recommended_keys:
                role = "Recommended"
            else:
                role = "Optional"
            if key == "plan_texture" and mode != MODE_RASTER_TEXTURE:
                role = "Not used"
            if layer is None:
                if key in required_keys:
                    status = "Missing"
                elif key in recommended_keys:
                    status = "Skipped (recommended)"
                else:
                    status = "Empty export"
                rows.append((LABELS[key], role, status, "-", "-", "-"))
                continue

            crs = layer.crs().authid() if hasattr(layer, "crs") and layer.crs().isValid() else "No CRS"
            crs_values.append(crs)
            count = self._feature_count(layer)
            geom = self._geometry_name(layer)
            status = "Ready"
            if count == 0 and key in required_keys:
                status = "Empty required layer"
                warnings.append(f"{LABELS[key]} is required but appears empty.")
            expected = EXPECTED_GEOMETRIES.get(key)
            expected_tokens = [token.strip() for token in expected.split("/") if token.strip()] if expected else []
            if expected_tokens and geom != "-" and not any(token in geom for token in expected_tokens):
                status = "Geometry warning"
                warnings.append(f"{LABELS[key]} expected geometry is {expected}; selected layer is {geom}.")
            rows.append((LABELS[key], role, status, str(count), geom, crs))

            if key == "buildings":
                names = {field.name().lower() for field in layer.fields()}
                for field in RECOMMENDED_BUILDING_FIELDS:
                    if field.lower() not in names:
                        warnings.append(f"Recommended building field is missing: {field}.")

        unique_crs = sorted({c for c in crs_values if c and c != "No CRS"})
        if len(unique_crs) > 1:
            warnings.append("Possible CRS mismatch: " + ", ".join(unique_crs))

        table = "".join(
            f"<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td><td>{e}</td><td>{f}</td></tr>"
            for a, b, c, d, e, f in rows
        )
        warn_html = "".join(f"<li>{w}</li>" for w in warnings) or "<li>No critical warning.</li>"
        if not warnings:
            warn_html = "<li>No critical warning.</li>"
        html = f"""
        <h2>PlanX 3D City quality report</h2>
        <p><b>Language note:</b> English is the primary interface language; Turkish hints are secondary where they help local data preparation.</p>
        <table border="0" cellspacing="0" cellpadding="6">
          <tr><th>Input</th><th>Role</th><th>Status</th><th>Features</th><th>Geometry</th><th>CRS</th></tr>
          {table}
        </table>
        <h3>Warnings</h3>
        <ul>{warn_html}</ul>
        <p><b>Note:</b> Export is blocked only when required data is missing. Other warnings are quality-control guidance.</p>
        """
        return html, bool(warnings)

    def _update_badges(self, layer_map: dict) -> None:
        mode = self._current_mode()
        required_keys = set(required_inputs_for_mode(mode))
        recommended_keys = set(recommended_inputs_for_mode(mode))
        for key, badge in self.badge_labels.items():
            layer = layer_map.get(key)
            if layer is None:
                if key in required_keys:
                    state, text = "missing", "Missing"
                elif key in recommended_keys:
                    state, text = "recommended", "Recommended"
                else:
                    state, text = "optional", ("Off" if key == "plan_texture" else "Optional")
            else:
                count = self._feature_count(layer)
                state = "empty" if count == 0 else "ready"
                text = "Empty" if count == 0 else "Ready"
            badge.setText(text)
            badge.setStyleSheet(self._badge_style(state))
        self._refresh_input_labels()

    def _switch_page(self, idx: int) -> None:
        for i, page in enumerate(self.pages):
            page.setVisible(i == idx)

    def _prepare_block_fields(self) -> None:
        added = ensure_fields(self.selected_layers().get("blocks"), BLOCK_STYLE_FIELDS)
        self._style_message("Blocks", added)

    def _reset_asset_theme_defaults(self) -> None:
        if hasattr(self, "asset_theme_combo"):
            idx = self.asset_theme_combo.findData("Modern Urban")
            self.asset_theme_combo.setCurrentIndex(idx if idx >= 0 else 0)
        for key, combo in getattr(self, "asset_pool_count_combos", {}).items():
            default_count = TREE_VARIANT_DEFAULT_COUNT if key == "trees" else 4
            idx = combo.findData(default_count)
            combo.setCurrentIndex(idx if idx >= 0 else 0)
        self._set_tree_variants(list(TREE_VARIANT_OPTIONS[:TREE_VARIANT_DEFAULT_COUNT]))
        if hasattr(self, "tree_randomize_check"):
            self.tree_randomize_check.setChecked(True)
        if hasattr(self, "tree_random_variant_count_combo"):
            idx = self.tree_random_variant_count_combo.findData(TREE_VARIANT_DEFAULT_COUNT)
            self.tree_random_variant_count_combo.setCurrentIndex(idx if idx >= 0 else 0)
        if hasattr(self, "tree_height_random_expr"):
            self.tree_height_random_expr.clear()
        if hasattr(self, "tree_render_mode_combo"):
            idx = self.tree_render_mode_combo.findData("Stylized")
            self.tree_render_mode_combo.setCurrentIndex(idx if idx >= 0 else 0)
        self._sync_tree_random_controls()
        if hasattr(self, "style_report"):
            self.style_report.setHtml("<p><b>Asset Theme</b>: Modern Urban defaults restored.</p>")

    def _prepare_building_fields(self) -> None:
        added = ensure_fields(self.selected_layers().get("buildings"), BUILDING_STYLE_FIELDS)
        self._style_message("Buildings", added)

    def _apply_block_style(self) -> None:
        layer = self.selected_layers().get("blocks")
        ensure_fields(layer, BLOCK_STYLE_FIELDS)
        values = {
            "planx_color": self.color_value,
            "planx_texture": self.block_texture_combo.currentText(),
        }
        count = apply_values_to_selected(layer, values)
        self._selection_message("Blocks", count)

    def _apply_building_style(self) -> None:
        layer = self.selected_layers().get("buildings")
        ensure_fields(layer, BUILDING_STYLE_FIELDS)
        values = {
            "planx_color": self.color_value,
            "planx_facade": self.facade_combo.currentText(),
            "planx_roof_shape": self.roof_shape_combo.currentText(),
            "planx_roof_texture": self.roof_texture_combo.currentText(),
            "planx_roof_color": self.roof_color_value,
        }
        count = apply_values_to_selected(layer, values)
        self._selection_message("Buildings", count)

    def _pick_color(self, target: str) -> None:
        color = QColorDialog.getColor(QColor("#0f766e"), self, "Pick color")
        if not color.isValid():
            return
        value = color.name()
        if target == "roof":
            self.roof_color_value = value
            self.roof_color_btn.setText(value)
        else:
            self.color_value = value
            self.color_btn.setText(value)

    def _selected_tree_variants(self) -> list[str]:
        if not hasattr(self, "tree_variant_list"):
            return list(TREE_VARIANT_OPTIONS[:TREE_VARIANT_DEFAULT_COUNT])
        selected: list[str] = []
        for i in range(self.tree_variant_list.count()):
            item = self.tree_variant_list.item(i)
            if item and item.checkState() == CHECKED_STATE:
                selected.append(item.text())
        return selected

    def _set_tree_variants(self, values: list[str]) -> None:
        if not hasattr(self, "tree_variant_list"):
            return
        chosen = {str(v) for v in values}
        self.tree_variant_list.blockSignals(True)
        try:
            for i in range(self.tree_variant_list.count()):
                item = self.tree_variant_list.item(i)
                if not item:
                    continue
                item.setCheckState(CHECKED_STATE if item.text() in chosen else UNCHECKED_STATE)
        finally:
            self.tree_variant_list.blockSignals(False)
        self._sync_tree_random_controls()

    def _sync_tree_random_controls(self) -> None:
        if not hasattr(self, "tree_random_variant_count_combo"):
            return
        selected_count = len(self._selected_tree_variants())
        if selected_count <= 0 and hasattr(self, "tree_variant_list") and self.tree_variant_list.count() > 0:
            first = self.tree_variant_list.item(0)
            if first:
                first.setCheckState(CHECKED_STATE)
            selected_count = 1
        elif selected_count <= 0:
            selected_count = TREE_VARIANT_MIN_COUNT
        target = self.tree_random_variant_count_combo.currentData()
        try:
            target_count = int(target)
        except (TypeError, ValueError):
            target_count = TREE_VARIANT_DEFAULT_COUNT
        target_count = max(TREE_VARIANT_MIN_COUNT, min(selected_count, target_count))
        idx = self.tree_random_variant_count_combo.findData(target_count)
        if idx >= 0 and idx != self.tree_random_variant_count_combo.currentIndex():
            self.tree_random_variant_count_combo.blockSignals(True)
            self.tree_random_variant_count_combo.setCurrentIndex(idx)
            self.tree_random_variant_count_combo.blockSignals(False)
        self.tree_random_variant_count_combo.setEnabled(
            bool(getattr(self, "tree_randomize_check", None) and self.tree_randomize_check.isChecked())
        )

    def _style_message(self, label: str, added: list[str]) -> None:
        if added:
            self.style_report.setHtml(f"<p><b>{label}</b> fields added: {', '.join(added)}</p>")
        else:
            self.style_report.setHtml(f"<p><b>{label}</b> style fields already exist or the layer is not selected.</p>")

    def _selection_message(self, label: str, count: int) -> None:
        if count:
            self.style_report.setHtml(f"<p><b>{label}</b>: {count} selected feature(s) updated. Remember to save the layer.</p>")
        else:
            QMessageBox.warning(self, "No selection", f"No selected feature was found in {label}, or the layer is not selected.")

    def _copy_url(self) -> None:
        if not self.last_url:
            self.set_status("There is no viewer URL to copy.", error=True)
            return
        QApplication.clipboard().setText(self.last_url)
        self.set_status("Viewer URL copied to the clipboard.")

    def _open_output_folder(self) -> None:
        QDesktopServices.openUrl(QUrl.fromLocalFile(os.path.join(self.web_root, "data")))

    def _input_label_html(self, key: str, role: str) -> str:
        descriptions = {
            "dem": "GeoTIFF/raster elevation model. / Yukseklik modeli.",
            "plan_texture": "Clipped 2D site-plan GeoTIFF draped over the DEM. / DEM uzerine kaplanacak plan texture.",
            "basemap": "Open QGIS XYZ/raster basemap rendered as PNG texture during export. / QGIS altligi.",
            "roi": "Study-area boundary polygon. / Calisma alani siniri.",
            "roads": "Road centerlines and mobility attributes. / Yol akslari.",
            "buildings": "Building footprints, floors and function attributes. / Bina tabanlari.",
            "blocks": "Block polygons and block style fields. / Ada poligonlari.",
            "parcels": "Parcel boundaries. / Parsel sinirlari.",
            "trees": "Tree points; height field can be mapped above. / Agac noktalari.",
            "hardscape": "Hardscape polygons. / Sert zemin poligonlari.",
            "sidewalks": "Sidewalk polygons; used instead of auto-sidewalks when selected. / Kaldirim poligonlari.",
            "pedestrian_paths": "Inner-block pedestrian paths or walkway polygons. / Ada ici patika veya yaya yolu katmani.",
            "bike_lanes": "Dedicated bicycle lane layer; bike simulation runs only on this layer. / Ayri bisiklet yolu katmani; simulasyon yalnizca bunun uzerinde calisir.",
            "lights": "Light fixture points. / Aydinlatma noktalari.",
            "benches": "Bench points. / Bank noktalari.",
            "trashbins": "Trash-bin points. / Cop kutusu noktalari.",
            "busstops": "Bus-stop points. / Otobus duragi noktalari.",
            "fences": "Fence or boundary wall polygons. / Cit veya bahce/sinir duvari poligonlari.",
            "waterlines": "Water lines or streams. / Akarsu veya su hatlari.",
            "mosques": "Mosque point features. / Cami nokta katmani.",
            "tumulus": "Tumulus / burial mound point features; a default mound model is used when no GLB is uploaded. / Tumulus (hoyuk) nokta katmani; GLB yuklenmezse varsayilan hoyuk modeli kullanilir.",
        }
        if role == "required":
            mark = " <span style='color:#b91c1c'>*</span>"
        elif role == "recommended":
            mark = " <span style='color:#0369a1; font-size: 11px;'>(recommended)</span>"
        else:
            mark = ""
        return f"<b>{LABELS[key]}{mark}</b><br><span style='color:#64748b'>{descriptions[key]}</span>"

    def _role_for_key(self, key: str, mode: str) -> str:
        required = required_inputs_for_mode(mode)
        recommended = recommended_inputs_for_mode(mode)
        if key in required:
            return "required"
        if key in recommended:
            return "recommended"
        return "optional"

    def _refresh_input_labels(self) -> None:
        mode = self._current_mode()
        for key, label in getattr(self, "input_labels", {}).items():
            role = self._role_for_key(key, mode)
            label.setText(self._input_label_html(key, role))

    def _sync_road_access_fields(self) -> None:
        if not hasattr(self, "road_access_field_combo"):
            return
        layer = self.layer_boxes.get("roads").currentLayer() if self.layer_boxes.get("roads") else None
        current = self.road_access_field_combo.currentData() or ""
        self.road_access_field_combo.blockSignals(True)
        self.road_access_field_combo.clear()
        self.road_access_field_combo.addItem("No road access filter", "")
        if layer is not None and hasattr(layer, "fields"):
            for field in layer.fields():
                name = field.name()
                self.road_access_field_combo.addItem(name, name)
        idx = self.road_access_field_combo.findData(current)
        self.road_access_field_combo.setCurrentIndex(idx if idx >= 0 else 0)
        self.road_access_field_combo.blockSignals(False)

    def _sync_field_mapping_fields(self) -> None:
        if not getattr(self, "field_mapping_combos", None):
            return
        for key, layer_key, _label, _help in FIELD_MAPPING_DEFS:
            combo = self.field_mapping_combos.get(key)
            if combo is None:
                continue
            layer_box = self.layer_boxes.get(layer_key)
            layer = layer_box.currentLayer() if layer_box else None
            current = combo.currentData() or ""
            combo.blockSignals(True)
            combo.clear()
            combo.addItem("Auto / fallback", "")
            matched_field = None
            if layer is not None and hasattr(layer, "fields"):
                field_names = [f.name() for f in layer.fields()]
                for name in field_names:
                    combo.addItem(name, name)
                if not current and key in SMART_FIELD_ALIASES:
                    aliases = SMART_FIELD_ALIASES[key]
                    for name in field_names:
                        norm = self._normalize_name(name)
                        if any(self._normalize_name(alias) == norm for alias in aliases):
                            matched_field = name
                            break
            idx = combo.findData(current or matched_field or "")
            combo.setCurrentIndex(idx if idx >= 0 else 0)
            combo.blockSignals(False)

    def _current_mode(self) -> str:
        if not hasattr(self, "mode_combo"):
            return MODE_VECTOR
        return self.mode_combo.currentData() or MODE_VECTOR

    def _feature_count(self, layer) -> int:
        if hasattr(layer, "featureCount"):
            return layer.featureCount()
        return 1

    def _geometry_name(self, layer) -> str:
        if not hasattr(layer, "wkbType"):
            return "Raster"
        return QgsWkbTypes.displayString(layer.wkbType()) or "-"

    def _badge_style(self, state: str) -> str:
        colors = {
            "ready": ("#dcfce7", "#166534"),
            "missing": ("#ffe4e6", "#be123c"),
            "optional": ("#e0f2fe", "#075985"),
            "recommended": ("#fef9c3", "#854d0e"),
            "empty": ("#fef3c7", "#92400e"),
        }
        bg, fg = colors.get(state, colors["optional"])
        return f"border-radius:10px; padding:3px 8px; font-weight:700; background:{bg}; color:{fg};"


class PlanXWelcomeDialog(QDialog):
    """First-run onboarding shown once per plugin version."""

    sampleRequested = pyqtSignal()
    docRequested = pyqtSignal()

    def __init__(self, parent=None, version: str = ""):
        super().__init__(parent)
        self.setWindowTitle("Welcome to PlanX 3D City")
        self.setModal(True)
        self.resize(560, 420)
        root = QVBoxLayout(self)

        title = QLabel(f"<h2 style='margin-bottom:4px;'>PlanX 3D City Viewer{(' v' + version) if version else ''}</h2>")
        root.addWidget(title)

        subtitle = QLabel(
            "<span style='color:#475569;'>Turn QGIS layers into an interactive 3D city in your browser.</span>"
        )
        subtitle.setWordWrap(True)
        root.addWidget(subtitle)

        intro = QLabel(
            "<p>This plugin publishes a DEM + your vector layers (blocks, buildings, roads, parcels, optional "
            "street furniture) into a Three.js cockpit. It runs offline through a local HTTP server, with sun "
            "animation, walk mode, narrative keyframes, and a portable export option for handoff.</p>"
            "<p><b>Quick start (3 steps)</b></p>"
            "<ol>"
            "<li><b>Data</b> — Open <i>1 Data</i> page and select the layers you have. DEM is recommended for real topography; without it the viewer uses a flat plane. Map other layers "
            "if available. Click <i>Try with sample data</i> for an instant demo dataset.</li>"
            "<li><b>Check</b> — <i>2 Kontrol</i> verifies geometry, CRS and recommended fields without blocking export.</li>"
            "<li><b>Publish</b> — <i>Export and open 3D Viewer</i> writes the data contract and opens the browser cockpit.</li>"
            "</ol>"
            "<p><b>Tips for new users</b></p>"
            "<ul>"
            "<li>Vector mode can start from any available layer set; DEM-less exports open on a flat presentation plane.</li>"
            "<li>Use Style → <i>Terrain shaping</i> to flatten DEM under blocks for clean presentations.</li>"
            "<li>4 Yayin → <i>Portable ZIP</i> packages the viewer for handoff to students or jury members.</li>"
            "</ul>"
        )
        intro.setWordWrap(True)
        intro.setTextFormat(Qt.TextFormat.RichText)
        root.addWidget(intro, 1)

        btn_row = QHBoxLayout()
        self.sample_btn = QPushButton("Generate sample project")
        self.docs_btn = QPushButton("Open documentation")
        self.close_btn = QPushButton("Got it, take me to the dialog")
        self.close_btn.setDefault(True)
        btn_row.addWidget(self.sample_btn)
        btn_row.addWidget(self.docs_btn)
        btn_row.addStretch(1)
        btn_row.addWidget(self.close_btn)
        root.addLayout(btn_row)

        self.sample_btn.clicked.connect(self._on_sample)
        self.docs_btn.clicked.connect(self._on_docs)
        self.close_btn.clicked.connect(self.accept)

    def _on_sample(self) -> None:
        self.sampleRequested.emit()
        self.accept()

    def _on_docs(self) -> None:
        self.docRequested.emit()
