// Punto de entrada principal de la aplicación web de presupuesto

import { ControladorInterfaz } from './controlador_interfaz.js';

document.addEventListener('DOMContentLoaded', () => {
    const controladorApp = new ControladorInterfaz();
    window.controladorApp = controladorApp;
    controladorApp.iniciar();
    console.log('Aplicación de Presupuesto Personal inicializada con éxito.');
});
