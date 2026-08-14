const CACHE_NAME = 'medibrief-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/medibrief-icon.svg'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('medibrief-shell-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key)),
            ))
            .then(() => self.clients.claim()),
    );
});

const sameOrigin = request => {
    try {
        return new URL(request.url).origin === self.location.origin;
    } catch {
        return false;
    }
};

self.addEventListener('fetch', event => {
    const { request } = event;
    if (
        request.method !== 'GET'
        || !sameOrigin(request)
        || request.headers.has('range')
        || new URL(request.url).pathname === '/sw.js'
    ) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put('/', response.clone());
                }
                return response;
            } catch {
                return (await caches.match('/'))
                    || new Response('MediBrief is offline and the app shell is unavailable.', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                    });
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    })());
});
