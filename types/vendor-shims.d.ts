// Vendored libraries are plain JS without type declarations: treat them as
// untyped so `npm run typecheck` checks the viewer's own code only.
declare module 'three';
declare module 'three/addons/*';
declare module 'three-mesh-bvh';
declare module '*/three.module.js';
declare module '*/mp4-muxer.mjs';
