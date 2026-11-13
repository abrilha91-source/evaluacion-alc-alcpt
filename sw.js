// Service worker de Evaluación Oficial · caché de la app (sin datos de usuario). Versión b3eef760
const C = 'eo-app-b3eef760', D = 'eo-d';
const FILES = ["./","index.html","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png","js/adjuntos.js","js/aviso.js","js/common.js","js/config.js","js/crypto.js","js/db.js","js/en.js","js/exam.js","js/integrity.js","js/main.js","js/order.js","js/pdfimport.js","js/protocol.js","js/qr.js","js/reglas.js","js/util.js","js/v-adm.js","js/v-apl.js","js/v-cadete.js","js/xlsxout.js","css/NotoSans-latin.woff2","css/styles.css","vendor/jsQR.js","vendor/nacl-fast.min.js","vendor/pdf.min.mjs","vendor/pdf.worker.min.mjs","vendor/qrcode.js","vendor/xlsx.bundle.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('eo-app-') && k !== C) || k.startsWith('eo-shell-') || k === 'eo-packs-v1').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return; const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('/d/m.json')) { // lista de bloques: red primero, caché si no hay internet
    e.respondWith(fetch(r, { cache: 'no-store' }).then(n => { const cp = n.clone(); if (n.ok && n.status === 200) caches.open(D).then(c => c.put('d/m.json', cp)); return n; }).catch(() => caches.match('d/m.json', { ignoreSearch: true }))); return; }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(m => m || fetch(r).then(n => { if (n.ok && n.status === 200 && /\/d\/[0-9a-f]{24}\.bin$/.test(u.pathname)) { const cp = n.clone(); caches.open(D).then(c => c.put(r, cp)); } return n; }).catch(() => (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
