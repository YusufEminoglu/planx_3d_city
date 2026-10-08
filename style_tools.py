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
    layer.commitChanges()
    layer.triggerRepaint()
    return len(selected_ids)


CALCULATED_ANALYTICS_FIELDS = {
    "planx_gfa": QVariant.Double,
    "planx_dwellings": QVariant.Int,
    "planx_pop": QVariant.Int,
}


def calculate_building_gfa_and_population(
    layer,
    floors_field: str = None,
    default_floors: int = 4,
    avg_dwelling_m2: float = 100.0,
    household_size: float = 3.14,
    efficiency_ratio: float = 0.85,
) -> dict:
    """Calculates GFA (m2), estimated dwellings, and population directly on building layer geometries."""
    if layer is None:
        return {"features": 0, "total_gfa": 0.0, "total_pop": 0}

    ensure_fields(layer, CALCULATED_ANALYTICS_FIELDS)
    fields = layer.fields()

    gfa_idx = fields.indexFromName("planx_gfa")
    dwl_idx = fields.indexFromName("planx_dwellings")
    pop_idx = fields.indexFromName("planx_pop")
    flr_idx = fields.indexFromName(floors_field) if floors_field else -1

    total_gfa = 0.0
    total_pop = 0
    count = 0

    layer.startEditing()
    for feature in layer.getFeatures():
        geom = feature.geometry()
        if geom is None or geom.isEmpty():
            continue

        footprint_m2 = geom.area()
        floors = default_floors
        if flr_idx >= 0:
            try:
                val = float(feature.attributes()[flr_idx] or default_floors)
                if val > 0:
                    floors = val
            except (ValueError, TypeError):
                pass

        gfa = footprint_m2 * floors
        dwellings = max(0, int((gfa * efficiency_ratio) / max(10.0, avg_dwelling_m2)))
        pop = max(0, int(dwellings * household_size))

        layer.changeAttributeValue(feature.id(), gfa_idx, round(gfa, 2))
        layer.changeAttributeValue(feature.id(), dwl_idx, dwellings)
        layer.changeAttributeValue(feature.id(), pop_idx, pop)

        total_gfa += gfa
        total_pop += pop
        count += 1

    layer.commitChanges()
    layer.triggerRepaint()
    return {"features": count, "total_gfa": round(total_gfa, 2), "total_pop": total_pop}
