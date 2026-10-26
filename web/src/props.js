// @ts-check
// Reading feature attributes: first matching column (case-insensitive),
// numbers, colours, preset names, floor counts and access text.
import { ROOF_SHAPE_OPTIONS, textureSets } from './catalog.js';
import { catalogueName } from './material_catalogue.js';

// Column names for a mapped field ('building_population_field' etc.): the
// viewer registers its resolver (the export's field mapping first, then the
// usual names); without one the usual names are used as they are.
/** @type {(mappingKey: string, names: string[]) => string[]} */
let resolveNames = (_key, names) => names;
/** @param {(mappingKey: string, names: string[]) => string[]} fn */
export function setFieldNameResolver(fn) {
  resolveNames = fn;
}

export function propFirst(props, names) {
  if (!props) return null;
  const lowerMap = {};
  for (const key of Object.keys(props)) lowerMap[key.toLowerCase()] = key;
  for (const name of names) {
    const key = lowerMap[name.toLowerCase()];
    if (key && props[key] !== null && props[key] !== undefined && String(props[key]).trim() !== '') {
      return props[key];
    }
  }
  return null;
}

export function normalizeHexColor(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash : fallback;
}

// The material catalogue group of a texture set, for legacy names.
function catalogueGroupOf(presetMap) {
  if (presetMap === textureSets.facade) return 'facade';
  if (presetMap === textureSets.roof) return 'roof';
  if ([textureSets.road, textureSets.pavement, textureSets.hardscape, textureSets.island].includes(presetMap)) return 'surface';
  return null;
}

// A key of presetMap matching value (any letter case); for the catalogue's
// texture sets also a legacy name, which maps to its current entry.
export function presetValue(value, presetMap, fallback) {
  const group = catalogueGroupOf(presetMap);
  const resolve = (v) => {
    if (v === null || v === undefined) return null;
    const raw = String(v).trim();
    if (!raw) return null;
    const found = Object.keys(presetMap).find((key) => key.toLowerCase() === raw.toLowerCase());
    return found || (group ? catalogueName(group, raw, presetMap) : null);
  };
  return resolve(value) || resolve(fallback) || fallback;
}

export function roofShapeValue(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const raw = String(value).trim();
  const legacy = { Cone: 'Pyramid', Prism: 'Hip' };
  const candidate = legacy[raw] || raw;
  return ROOF_SHAPE_OPTIONS.find((key) => key.toLowerCase() === candidate.toLowerCase()) || fallback;
}

export function parseNumberProp(props, names, fallback = null) {
  let lookupNames = names;
  if (names.includes('population') || names.includes('pop')) {
    lookupNames = resolveNames('building_population_field', names);
  } else if (names.includes('vehicle') || names.includes('cars')) {
    lookupNames = resolveNames('building_vehicle_field', names);
  } else if (names.includes('gross_area') || names.includes('floor_area')) {
    lookupNames = resolveNames('building_floor_area_field', names);
  } else if (names.includes('dwellings') || names.includes('dwelling')) {
    lookupNames = resolveNames('building_dwelling_field', names);
  }
  const raw = propFirst(props || {}, lookupNames);
  if (raw === null || raw === undefined || raw === '') return fallback;
  const value = Number(String(raw).replace(',', '.'));
  return Number.isFinite(value) ? value : fallback;
}

export function featureLabelText(props, names, fallback = '') {
  const value = propFirst(props || {}, names);
  return value === null || value === undefined ? fallback : String(value);
}

export function parseLevel(v) {
  if (v == null) return 4;
  const s = String(v).replace(',', '.');
  const n = parseFloat(s);
  if (Number.isFinite(n) && n > 0) return n;
  return 4;
}

export function normalizeAccessText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function keywordList(values) {
  return (values || []).map(normalizeAccessText).filter(Boolean);
}

export function numericPropFirst(props, names) {
  for (const name of names) {
    if (!name || props?.[name] === undefined || props?.[name] === null || props?.[name] === '') continue;
    const value = Number(String(props[name]).replace(',', '.'));
    if (Number.isFinite(value)) return value;
  }
  return null;
}
