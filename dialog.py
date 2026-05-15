# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import unicodedata

from qgis.PyQt.QtCore import QDateTime, QUrl, pyqtSignal
from qgis.PyQt.QtGui import QColor, QDesktopServices
from qgis.PyQt.QtWidgets import (
    QColorDialog,
    QComboBox,
    QDialog,
    QDialogButtonBox,
    QApplication,
    QFormLayout,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)
from qgis.core import QgsMapLayerProxyModel, QgsProject, QgsWkbTypes
from qgis.gui import QgsMapLayerComboBox

from .exporter import LABELS, OPTIONAL_INPUTS, REQUIRED_INPUTS, validate_inputs
from .style_tools import (
    BLOCK_STYLE_FIELDS,
    BUILDING_STYLE_FIELDS,
    apply_values_to_selected,
    ensure_fields,
)


EXPECTED_GEOMETRIES = {
    "roi": "Polygon",
    "roads": "Line",
    "buildings": "Polygon",
    "blocks": "Polygon",
    "parcels": "Polygon",
    "trees": "Point",
    "hardscape": "Polygon",
    "lights": "Point",
    "benches": "Point",
    "trashbins": "Point",
    "busstops": "Point",
}

RECOMMENDED_BUILDING_FIELDS = ("katadedi", "uipfonksiyon")

AUTO_MATCH_ALIASES = {
    "dem": ("dem", "mydem", "elevation", "yukseklik", "yukseklik modeli"),
    "roi": ("roi", "sinir", "calisma", "alan", "boundary"),
    "roads": ("roads", "road", "yol", "yollar", "aks", "myroads"),
    "buildings": ("buildings", "building", "bina", "binalar", "yapi", "yapilar", "mybuildings"),
    "blocks": ("blocks", "block", "ada", "adalar", "myblocks"),
    "parcels": ("parcels", "parcel", "parsel", "parseller", "myparcels"),
    "trees": ("trees", "tree", "agac", "agaclar", "mytrees"),
    "hardscape": ("hardscape", "sert", "zemin", "myhardscape"),
    "lights": ("lights", "light", "aydinlatma", "lamba", "mylights"),
    "benches": ("benches", "bench", "bank", "mybenches"),
    "trashbins": ("trashbins", "trash", "bin", "cop", "mytrashbins"),
    "busstops": ("busstops", "bus", "durak", "mybusstops"),
}


