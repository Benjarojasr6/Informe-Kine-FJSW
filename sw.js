/* Service worker: la app funciona sin conexión.
   Al subir una versión nueva a GitHub, cambia VERSION para forzar la actualización. */
const VERSION = '1.5.0';
const CACHE = 'kine-sw-' + VERSION;

const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/report.css',
  './js/store.js', './js/calc.js', './js/categorias.js', './js/icons.js', './js/bodymap.js',
  './js/report.js', './js/pdf.js', './js/ui.js', './js/forms.js', './js/manual.js', './js/screens.js', './js/bitacora.js', './js/navegacion.js', './js/kine.js', './js/seguro.js', './js/partidos.js', './js/firebase-config.js', './js/nube.js', './js/fuentes.js', './js/salud.js', './js/app.js', './js/recordatorios.js',
  './fonts/Inter-Regular.woff', './fonts/Inter-SemiBold.woff', './fonts/Inter-Bold.woff', './fonts/Caladea-Regular.woff', './fonts/InterDisplay-Bold.woff', './fonts/InterDisplay-Regular.woff', './fonts/Poppins-Bold.woff', './fonts/Poppins-Regular.woff', './fonts/Pagella-Italic.woff', './fonts/Pagella-Bold.woff', './fonts/Pagella-Regular.woff', './fonts/Carlito-Bold.woff', './fonts/Carlito-Regular.woff', './fonts/Lora-Italic.woff', './fonts/Lora-Bold.woff', './fonts/Lora-Regular.woff', './fonts/Caladea-Bold.woff', './fonts/Caladea-Italic.woff',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png',
  './img/insignia-512.png', './img/insignia-kinesiologia.png', './img/escudo-sw-verde.png', './img/escudo-sw-blanco.png',
  './img/iconos/atenciones.png', './img/iconos/termoterapia.png', './img/iconos/crioterapia.png',
  './img/iconos/vendaje.png', './img/iconos/ejercicio.png', './img/iconos/presoterapia.png',
  './img/iconos/masaje.png', './img/iconos/puncion.png', './img/iconos/mok.png',
  './img/rivales/palestino.png', './img/rivales/audax.png', './img/rivales/everton.png',
  './img/rivales/coquimbo.png', './img/rivales/iquique.png', './img/rivales/u-de-chile.png',
  './img/rivales/temuco.png', './img/rivales/cobreloa.png', './img/rivales/ohiggins.png',
  './img/rivales/colo-colo.png', './img/rivales/union-espanola.png', './img/rivales/u-de-concepcion.png',
  './img/rivales/recoleta.png', './img/rivales/u-catolica.png', './img/rivales/huachipato.png'
];

// Librerías de Firebase (se cargan desde Google): se guardan aparte para que la app abra sin conexión.
const SDK_CACHE = 'kine-sdk';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const SDK_ARCHIVOS = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'].map((f) => SDK + f);

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))), // siempre lo último de GitHub, no una copia vieja del navegador
    caches.open(SDK_CACHE).then((c) => Promise.all(SDK_ARCHIVOS.map((u) => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {}))))
  ]));
});

// La versión nueva espera a que la persona toque “Actualizar” en el aviso de la app.
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('kine-sw-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero lo guardado (rápido y sin conexión); en segundo plano se actualiza.
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method === 'GET' && url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(SDK_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const red = fetch(req).then((res) => {
        if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return res;
      }).catch(() => hit);
      return hit || red;
    })
  );
});
