// @ts-check
// Built-in asset catalogue: texture sets (facades, roofs, pavements...),
// theme presets, named colours, tree variants and the procedural facade
// recipes. Plain data, shared by the viewer's layers and its style panels.
import { FACADES, ROOFS, ROOF_LABELS, surfacesFor } from './material_catalogue.js';

export const ROOF_SHAPE_OPTIONS = ['Flat', 'Pyramid', 'Hip', 'Gable', 'Shed'];

export const BUILDING_MODE_OPTIONS = [
  'Auto Smart Massing',
  'Extruded + roof',
  'Podium + tower',
  'Stepped tower',
  'Courtyard block',
  'Cantilever / pilotis',
  'Penthouse crown',
  'Extruded',
  'Footprint only'
];

// Texture sets offered by the style panels, from the shared material
// catalogue (English names; legacy names resolve through presetValue).
export const textureSets = {
  pavement: surfacesFor('walk'),
  road: surfacesFor('road'),
  island: { None: null, ...surfacesFor('ground') },
  hardscape: surfacesFor('walk'),
  facade: { ...FACADES },
  roof: { ...ROOFS }
};

export const ROOF_TEXTURE_LABELS = ROOF_LABELS;

export function roofTextureLabel(key) {
  return ROOF_TEXTURE_LABELS[key] || key;
}

