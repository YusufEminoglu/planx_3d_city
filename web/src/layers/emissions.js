// Wind plumes over odour or emission sources (industry, waste, farms),
// pointing downwind.
import * as THREE from 'three';
import { compassDirection, getPolygonRings, polygonCentroidGeo } from '../geo.js';
import { normalizeAccessText } from '../props.js';
import { state } from '../core/state.js';
import { windPlumeGroup } from '../core/scene.js';
import { mappedField, settings } from '../core/settings.js';
import { metersToLocal } from '../core/data.js';
import { clearGroup } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';

function isOdorOrEmissionSource(feature) {
  const props = feature?.properties || {};
  const odorField = mappedField('odor_source_field');
  if (odorField && props[odorField] !== undefined) {
    return /(1|true|yes|source|risk|industr|waste|storage|treatment|sewage)/.test(normalizeAccessText(props[odorField]));
  }
  const text = normalizeAccessText([
    props[mappedField('landuse_function_field')], props.function, props.landuse, props.industrial, props.amenity,
    props.name, props.type
  ].filter(Boolean).join(' '));
  return /(industr|waste|solid|storage|transfer|treatment|sewage|logistics)/.test(text);
}

export function buildWindPlumeLayer() {
  clearGroup(windPlumeGroup);
  if (!settings.showWindPlumes) return;
  const sources = [
    ...(state.layerDataCache?.buildingsFc?.features || []),
    ...(state.layerDataCache?.hardscape?.features || [])
  ].filter(isOdorOrEmissionSource);
  if (!sources.length) return;

  const windDir = compassDirection(THREE.MathUtils.degToRad(settings.windDirectionDeg));
  const dx = windDir.x;
  const dz = windDir.z;
  const length = settings.windPlumeDistance;
  const width = Math.max(28, length * 0.28);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (const f of sources) {
    const rings = getPolygonRings(f.geometry);
    const outer = rings?.[0]?.[0];
    const c = polygonCentroidGeo(outer);
    if (!c) continue;
    const [lx, lz] = metersToLocal(c[0], c[1]);
    const cx = lx + dx * length * 0.5;
    const cz = lz + dz * length * 0.5;
    const y = terrainLocalYAt(lx, lz) + 2.0;
    const geo = new THREE.PlaneGeometry(width, length, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(cx, y, cz);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.renderOrder = 44;
    windPlumeGroup.add(mesh);
  }
}
