# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import webbrowser
from datetime import datetime
from pathlib import Path

from qgis.PyQt.QtCore import QSettings
from qgis.PyQt.QtGui import QIcon
from qgis.PyQt.QtWidgets import QAction, QFileDialog, QMessageBox

from .exporter import LABELS, copy_portable_viewer, existing_target_files, export_all, optional_inputs_for_mode, plugin_version, required_inputs_for_mode, validate_inputs, zip_portable_viewer
from .server import PlanX3DServer

PLUGIN_VERSION = plugin_version()
WELCOME_SETTINGS_KEY = "PlanX/PlanX3DCity/welcomeSeenVersion"
DOC_URL = "https://github.com/YusufEminoglu/planx_3d_city#planx-3d-city-viewer"


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
            self.dialog.portableExportRequested.connect(self.export_portable_viewer)
            self.dialog.portableZipRequested.connect(self.export_portable_viewer_zip)
        self._maybe_show_welcome()
        self.dialog.show()
        self.dialog.raise_()
        self.dialog.activateWindow()

    def _maybe_show_welcome(self):
        settings = QSettings()
        seen = settings.value(WELCOME_SETTINGS_KEY, "", type=str)
        if seen == PLUGIN_VERSION:
            return
        from .dialog import PlanXWelcomeDialog
        welcome = PlanXWelcomeDialog(self.iface.mainWindow(), version=PLUGIN_VERSION)
        welcome.sampleRequested.connect(self._welcome_sample)
        welcome.docRequested.connect(lambda: webbrowser.open(DOC_URL))
        welcome.exec_()
        settings.setValue(WELCOME_SETTINGS_KEY, PLUGIN_VERSION)

    def _welcome_sample(self):
        if self.dialog is None:
            return
        # Defer until the dialog has had a chance to render.
        self.dialog._load_sample_project()

    def export_and_launch(self, layer_map: dict):
        missing = validate_inputs(layer_map)
        if missing:
            self._message("Missing required data", "Please select these inputs:\n- " + "\n- ".join(missing), QMessageBox.Warning)
            if self.dialog:
                self.dialog.set_status("Missing required data: " + ", ".join(missing), error=True)
            return

        existing = existing_target_files(self.web_root)
        if existing:
            preview = "\n".join(f"- {os.path.basename(path)}" for path in existing[:12])
            if len(existing) > 12:
                preview += f"\n- ... and {len(existing) - 12} more files"
            answer = QMessageBox.question(
                self.iface.mainWindow(),
                "Overwrite existing data?",
                "The existing files in the PlanX 3D City data folder will be updated:\n\n"
                f"{preview}\n\nContinue?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No,
            )
            if answer != QMessageBox.Yes:
                if self.dialog:
                    self.dialog.set_status("Export cancelled.", error=True)
                return

        try:
            required = set(required_inputs_for_mode(layer_map.get("mode") or "vector"))
            optional = optional_inputs_for_mode(layer_map.get("mode") or "vector")
            empty_optionals = [LABELS[key] for key in optional if key not in required and layer_map.get(key) is None]
            written = export_all(layer_map, self.web_root)
            url = self.server.start()
            webbrowser.open(url)
        except Exception as exc:
            self._message("PlanX 3D City error", str(exc), QMessageBox.Critical)
            if self.dialog:
                self.dialog.set_status(str(exc), error=True)
            return

        message = f"{len(written)} file(s) written. Viewer opened: {url}"
        self.iface.messageBar().pushSuccess("PlanX 3D City", message)
        if self.dialog:
            self.dialog.set_status(message)
            self.dialog.set_publish_summary(url, written, empty_optionals)

    def stop_server(self):
        self.server.stop()
        self.iface.messageBar().pushInfo("PlanX 3D City", "Local server stopped.")
        if self.dialog:
            self.dialog.set_status("Local server stopped.")

    def reopen_viewer(self):
        if self.server.is_running and self.server.url:
            webbrowser.open(self.server.url)
            if self.dialog:
                self.dialog.set_status(f"Viewer reopened: {self.server.url}")
            return
        try:
            url = self.server.start()
            webbrowser.open(url)
            if self.dialog:
                self.dialog.set_status(f"Local server started: {url}")
                self.dialog.set_publish_summary(url, [], [])
        except Exception as exc:
            self._message("PlanX 3D City error", str(exc), QMessageBox.Critical)

    def export_portable_viewer(self):
        parent = QFileDialog.getExistingDirectory(
            self.iface.mainWindow(),
            "Select portable viewer target folder",
            os.path.expanduser("~"),
        )
        if not parent:
            return

        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(parent) / f"planx_3d_city_viewer_{stamp}"
        try:
            copied = copy_portable_viewer(self.web_root, str(output_dir))
        except Exception as exc:
            self._message("Portable viewer error", str(exc), QMessageBox.Critical)
            if self.dialog:
                self.dialog.set_status(str(exc), error=True)
            return

        message = f"Portable viewer folder ready: {output_dir}"
        self.iface.messageBar().pushSuccess("PlanX 3D City", message)
        if self.dialog:
            self.dialog.set_portable_summary(str(output_dir), len(copied))

    def export_portable_viewer_zip(self):
        default_name = f"planx_3d_city_portable_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        zip_path, _selected_filter = QFileDialog.getSaveFileName(
            self.iface.mainWindow(),
            "Save portable viewer ZIP",
            os.path.join(os.path.expanduser("~"), default_name),
            "Zip files (*.zip)",
        )
        if not zip_path:
            return
        if not zip_path.lower().endswith(".zip"):
            zip_path += ".zip"

        tour_json = None
        answer = QMessageBox.question(
            self.iface.mainWindow(),
            "Include a narrative tour?",
            "Do you want to include a planx_tour.json file exported from Narrative Studio > Export JSON?\n\n"
            "If included, the ZIP carries the tour as data/planx_tour.json for use on another computer.",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if answer == QMessageBox.Yes:
            tour_json, _filter = QFileDialog.getOpenFileName(
                self.iface.mainWindow(),
                "Select planx_tour.json",
                os.path.expanduser("~"),
                "PlanX tour JSON (*.json)",
            )
            if not tour_json:
                tour_json = None

        try:
            copied = zip_portable_viewer(self.web_root, zip_path, tour_json_path=tour_json)
        except Exception as exc:
            self._message("Portable viewer ZIP error", str(exc), QMessageBox.Critical)
            if self.dialog:
                self.dialog.set_status(str(exc), error=True)
            return

        self.iface.messageBar().pushSuccess("PlanX 3D City", f"Portable ZIP ready: {zip_path}")
        if self.dialog:
            self.dialog.set_portable_zip_summary(zip_path, len(copied))

    def _message(self, title: str, text: str, icon):
        QMessageBox(icon, title, text, QMessageBox.Ok, self.iface.mainWindow()).exec_()
