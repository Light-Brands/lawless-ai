const CACHE_NAME = 'lawless-ai-v1';
const STATIC_CACHE_NAME = 'lawless-ai-static-v1';
const VERSION_KEY = 'lawless-ai-version';

// Static assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
];

// Fetch current version from server
async function fetchVersion() {
  try {
    const response = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      return data.timestamp;
    }
  } catch (e) {
    console.log('Failed to fetch version:', e);
  }
  return null;
}

// Get stored version
async function getStoredVersion() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(VERSION_KEY);
    if (response) {
      const text = await response.text();
      return parseInt(text, 10);
    }
  } catch (e) {
    console.log('Failed to get stored version:', e);
  }
  return null;
}

// Store version
async function storeVersion(version) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(VERSION_KEY, new Response(String(version)));
  } catch (e) {
    console.log('Failed to store version:', e);
  }
}

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('All caches cleared');
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    (async () => {
      // Fetch and store the current version
      const version = await fetchVersion();
      if (version) {
        await storeVersion(version);
      }

      // Cache static assets
      const cache = await caches.open(STATIC_CACHE_NAME);
      console.log('Caching static assets');
      await cache.addAll(STATIC_ASSETS);
    })()
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - check version and clear old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    (async () => {
      const [currentVersion, storedVersion] = await Promise.all([
        fetchVersion(),
        getStoredVersion(),
      ]);

      console.log('Version check:', { current: currentVersion, stored: storedVersion });

      // If version changed, clear all caches and re-cache
      if (currentVersion && storedVersion && currentVersion !== storedVersion) {
        console.log('New version detected! Clearing caches...');
        await clearAllCaches();
        await storeVersion(currentVersion);

        // Re-cache static assets
        const cache = await caches.open(STATIC_CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);

        // Notify all clients to refresh
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach((client) => {
          client.postMessage({ type: 'VERSION_UPDATED', version: currentVersion });
        });
      } else if (currentVersion && !storedVersion) {
        // First install, just store the version
        await storeVersion(currentVersion);
      }

      // Clean up any unknown caches (safety net)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })()
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - network first for API, stale-while-revalidate for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip version.json - always fetch fresh
  if (url.pathname === '/version.json') {
    return;
  }

  // API requests - network only (chat needs live connection)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'You are offline. Please check your connection.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Static assets and pages - stale while revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Update cache with fresh response
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return cached response or offline fallback
          return cachedResponse;
        });

      // Return cached response immediately, update in background
      return cachedResponse || fetchPromise;
    })
  );
});

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  // Force cache clear on demand
  if (event.data === 'clearCache') {
    event.waitUntil(
      (async () => {
        await clearAllCaches();
        const version = await fetchVersion();
        if (version) {
          await storeVersion(version);
        }
        // Re-cache static assets
        const cache = await caches.open(STATIC_CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);
        // Notify client
        event.source?.postMessage({ type: 'CACHE_CLEARED' });
      })()
    );
  }

  // Check for updates
  if (event.data === 'checkUpdate') {
    event.waitUntil(
      (async () => {
        const [currentVersion, storedVersion] = await Promise.all([
          fetchVersion(),
          getStoredVersion(),
        ]);
        if (currentVersion && storedVersion && currentVersion !== storedVersion) {
          event.source?.postMessage({ type: 'UPDATE_AVAILABLE', version: currentVersion });
        } else {
          event.source?.postMessage({ type: 'UP_TO_DATE' });
        }
      })()
    );
  }
});
