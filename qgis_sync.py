# -*- coding: utf-8 -*-
"""QGIS side of the live link with the 3D viewer.

- Selection QGIS -> viewer: when the exported building layer's selection
  changes, a point inside each selected footprint (in the export CRS) is
  published on the local server; the viewer highlights and flies to it.
- Selection viewer -> QGIS: a building clicked in the viewer comes back as a
  point; the feature containing it is selected and the map pans to it.
- A dock panel shows the viewer inside QGIS when this QGIS build has
  QtWebEngine; otherwise it offers to open the system browser.

The server thread never touches QGIS objects: viewer clicks are queued by
server.SelectionBridge and collected here on a QTimer (main thread).
"""
from __future__ import annotations

import webbrowser

from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeatureRequest,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsRectangle,
)
from qgis.PyQt.QtCore import QTimer, QUrl, Qt
from qgis.PyQt.QtWidgets import QDockWidget, QLabel, QPushButton, QVBoxLayout, QWidget

try:  # Not every QGIS build ships QtWebEngine.
    from qgis.PyQt.QtWebEngineWidgets import QWebEngineView
except Exception:  # noqa: BLE001 - any import failure means "no embedded view"
    QWebEngineView = None

MAX_PUBLISHED = 500
PICK_POLL_MS = 400


class PlanXQgisSync:
    """Two-way building selection between QGIS and the viewer."""

    def __init__(self, iface, bridge):
        self.iface = iface
        self.bridge = bridge
        self.layer = None
        self.export_crs = None
        self._to_export = None
        self._from_export = None
        self._applying_pick = False
        self._timer = QTimer()
        self._timer.setInterval(PICK_POLL_MS)
        self._timer.timeout.connect(self._collect_viewer_picks)

    def attach(self, layer, export_crs) -> None:
        """Follow this building layer (exported in export_crs)."""
        self.detach()
        if layer is None:
            return
        crs = export_crs if export_crs is not None and export_crs.isValid() else layer.crs()
        context = QgsProject.instance()
        self.layer = layer
        self.export_crs = QgsCoordinateReferenceSystem(crs)
        self._to_export = QgsCoordinateTransform(layer.crs(), self.export_crs, context)
        self._from_export = QgsCoordinateTransform(self.export_crs, layer.crs(), context)
        layer.selectionChanged.connect(self._publish_selection)
        layer.willBeDeleted.connect(self.detach)
        self._timer.start()
        self._publish_selection()

    def detach(self) -> None:
        self._timer.stop()
        if self.layer is not None:
            for signal, slot in ((self.layer.selectionChanged, self._publish_selection), (self.layer.willBeDeleted, self.detach)):
                try:
                    signal.disconnect(slot)
                except (TypeError, RuntimeError):
                    pass
        self.layer = None

    def _publish_selection(self, *_args) -> None:
        if self.layer is None or self._applying_pick:
            return
        points = []
        try:
            for feature in self.layer.getSelectedFeatures():
                geom = feature.geometry()
                if geom is None or geom.isEmpty():
                    continue
                inside = geom.pointOnSurface()
                if inside is None or inside.isEmpty():
                    continue
                p = self._to_export.transform(inside.asPoint())
                points.append((p.x(), p.y()))
                if len(points) >= MAX_PUBLISHED:
                    break
        except Exception:  # noqa: BLE001 - a broken selection must not break QGIS
            points = []
        self.bridge.set_qgis_selection(points)

    def _collect_viewer_picks(self) -> None:
        picks = self.bridge.pop_viewer_picks()
        if not picks or self.layer is None:
            return
        x, y = picks[-1]
        try:
            point = self._from_export.transform(QgsPointXY(x, y))
        except Exception:  # noqa: BLE001 - untransformable pick: ignore it
            return
        probe = QgsGeometry.fromPointXY(point)
        tol = 0.5
        rect = QgsRectangle(point.x() - tol, point.y() - tol, point.x() + tol, point.y() + tol)
        ids = [f.id() for f in self.layer.getFeatures(QgsFeatureRequest().setFilterRect(rect)) if f.geometry().contains(probe)]
        if not ids:
            return
        self._applying_pick = True
        try:
            self.layer.selectByIds(ids)
        finally:
            self._applying_pick = False
        canvas = self.iface.mapCanvas()
        canvas.panToSelected(self.layer)
        canvas.flashFeatureIds(self.layer, ids)


class PlanXPreviewDock(QDockWidget):
    """The 3D viewer docked in QGIS (QtWebEngine), or a link to open it."""

    def __init__(self, parent=None):
        super().__init__("PlanX 3D City", parent)
        self.setObjectName("PlanX3DCityPreviewDock")
        self._url = ""
        self.view = None
        if QWebEngineView is not None:
            self.view = QWebEngineView(self)
            self.setWidget(self.view)
        else:
            holder = QWidget(self)
            layout = QVBoxLayout(holder)
            note = QLabel(
                "This QGIS build has no embedded web engine (QtWebEngine).\n"
                "The viewer runs in your browser; selections still sync both ways."
            )
            note.setWordWrap(True)
            button = QPushButton("Open the 3D viewer in the browser")
            button.clicked.connect(self._open_external)
            layout.addWidget(note)
            layout.addWidget(button)
            layout.addStretch(1)
            self.setWidget(holder)

    @property
    def embedded(self) -> bool:
        return self.view is not None

    def load(self, url: str) -> None:
        self._url = url
        if self.view is not None:
            self.view.setUrl(QUrl(url))

    def _open_external(self) -> None:
        if self._url:
            webbrowser.open(self._url)


def add_preview_dock(iface, dock: PlanXPreviewDock) -> None:
    area = getattr(Qt, "RightDockWidgetArea", None)
    if area is None:  # Qt6 enum scoping
        area = Qt.DockWidgetArea.RightDockWidgetArea
    iface.addDockWidget(area, dock)