export const assetThemePresets = {
  'Modern Urban': {
    pedestrians: ['Commuter', 'Urban Casual', 'Office', 'Student', 'Evening'],
    cars: ['Graphite', 'Slate', 'Teal', 'White', 'Navy', 'Silver'],
    trees: ['Street Linden', 'Plane', 'Compact Maple', 'Columnar', 'Broadleaf', 'Pine', 'Olive', 'Cypress'],
    lights: ['Modern Arc', 'Dual Head', 'Slim Post', 'Bollard Path', 'Classic Post'],
    benches: ['Wood Plank', 'Concrete Slab', 'Curved Metal', 'Slim Urban', 'Stone Seat'],
    bins: ['Square Box', 'Dual Recycle', 'Cylinder', 'Compact', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy', 'Wood Cabin', 'Compact Marker'],
    facades: ['ApartmentTextureA', 'ApartmentTextureB', 'ApartmentTextureC', 'ApartmentTextureD', 'ApartmentTextureE', 'ApartmentTextureF', 'Apartment', 'Brick', 'ModernTextureA', 'ModernTextureB', 'MixedUse', 'Modern', 'Office'],
    roofs: ['ClayTile', 'Slate', 'Shingle', 'MetalSeam', 'Gravel'],
    paving: ['Asphalt', 'GraniteSlab', 'Cobblestone', 'ConcreteSlab']
  },
  'Modern Turkish': {
    pedestrians: ['Commuter', 'Urban Casual', 'Student', 'Visitor', 'Warm Neutral'],
    cars: ['White', 'Silver', 'Graphite', 'Slate', 'Navy'],
    trees: ['Plane', 'Olive', 'Cypress', 'Street Linden', 'Compact Maple', 'Pine', 'Broadleaf'],
    lights: ['Modern Arc', 'Slim Post', 'Dual Head', 'Classic Post'],
    benches: ['Wood Plank', 'Concrete Slab', 'Curved Metal', 'Slim Urban'],
    bins: ['Square Box', 'Dual Recycle', 'Cylinder', 'Compact'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy'],
    facades: ['ApartmentTextureA', 'ApartmentTextureB', 'ApartmentTextureC', 'ApartmentTextureD', 'ApartmentTextureE', 'ApartmentTextureF', 'Brick', 'Modern'],
    roofs: ['ClayTile', 'MetalSeam'],
    paving: ['Asphalt', 'GraniteSlab', 'ConcreteSlab']
  },
  Mediterranean: {
    pedestrians: ['Casual Linen', 'Warm Neutral', 'Student', 'Visitor'],
    cars: ['Ivory', 'Terracotta', 'Olive', 'Slate', 'Sand'],
    trees: ['Olive', 'Cypress', 'Plane', 'Palm', 'Jacaranda', 'Broadleaf', 'Compact Maple', 'Street Linden'],
    lights: ['Classic Post', 'Slim Post', 'Heritage Lantern', 'Modern Arc'],
    benches: ['Wood Plank', 'Curved Metal', 'Stone Seat', 'Classic Iron'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle', 'Compact'],
    busstops: ['Minimal Canopy', 'Wood Cabin', 'Glass Shelter', 'Compact Marker'],
    facades: ['Apartment', 'ApartmentTextureA', 'ApartmentTextureC', 'ApartmentTextureE', 'Brick', 'ModernTextureB', 'Villa'],
    roofs: ['ClayTile', 'Slate'],
    paving: ['GraniteSlab', 'Cobblestone', 'ConcreteSlab']
  },
  Campus: {
    pedestrians: ['Student', 'Academic', 'Sport', 'Visitor'],
    cars: ['Slate', 'Navy', 'White', 'Graphite', 'Silver'],
    trees: ['Plane', 'Pine', 'Compact Maple', 'Street Linden', 'Broadleaf', 'Columnar', 'Olive', 'Cypress'],
    lights: ['Slim Post', 'Campus Twin', 'Modern Arc', 'Dual Head'],
    benches: ['Wood Plank', 'Concrete Slab', 'Slim Urban', 'Eco Timber'],
    bins: ['Dual Recycle', 'Square Box', 'Compact', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy'],
    facades: ['Office', 'ModernTextureA', 'Apartment', 'Brick'],
    roofs: ['ClayTile', 'Shingle', 'Solar', 'Gravel'],
    paving: ['ConcreteSlab', 'ConcretePaver', 'GraniteSlab', 'Asphalt']
  },
  Eco: {
    pedestrians: ['Outdoor', 'Casual Green', 'Student', 'Visitor'],
    cars: ['Teal', 'Olive', 'White', 'Slate', 'Moss'],
    trees: ['Broadleaf', 'Pine', 'Street Linden', 'Compact Maple', 'Olive', 'Jacaranda', 'Cypress', 'Plane'],
    lights: ['Slim Post', 'Bollard Path', 'Modern Arc', 'Classic Post'],
    benches: ['Eco Timber', 'Wood Plank', 'Stone Seat', 'Concrete Slab'],
    bins: ['Dual Recycle', 'Compact', 'Cylinder', 'Solar Compactor'],
    busstops: ['Wood Cabin', 'Minimal Canopy', 'Glass Shelter'],
    facades: ['Modern', 'ModernTextureB', 'Brick', 'Apartment'],
    roofs: ['Green', 'Solar', 'ClayTile', 'Copper'],
    paving: ['GrassPaver', 'Cobblestone', 'GraniteSlab', 'ConcreteSlab']
  },
  'Dense Urban': {
    pedestrians: ['Commuter', 'Office', 'Evening', 'Urban Casual', 'Visitor'],
    cars: ['Graphite', 'Black', 'Navy', 'White', 'Slate', 'Burgundy'],
    trees: ['Columnar', 'Compact Maple', 'Street Linden', 'Plane', 'Broadleaf', 'Pine', 'Olive', 'Cypress'],
    lights: ['Dual Head', 'Modern Arc', 'Slim Post', 'Bollard Path'],
    benches: ['Concrete Slab', 'Curved Metal', 'Slim Urban', 'Stone Seat'],
    bins: ['Square Box', 'Compact', 'Dual Recycle', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Steel Canopy', 'Minimal Canopy', 'Compact Marker'],
    facades: ['ApartmentTextureB', 'ApartmentTextureD', 'ApartmentTextureF', 'Brick', 'Industrial', 'Office', 'Apartment', 'ModernTextureA', 'ModernTextureB', 'Modern'],
    roofs: ['MetalSeam', 'ClayTile', 'Slate', 'Shingle', 'Gravel'],
    paving: ['Asphalt', 'ConcreteSlab', 'ConcretePaver', 'GraniteSlab']
  },
  'Civic Heritage': {
    pedestrians: ['Visitor', 'Academic', 'Warm Neutral', 'Commuter'],
    cars: ['Graphite', 'Ivory', 'Slate', 'Burgundy', 'Black'],
    trees: ['Plane', 'Cypress', 'Street Linden', 'Columnar', 'Olive', 'Broadleaf', 'Jacaranda', 'Pine'],
    lights: ['Heritage Lantern', 'Classic Post', 'Slim Post', 'Bollard Path'],
    benches: ['Classic Iron', 'Stone Seat', 'Wood Plank', 'Concrete Slab'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle', 'Compact'],
    busstops: ['Steel Canopy', 'Glass Shelter', 'Minimal Canopy'],
    facades: ['Civic', 'Heritage', 'Apartment', 'Brick', 'ModernTextureA'],
    roofs: ['Copper', 'Lead', 'Slate', 'ClayTile', 'MetalSeam'],
    paving: ['GraniteSlab', 'Cobblestone']
  },
  'Coastal Light': {
    pedestrians: ['Casual Linen', 'Visitor', 'Student', 'Outdoor'],
    cars: ['White', 'Ivory', 'Teal', 'Sand', 'Slate'],
    trees: ['Palm', 'Plane', 'Olive', 'Broadleaf', 'Jacaranda', 'Street Linden', 'Compact Maple', 'Cypress'],
    lights: ['Slim Post', 'Modern Arc', 'Bollard Path', 'Classic Post'],
    benches: ['Wood Plank', 'Eco Timber', 'Stone Seat', 'Slim Urban'],
    bins: ['Cylinder', 'Dual Recycle', 'Compact', 'Square Box'],
    busstops: ['Minimal Canopy', 'Glass Shelter', 'Wood Cabin'],
    facades: ['Villa', 'Apartment', 'Modern', 'ModernTextureB', 'Office'],
    roofs: ['ClayTile', 'Solar'],
    paving: ['GraniteSlab', 'GrassPaver', 'ConcreteSlab']
  }
};

export const namedAssetColors = {
  Graphite: 0x1f2937, Slate: 0x475569, Teal: 0x0f766e, White: 0xe5e7eb, Navy: 0x1d4ed8,
  Ivory: 0xf8f1df, Terracotta: 0x9f5b3f, Black: 0x111827,
  Silver: 0xcbd5e1, Sand: 0xd8c3a5, Moss: 0x3f6212, Burgundy: 0x7f1d1d,
  Commuter: 0x334155, 'Urban Casual': 0x475569, Office: 0x1f2937, Student: 0x0f766e,
  Evening: 0x374151, 'Casual Linen': 0xd8c3a5, 'Warm Neutral': 0x8b6f47, Visitor: 0x64748b,
  Academic: 0x243044, Sport: 0x2563eb, Outdoor: 0x365314, 'Casual Green': 0x15803d,
  Broadleaf: 0x2f7d32, Pine: 0x1f5f3a, 'Street Linden': 0x3f8f3b, Plane: 0x4b9c45,
  'Compact Maple': 0x5a8f35, Columnar: 0x2c6e3f, Cypress: 0x174d32, Palm: 0x3d8b44,
  Olive: 0x667a2d, Jacaranda: 0x3f7f46
};

export const TREE_VARIANT_CATALOG = ['Street Linden', 'Plane', 'Compact Maple', 'Columnar', 'Olive', 'Cypress', 'Palm', 'Jacaranda', 'Pine', 'Broadleaf'];

export const TREE_PROFILE_DEFAULT = { shape: 'round', trunkRatio: 0.22, crownWidth: 0.46, crownHeight: 0.72, crownLift: 0.36, crownEmbed: 0.08 };

export const TREE_VARIANT_PROFILES = {
  'Street Linden': { shape: 'linden', trunkRatio: 0.23, crownWidth: 0.44, crownHeight: 0.74, crownLift: 0.34, crownEmbed: 0.08 },
  Plane: { shape: 'plane', trunkRatio: 0.21, crownWidth: 0.52, crownHeight: 0.68, crownLift: 0.33, crownEmbed: 0.09 },
  'Compact Maple': { shape: 'compact', trunkRatio: 0.2, crownWidth: 0.45, crownHeight: 0.69, crownLift: 0.36, crownEmbed: 0.08 },
  Columnar: { shape: 'columnar', trunkRatio: 0.24, crownWidth: 0.29, crownHeight: 0.92, crownLift: 0.4, crownEmbed: 0.14 },
  Olive: { shape: 'olive', trunkRatio: 0.23, crownWidth: 0.43, crownHeight: 0.62, crownLift: 0.33, crownEmbed: 0.09 },
  Cypress: { shape: 'cypress', trunkRatio: 0.26, crownWidth: 0.25, crownHeight: 1.02, crownLift: 0.46, crownEmbed: 0.2 },
  Palm: { shape: 'palm', trunkRatio: 0.45, crownWidth: 0.35, crownHeight: 0.48, crownLift: 0.55, crownEmbed: 0.06 },
  Jacaranda: { shape: 'jacaranda', trunkRatio: 0.2, crownWidth: 0.52, crownHeight: 0.7, crownLift: 0.31, crownEmbed: 0.08 },
  Pine: { shape: 'pine', trunkRatio: 0.28, crownWidth: 0.32, crownHeight: 1.0, crownLift: 0.47, crownEmbed: 0.18 },
  Broadleaf: { shape: 'broadleaf', trunkRatio: 0.22, crownWidth: 0.5, crownHeight: 0.76, crownLift: 0.34, crownEmbed: 0.09 }
};

/** Colour of a named asset variant (cars, people, trees), or the fallback. */
export function assetColor(name, fallback = 0x64748b) {
  return namedAssetColors[name] ?? fallback;
}