class PlanX3DCityDialog(QDialog):
    exportRequested = pyqtSignal(dict)
    stopServerRequested = pyqtSignal()
    reopenViewerRequested = pyqtSignal()

    def __init__(self, iface, web_root: str, parent=None):
        super().__init__(parent)
        self.iface = iface
        self.web_root = web_root
        self.layer_boxes = {}
        self.badge_labels = {}
        self.last_url = ""
        self.setWindowTitle("PlanX 3D City Publisher")
        self.resize(980, 720)
        self._build_ui()
        self._refresh_report()

    def selected_layers(self) -> dict:
        return {key: box.currentLayer() for key, box in self.layer_boxes.items()}

    def set_status(self, text: str, error: bool = False) -> None:
        self.status_label.setText(text)
        self.status_label.setProperty("error", error)
        self.status_label.style().unpolish(self.status_label)
        self.status_label.style().polish(self.status_label)

    def set_publish_summary(self, url: str, written: list[str], empty_optionals: list[str]) -> None:
        self.last_url = url
        self.url_label.setText(url or "-")
        self.url_label.setTextInteractionFlags(self.url_label.textInteractionFlags() | 1)
        self.publish_time_label.setText(QDateTime.currentDateTime().toString("yyyy-MM-dd HH:mm:ss"))
        self.files_label.setText(str(len(written)))
        self.empty_label.setText(", ".join(empty_optionals) if empty_optionals else "Yok")
        self.publish_report.setHtml(
            "<h3>Son yayin ozeti</h3>"
            f"<p><b>Viewer:</b> {url}</p>"
            f"<p><b>Yazilan dosya:</b> {len(written)}</p>"
            f"<p><b>Opsiyonel bos katman:</b> {', '.join(empty_optionals) if empty_optionals else 'Yok'}</p>"
        )

    def _build_ui(self) -> None:
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
            QListWidget::item { padding: 12px 10px; border-radius: 7px; }
            QListWidget::item:selected { background: #0f766e; color: white; }
            QGroupBox {
                border: 1px solid #d8e0ea;
                border-radius: 8px;
                margin-top: 12px;
                padding: 12px 10px 10px 10px;
                background: white;
                font-weight: 700;
            }
            QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 6px; }
            QLabel { color: #334155; }
            QLabel#heroTitle { font-size: 22px; font-weight: 800; color: #12343b; }
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
                border-radius: 8px;
                background: white;
                padding: 10px;
            }
        """)

        shell = QHBoxLayout(self)
        self.nav = QListWidget()
        self.nav.setFixedWidth(170)
        for label in ("1 Veri", "2 Kontrol", "3 Stil", "4 Yayin"):
            QListWidgetItem(label, self.nav)
        self.nav.setCurrentRow(0)
        shell.addWidget(self.nav)

        content = QVBoxLayout()
        hero = QVBoxLayout()
        title = QLabel("PlanX 3D City Publisher")
        title.setObjectName("heroTitle")
        subtitle = QLabel("QGIS katmanlarini dogrula, stillendir, yayinla ve 3D viewer'i tek akistan ac.")
        subtitle.setObjectName("heroSub")
        subtitle.setWordWrap(True)
        hero.addWidget(title)
        hero.addWidget(subtitle)
        content.addLayout(hero)

        self.pages = [
            self._make_data_page(),
            self._make_check_page(),
            self._make_style_page(),
            self._make_publish_page(),
        ]
        for i, page in enumerate(self.pages):
            page.setVisible(i == 0)
            content.addWidget(page)

        self.status_label = QLabel("Hazir. Once veri secimini tamamlayin, sonra kalite kontrol raporunu uretin.")
        self.status_label.setObjectName("statusLabel")
        self.status_label.setWordWrap(True)
        content.addWidget(self.status_label)

        buttons = QDialogButtonBox(QDialogButtonBox.Close)
        buttons.rejected.connect(self.reject)
        content.addWidget(buttons)
        shell.addLayout(content, 1)
        self.nav.currentRowChanged.connect(self._switch_page)

    def _make_data_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)

        required_group = QGroupBox("Zorunlu veri katmanlari")
        required_grid = QGridLayout(required_group)
        for row, key in enumerate(REQUIRED_INPUTS):
            self._add_layer_row(required_grid, row, key, required=True)
        root.addWidget(required_group)

        optional_group = QGroupBox("Opsiyonel zenginlestirme katmanlari")
        optional_grid = QGridLayout(optional_group)
        for row, key in enumerate(OPTIONAL_INPUTS):
            self._add_layer_row(optional_grid, row, key, required=False)
        root.addWidget(optional_group)

        actions = QHBoxLayout()
        self.auto_match_button = QPushButton("Katmanlari otomatik eslestir")
        self.check_button = QPushButton("Kalite raporu uret")
        self.export_button = QPushButton("Disari aktar ve 3D Viewer ac")
        self.export_button.setObjectName("primaryButton")
        actions.addWidget(self.auto_match_button)
        actions.addWidget(self.check_button)
        actions.addWidget(self.export_button)
        root.addLayout(actions)
        root.addStretch(1)

        self.auto_match_button.clicked.connect(self._auto_match_layers)
        self.check_button.clicked.connect(self._refresh_report)
        self.export_button.clicked.connect(lambda: self.exportRequested.emit(self.selected_layers()))
        return page

    def _add_layer_row(self, grid: QGridLayout, row: int, key: str, required: bool) -> None:
        label = QLabel(self._input_label_html(key, required))
        label.setMinimumWidth(240)
        label.setWordWrap(True)
        box = QgsMapLayerComboBox()
        box.setAllowEmptyLayer(not required)
        box.setFilters(QgsMapLayerProxyModel.RasterLayer if key == "dem" else QgsMapLayerProxyModel.VectorLayer)
        badge = QLabel("Eksik" if required else "Opsiyonel")
        badge.setProperty("class", "badge")
        badge.setStyleSheet(self._badge_style("missing" if required else "optional"))
        box.layerChanged.connect(lambda _layer=None: self._refresh_report())
        self.layer_boxes[key] = box
        self.badge_labels[key] = badge
        grid.addWidget(label, row, 0)
        grid.addWidget(box, row, 1)
        grid.addWidget(badge, row, 2)

    def _make_check_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)
        row = QHBoxLayout()
        refresh = QPushButton("Raporu yenile")
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
            "Secili ada veya binalara PlanX stil alanlari yazilir. Islem yalniz secili feature'lari etkiler; "
            "sonucu viewer'da gormek icin yeniden export gerekir."
        )
        intro.setWordWrap(True)
        root.addWidget(intro)

        prep = QGroupBox("Alan hazirligi")
        prep_row = QHBoxLayout(prep)
        self.prepare_block_fields_btn = QPushButton("Blocks stil alanlarini olustur")
        self.prepare_building_fields_btn = QPushButton("Buildings stil alanlarini olustur")
        prep_row.addWidget(self.prepare_block_fields_btn)
        prep_row.addWidget(self.prepare_building_fields_btn)
        root.addWidget(prep)

        quick = QGroupBox("Secili feature hizli stil uygula")
        form = QFormLayout(quick)
        self.block_texture_combo = QComboBox()
        self.block_texture_combo.addItems(["", "None", "SoftNoise", "FineGrid"])
        self.facade_combo = QComboBox()
        self.facade_combo.addItems(["", "UrbanA", "UrbanB", "UrbanC", "UrbanD"])
        self.roof_shape_combo = QComboBox()
        self.roof_shape_combo.addItems(["", "Flat", "Pyramid", "Gable", "Cone", "Prism"])
        self.roof_texture_combo = QComboBox()
        self.roof_texture_combo.addItems(["", "RoofA", "GermanTile", "TurkishTile", "USShingle"])
        self.color_btn = QPushButton("Renk sec")
        self.roof_color_btn = QPushButton("Cati rengi sec")
        self.color_value = ""
        self.roof_color_value = ""
        form.addRow("Ada/bina rengi", self.color_btn)
        form.addRow("Ada dokusu", self.block_texture_combo)
        form.addRow("Bina cephesi", self.facade_combo)
        form.addRow("Cati tipi", self.roof_shape_combo)
        form.addRow("Cati dokusu", self.roof_texture_combo)
        form.addRow("Cati rengi", self.roof_color_btn)
        root.addWidget(quick)

        apply_row = QHBoxLayout()
        self.apply_blocks_btn = QPushButton("Secili adalara uygula")
        self.apply_buildings_btn = QPushButton("Secili binalara uygula")
        self.apply_buildings_btn.setObjectName("primaryButton")
        apply_row.addWidget(self.apply_blocks_btn)
        apply_row.addWidget(self.apply_buildings_btn)
        root.addLayout(apply_row)

        self.style_report = QTextBrowser()
        self.style_report.setMaximumHeight(150)
        self.style_report.setHtml("<p>Stil islemleri burada raporlanacak.</p>")
        root.addWidget(self.style_report)
        root.addStretch(1)

        self.prepare_block_fields_btn.clicked.connect(self._prepare_block_fields)
        self.prepare_building_fields_btn.clicked.connect(self._prepare_building_fields)
        self.apply_blocks_btn.clicked.connect(self._apply_block_style)
        self.apply_buildings_btn.clicked.connect(self._apply_building_style)
        self.color_btn.clicked.connect(lambda: self._pick_color("color"))
        self.roof_color_btn.clicked.connect(lambda: self._pick_color("roof"))
        return page

    def _make_publish_page(self) -> QWidget:
        page = QWidget()
        root = QVBoxLayout(page)
        summary = QGroupBox("Son yayin")
        form = QFormLayout(summary)
        self.url_label = QLabel("-")
        self.publish_time_label = QLabel("-")
        self.files_label = QLabel("0")
        self.empty_label = QLabel("-")
        form.addRow("Viewer URL", self.url_label)
        form.addRow("Yayin zamani", self.publish_time_label)
        form.addRow("Yazilan dosya", self.files_label)
        form.addRow("Bos opsiyoneller", self.empty_label)
        root.addWidget(summary)

        actions = QHBoxLayout()
        self.copy_url_btn = QPushButton("Viewer URL kopyala")
        self.reopen_btn = QPushButton("Tarayicida tekrar ac")
        self.open_folder_button = QPushButton("Data klasorunu ac")
        self.stop_button = QPushButton("Sunucuyu durdur")
        actions.addWidget(self.copy_url_btn)
        actions.addWidget(self.reopen_btn)
        actions.addWidget(self.open_folder_button)
        actions.addWidget(self.stop_button)
        root.addLayout(actions)

        self.publish_report = QTextBrowser()
        self.publish_report.setHtml("<p>Henuz yayin yapilmadi.</p>")
        root.addWidget(self.publish_report)
        root.addStretch(1)

        self.copy_url_btn.clicked.connect(self._copy_url)
        self.reopen_btn.clicked.connect(self.reopenViewerRequested.emit)
        self.open_folder_button.clicked.connect(self._open_output_folder)
        self.stop_button.clicked.connect(self.stopServerRequested.emit)
        return page

    def _refresh_report(self) -> None:
        layer_map = self.selected_layers()
        html, has_error = self._build_quality_report(layer_map)
        if hasattr(self, "report_browser"):
            self.report_browser.setHtml(html)
        self._update_badges(layer_map)
        self.set_status("Kalite raporu guncellendi." if not has_error else "Rapor uyarilar iceriyor; ayrintilar Kontrol sekmesinde.", has_error)

    def _auto_match_layers(self) -> None:
        layers = list(QgsProject.instance().mapLayers().values())
        used_ids = set()
        matched = []
        for key in REQUIRED_INPUTS + OPTIONAL_INPUTS:
            candidate = self._best_layer_match(key, layers, used_ids)
            if candidate is None:
                continue
            self.layer_boxes[key].setLayer(candidate)
            used_ids.add(candidate.id())
            matched.append(f"{LABELS[key]} = {candidate.name()}")
        self._refresh_report()
        if matched:
            self.set_status("Otomatik eslestirme tamamlandi: " + "; ".join(matched[:6]) + (" ..." if len(matched) > 6 else ""))
        else:
            self.set_status("Otomatik eslestirme icin isimlerden uygun katman bulunamadi.", error=True)

    def _best_layer_match(self, key: str, layers: list, used_ids: set):
        aliases = AUTO_MATCH_ALIASES.get(key, ())
        best = None
        best_score = 0
        for layer in layers:
            if layer.id() in used_ids:
                continue
            if key == "dem" and hasattr(layer, "featureCount"):
                continue
            if key != "dem" and not hasattr(layer, "featureCount"):
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
        missing = validate_inputs(layer_map)
        if missing:
            warnings.append("Eksik zorunlu veri: " + ", ".join(missing))

        for key in REQUIRED_INPUTS + OPTIONAL_INPUTS:
            layer = layer_map.get(key)
            role = "Zorunlu" if key in REQUIRED_INPUTS else "Opsiyonel"
            if layer is None:
                status = "Eksik" if key in REQUIRED_INPUTS else "Bos gecilecek"
                rows.append((LABELS[key], role, status, "-", "-", "-"))
                continue

            crs = layer.crs().authid() if hasattr(layer, "crs") and layer.crs().isValid() else "CRS yok"
            crs_values.append(crs)
            count = self._feature_count(layer)
            geom = self._geometry_name(layer)
            status = "Hazir"
            if count == 0 and key in REQUIRED_INPUTS:
                status = "Bos katman"
                warnings.append(f"{LABELS[key]} zorunlu ama bos gorunuyor.")
            expected = EXPECTED_GEOMETRIES.get(key)
            if expected and geom != "-" and expected not in geom:
                status = "Geometri uyarisi"
                warnings.append(f"{LABELS[key]} beklenen geometri {expected}, secilen katman {geom}.")
            rows.append((LABELS[key], role, status, str(count), geom, crs))

            if key == "buildings":
                names = {field.name().lower() for field in layer.fields()}
                for field in RECOMMENDED_BUILDING_FIELDS:
                    if field.lower() not in names:
                        warnings.append(f"Buildings katmaninda onerilen alan eksik: {field}.")

        unique_crs = sorted({c for c in crs_values if c and c != "CRS yok"})
        if len(unique_crs) > 1:
            warnings.append("CRS uyusmazligi olabilir: " + ", ".join(unique_crs))

        table = "".join(
            f"<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td><td>{e}</td><td>{f}</td></tr>"
            for a, b, c, d, e, f in rows
        )
        warn_html = "".join(f"<li>{w}</li>" for w in warnings) or "<li>Kritik uyarı yok.</li>"
        html = f"""
        <h2>PlanX 3D City kalite raporu</h2>
        <table border="0" cellspacing="0" cellpadding="6">
          <tr><th>Veri</th><th>Rol</th><th>Durum</th><th>Feature</th><th>Geometri</th><th>CRS</th></tr>
          {table}
        </table>
        <h3>Uyarilar</h3>
        <ul>{warn_html}</ul>
        <p><b>Not:</b> Export, eksik zorunlu veri varsa engellenir. Diger uyarilar kalite kontrol amaclidir.</p>
        """
        return html, bool(warnings)

    def _update_badges(self, layer_map: dict) -> None:
        for key, badge in self.badge_labels.items():
            layer = layer_map.get(key)
            if layer is None:
                state = "missing" if key in REQUIRED_INPUTS else "optional"
                text = "Eksik" if key in REQUIRED_INPUTS else "Opsiyonel"
            else:
                count = self._feature_count(layer)
                state = "empty" if count == 0 else "ready"
                text = "Bos" if count == 0 else "Hazir"
            badge.setText(text)
            badge.setStyleSheet(self._badge_style(state))

    def _switch_page(self, idx: int) -> None:
        for i, page in enumerate(self.pages):
            page.setVisible(i == idx)

    def _prepare_block_fields(self) -> None:
        added = ensure_fields(self.selected_layers().get("blocks"), BLOCK_STYLE_FIELDS)
        self._style_message("Blocks", added)

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
        color = QColorDialog.getColor(QColor("#0f766e"), self, "Renk sec")
        if not color.isValid():
            return
        value = color.name()
        if target == "roof":
            self.roof_color_value = value
            self.roof_color_btn.setText(value)
        else:
            self.color_value = value
            self.color_btn.setText(value)

    def _style_message(self, label: str, added: list[str]) -> None:
        if added:
            self.style_report.setHtml(f"<p><b>{label}</b> icin alanlar eklendi: {', '.join(added)}</p>")
        else:
            self.style_report.setHtml(f"<p><b>{label}</b> stil alanlari zaten hazir veya katman secili degil.</p>")

    def _selection_message(self, label: str, count: int) -> None:
        if count:
            self.style_report.setHtml(f"<p><b>{label}</b>: {count} secili feature guncellendi. Katmani kaydetmeyi unutmayin.</p>")
        else:
            QMessageBox.warning(self, "Secim yok", f"{label} katmaninda secili feature yok veya katman secilmedi.")

    def _copy_url(self) -> None:
        if not self.last_url:
            self.set_status("Kopyalanacak viewer URL yok.", error=True)
            return
        QApplication.clipboard().setText(self.last_url)
        self.set_status("Viewer URL panoya kopyalandi.")

    def _open_output_folder(self) -> None:
        QDesktopServices.openUrl(QUrl.fromLocalFile(os.path.join(self.web_root, "data")))

    def _input_label_html(self, key: str, required: bool) -> str:
        descriptions = {
            "dem": "GeoTIFF/raster yukseklik modeli",
            "roi": "Calisma alani siniri",
            "roads": "Yol akslari",
            "buildings": "Bina tabanlari, kat ve fonksiyon bilgisi",
            "blocks": "Ada poligonlari ve ada stilleri",
            "parcels": "Parsel sinirlari",
            "trees": "Agac noktalari",
            "hardscape": "Sert zemin poligonlari",
            "lights": "Aydinlatma noktalari",
            "benches": "Bank noktalari",
            "trashbins": "Cop kutusu noktalari",
            "busstops": "Otobus duragi noktalari",
        }
        mark = " *" if required else ""
        return f"<b>{LABELS[key]}{mark}</b><br><span style='color:#64748b'>{descriptions[key]}</span>"

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
            "empty": ("#fef3c7", "#92400e"),
        }
        bg, fg = colors.get(state, colors["optional"])
        return f"border-radius:10px; padding:3px 8px; font-weight:700; background:{bg}; color:{fg};"
