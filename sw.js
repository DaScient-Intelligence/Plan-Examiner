/**
 * Plan-Examiner Service Worker
 * Caches static assets for offline use (PWA).
 */

var CACHE_NAME = 'plan-examiner-v2';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/app.js',
  '/assets/js/agent/rule-engine.js',
  '/assets/js/agent/extractors.js',
  '/assets/js/agent/llm-bridge.js',
  '/assets/js/agent/pipeline.js',
  '/assets/js/utils/history.js',
  '/assets/js/utils/export.js',
  '/assets/data/rules/index.json',
  '/assets/data/rules/ibc-2021.json',
  '/assets/data/rules/ada-2010.json',
  '/assets/data/rules/nfpa-101.json',
  '/manifest.json',
  '/404.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).catch(function (err) {
      console.warn('[SW] Pre-cache failed (some assets may be unavailable):', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  // Only handle GET requests; skip cross-origin API calls (LLM providers)
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        // Cache successful same-origin responses
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        }
        return response;
      });
    }).catch(function () {
      // Offline fallback: serve 404 page for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/404.html');
      }
    })
  );
});
