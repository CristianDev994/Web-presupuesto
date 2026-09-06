// Service Worker para funcionamiento Offline y PWA de Presupuesto Personal
// Reglas: Variables, constantes y comentarios en español.

const NOMBRE_CACHE = 'presupuesto-cache-v1';
const RECURSOS_LOCALES = [
    './',
    './index.html',
    './estilos.css',
    './app.js',
    './controlador_interfaz.js',
    './gestor_financiero.js',
    './utilidades_dinero.js',
    './datos_iniciales.js',
    './exportador_excel.js',
    './manifest.json',
    './icono.svg'
];

self.addEventListener('install', eventoInstalacion => {
    eventoInstalacion.waitUntil(
        caches.open(NOMBRE_CACHE).then(cache => {
            return cache.addAll(RECURSOS_LOCALES);
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', eventoActivacion => {
    eventoActivacion.waitUntil(
        caches.keys().then(claves => {
            return Promise.all(
                claves.filter(clave => clave !== NOMBRE_CACHE).map(claveAntigua => {
                    return caches.delete(claveAntigua);
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', eventoPeticion => {
    const solicitud = eventoPeticion.request;

    // Solo interceptar peticiones GET
    if (solicitud.method !== 'GET') return;

    eventoPeticion.respondWith(
        caches.match(solicitud).then(respuestaCache => {
            if (respuestaCache) {
                // Devolver recurso desde caché y actualizar en segundo plano
                fetch(solicitud).then(respuestaRed => {
                    if (respuestaRed && respuestaRed.status === 200) {
                        const clonRespuesta = respuestaRed.clone();
                        caches.open(NOMBRE_CACHE).then(cache => {
                            cache.put(solicitud, clonRespuesta);
                        });
                    }
                }).catch(() => {
                    // Si no hay red, ya devolvimos la caché
                });

                return respuestaCache;
            }

            // Si no está en caché, buscar en red
            return fetch(solicitud).then(respuestaRed => {
                if (!respuestaRed || respuestaRed.status !== 200 || respuestaRed.type === 'opaque') {
                    return respuestaRed;
                }

                const clonRespuesta = respuestaRed.clone();
                caches.open(NOMBRE_CACHE).then(cache => {
                    cache.put(solicitud, clonRespuesta);
                });

                return respuestaRed;
            }).catch(() => {
                // Fallback para navegación de páginas si está offline
                if (solicitud.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
