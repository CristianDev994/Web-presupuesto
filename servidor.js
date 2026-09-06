// Servidor local de desarrollo sin dependencias externas.
// Se limita deliberadamente a loopback y a los archivos publicos del proyecto.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nombreArchivoActual = fileURLToPath(import.meta.url);
const directorioActual = path.dirname(nombreArchivoActual);
const directorioReal = fs.realpathSync(directorioActual);
const DIRECCION_LOCAL = '127.0.0.1';
const puertoSolicitado = Number.parseInt(process.env.PRESUPUESTO_PUERTO || '', 10);
const PUERTO = Number.isInteger(puertoSolicitado) && puertoSolicitado >= 1 && puertoSolicitado <= 65535
    ? puertoSolicitado
    : 8085;

const TIPOS_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

const POLITICA_SEGURIDAD_CONTENIDO = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net https://cdn.sheetjs.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
].join('; ');

function construirCabeceras(tipoContenido = 'text/plain; charset=utf-8', controlCache = 'no-store') {
    return {
        'Content-Type': tipoContenido,
        'Cache-Control': controlCache,
        'Content-Security-Policy': POLITICA_SEGURIDAD_CONTENIDO,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY',
        'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
    };
}

function responderTexto(solicitud, respuesta, estado, mensaje, cabecerasAdicionales = {}) {
    const contenido = Buffer.from(mensaje, 'utf8');
    respuesta.writeHead(estado, {
        ...construirCabeceras(),
        ...cabecerasAdicionales,
        'Content-Length': contenido.length
    });
    respuesta.end(solicitud.method === 'HEAD' ? undefined : contenido);
}

function estaDentroDelDirectorio(rutaReal) {
    const rutaRelativa = path.relative(directorioReal, rutaReal);
    return rutaRelativa === '' || (!rutaRelativa.startsWith(`..${path.sep}`)
        && rutaRelativa !== '..'
        && !path.isAbsolute(rutaRelativa));
}

function resolverRutaPublica(urlOriginal) {
    let urlSolicitada;
    try {
        urlSolicitada = new URL(urlOriginal || '/', 'http://localhost');
    } catch {
        return { error: 400 };
    }

    if (urlSolicitada.origin !== 'http://localhost') return { error: 400 };

    let rutaDecodificada;
    try {
        rutaDecodificada = decodeURIComponent(urlSolicitada.pathname).replace(/\\/g, '/');
    } catch {
        return { error: 400 };
    }

    if (rutaDecodificada.includes('\0')) return { error: 400 };
    if (rutaDecodificada === '/') rutaDecodificada = '/index.html';

    const segmentos = rutaDecodificada.split('/').filter(Boolean);
    if (segmentos.some(segmento => segmento === '..' || segmento.startsWith('.'))) {
        return { error: 404 };
    }

    const rutaArchivo = path.resolve(directorioReal, ...segmentos);
    if (!estaDentroDelDirectorio(rutaArchivo)) return { error: 404 };
    return { rutaArchivo };
}

function obtenerControlCache(rutaArchivo) {
    const nombre = path.basename(rutaArchivo).toLowerCase();
    const extension = path.extname(nombre);
    if (nombre === 'sw.js' || nombre === 'manifest.json' || extension === '.html') {
        return 'no-cache, no-store, must-revalidate';
    }
    return 'public, max-age=300, must-revalidate';
}

const servidor = http.createServer((solicitud, respuesta) => {
    if (solicitud.method !== 'GET' && solicitud.method !== 'HEAD') {
        responderTexto(solicitud, respuesta, 405, 'Metodo no permitido', { Allow: 'GET, HEAD' });
        return;
    }

    const rutaResuelta = resolverRutaPublica(solicitud.url);
    if (rutaResuelta.error) {
        const mensaje = rutaResuelta.error === 400 ? 'Solicitud no valida' : 'Archivo no encontrado';
        responderTexto(solicitud, respuesta, rutaResuelta.error, mensaje);
        return;
    }

    fs.realpath(rutaResuelta.rutaArchivo, (errorRuta, rutaReal) => {
        if (errorRuta || !estaDentroDelDirectorio(rutaReal)) {
            responderTexto(solicitud, respuesta, 404, 'Archivo no encontrado');
            return;
        }

        fs.readFile(rutaReal, (errorLectura, contenido) => {
            if (errorLectura) {
                const noEncontrado = ['ENOENT', 'ENOTDIR', 'EISDIR', 'EACCES'].includes(errorLectura.code);
                responderTexto(
                    solicitud,
                    respuesta,
                    noEncontrado ? 404 : 500,
                    noEncontrado ? 'Archivo no encontrado' : 'Error interno del servidor'
                );
                return;
            }

            const extension = path.extname(rutaReal).toLowerCase();
            const tipoContenido = TIPOS_MIME[extension] || 'application/octet-stream';
            respuesta.writeHead(200, {
                ...construirCabeceras(tipoContenido, obtenerControlCache(rutaReal)),
                'Content-Length': contenido.length
            });
            respuesta.end(solicitud.method === 'HEAD' ? undefined : contenido);
        });
    });
});

servidor.on('error', error => {
    console.error(`No se pudo iniciar el servidor local: ${error.message}`);
    process.exitCode = 1;
});

servidor.listen(PUERTO, DIRECCION_LOCAL, () => {
    console.log(`Servidor de desarrollo activo en: http://${DIRECCION_LOCAL}:${PUERTO}`);
});
