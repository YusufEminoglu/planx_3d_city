// ESLint (flat config) for the browser viewer, its workers and the node
// test/benchmark scripts. Run with: npm run lint
const browser = [
  'window', 'document', 'navigator', 'performance', 'localStorage', 'sessionStorage', 'console',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'AbortController', 'URL', 'URLSearchParams', 'Image', 'Blob', 'MediaRecorder', 'GeoTIFF', 'location',
  'innerWidth', 'innerHeight', 'alert', 'confirm', 'prompt', 'Worker', 'self', 'ResizeObserver', 'getComputedStyle',
  'structuredClone', 'TextDecoder', 'TextEncoder', 'FileReader', 'atob', 'btoa', 'Event', 'CustomEvent', 'EventTarget',
  'history', 'matchMedia', 'crypto', 'PerformanceObserver', 'devicePixelRatio', 'addEventListener',
  'removeEventListener', 'queueMicrotask', 'DOMParser', 'FormData', 'ImageData', 'OffscreenCanvas', 'createImageBitmap',
  'WebGLRenderingContext', 'WebGL2RenderingContext', 'MutationObserver', 'IntersectionObserver', 'HTMLCanvasElement',
  'HTMLElement', 'Node', 'Element', 'screen', 'open', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'DataTransfer',
  'File', 'caches', 'indexedDB', 'CSS', 'Audio', 'AudioContext', 'speechSynthesis', 'SpeechSynthesisUtterance',
  'getSelection', 'ClipboardItem', 'DOMRect', 'VideoEncoder', 'VideoFrame'
];
const node = ['process', 'Buffer', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'URL', 'TextEncoder', 'TextDecoder', 'performance', 'fetch', 'structuredClone'];
const globals = (names) => Object.fromEntries(names.map((g) => [g, 'readonly']));
const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  'no-constant-binary-expression': 'error'
};

export default [
  { ignores: ['web/assets/vendor/**', 'node_modules/**', 'web/data/**'] },
  {
    files: ['web/src/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals(browser) },
    rules
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals(node), ...globals(browser) } },
    rules
  }
];
