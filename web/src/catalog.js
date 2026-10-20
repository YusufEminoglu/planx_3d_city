// @ts-check
// Built-in asset catalogue: texture sets (facades, roofs, pavements...),
// theme presets, named colours, tree variants and the procedural facade
// recipes. Plain data, shared by the viewer's layers and its style panels.

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

export const textureSets = {
  pavement: {
    Asphalt: null,
    StoneA: 'assets/pavement.webp',
    StoneB: 'StoneB',
    Concrete: 'Concrete',
    Cobble: 'Cobble',
    WarmStone: 'WarmStone',
    CampusPaver: 'CampusPaver',
    Permeable: 'Permeable',
    Grid: 'Grid'
  },
  road: {
    Plain: null,
    Asphalt: 'Asphalt',
    Cobblestone: 'assets/pavement.webp',
    SharedStreet: 'SharedStreet'
  },
  island: {
    None: null,
    SoftNoise: 'SoftNoise',
    FineGrid: 'FineGrid',
    ParkGreen: 'ParkGreen',
    ResidentialBeige: 'ResidentialBeige',
    CivicGravel: 'CivicGravel',
    CoastalSand: 'CoastalSand',
    Water: 'Water'
  },
  hardscape: {
    Cobble: 'assets/pavement.webp',
    Concrete: 'Concrete',
    Tile: 'Tile',
    WarmStone: 'WarmStone',
    CampusPaver: 'CampusPaver',
    Permeable: 'Permeable',
    PlazaGranite: 'PlazaGranite'
  },
  facade: {
    UrbanA: 'assets/facade.webp',
    UrbanB: 'assets/facade2.png',
    UrbanC: 'assets/facade3.png',
    UrbanD: 'assets/facade4.png',
    UrbanE: 'UrbanE',
    UrbanF: 'UrbanF',
    ResidentialA: 'assets/facade_resid_a.webp',
    ResidentialB: 'assets/facade_resid_b.webp',
    ResidentialC: 'assets/facade_resid_c.webp',
    ResidentialD: 'assets/facade_resid_d.webp',
    ResidentialE: 'assets/facade_resid_e.webp',
    ResidentialF: 'assets/facade_resid_f.webp',
    CampusGlass: 'CampusGlass',
    CurtainWall: 'CurtainWall',
    EcoTimber: 'EcoTimber',
    NordicTimber: 'NordicTimber',
    CivicStone: 'CivicStone',
    HeritageStone: 'HeritageStone',
    DenseBrick: 'DenseBrick',
    AnatolianBrick: 'AnatolianBrick',
    IndustrialLoft: 'IndustrialLoft',
    BrutalistConcrete: 'BrutalistConcrete',
    CoastalWhite: 'CoastalWhite',
    MediterraneanStucco: 'MediterraneanStucco'
  },
  roof: {
    RoofA: 'assets/roof.webp',
    RoofB: 'RoofB',
    RoofC: 'RoofC',
    RoofD: 'RoofD',
    TurkishTile: 'TurkishTile',
    GermanTile: 'GermanTile',
    USShingle: 'USShingle',
    StandingSeam: 'StandingSeam',
    GreenRoof: 'GreenRoof',
    SolarRoof: 'SolarRoof',
    CeramicLight: 'CeramicLight',
    CopperPatina: 'CopperPatina',
    GravelBallast: 'GravelBallast',
    LeadMansard: 'LeadMansard'
  }
};

