// Punto de entrada principal de la aplicación web de presupuesto

import { ControladorInterfaz } from './controlador_interfaz.js';

document.addEventListener('DOMContentLoaded', () => {
    const controladorApp = new ControladorInterfaz();
    window.controladorApp = controladorApp;
    controladorApp.iniciar();
    console.log('Aplicación de Presupuesto Personal inicializada con éxito.');

    // Registro de Service Worker para soporte PWA y modo sin conexión
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registro => {
                    console.log('Service Worker registrado correctamente:', registro.scope);
                })
                .catch(errorRegistro => {
                    console.warn('Aviso: no se pudo registrar el Service Worker:', errorRegistro);
                });
        });
    }
});

