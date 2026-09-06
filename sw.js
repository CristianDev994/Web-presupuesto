// Service Worker para funcionamiento sin conexión y PWA de Presupuesto Personal.
// Reglas: Variables, constantes y comentarios en español.

// IMPORTANTE: sube este número en cada publicación. Al cambiar el archivo, el
// navegador reinstala el Service Worker, precarga los recursos nuevos y borra
// las cachés anteriores; si no cambia, los visitantes que ya entraron seguirían
// viendo indefinidamente la versión vieja guardada en su navegador.
const VERSION_CACHE = 'v3';
const NOMBRE_CACHE = `presupuesto-cache-${VERSION_CACHE}`;

const RECURSOS_LOCALES = [
    './',
    './index.html',
    './estilos.css',
    './tema_inicial.js',
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
        caches.open(NOMBRE_CACHE)
            .then(cache => cache.addAll(RECURSOS_LOCALES))
            // Si algún recurso falla, se instala igualmente: la estrategia de
            // red primero permite recuperarlo más adelante.
            .catch(error => console.warn('Precarga parcial del Service Worker:', error))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', eventoActivacion => {
    eventoActivacion.waitUntil(
        caches.keys()
            .then(claves => Promise.all(
                claves
                    .filter(clave => clave !== NOMBRE_CACHE)
                    .map(claveAntigua => caches.delete(claveAntigua))
            ))
            .then(() => self.clients.claim())
    );
});

/**
 * Estrategia: RED PRIMERO con respaldo en caché.
 *
 * El HTML y los módulos JavaScript se despliegan siempre juntos y comparten
 * nombres de archivo sin huella digital. Servir desde caché primero podía
 * mezclar un index.html antiguo con módulos nuevos (o al revés) y romper la
 * interfaz, además de retrasar una versión cada mejora publicada.
 * Con red primero, quien tenga conexión ve siempre la última versión, y la
 * caché solo entra en juego cuando no hay red.
 */
self.addEventListener('fetch', eventoPeticion => {
    const solicitud = eventoPeticion.request;

    if (solicitud.method !== 'GET') return;

    // Las peticiones a otros orígenes (CDN de iconos, gráficos o Excel) las
    // gestiona la caché HTTP del navegador; aquí solo se controla la app.
    const url = new URL(solicitud.url);
    if (url.origin !== self.location.origin) return;

    eventoPeticion.respondWith(
        fetch(solicitud)
            .then(respuestaRed => {
                if (respuestaRed && respuestaRed.status === 200 && respuestaRed.type === 'basic') {
                    const clonRespuesta = respuestaRed.clone();
                    caches.open(NOMBRE_CACHE).then(cache => cache.put(solicitud, clonRespuesta));
                }
                return respuestaRed;
            })
            .catch(() => caches.match(solicitud).then(respuestaCache => {
                if (respuestaCache) return respuestaCache;

                // Sin conexión y sin copia: se devuelve la portada de la app
                if (solicitud.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                return new Response('Recurso no disponible sin conexión', {
                    status: 503,
                    statusText: 'Sin conexión',
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                });
            }))
    );
});
