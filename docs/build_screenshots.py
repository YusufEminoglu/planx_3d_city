"""Render the real PlanX3DCityDialog headlessly (offscreen) and grab genuine
screenshots -- no mock-ups, no AI-generated fakes.

The existing docs/assets/images/step{1,4}_guide.jpg files are AI-generated
and don't just render badly (garbled menu text, nonsense field names) -- they
depict a UI that never existed in this plugin at all: a tabbed
"Datasets | Style | Analysis | Export" layout and a separate floating
"Quality Report Check" scoring window with a performance-tier gauge. The
real dialog is a single window with a dark sidebar nav list
(Guide / Data / Check / Style / Publish) that swaps pages in place -- see
dialog.py's `_build_ui`. This script captures the REAL pages so genuine
images can sit next to the old mock-ups.

Run:
    C:\\OSGeo4W\\bin\\python-qgis.bat planx_3d_city\\docs\\build_screenshots.py

Output: docs/assets/images/real_*.png.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("QT_QPA_FONTDIR", r"C:\Windows\Fonts")

HERE = Path(__file__).resolve().parent
PLUGIN_ROOT = HERE.parent
IMAGES = HERE / "assets" / "images"

sys.path.insert(0, r"C:\OSGeo4W\apps\qgis\python\plugins")
if str(PLUGIN_ROOT.parent) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT.parent))

from qgis.core import QgsApplication  # noqa: E402

qgs = QgsApplication([], True)
qgs.initQgis()

from qgis.PyQt.QtGui import QFont, QFontDatabase  # noqa: E402
from qgis.PyQt.QtCore import QCoreApplication  # noqa: E402

_font_id = QFontDatabase.addApplicationFont(r"C:\Windows\Fonts\segoeui.ttf")
if _font_id != -1:
    _family = QFontDatabase.applicationFontFamilies(_font_id)[0]
    QgsApplication.setFont(QFont(_family, 9))

from planx_3d_city.dialog import PlanX3DCityDialog  # noqa: E402


class _Iface:
    def mainWindow(self):
        return None

    def mapCanvas(self):
        return None

    def layerTreeView(self):
        return None


def grab_png(widget, name: str) -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    path = IMAGES / f"{name}.png"
    widget.grab().save(str(path), "PNG")
    print(f"wrote {path.relative_to(PLUGIN_ROOT)} ({path.stat().st_size // 1024} KB)", flush=True)


def main() -> None:
    web_root = str(PLUGIN_ROOT / "web")
    dialog = PlanX3DCityDialog(_Iface(), web_root, parent=None)
    dialog.resize(1180, 800)
    dialog.show()
    for _ in range(10):
        QCoreApplication.processEvents()
    grab_png(dialog, "real_step0_guide")

    # nav rows: 0 Guide, 1 Data, 2 Check, 3 Style, 4 Publish
    labels = {1: "real_step1_data", 2: "real_step2_check", 3: "real_step3_style", 4: "real_step4_publish"}
    for row, name in labels.items():
        dialog.nav.setCurrentRow(row)
        for _ in range(10):
            QCoreApplication.processEvents()
        grab_png(dialog, name)

    qgs.exitQgis()


if __name__ == "__main__":
    main()
