# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import webbrowser

from qgis.PyQt.QtGui import QIcon
from qgis.PyQt.QtWidgets import QAction, QMessageBox

from .exporter import LABELS, OPTIONAL_INPUTS, existing_target_files, export_all, optional_inputs_for_mode, required_inputs_for_mode, validate_inputs
from .server import PlanX3DServer


class PlanX3DCityPlugin:
    def __init__(self, iface):
        self.iface = iface
        self.plugin_dir = os.path.dirname(__file__)
        self.web_root = os.path.join(self.plugin_dir, "web")
        self.action = None
        self.dialog = None
        self.server = PlanX3DServer(self.web_root)

    def initGui(self):
        icon = QIcon(os.path.join(self.plugin_dir, "icons", "icon_main.svg"))
        self.action = QAction(icon, "PlanX 3D City", self.iface.mainWindow())
        self.action.setStatusTip("Export QGIS layers and launch PlanX 3D City")
        self.action.triggered.connect(self.show_dialog)
        self.iface.addToolBarIcon(self.action)
        self.iface.addPluginToMenu("&PlanX 3D City", self.action)

    def unload(self):
        if self.action:
            self.iface.removePluginMenu("&PlanX 3D City", self.action)
            self.iface.removeToolBarIcon(self.action)
        self.server.stop()
        if self.dialog:
            self.dialog.close()
            self.dialog = None

    def show_dialog(self):
        if self.dialog is None:
            from .dialog import PlanX3DCityDialog

            self.dialog = PlanX3DCityDialog(self.iface, self.web_root, self.iface.mainWindow())
            self.dialog.exportRequested.connect(self.export_and_launch)
            self.dialog.stopServerRequested.connect(self.stop_server)
            self.dialog.reopenViewerRequested.connect(self.reopen_viewer)
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()

    def export_and_launch(self, layer_map: dict):
        missing = validate_inputs(layer_map)
        if missing:
            self._message("Eksik zorunlu veri", "Lutfen su verileri secin:\n- " + "\n- ".join(missing), QMessageBox.Warning)
            if self.dialog:
                self.dialog.set_status("Eksik zorunlu veri: " + ", ".join(missing), error=True)
            return

        existing = existing_target_files(self.web_root)
        if existing:
            preview = "\n".join(f"- {os.path.basename(path)}" for path in existing[:12])
            if len(existing) > 12:
                preview += f"\n- ... ve {len(existing) - 12} dosya daha"
            answer = QMessageBox.question(
                self.iface.mainWindow(),
                "Mevcut verilerin uzerine yazilsin mi?",
                "PlanX 3D City data klasorundeki mevcut dosyalar guncellenecek:\n\n"
                f"{preview}\n\nDevam edilsin mi?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No,
            )
            if answer != QMessageBox.Yes:
                if self.dialog:
                    self.dialog.set_status("Disari aktarim iptal edildi.", error=True)
                return

        try:
            required = set(required_inputs_for_mode(layer_map.get("mode") or "vector"))
            optional = optional_inputs_for_mode(layer_map.get("mode") or "vector")
            empty_optionals = [LABELS[key] for key in optional if key not in required and layer_map.get(key) is None]
            written = export_all(layer_map, self.web_root)
            url = self.server.start()
            webbrowser.open(url)
        except Exception as exc:
            self._message("PlanX 3D City hatasi", str(exc), QMessageBox.Critical)
            if self.dialog:
                self.dialog.set_status(str(exc), error=True)
            return

        message = f"{len(written)} dosya yazildi. Viewer acildi: {url}"
        self.iface.messageBar().pushSuccess("PlanX 3D City", message)
        if self.dialog:
            self.dialog.set_status(message)
            self.dialog.set_publish_summary(url, written, empty_optionals)

    def stop_server(self):
        self.server.stop()
        self.iface.messageBar().pushInfo("PlanX 3D City", "Yerel sunucu durduruldu.")
        if self.dialog:
            self.dialog.set_status("Yerel sunucu durduruldu.")

    def reopen_viewer(self):
        if self.server.is_running and self.server.url:
            webbrowser.open(self.server.url)
            if self.dialog:
                self.dialog.set_status(f"Viewer tekrar acildi: {self.server.url}")
            return
        try:
            url = self.server.start()
            webbrowser.open(url)
            if self.dialog:
                self.dialog.set_status(f"Yerel sunucu baslatildi: {url}")
                self.dialog.set_publish_summary(url, [], [])
        except Exception as exc:
            self._message("PlanX 3D City hatasi", str(exc), QMessageBox.Critical)

    def _message(self, title: str, text: str, icon):
        QMessageBox(icon, title, text, QMessageBox.Ok, self.iface.mainWindow()).exec_()
