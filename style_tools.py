# -*- coding: utf-8 -*-
from __future__ import annotations

from qgis.PyQt.QtCore import QVariant
from qgis.core import QgsField


BLOCK_STYLE_FIELDS = {
    "planx_color": QVariant.String,
    "planx_texture": QVariant.String,
}

BUILDING_STYLE_FIELDS = {
    "planx_color": QVariant.String,
    "planx_facade": QVariant.String,
    "planx_roof_shape": QVariant.String,
    "planx_roof_texture": QVariant.String,
    "planx_roof_color": QVariant.String,
}


def ensure_fields(layer, field_specs: dict[str, QVariant]) -> list[str]:
    if layer is None:
        return []

    provider = layer.dataProvider()
    existing = {field.name().lower() for field in layer.fields()}
    to_add = []
    added = []
    for name, field_type in field_specs.items():
        if name.lower() not in existing:
            to_add.append(QgsField(name, field_type, "", 64))
            added.append(name)

    if to_add:
        provider.addAttributes(to_add)
        layer.updateFields()
    return added


def apply_values_to_selected(layer, values: dict[str, str]) -> int:
    if layer is None:
        return 0

    selected_ids = layer.selectedFeatureIds()
    if not selected_ids:
        return 0

    fields = layer.fields()
    updates = {}
    for name, value in values.items():
        idx = fields.indexFromName(name)
        if idx >= 0 and value not in (None, ""):
            updates[idx] = value

    if not updates:
        return 0

    layer.startEditing()
    for fid in selected_ids:
        for idx, value in updates.items():
            layer.changeAttributeValue(fid, idx, value)
    layer.triggerRepaint()
    return len(selected_ids)
