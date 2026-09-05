// Servidor local de desarrollo sin dependencias externas
// Reglas: Variables, funciones y constantes en español.

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const nombreArchivoActual = fileURLToPath(import.meta.url);
const directorioActual = path.dirname(nombreArchivoActual);
const PUERTO = 8085;

const TIPOS_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const servidor = http.createServer((solicitud, respuesta) => {
    let rutaSolicitada = solicitud.url.split('?')[0];
    if (rutaSolicitada === '/') {
        rutaSolicitada = '/index.html';
    }

    const rutaArchivo = path.join(directorioActual, rutaSolicitada);
    const extension = path.extname(rutaArchivo).toLowerCase();
    const tipoContenido = TIPOS_MIME[extension] || 'text/plain';

    fs.readFile(rutaArchivo, (error, contenido) => {
        if (error) {
            if (error.code === 'ENOENT') {
                respuesta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                respuesta.end('Archivo no encontrado');
            } else {
                respuesta.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                respuesta.end('Error interno del servidor');
            }
        } else {
            respuesta.writeHead(200, { 'Content-Type': tipoContenido });
            respuesta.end(contenido);
        }
    });
});

servidor.listen(PUERTO, () => {
    console.log(`Servidor de desarrollo activo en: http://localhost:${PUERTO}`);
});
