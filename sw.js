
const CACHE_NAME = 'medibrief-v5.0';

// Explicitly cache the ESM modules defined in the importmap
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  '/workers/pcm-processor.js',
  // External Libraries (Must match importmap versions exactly)
  'https://cdn.tailwindcss.com?plugins=typography',
  'https://aistudiocdn.com/@google/genai@^1.29.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/jspdf@2.5.2?exports=jsPDF',
  'https://esm.sh/dompurify@3.0.6',
  'https://aistudiocdn.com/marked@^17.0.0',
  'https://esm.sh/uuid@^13.0.0',
  'https://esm.sh/recharts@2.12.7?external=react,react-dom',
  'https://esm.sh/zustand@4.5.2',
  'https://esm.sh/zustand@4.5.2/middleware',
  'https://esm.sh/zustand@^5.0.10/',
  'https://esm.sh/zod@3.22.4',
  'https://esm.sh/idb-keyval@6.2.1',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
          // Fallback logic for offline navigation
          if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
          }
      });
    })
  );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