export const ROOF_TEXTURE_LABELS = {
  RoofA: 'Warm Tile (Classic)',
  RoofB: 'Slate Seam (Diagonal)',
  RoofC: 'Terracotta Wave',
  RoofD: 'Flat Gravel (Dark)',
  TurkishTile: 'Alaturka Tile (Red)',
  GermanTile: 'Slate Tile (Dark)',
  USShingle: 'Asphalt Shingle',
  StandingSeam: 'Standing Seam Metal',
  GreenRoof: 'Green / Sedum Roof',
  SolarRoof: 'Solar Panel Array',
  CeramicLight: 'Mediterranean Clay',
  CopperPatina: 'Patina Copper Seam',
  GravelBallast: 'Pebble Ballast Deck',
  LeadMansard: 'Zinc / Lead Mansard'
};

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
    facades: ['ResidentialA', 'ResidentialB', 'ResidentialC', 'ResidentialD', 'ResidentialE', 'ResidentialF', 'UrbanA', 'UrbanB', 'UrbanC', 'UrbanD', 'UrbanE', 'UrbanF', 'CurtainWall'],
    roofs: ['TurkishTile', 'RoofA', 'RoofB', 'GermanTile', 'USShingle', 'StandingSeam', 'GravelBallast'],
    paving: ['Asphalt', 'StoneA', 'Cobble', 'Concrete', 'PlazaGranite']
  },
  'Modern Turkish': {
    pedestrians: ['Commuter', 'Urban Casual', 'Student', 'Visitor', 'Warm Neutral'],
    cars: ['White', 'Silver', 'Graphite', 'Slate', 'Navy'],
    trees: ['Plane', 'Olive', 'Cypress', 'Street Linden', 'Compact Maple', 'Pine', 'Broadleaf'],
    lights: ['Modern Arc', 'Slim Post', 'Dual Head', 'Classic Post'],
    benches: ['Wood Plank', 'Concrete Slab', 'Curved Metal', 'Slim Urban'],
    bins: ['Square Box', 'Dual Recycle', 'Cylinder', 'Compact'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy'],
    facades: ['ResidentialA', 'ResidentialB', 'ResidentialC', 'ResidentialD', 'ResidentialE', 'ResidentialF', 'AnatolianBrick', 'UrbanF'],
    roofs: ['TurkishTile', 'CeramicLight', 'RoofA', 'StandingSeam'],
    paving: ['Asphalt', 'StoneA', 'Concrete', 'WarmStone']
  },
  Mediterranean: {
    pedestrians: ['Casual Linen', 'Warm Neutral', 'Student', 'Visitor'],
    cars: ['Ivory', 'Terracotta', 'Olive', 'Slate', 'Sand'],
    trees: ['Olive', 'Cypress', 'Plane', 'Palm', 'Jacaranda', 'Broadleaf', 'Compact Maple', 'Street Linden'],
    lights: ['Classic Post', 'Slim Post', 'Heritage Lantern', 'Modern Arc'],
    benches: ['Wood Plank', 'Curved Metal', 'Stone Seat', 'Classic Iron'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle', 'Compact'],
    busstops: ['Minimal Canopy', 'Wood Cabin', 'Glass Shelter', 'Compact Marker'],
    facades: ['MediterraneanStucco', 'ResidentialA', 'ResidentialC', 'ResidentialE', 'UrbanB', 'UrbanD', 'CoastalWhite', 'AnatolianBrick'],
    roofs: ['TurkishTile', 'RoofC', 'CeramicLight', 'GermanTile', 'RoofA'],
    paving: ['StoneA', 'WarmStone', 'Cobble', 'Concrete']
  },
  Campus: {
    pedestrians: ['Student', 'Academic', 'Sport', 'Visitor'],
    cars: ['Slate', 'Navy', 'White', 'Graphite', 'Silver'],
    trees: ['Plane', 'Pine', 'Compact Maple', 'Street Linden', 'Broadleaf', 'Columnar', 'Olive', 'Cypress'],
    lights: ['Slim Post', 'Campus Twin', 'Modern Arc', 'Dual Head'],
    benches: ['Wood Plank', 'Concrete Slab', 'Slim Urban', 'Eco Timber'],
    bins: ['Dual Recycle', 'Square Box', 'Compact', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Minimal Canopy', 'Steel Canopy'],
    facades: ['CampusGlass', 'CurtainWall', 'UrbanC', 'UrbanA', 'UrbanB', 'BrutalistConcrete'],
    roofs: ['RoofA', 'RoofC', 'USShingle', 'SolarRoof', 'GravelBallast'],
    paving: ['Concrete', 'CampusPaver', 'StoneA', 'Asphalt']
  },
  Eco: {
    pedestrians: ['Outdoor', 'Casual Green', 'Student', 'Visitor'],
    cars: ['Teal', 'Olive', 'White', 'Slate', 'Moss'],
    trees: ['Broadleaf', 'Pine', 'Street Linden', 'Compact Maple', 'Olive', 'Jacaranda', 'Cypress', 'Plane'],
    lights: ['Slim Post', 'Bollard Path', 'Modern Arc', 'Classic Post'],
    benches: ['Eco Timber', 'Wood Plank', 'Stone Seat', 'Concrete Slab'],
    bins: ['Dual Recycle', 'Compact', 'Cylinder', 'Solar Compactor'],
    busstops: ['Wood Cabin', 'Minimal Canopy', 'Glass Shelter'],
    facades: ['EcoTimber', 'NordicTimber', 'UrbanD', 'UrbanB', 'UrbanA'],
    roofs: ['GreenRoof', 'SolarRoof', 'RoofA', 'RoofC', 'CopperPatina'],
    paving: ['Permeable', 'Cobble', 'StoneA', 'Concrete']
  },
  'Dense Urban': {
    pedestrians: ['Commuter', 'Office', 'Evening', 'Urban Casual', 'Visitor'],
    cars: ['Graphite', 'Black', 'Navy', 'White', 'Slate', 'Burgundy'],
    trees: ['Columnar', 'Compact Maple', 'Street Linden', 'Plane', 'Broadleaf', 'Pine', 'Olive', 'Cypress'],
    lights: ['Dual Head', 'Modern Arc', 'Slim Post', 'Bollard Path'],
    benches: ['Concrete Slab', 'Curved Metal', 'Slim Urban', 'Stone Seat'],
    bins: ['Square Box', 'Compact', 'Dual Recycle', 'Solar Compactor'],
    busstops: ['Glass Shelter', 'Steel Canopy', 'Minimal Canopy', 'Compact Marker'],
    facades: ['ResidentialB', 'ResidentialD', 'ResidentialF', 'DenseBrick', 'IndustrialLoft', 'CurtainWall', 'UrbanA', 'UrbanC', 'UrbanD', 'UrbanF'],
    roofs: ['StandingSeam', 'TurkishTile', 'RoofA', 'RoofB', 'USShingle', 'GravelBallast'],
    paving: ['Asphalt', 'Concrete', 'Grid', 'PlazaGranite']
  },
  'Civic Heritage': {
    pedestrians: ['Visitor', 'Academic', 'Warm Neutral', 'Commuter'],
    cars: ['Graphite', 'Ivory', 'Slate', 'Burgundy', 'Black'],
    trees: ['Plane', 'Cypress', 'Street Linden', 'Columnar', 'Olive', 'Broadleaf', 'Jacaranda', 'Pine'],
    lights: ['Heritage Lantern', 'Classic Post', 'Slim Post', 'Bollard Path'],
    benches: ['Classic Iron', 'Stone Seat', 'Wood Plank', 'Concrete Slab'],
    bins: ['Cylinder', 'Square Box', 'Dual Recycle', 'Compact'],
    busstops: ['Steel Canopy', 'Glass Shelter', 'Minimal Canopy'],
    facades: ['CivicStone', 'HeritageStone', 'MediterraneanStucco', 'UrbanB', 'UrbanC'],
    roofs: ['CopperPatina', 'LeadMansard', 'GermanTile', 'CeramicLight', 'RoofC', 'StandingSeam'],
    paving: ['WarmStone', 'StoneA', 'Cobble', 'PlazaGranite']
  },
  'Coastal Light': {
    pedestrians: ['Casual Linen', 'Visitor', 'Student', 'Outdoor'],
    cars: ['White', 'Ivory', 'Teal', 'Sand', 'Slate'],
    trees: ['Palm', 'Plane', 'Olive', 'Broadleaf', 'Jacaranda', 'Street Linden', 'Compact Maple', 'Cypress'],
    lights: ['Slim Post', 'Modern Arc', 'Bollard Path', 'Classic Post'],
    benches: ['Wood Plank', 'Eco Timber', 'Stone Seat', 'Slim Urban'],
    bins: ['Cylinder', 'Dual Recycle', 'Compact', 'Square Box'],
    busstops: ['Minimal Canopy', 'Glass Shelter', 'Wood Cabin'],
    facades: ['CoastalWhite', 'MediterraneanStucco', 'NordicTimber', 'UrbanD', 'CampusGlass'],
    roofs: ['CeramicLight', 'RoofA', 'SolarRoof', 'RoofC'],
    paving: ['WarmStone', 'Permeable', 'StoneA', 'Concrete']
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

export const FACADE_RECIPES = {
  CampusGlass:         { floorRows: 14, windowCols: 5, groundShop: true,  windowAspect: 0.82, glassPattern: 'horizontal-bands', columnPattern: 'flat',       accent: '#3d6b85' },
  CurtainWall:         { floorRows: 16, windowCols: 8, groundShop: true,  windowAspect: 0.88, glassPattern: 'spandrel',         columnPattern: 'curtain',    accent: '#1e3a5f', windowFrameColor: '#94a3b8' },
  EcoTimber:           { floorRows: 10, windowCols: 4, groundShop: true,  windowAspect: 0.55, glassPattern: 'uniform',          columnPattern: 'timber',     accent: '#6b4a2a' },
  NordicTimber:        { floorRows:  9, windowCols: 4, groundShop: false, windowAspect: 0.64, glassPattern: 'balcony-bands',    columnPattern: 'slats',      accent: '#523a24', windowFrameColor: '#292524' },
  CivicStone:          { floorRows: 12, windowCols: 5, groundShop: false, windowAspect: 0.35, glassPattern: 'shutters',         columnPattern: 'pilaster',   accent: '#8a7a62' },
  HeritageStone:       { floorRows:  8, windowCols: 5, groundShop: true,  windowAspect: 0.44, glassPattern: 'french-arch',      columnPattern: 'ashlar',     accent: '#786b59', windowFrameColor: '#44403c' },
  DenseBrick:          { floorRows: 11, windowCols: 6, groundShop: true,  windowAspect: 0.62, glassPattern: 'uniform',          columnPattern: 'brick',      accent: '#4a1f15' },
  AnatolianBrick:      { floorRows:  9, windowCols: 4, groundShop: true,  windowAspect: 0.58, glassPattern: 'balcony-bands',    columnPattern: 'brick',      accent: '#7c2d12', windowFrameColor: '#f5f5f4' },
  IndustrialLoft:      { floorRows:  8, windowCols: 5, groundShop: true,  windowAspect: 0.74, glassPattern: 'mullion-grid',     columnPattern: 'industrial', accent: '#27272a', windowFrameColor: '#18181b' },
  BrutalistConcrete:   { floorRows: 11, windowCols: 6, groundShop: false, windowAspect: 0.52, glassPattern: 'spandrel',         columnPattern: 'waffle',     accent: '#52525b', windowFrameColor: '#3f3f46' },
  CoastalWhite:        { floorRows:  9, windowCols: 3, groundShop: true,  windowAspect: 0.95, glassPattern: 'striped',          columnPattern: 'flat',       accent: '#bcd1dc' },
  MediterraneanStucco: { floorRows: 10, windowCols: 4, groundShop: true,  windowAspect: 0.50, glassPattern: 'shutters',         columnPattern: 'flat',       accent: '#a05a3c' },
  UrbanE:              { floorRows: 13, windowCols: 6, groundShop: true,  windowAspect: 0.78, glassPattern: 'horizontal-bands', columnPattern: 'flat',       accent: '#2f3e52' },
  UrbanF:              { floorRows: 12, windowCols: 5, groundShop: true,  windowAspect: 0.70, glassPattern: 'balcony-bands',    columnPattern: 'pilaster',   accent: '#334155', windowFrameColor: '#cbd5e1' }
};

/** Colour of a named asset variant (cars, people, trees), or the fallback. */
export function assetColor(name, fallback = 0x64748b) {
  return namedAssetColors[name] ?? fallback;
}
