// Service worker da versão web: abre rápido e funciona sem internet (menos a IA).
// Arquivos do app: rede primeiro, cache se estiver offline. Biblioteca do Whisper (URL com versão fixa): cache primeiro.
// Áudio fica fora: o Safari pede trechos (Range) e o cache do navegador já cuida disso.
const CACHE = 'talkready-v3';
const SHELL = [
  './', 'index.html', 'styles.css', 'fonts.css', 'app.js', 'logic.js', 'data.js', 'modules.js', 'prompts.js',
  'web-api.js', 'asr-worker.js', 'whisper-score.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
  'fonts/inter-tight-latin-400-normal.woff2', 'fonts/inter-tight-latin-500-normal.woff2', 'fonts/inter-tight-latin-600-normal.woff2',
  'fonts/inter-tight-latin-700-normal.woff2', 'fonts/ibm-plex-mono-latin-400-normal.woff2', 'fonts/ibm-plex-mono-latin-500-normal.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || req.headers.has('range')) return;
  if (url.origin === 'https://cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin || url.pathname.includes('/modulos/')) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
