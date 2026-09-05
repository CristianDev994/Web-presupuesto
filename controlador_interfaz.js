// Controlador principal de la interfaz: renderizado, eventos y accesibilidad.
// Todo el dinero llega del gestor en céntimos enteros y solo se convierte a
// texto en el último momento con el formateador español.

import {
    CANALES_PAGO,
    CATEGORIAS_GASTO,
    SUBTIPOS_PATRIMONIO,
    PERFILES_PRESUPUESTO,
    LUGARES_FRECUENTES_SUGERIDOS,
    APIS_INVERSION_GRATUITAS
} from './datos_iniciales.js';

import { GestorFinanciero } from './gestor_financiero.js';
import { ExportadorExcel } from './exportador_excel.js';
import {
    aCentimos,
    aEuros,
    formatearEuros,
    formatearPorcentaje,
    formatearParaEntrada,
    calcularPorcentaje
} from './utilidades_dinero.js';

const CLAVE_TEMA = 'presupuesto_tema';

export class ControladorInterfaz {
    constructor() {
        this.gestor = new GestorFinanciero();
        this.exportador = new ExportadorExcel(this.gestor);
        this.filtroCanal = 'TODOS';
        this.idPartidaEnEdicion = null;
        this.graficos = {};
        this.pestanaActiva = 'panel-gastos';
        this.elementoConFocoPrevio = null;
        this.resolverConfirmacion = null;
        this.temporizadorGraficos = null;
    }

    iniciar() {
        this.rellenarSelectores();
        this.configurarTema();
        this.configurarPanelAcciones();
        this.configurarNavegacion();
        this.configurarAsistente();
        this.configurarFormularioCompra();
        this.configurarTablasInteractivas();
        this.configurarModalPartida();
        this.configurarModalConfirmacion();
        this.configurarFiltros();
        this.configurarCopiasSeguridad();
        this.configurarRedimensionado();
        this.renderizarApis();
        this.actualizarVistaCompleta();
    }

    // ======================================================================
    // UTILIDADES
    // ======================================================================

    obtener(id) {
        return document.getElementById(id);
    }

    /** Escapa el texto introducido por la persona usuaria antes de inyectarlo como HTML. */
    escapar(valor) {
        const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(valor === null || valor === undefined ? '' : valor)
            .replace(/[&<>"']/g, caracter => mapa[caracter]);
    }

    actualizarIconos() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    mostrarAviso(mensaje, tipo = 'info') {
        const contenedor = this.obtener('contenedor-avisos');
        if (!contenedor) return;

        const iconos = { exito: 'check-circle-2', error: 'alert-triangle', info: 'info' };
        const aviso = document.createElement('div');
        aviso.className = `aviso-emergente aviso-emergente--${tipo}`;
        aviso.innerHTML = `
            <i data-lucide="${iconos[tipo] || iconos.info}" aria-hidden="true"></i>
            <span>${this.escapar(mensaje)}</span>
        `;

        contenedor.appendChild(aviso);
        this.actualizarIconos();

        setTimeout(() => {
            aviso.classList.add('saliendo');
            setTimeout(() => aviso.remove(), 220);
        }, 3600);
    }

    /** Sustituye a window.confirm con un diálogo propio coherente con el diseño. */
    pedirConfirmacion({ titulo, texto, textoBoton = 'Sí, continuar' }) {
        return new Promise(resolver => {
            const modal = this.obtener('modal-confirmacion');
            if (!modal) {
                resolver(false);
                return;
            }

            this.obtener('titulo-confirmacion').textContent = titulo;
            this.obtener('texto-confirmacion').innerHTML = texto;
            this.obtener('boton-aceptar-confirmacion').textContent = textoBoton;

            this.resolverConfirmacion = resolver;
            this.abrirModal(modal);
        });
    }

    cerrarConfirmacion(respuesta) {
        const modal = this.obtener('modal-confirmacion');
        this.cerrarModal(modal);
        if (this.resolverConfirmacion) {
            this.resolverConfirmacion(respuesta);
            this.resolverConfirmacion = null;
        }
    }

    // ======================================================================
    // MODALES: APERTURA, CIERRE Y FOCO
    // ======================================================================

    abrirModal(modal) {
        if (!modal) return;
        this.elementoConFocoPrevio = document.activeElement;
        modal.classList.add('abierto');
        document.body.style.overflow = 'hidden';

        // Se enfoca el primer campo del formulario, no el aspa de cerrar
        const enfocable = modal.querySelector('input:not([type="checkbox"]), select, textarea')
            || modal.querySelector('.pie-modal button')
            || modal.querySelector('button');
        if (enfocable) setTimeout(() => enfocable.focus(), 60);
    }

    cerrarModal(modal) {
        if (!modal) return;
        modal.classList.remove('abierto');
        if (!document.querySelector('.fondo-modal.abierto')) {
            document.body.style.overflow = '';
        }
        if (this.elementoConFocoPrevio && typeof this.elementoConFocoPrevio.focus === 'function') {
            this.elementoConFocoPrevio.focus();
            this.elementoConFocoPrevio = null;
        }
    }

    /** Mantiene el tabulador dentro del modal abierto y cierra con Escape. */
    configurarTecladoGlobal() {
        document.addEventListener('keydown', evento => {
            const modalAbierto = document.querySelector('.fondo-modal.abierto');

            if (evento.key === 'Escape') {
                if (modalAbierto) {
                    if (modalAbierto.id === 'modal-confirmacion') {
                        this.cerrarConfirmacion(false);
                    } else {
                        this.cerrarModal(modalAbierto);
                    }
                    return;
                }
                if (this.obtener('panel-acciones').classList.contains('abierto')) {
                    this.alternarPanelAcciones(false);
                }
                return;
            }

            if (evento.key !== 'Tab' || !modalAbierto) return;

            const enfocables = Array.from(modalAbierto.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
            )).filter(elemento => elemento.offsetParent !== null);

            if (enfocables.length === 0) return;

            const primero = enfocables[0];
            const ultimo = enfocables[enfocables.length - 1];

            if (evento.shiftKey && document.activeElement === primero) {
                evento.preventDefault();
                ultimo.focus();
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
                evento.preventDefault();
                primero.focus();
            }
        });
    }

    // ======================================================================
    // CONFIGURACIÓN INICIAL
    // ======================================================================

    rellenarSelectores() {
        const opcionesCategorias = Object.entries(CATEGORIAS_GASTO)
            .map(([clave, config]) => `<option value="${clave}">${this.escapar(config.nombre)}</option>`)
            .join('');

        const selectorCategoriaCompra = this.obtener('selector-categoria-compra');
        if (selectorCategoriaCompra) {
            selectorCategoriaCompra.innerHTML = opcionesCategorias;
            selectorCategoriaCompra.value = 'VIVIENDA_COMIDA';
        }

        const selectorCategoriaPartida = this.obtener('campo-categoria');
        if (selectorCategoriaPartida) {
            selectorCategoriaPartida.innerHTML = opcionesCategorias;
            selectorCategoriaPartida.value = 'OCIO_ESTILO_VIDA';
        }

        const listaLugares = this.obtener('sugerencias-lugares');
        if (listaLugares) {
            listaLugares.innerHTML = LUGARES_FRECUENTES_SUGERIDOS
                .map(lugar => `<option value="${this.escapar(lugar)}"></option>`)
                .join('');
        }

        this.configurarCamposMonetarios();
        this.configurarTecladoGlobal();
    }

    /**
     * Los campos de dinero son de texto para aceptar la coma decimal española
     * (un input[type=number] descarta "33,33" y deja el campo vacío).
     * Al salir del campo se normaliza el valor a la forma canónica "33,33".
     */
    configurarCamposMonetarios() {
        document.querySelectorAll('.campo-monetario').forEach(campo => {
            campo.addEventListener('blur', () => {
                const centimos = aCentimos(campo.value);
                const nuevoValor = centimos > 0 ? formatearParaEntrada(centimos) : '';
                if (campo.value !== nuevoValor) {
                    campo.value = nuevoValor;
                    campo.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        });
    }

    configurarTema() {
        const boton = this.obtener('boton-tema');
        if (!boton) return;

        boton.addEventListener('click', () => {
            const temaActual = document.documentElement.getAttribute('data-tema');
            const nuevoTema = temaActual === 'claro' ? 'oscuro' : 'claro';
            document.documentElement.setAttribute('data-tema', nuevoTema);

            try {
                localStorage.setItem(CLAVE_TEMA, nuevoTema);
            } catch (error) {
                console.warn('No se pudo guardar la preferencia de tema:', error);
            }

            // Los gráficos llevan colores calculados: hay que rehacerlos
            this.renderizarGraficos();
            this.mostrarAviso(nuevoTema === 'claro' ? 'Tema claro activado' : 'Tema oscuro activado', 'info');
        });
    }

    alternarPanelAcciones(forzar) {
        const panel = this.obtener('panel-acciones');
        const velo = this.obtener('velo-panel');
        const boton = this.obtener('boton-menu-movil');
        if (!panel || !velo) return;

        const debeAbrir = forzar !== undefined ? forzar : !panel.classList.contains('abierto');
        panel.classList.toggle('abierto', debeAbrir);
        velo.classList.toggle('abierto', debeAbrir);
        document.body.style.overflow = debeAbrir ? 'hidden' : '';
        if (boton) boton.setAttribute('aria-expanded', String(debeAbrir));
    }

    configurarPanelAcciones() {
        const botonMenu = this.obtener('boton-menu-movil');
        const botonMas = this.obtener('boton-mas-movil');
        const velo = this.obtener('velo-panel');
        const panel = this.obtener('panel-acciones');

        if (botonMenu) botonMenu.addEventListener('click', () => this.alternarPanelAcciones());
        if (botonMas) botonMas.addEventListener('click', () => this.alternarPanelAcciones());
        if (velo) velo.addEventListener('click', () => this.alternarPanelAcciones(false));

        if (panel) {
            panel.addEventListener('click', evento => {
                const boton = evento.target.closest('[data-accion], [data-pestana]');
                if (!boton) return;

                const pestana = boton.getAttribute('data-pestana');
                if (pestana) {
                    this.alternarPanelAcciones(false);
                    this.cambiarPestana(pestana);
                    return;
                }

                this.alternarPanelAcciones(false);
                this.ejecutarAccionDatos(boton.getAttribute('data-accion'));
            });
        }
    }

    ejecutarAccionDatos(accion) {
        switch (accion) {
            case 'excel': this.exportarExcel(); break;
            case 'copia': this.descargarCopiaSeguridad(); break;
            case 'restaurar': this.obtener('input-archivo-copia').click(); break;
            case 'ejemplo': this.cargarCasoEjemplo(); break;
            case 'reiniciar': this.reiniciarPresupuesto(); break;
        }
    }

    configurarNavegacion() {
        document.querySelectorAll('[data-pestana]').forEach(boton => {
            if (boton.closest('#panel-acciones')) return;
            boton.addEventListener('click', () => this.cambiarPestana(boton.getAttribute('data-pestana')));
        });
    }

    cambiarPestana(destinoId) {
        if (!destinoId) return;
        this.pestanaActiva = destinoId;

        document.querySelectorAll('.boton-pestana, .item-nav').forEach(boton => {
            const esDestino = boton.getAttribute('data-pestana') === destinoId;
            boton.setAttribute('aria-selected', String(esDestino));
        });

        document.querySelectorAll('.panel-contenido').forEach(panel => {
            panel.classList.toggle('activo', panel.id === destinoId);
        });

        if (destinoId === 'panel-graficos') {
            this.renderizarGraficos();
        }

        const panel = this.obtener(destinoId);
        if (panel) {
            const cabecera = document.querySelector('.cabecera-app');
            const alturaCabecera = cabecera ? cabecera.offsetHeight : 0;
            const posicion = panel.getBoundingClientRect().top + window.scrollY - alturaCabecera - 12;
            window.scrollTo({ top: Math.max(0, posicion), behavior: 'smooth' });
        }
    }

    configurarRedimensionado() {
        // Los gráficos se rehacen al girar el móvil o cambiar el tamaño de la ventana
        window.addEventListener('resize', () => {
            clearTimeout(this.temporizadorGraficos);
            this.temporizadorGraficos = setTimeout(() => {
                if (this.pestanaActiva === 'panel-graficos') this.renderizarGraficos();
            }, 250);
        });
    }

    // ======================================================================
    // ASISTENTE DE INGRESOS
    // ======================================================================

    configurarAsistente() {
        const bloque = this.obtener('bloque-asistente');
        const formulario = this.obtener('formulario-ingresos');
        const inputCuenta = this.obtener('input-ingreso-cuenta');
        const inputFisico = this.obtener('input-ingreso-fisico');
        const selectorPerfil = this.obtener('selector-perfil');

        if (inputCuenta && this.gestor.ingresoCuentaCent > 0) {
            inputCuenta.value = formatearParaEntrada(this.gestor.ingresoCuentaCent);
        }
        if (inputFisico && this.gestor.ingresoFisicoCent > 0) {
            inputFisico.value = formatearParaEntrada(this.gestor.ingresoFisicoCent);
        }

        // El asistente arranca plegado si ya hay un presupuesto configurado
        if (bloque && this.gestor.tieneDatosConfigurados()) {
            bloque.open = false;
        }

        const actualizarResumenVivo = () => {
            const cuentaCent = Math.max(0, aCentimos(inputCuenta ? inputCuenta.value : 0));
            const fisicoCent = Math.max(0, aCentimos(inputFisico ? inputFisico.value : 0));
            const totalCent = cuentaCent + fisicoCent;

            const textoTotal = this.obtener('texto-total-vivo');
            const textoReparto = this.obtener('texto-reparto-vivo');

            if (textoTotal) textoTotal.textContent = formatearEuros(totalCent);
            if (textoReparto) {
                textoReparto.textContent = totalCent > 0
                    ? `${formatearPorcentaje(calcularPorcentaje(cuentaCent, totalCent, 0), 0)} en banco • ${formatearPorcentaje(calcularPorcentaje(fisicoCent, totalCent, 0), 0)} en efectivo`
                    : '0 % en banco • 0 % en efectivo';
            }
        };

        if (inputCuenta) inputCuenta.addEventListener('input', actualizarResumenVivo);
        if (inputFisico) inputFisico.addEventListener('input', actualizarResumenVivo);
        actualizarResumenVivo();

        if (selectorPerfil) {
            selectorPerfil.value = this.gestor.perfilSeleccionado;
            const describirPerfil = () => {
                const perfil = PERFILES_PRESUPUESTO[selectorPerfil.value];
                const texto = this.obtener('texto-perfil');
                if (perfil && texto) texto.textContent = perfil.descripcion;
            };
            selectorPerfil.addEventListener('change', describirPerfil);
            describirPerfil();
        }

        if (formulario) {
            formulario.addEventListener('submit', evento => {
                evento.preventDefault();
                const cuenta = inputCuenta ? inputCuenta.value : 0;
                const fisico = inputFisico ? inputFisico.value : 0;

                if (aCentimos(cuenta) + aCentimos(fisico) <= 0) {
                    this.mostrarAviso('Introduce un importe mayor que 0 € en banco o en efectivo.', 'error');
                    if (inputCuenta) inputCuenta.focus();
                    return;
                }

                this.gestor.generarPresupuestoBicanal(cuenta, fisico, selectorPerfil.value);
                this.actualizarVistaCompleta();
                if (bloque) bloque.open = false;
                this.mostrarAviso('Presupuesto calculado y repartido al céntimo.', 'exito');
                this.cambiarPestana('panel-gastos');
            });
        }

        const enlaceEjemplo = this.obtener('enlace-ejemplo');
        if (enlaceEjemplo) enlaceEjemplo.addEventListener('click', () => this.cargarCasoEjemplo());

        const botonEjemplo = this.obtener('boton-cargar-ejemplo');
        if (botonEjemplo) botonEjemplo.addEventListener('click', () => this.cargarCasoEjemplo());

        const botonReiniciar = this.obtener('boton-reiniciar');
        if (botonReiniciar) botonReiniciar.addEventListener('click', () => this.reiniciarPresupuesto());
    }

    cargarCasoEjemplo() {
        this.gestor.cargarCasoEjemplo();
        this.sincronizarCamposIngresos();
        this.actualizarVistaCompleta();
        const bloque = this.obtener('bloque-asistente');
        if (bloque) bloque.open = false;
        this.mostrarAviso('Caso de ejemplo cargado: 1.000 € en banco y 400 € en efectivo.', 'exito');
    }

    async reiniciarPresupuesto() {
        const confirmado = await this.pedirConfirmacion({
            titulo: 'Empezar de cero',
            texto: 'Se borrarán <strong>todas</strong> tus partidas y gastos registrados de este navegador. Esta acción no se puede deshacer.',
            textoBoton: 'Sí, borrar todo'
        });
        if (!confirmado) return;

        this.gestor.reiniciarPresupuestoEnBlanco();
        this.sincronizarCamposIngresos();
        this.actualizarVistaCompleta();

        const bloque = this.obtener('bloque-asistente');
        if (bloque) bloque.open = true;
        this.mostrarAviso('Presupuesto vaciado. Puedes empezar de nuevo.', 'exito');
    }

    sincronizarCamposIngresos() {
        const inputCuenta = this.obtener('input-ingreso-cuenta');
        const inputFisico = this.obtener('input-ingreso-fisico');
        const selectorPerfil = this.obtener('selector-perfil');

        if (inputCuenta) {
            inputCuenta.value = this.gestor.ingresoCuentaCent > 0 ? formatearParaEntrada(this.gestor.ingresoCuentaCent) : '';
        }
        if (inputFisico) {
            inputFisico.value = this.gestor.ingresoFisicoCent > 0 ? formatearParaEntrada(this.gestor.ingresoFisicoCent) : '';
        }
        if (selectorPerfil) selectorPerfil.value = this.gestor.perfilSeleccionado;

        const totalCent = this.gestor.obtenerIngresoTotalCent();
        const textoTotal = this.obtener('texto-total-vivo');
        const textoReparto = this.obtener('texto-reparto-vivo');
        if (textoTotal) textoTotal.textContent = formatearEuros(totalCent);
        if (textoReparto) {
            textoReparto.textContent = totalCent > 0
                ? `${formatearPorcentaje(calcularPorcentaje(this.gestor.ingresoCuentaCent, totalCent, 0), 0)} en banco • ${formatearPorcentaje(calcularPorcentaje(this.gestor.ingresoFisicoCent, totalCent, 0), 0)} en efectivo`
                : '0 % en banco • 0 % en efectivo';
        }
    }

    // ======================================================================
    // REGISTRO DE GASTOS DIARIOS
    // ======================================================================

    configurarFormularioCompra() {
        const formulario = this.obtener('formulario-compra');
        if (!formulario) return;

        formulario.addEventListener('submit', evento => {
            evento.preventDefault();

            const inputLugar = this.obtener('input-lugar');
            const inputImporte = this.obtener('input-importe-compra');
            const lugar = inputLugar.value.trim();
            const importeCent = aCentimos(inputImporte.value);

            if (!lugar) {
                this.mostrarAviso('Escribe el lugar o comercio del gasto.', 'error');
                inputLugar.focus();
                return;
            }
            if (importeCent <= 0) {
                this.mostrarAviso('El importe debe ser mayor que 0 €.', 'error');
                inputImporte.focus();
                return;
            }

            this.gestor.registrarTransaccion({
                lugar,
                importeCent,
                categoria: this.obtener('selector-categoria-compra').value,
                canal: this.obtener('selector-canal-compra').value,
                mes: this.gestor.mesVisualizado
            });

            inputLugar.value = '';
            inputImporte.value = '';
            inputLugar.focus();

            this.actualizarVistaCompleta();
            this.mostrarAviso(`Gasto de ${formatearEuros(importeCent)} anotado en ${lugar}.`, 'exito');
        });

        const botonFlotante = this.obtener('boton-flotante');
        if (botonFlotante) {
            botonFlotante.addEventListener('click', () => {
                this.cambiarPestana('panel-lugares');
                setTimeout(() => {
                    const inputLugar = this.obtener('input-lugar');
                    if (inputLugar) inputLugar.focus();
                }, 350);
            });
        }
    }

    // ======================================================================
    // DELEGACIÓN DE EVENTOS EN TABLAS Y SOBRES
    // ======================================================================

    configurarTablasInteractivas() {
        const cuerpoPartidas = this.obtener('cuerpo-tabla-partidas');
        if (cuerpoPartidas) {
            cuerpoPartidas.addEventListener('click', evento => {
                const boton = evento.target.closest('[data-accion]');
                if (!boton) return;

                const id = boton.getAttribute('data-id');
                const accion = boton.getAttribute('data-accion');

                if (accion === 'editar') this.abrirModalPartida(id);
                if (accion === 'eliminar') this.eliminarPartida(id);
                if (accion === 'canal') {
                    this.gestor.cambiarCanalPagoGasto(id);
                    this.actualizarVistaCompleta();
                }
            });
        }

        const cuerpoHistorial = this.obtener('cuerpo-tabla-historial');
        if (cuerpoHistorial) {
            cuerpoHistorial.addEventListener('click', evento => {
                const boton = evento.target.closest('[data-accion="eliminar-transaccion"]');
                if (boton) this.eliminarTransaccion(boton.getAttribute('data-id'));
            });
        }

        const rejillaSobres = this.obtener('rejilla-sobres');
        if (rejillaSobres) {
            rejillaSobres.addEventListener('click', evento => {
                const boton = evento.target.closest('[data-categoria]');
                if (!boton) return;

                const selector = this.obtener('selector-categoria-compra');
                if (selector) selector.value = boton.getAttribute('data-categoria');

                const inputLugar = this.obtener('input-lugar');
                if (inputLugar) {
                    inputLugar.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => inputLugar.focus(), 320);
                }
            });
        }

        const botonNueva = this.obtener('boton-nueva-partida');
        if (botonNueva) botonNueva.addEventListener('click', () => this.abrirModalPartida(null));
    }

    async eliminarPartida(idGasto) {
        const gasto = this.gestor.gastos.find(item => item.id === idGasto);
        if (!gasto) return;

        const confirmado = await this.pedirConfirmacion({
            titulo: 'Eliminar partida',
            texto: `Se eliminará <strong>${this.escapar(gasto.concepto)}</strong> (${formatearEuros(gasto.importeCent)}) del presupuesto.`,
            textoBoton: 'Eliminar'
        });
        if (!confirmado) return;

        this.gestor.eliminarGasto(idGasto);
        this.actualizarVistaCompleta();
        this.mostrarAviso('Partida eliminada.', 'exito');
    }

    async eliminarTransaccion(idTransaccion) {
        const transaccion = this.gestor.transacciones.find(item => item.id === idTransaccion);
        if (!transaccion) return;

        const confirmado = await this.pedirConfirmacion({
            titulo: 'Eliminar gasto',
            texto: `Se eliminará el gasto de <strong>${formatearEuros(transaccion.importeCent)}</strong> en ${this.escapar(transaccion.lugar)}. El dinero volverá a estar disponible en su sobre.`,
            textoBoton: 'Eliminar'
        });
        if (!confirmado) return;

        this.gestor.eliminarTransaccion(idTransaccion);
        this.actualizarVistaCompleta();
        this.mostrarAviso('Gasto eliminado del historial.', 'exito');
    }

    // ======================================================================
    // MODAL DE PARTIDA
    // ======================================================================

    configurarModalPartida() {
        const modal = this.obtener('modal-partida');
        const formulario = this.obtener('formulario-partida');
        const campoCategoria = this.obtener('campo-categoria');

        const cerrar = () => {
            this.cerrarModal(modal);
            this.idPartidaEnEdicion = null;
        };

        this.obtener('boton-cerrar-modal').addEventListener('click', cerrar);
        this.obtener('boton-cancelar-modal').addEventListener('click', cerrar);
        modal.addEventListener('mousedown', evento => {
            if (evento.target === modal) cerrar();
        });

        // El selector de ahorro/inversión solo aparece en la categoría de patrimonio
        const alternarSubtipo = () => {
            const envoltorio = this.obtener('campo-subtipo-envoltorio');
            envoltorio.classList.toggle('oculto', campoCategoria.value !== 'AHORRO_INVERSION');
        };
        campoCategoria.addEventListener('change', alternarSubtipo);

        formulario.addEventListener('submit', evento => {
            evento.preventDefault();
            if (this.guardarPartidaDesdeFormulario(formulario)) cerrar();
        });
    }

    abrirModalPartida(idGasto = null) {
        const modal = this.obtener('modal-partida');
        this.idPartidaEnEdicion = idGasto;

        const titulo = this.obtener('titulo-modal-partida');
        const campoConcepto = this.obtener('campo-concepto');
        const campoImporte = this.obtener('campo-importe');
        const campoCategoria = this.obtener('campo-categoria');
        const campoCanal = this.obtener('campo-canal');
        const campoDuracion = this.obtener('campo-duracion');
        const campoDescripcion = this.obtener('campo-descripcion');
        const campoEsencial = this.obtener('campo-esencial');
        const campoSubtipo = this.obtener('campo-subtipo');

        const gasto = idGasto ? this.gestor.gastos.find(item => item.id === idGasto) : null;

        if (gasto) {
            titulo.textContent = 'Editar partida';
            campoConcepto.value = gasto.concepto;
            campoImporte.value = formatearParaEntrada(gasto.importeCent);
            campoCategoria.value = gasto.categoria;
            campoCanal.value = gasto.canal;
            campoDescripcion.value = gasto.descripcion || '';
            campoEsencial.checked = Boolean(gasto.esencial);
            campoSubtipo.value = gasto.subtipo || SUBTIPOS_PATRIMONIO.AHORRO;
            campoDuracion.value = gasto.recurrente
                ? 'recurrente'
                : String(gasto.mesFiniquito || 1);
        } else {
            titulo.textContent = 'Añadir partida';
            campoConcepto.value = '';
            campoImporte.value = '';
            campoCategoria.value = 'OCIO_ESTILO_VIDA';
            campoCanal.value = CANALES_PAGO.CUENTA;
            campoDescripcion.value = '';
            campoEsencial.checked = false;
            campoSubtipo.value = SUBTIPOS_PATRIMONIO.AHORRO;
            campoDuracion.value = 'recurrente';
        }

        this.obtener('campo-subtipo-envoltorio')
            .classList.toggle('oculto', campoCategoria.value !== 'AHORRO_INVERSION');

        this.abrirModal(modal);
    }

    guardarPartidaDesdeFormulario(formulario) {
        const concepto = formulario.concepto.value.trim();
        const importeCent = aCentimos(formulario.importe.value);
        const duracion = formulario.duracion.value;

        if (!concepto) {
            this.mostrarAviso('Escribe un concepto para la partida.', 'error');
            formulario.concepto.focus();
            return false;
        }
        if (importeCent <= 0) {
            this.mostrarAviso('El importe debe ser mayor que 0 €.', 'error');
            formulario.importe.focus();
            return false;
        }

        const datos = {
            concepto,
            importeCent,
            categoria: formulario.categoria.value,
            canal: formulario.canal.value,
            descripcion: formulario.descripcion.value.trim(),
            esencial: formulario.esencial.checked,
            recurrente: duracion === 'recurrente',
            mesFiniquito: duracion === 'recurrente' ? null : parseInt(duracion, 10),
            subtipo: formulario.categoria.value === 'AHORRO_INVERSION' ? formulario.subtipo.value : null
        };

        if (this.idPartidaEnEdicion) {
            this.gestor.actualizarGasto(this.idPartidaEnEdicion, datos);
            this.mostrarAviso('Partida actualizada.', 'exito');
        } else {
            this.gestor.agregarGasto(datos);
            this.mostrarAviso('Partida añadida al presupuesto.', 'exito');
        }

        this.actualizarVistaCompleta();
        return true;
    }

    configurarModalConfirmacion() {
        this.obtener('boton-aceptar-confirmacion').addEventListener('click', () => this.cerrarConfirmacion(true));
        this.obtener('boton-cancelar-confirmacion').addEventListener('click', () => this.cerrarConfirmacion(false));
        this.obtener('boton-cerrar-confirmacion').addEventListener('click', () => this.cerrarConfirmacion(false));

        const modal = this.obtener('modal-confirmacion');
        modal.addEventListener('mousedown', evento => {
            if (evento.target === modal) this.cerrarConfirmacion(false);
        });
    }

    // ======================================================================
    // FILTROS Y COPIAS DE SEGURIDAD
    // ======================================================================

    configurarFiltros() {
        const selectorCanal = this.obtener('selector-canal-filtro');
        if (selectorCanal) {
            selectorCanal.addEventListener('change', evento => {
                this.filtroCanal = evento.target.value;
                this.renderizarTablaPartidas();
                this.actualizarIconos();
            });
        }

        const selectorMes = this.obtener('selector-mes');
        if (selectorMes) {
            selectorMes.value = String(this.gestor.mesVisualizado);
            selectorMes.addEventListener('change', evento => {
                this.gestor.mesVisualizado = parseInt(evento.target.value, 10) || 1;
                this.gestor.guardarEnAlmacenamientoLocal();
                this.actualizarVistaCompleta();
            });
        }

        const botonExcel = this.obtener('boton-exportar-excel');
        if (botonExcel) botonExcel.addEventListener('click', () => this.exportarExcel());

        const botonExcelProyeccion = this.obtener('boton-excel-proyeccion');
        if (botonExcelProyeccion) botonExcelProyeccion.addEventListener('click', () => this.exportarExcel());
    }

    exportarExcel() {
        const resultado = this.exportador.generarYDescargarExcel();
        if (resultado && resultado.exito) {
            this.mostrarAviso('Excel descargado con 5 hojas de cálculo.', 'exito');
        } else {
            this.mostrarAviso(resultado ? resultado.mensaje : 'No se pudo generar el Excel.', 'error');
        }
    }

    configurarCopiasSeguridad() {
        const botonExportar = this.obtener('boton-exportar-copia');
        const botonImportar = this.obtener('boton-importar-copia');
        const inputArchivo = this.obtener('input-archivo-copia');

        if (botonExportar) botonExportar.addEventListener('click', () => this.descargarCopiaSeguridad());
        if (botonImportar) botonImportar.addEventListener('click', () => inputArchivo.click());

        if (inputArchivo) {
            inputArchivo.addEventListener('change', evento => {
                const archivo = evento.target.files && evento.target.files[0];
                if (!archivo) return;

                const lector = new FileReader();
                lector.onload = eventoLectura => {
                    const resultado = this.gestor.importarCopiaSeguridadJSON(eventoLectura.target.result);
                    this.mostrarAviso(resultado.mensaje, resultado.exito ? 'exito' : 'error');
                    if (resultado.exito) {
                        this.sincronizarCamposIngresos();
                        const selectorMes = this.obtener('selector-mes');
                        if (selectorMes) selectorMes.value = String(this.gestor.mesVisualizado);
                        this.actualizarVistaCompleta();
                    }
                };
                lector.onerror = () => this.mostrarAviso('No se pudo leer el archivo seleccionado.', 'error');
                lector.readAsText(archivo);
                inputArchivo.value = '';
            });
        }
    }

    descargarCopiaSeguridad() {
        const contenido = this.gestor.exportarCopiaSeguridadJSON();
        const blob = new Blob([contenido], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = `Mi_Presupuesto_${this.gestor.obtenerFechaHoy()}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);

        this.mostrarAviso('Copia de seguridad descargada.', 'exito');
    }

    // ======================================================================
    // RENDERIZADO GENERAL
    // ======================================================================

    actualizarVistaCompleta() {
        const mes = this.gestor.mesVisualizado;
        const resumen = this.gestor.calcularResumenMes(mes);

        this.renderizarMetricas(resumen);
        this.renderizarAvisoDidactico(resumen);
        this.renderizarDistribucion(resumen);
        this.renderizarEstrategia(resumen);
        this.renderizarTablaPartidas();
        this.renderizarCanales(resumen);
        this.renderizarProyeccion();
        this.renderizarSobres();
        this.renderizarHistorial();
        this.renderizarRanking();
        this.renderizarPie();

        if (this.pestanaActiva === 'panel-graficos') {
            this.renderizarGraficos();
        }

        this.actualizarIconos();
    }

    renderizarMetricas(resumen) {
        const asignar = (id, texto) => {
            const elemento = this.obtener(id);
            if (elemento) elemento.textContent = texto;
        };

        asignar('metrica-ingreso', formatearEuros(resumen.ingresoCent));
        asignar('metrica-cuenta', formatearEuros(resumen.cuentaCent));
        asignar('metrica-fisico', formatearEuros(resumen.fisicoCent));
        asignar('metrica-ahorro', formatearEuros(resumen.patrimonioAsignadoCent));

        asignar('detalle-ingreso', resumen.ingresoCent > 0
            ? `${formatearEuros(resumen.ingresoCuentaCent)} banco · ${formatearEuros(resumen.ingresoFisicoCent)} efectivo`
            : 'Cuenta + efectivo');

        if (resumen.ingresoCuentaCent <= 0) {
            asignar('detalle-cuenta', 'Recibos y domiciliaciones');
        } else if (resumen.saldoLibreCuentaCent >= 0) {
            asignar('detalle-cuenta', `Quedan ${formatearEuros(resumen.saldoLibreCuentaCent)} libres en el banco`);
        } else {
            asignar('detalle-cuenta', `Faltan ${formatearEuros(-resumen.saldoLibreCuentaCent)} en el banco`);
        }

        asignar('detalle-fisico', resumen.retiradaCajeroCent > 0
            ? `Saca ${formatearEuros(resumen.retiradaCajeroCent)} del cajero`
            : (resumen.fisicoCent > 0 ? 'Cubierto con tu efectivo en mano' : 'Consumo en billetes'));

        asignar('detalle-ahorro', resumen.ingresoCent > 0
            ? `${formatearPorcentaje(calcularPorcentaje(resumen.patrimonioAsignadoCent, resumen.ingresoCent, 1))} de tu sueldo`
            : 'Patrimonio construido este mes');

        // Balance con color según el estado real del cuadre
        const elementoBalance = this.obtener('metrica-balance');
        const detalleBalance = this.obtener('detalle-balance');
        if (elementoBalance) {
            elementoBalance.classList.remove('valor-metrica--positivo', 'valor-metrica--negativo', 'valor-metrica--neutro');

            if (resumen.balanceNetoCent < 0) {
                elementoBalance.textContent = formatearEuros(resumen.balanceNetoCent);
                elementoBalance.classList.add('valor-metrica--negativo');
                if (detalleBalance) detalleBalance.textContent = 'Gastas más de lo que ingresas';
            } else if (resumen.balanceNetoCent > 0) {
                elementoBalance.textContent = formatearEuros(resumen.balanceNetoCent, { conSigno: true });
                elementoBalance.classList.add('valor-metrica--positivo');
                if (detalleBalance) detalleBalance.textContent = 'Libre por asignar';
            } else {
                elementoBalance.textContent = formatearEuros(0);
                elementoBalance.classList.add('valor-metrica--neutro');
                if (detalleBalance) {
                    detalleBalance.textContent = resumen.ingresoCent > 0
                        ? 'Cuadrado al céntimo'
                        : 'Sin datos todavía';
                }
            }
        }

        this.renderizarInsigniaEstado(resumen);
    }

    renderizarInsigniaEstado(resumen) {
        const insignia = this.obtener('insignia-estado');
        if (!insignia) return;

        if (resumen.ingresoCent <= 0) {
            insignia.className = 'insignia';
            insignia.textContent = 'Sin configurar';
            return;
        }

        if (this.gestor.escenarioActual === 'ejemplo_optimizado') {
            insignia.className = 'insignia insignia--info';
            insignia.textContent = 'Caso de ejemplo';
            return;
        }

        if (resumen.balanceNetoCent < 0) {
            insignia.className = 'insignia insignia--peligro';
            insignia.textContent = 'Déficit';
            return;
        }

        insignia.className = 'insignia insignia--exito';
        insignia.textContent = `${formatearPorcentaje(resumen.porcentajeIngresoCuenta, 0)} banco · ${formatearPorcentaje(resumen.porcentajeIngresoFisico, 0)} efectivo`;
    }

    renderizarAvisoDidactico(resumen) {
        const contenedor = this.obtener('aviso-didactico');
        if (!contenedor) return;

        const pintar = (clase, icono, titulo, cuerpo) => {
            contenedor.className = `aviso ${clase}`;
            contenedor.innerHTML = `
                <span class="icono-aviso" aria-hidden="true"><i data-lucide="${icono}"></i></span>
                <div class="contenido-aviso">
                    <h3>${titulo}</h3>
                    <p>${cuerpo}</p>
                </div>
            `;
        };

        if (resumen.ingresoCent <= 0) {
            pintar('aviso--neutro', 'info', 'Bienvenido a tu gestor financiero',
                'Introduce arriba el dinero que recibes en <strong>cuenta bancaria</strong> y en <strong>efectivo físico</strong>. El sistema repartirá tu sueldo al céntimo, te dirá cuánto sacar del cajero y cuánto puedes invertir.');
            return;
        }

        if (resumen.balanceNetoCent < 0) {
            pintar('aviso--alerta', 'alert-triangle',
                `Déficit de ${formatearEuros(-resumen.balanceNetoCent)}`,
                `Has presupuestado <strong>${formatearEuros(resumen.totalPresupuestadoCent)}</strong> sobre un ingreso de <strong>${formatearEuros(resumen.ingresoCent)}</strong>. Ajusta o elimina partidas hasta cuadrar las cuentas.`);
            return;
        }

        if (resumen.patrimonioAsignadoCent === 0 && resumen.balanceNetoCent > 0) {
            pintar('aviso--info', 'piggy-bank',
                `Tienes ${formatearEuros(resumen.balanceNetoCent)} sin asignar`,
                'Ese dinero no está trabajando para ti. Crea una partida de <strong>ahorro</strong> o <strong>inversión</strong> para que forme parte de tu patrimonio en la proyección a 6 meses.');
            return;
        }

        const patrimonioAnualCent = (resumen.patrimonioAsignadoCent + resumen.balanceNetoCent) * 12;
        pintar('aviso--exito', 'sparkles', 'Plan bicanal saludable',
            `Tienes <strong>${formatearEuros(resumen.cuentaCent)}</strong> comprometidos en el banco y <strong>${formatearEuros(resumen.fisicoCent)}</strong> en efectivo. A este ritmo acumularás <strong>${formatearEuros(patrimonioAnualCent)}</strong> al año.`);
    }

    renderizarDistribucion(resumen) {
        const bloque = this.obtener('bloque-distribucion');
        const barra = this.obtener('barra-distribucion');
        const leyenda = this.obtener('leyenda-distribucion');
        const etiqueta = this.obtener('etiqueta-asignado');
        if (!bloque || !barra || !leyenda) return;

        if (resumen.ingresoCent <= 0) {
            bloque.classList.add('oculto');
            return;
        }
        bloque.classList.remove('oculto');

        if (etiqueta) {
            if (resumen.balanceNetoCent < 0) {
                etiqueta.className = 'insignia insignia--peligro';
                etiqueta.textContent = `${formatearPorcentaje(resumen.porcentajeAsignado)} asignado · déficit`;
            } else if (resumen.balanceNetoCent === 0) {
                etiqueta.className = 'insignia insignia--exito';
                etiqueta.textContent = '100 % asignado · cuadre perfecto';
            } else {
                etiqueta.className = 'insignia insignia--info';
                etiqueta.textContent = `${formatearPorcentaje(resumen.porcentajeAsignado)} asignado`;
            }
        }

        // La barra se normaliza sobre el mayor entre ingreso y gasto para no desbordar
        const referenciaCent = Math.max(resumen.ingresoCent, resumen.totalPresupuestadoCent);
        const entradas = Object.entries(resumen.desglosePorCategoriaCent).filter(([, total]) => total > 0);

        barra.innerHTML = entradas.map(([clave, totalCent]) => {
            const config = CATEGORIAS_GASTO[clave];
            const anchoVisual = (totalCent / referenciaCent) * 100;
            const porcentajeReal = calcularPorcentaje(totalCent, resumen.ingresoCent, 1);
            return `<span class="segmento-barra"
                          style="width: ${anchoVisual}%; background-color: ${config.color};"
                          title="${this.escapar(config.nombre)}: ${formatearEuros(totalCent)} (${formatearPorcentaje(porcentajeReal)})"></span>`;
        }).join('');

        leyenda.innerHTML = entradas.map(([clave, totalCent]) => {
            const config = CATEGORIAS_GASTO[clave];
            const porcentajeReal = calcularPorcentaje(totalCent, resumen.ingresoCent, 1);
            return `
                <span class="item-leyenda">
                    <span class="punto-leyenda" style="background-color: ${config.color};"></span>
                    <span>${this.escapar(config.nombreCorto)}: <strong>${formatearEuros(totalCent)}</strong></span>
                    <span class="porcentaje-leyenda">${formatearPorcentaje(porcentajeReal)}</span>
                </span>
            `;
        }).join('');
    }

    renderizarEstrategia(resumen) {
        const tarjeta = this.obtener('tarjeta-estrategia');
        const parrafo = this.obtener('parrafo-estrategia');
        if (!tarjeta || !parrafo) return;

        if (resumen.ingresoCent <= 0) {
            tarjeta.classList.add('oculto');
            return;
        }

        tarjeta.classList.remove('oculto');
        parrafo.textContent = resumen.analisisEfectivo.recomendacion;
    }

    renderizarTablaPartidas() {
        const cuerpo = this.obtener('cuerpo-tabla-partidas');
        if (!cuerpo) return;

        let partidas = this.gestor.obtenerGastosActivosMes(this.gestor.mesVisualizado);

        if (this.filtroCanal !== 'TODOS') {
            const canal = this.filtroCanal === 'CUENTA' ? CANALES_PAGO.CUENTA : CANALES_PAGO.FISICO;
            partidas = partidas.filter(gasto => gasto.canal === canal);
        }

        if (partidas.length === 0) {
            cuerpo.innerHTML = `
                <tr>
                    <td colspan="5" class="celda-vacia" data-destacada>
                        <i data-lucide="inbox" aria-hidden="true"></i>
                        <p>No hay partidas en este mes. Configura tus ingresos arriba o pulsa <strong>Añadir partida</strong>.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Se muestran ordenadas de mayor a menor importe: lo relevante primero
        const ordenadas = [...partidas].sort((a, b) => b.importeCent - a.importeCent);

        cuerpo.innerHTML = ordenadas.map(gasto => {
            const config = CATEGORIAS_GASTO[gasto.categoria];
            const esCuenta = gasto.canal === CANALES_PAGO.CUENTA;
            const notaDuracion = gasto.recurrente
                ? ''
                : `<span class="descripcion-concepto">Solo hasta el mes ${gasto.mesFiniquito || 1}</span>`;

            return `
                <tr>
                    <td data-etiqueta="Concepto" data-destacada>
                        <span class="celda-concepto">
                            <span class="nombre-concepto">${this.escapar(gasto.concepto)}</span>
                            ${gasto.descripcion ? `<span class="descripcion-concepto">${this.escapar(gasto.descripcion)}</span>` : ''}
                            ${notaDuracion}
                        </span>
                    </td>
                    <td data-etiqueta="Categoría">
                        <span class="insignia-categoria" style="--color-categoria: ${config.color};">
                            <i data-lucide="${config.icono}" aria-hidden="true"></i>
                            ${this.escapar(config.nombreCorto)}
                        </span>
                    </td>
                    <td data-etiqueta="Canal">
                        <button type="button"
                                class="etiqueta-canal ${esCuenta ? 'etiqueta-canal--cuenta' : 'etiqueta-canal--fisico'}"
                                data-accion="canal" data-id="${gasto.id}"
                                title="Cambiar a ${esCuenta ? 'efectivo físico' : 'cuenta bancaria'}">
                            <i data-lucide="${esCuenta ? 'credit-card' : 'banknote'}" aria-hidden="true"></i>
                            ${esCuenta ? 'Banco' : 'Efectivo'}
                        </button>
                    </td>
                    <td data-etiqueta="Importe">
                        <span class="celda-numerica">${formatearEuros(gasto.importeCent)}</span>
                    </td>
                    <td data-etiqueta="Acciones">
                        <span class="acciones-fila">
                            <button type="button" class="boton-icono" data-accion="editar" data-id="${gasto.id}" aria-label="Editar ${this.escapar(gasto.concepto)}">
                                <i data-lucide="pencil" aria-hidden="true"></i>
                            </button>
                            <button type="button" class="boton-icono boton-icono--peligro" data-accion="eliminar" data-id="${gasto.id}" aria-label="Eliminar ${this.escapar(gasto.concepto)}">
                                <i data-lucide="trash-2" aria-hidden="true"></i>
                            </button>
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderizarSobres() {
        const contenedor = this.obtener('rejilla-sobres');
        const valorHucha = this.obtener('valor-hucha');
        const insigniaMes = this.obtener('insignia-mes-sobres');
        if (!contenedor) return;

        const mes = this.gestor.mesVisualizado;
        const seguimiento = this.gestor.obtenerSeguimientoSobres(mes);
        const salvadoCent = this.gestor.calcularTotalSalvadoParaAhorroCent(mes);

        if (valorHucha) valorHucha.textContent = formatearEuros(salvadoCent);
        if (insigniaMes) insigniaMes.textContent = `Mes ${mes}`;

        const sobres = Object.values(seguimiento)
            .filter(sobre => sobre.limitePresupuestadoCent > 0 || sobre.gastadoCent > 0);

        if (sobres.length === 0) {
            contenedor.innerHTML = `
                <p class="lista-vacia">
                    Configura tu presupuesto arriba para activar los sobres digitales de gasto.
                </p>
            `;
            return;
        }

        const textosEstado = {
            saludable: 'Dentro del límite',
            alerta: 'Atención',
            sobregasto: 'Excedido'
        };

        contenedor.innerHTML = sobres.map(sobre => {
            const config = sobre.configuracion;
            const anchoBarra = Math.min(100, Math.max(0, sobre.porcentajeConsumido));
            const claseInsignia = sobre.estadoSobre === 'sobregasto'
                ? 'insignia--peligro'
                : (sobre.estadoSobre === 'alerta' ? 'insignia--aviso' : 'insignia--exito');

            return `
                <article class="tarjeta-sobre tarjeta-sobre--${sobre.estadoSobre}">
                    <div class="cabecera-sobre">
                        <h3 class="nombre-sobre">
                            <i data-lucide="${config.icono}" style="color: ${config.color};" aria-hidden="true"></i>
                            ${this.escapar(config.nombreCorto)}
                        </h3>
                        <span class="insignia ${claseInsignia}">${textosEstado[sobre.estadoSobre]}</span>
                    </div>

                    <div class="cifra-disponible">
                        <span class="etiqueta">Te queda</span>
                        <span class="valor">${formatearEuros(sobre.disponibleCent)}</span>
                    </div>

                    <div class="barra-sobre">
                        <div class="relleno-sobre" style="width: ${anchoBarra}%;"></div>
                    </div>

                    <div class="detalle-sobre">
                        <span>Gastado <strong>${formatearEuros(sobre.gastadoCent)}</strong></span>
                        <span>de ${formatearEuros(sobre.limitePresupuestadoCent)}</span>
                    </div>

                    <div class="pie-sobre">
                        <span>${formatearPorcentaje(sobre.porcentajeConsumido)} consumido</span>
                        ${sobre.salvadoParaAhorroCent > 0
                            ? `<span class="salvado">+${formatearEuros(sobre.salvadoParaAhorroCent)} al ahorro</span>`
                            : ''}
                    </div>

                    <button type="button" class="boton-mini" data-categoria="${sobre.categoria}">
                        <i data-lucide="plus" aria-hidden="true"></i>
                        Anotar gasto
                    </button>
                </article>
            `;
        }).join('');
    }

    renderizarHistorial() {
        const cuerpo = this.obtener('cuerpo-tabla-historial');
        const contador = this.obtener('contador-transacciones');
        if (!cuerpo) return;

        const transacciones = this.gestor.obtenerTransaccionesDelMes(this.gestor.mesVisualizado);

        if (contador) {
            contador.textContent = transacciones.length === 1
                ? '1 gasto registrado'
                : `${transacciones.length} gastos registrados`;
        }

        if (transacciones.length === 0) {
            cuerpo.innerHTML = `
                <tr>
                    <td colspan="6" class="celda-vacia" data-destacada>
                        <i data-lucide="receipt" aria-hidden="true"></i>
                        <p>Todavía no has anotado gastos este mes. Usa el formulario de arriba o el botón flotante.</p>
                    </td>
                </tr>
            `;
            return;
        }

        cuerpo.innerHTML = transacciones.map(transaccion => {
            const config = CATEGORIAS_GASTO[transaccion.categoria];
            const esCuenta = transaccion.canal === CANALES_PAGO.CUENTA;

            return `
                <tr>
                    <td data-etiqueta="Fecha">${this.escapar(this.formatearFecha(transaccion.fecha))}</td>
                    <td data-etiqueta="Lugar" data-destacada>
                        <span class="celda-concepto">
                            <span class="nombre-concepto">${this.escapar(transaccion.lugar)}</span>
                            ${transaccion.notas ? `<span class="descripcion-concepto">${this.escapar(transaccion.notas)}</span>` : ''}
                        </span>
                    </td>
                    <td data-etiqueta="Categoría">
                        <span class="insignia-categoria" style="--color-categoria: ${config.color};">
                            ${this.escapar(config.nombreCorto)}
                        </span>
                    </td>
                    <td data-etiqueta="Canal">
                        <span class="etiqueta-canal ${esCuenta ? 'etiqueta-canal--cuenta' : 'etiqueta-canal--fisico'}">
                            <i data-lucide="${esCuenta ? 'credit-card' : 'banknote'}" aria-hidden="true"></i>
                            ${esCuenta ? 'Banco' : 'Efectivo'}
                        </span>
                    </td>
                    <td data-etiqueta="Importe">
                        <span class="celda-numerica">${formatearEuros(transaccion.importeCent)}</span>
                    </td>
                    <td data-etiqueta="Acción">
                        <span class="acciones-fila">
                            <button type="button" class="boton-icono boton-icono--peligro"
                                    data-accion="eliminar-transaccion" data-id="${transaccion.id}"
                                    aria-label="Eliminar gasto en ${this.escapar(transaccion.lugar)}">
                                <i data-lucide="trash-2" aria-hidden="true"></i>
                            </button>
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    formatearFecha(fechaIso) {
        const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso || '');
        if (!partes) return fechaIso || '';
        return `${partes[3]}/${partes[2]}/${partes[1]}`;
    }

    renderizarRanking() {
        const bloque = this.obtener('bloque-ranking');
        const lista = this.obtener('lista-ranking');
        if (!bloque || !lista) return;

        const ranking = this.gestor.obtenerRankingLugares(this.gestor.mesVisualizado, 5);

        if (ranking.length === 0) {
            bloque.classList.add('oculto');
            return;
        }
        bloque.classList.remove('oculto');

        lista.innerHTML = ranking.map((item, indice) => `
            <li class="item-ranking">
                <span class="posicion">${indice + 1}</span>
                <span class="nombre-lugar">
                    ${this.escapar(item.lugar)}
                    <span class="visitas">${item.visitas === 1 ? '1 visita' : `${item.visitas} visitas`}</span>
                </span>
                <span class="importe-lugar">${formatearEuros(item.totalCent)}</span>
            </li>
        `).join('');
    }

    renderizarCanales(resumen) {
        const partidas = this.gestor.obtenerGastosActivosMes(this.gestor.mesVisualizado);
        const partidasCuenta = partidas.filter(gasto => gasto.canal === CANALES_PAGO.CUENTA);
        const partidasFisico = partidas.filter(gasto => gasto.canal === CANALES_PAGO.FISICO);

        const totalCuenta = this.obtener('total-cuenta');
        const totalFisico = this.obtener('total-fisico');
        if (totalCuenta) totalCuenta.textContent = formatearEuros(resumen.cuentaCent);
        if (totalFisico) totalFisico.textContent = formatearEuros(resumen.fisicoCent);

        const instruccionCuenta = this.obtener('instruccion-cuenta');
        if (instruccionCuenta) {
            if (resumen.ingresoCuentaCent <= 0) {
                instruccionCuenta.textContent = 'Dinero que se liquida directamente desde tu banco.';
            } else if (resumen.saldoLibreCuentaCent >= 0) {
                instruccionCuenta.textContent = `De tus ${formatearEuros(resumen.ingresoCuentaCent)} en cuenta quedan ${formatearEuros(resumen.saldoLibreCuentaCent)} libres.`;
            } else if (resumen.saldoLibreFisicoCent > 0) {
                // El efectivo sobrante compensa exactamente lo que falta en el banco
                instruccionCuenta.textContent = `Te faltan ${formatearEuros(-resumen.saldoLibreCuentaCent)} en el banco: cúbrelos con los ${formatearEuros(resumen.saldoLibreFisicoCent)} que te sobran en efectivo.`;
            } else {
                instruccionCuenta.textContent = `Te faltan ${formatearEuros(-resumen.saldoLibreCuentaCent)} en el banco para cubrir todos los cargos.`;
            }
        }

        const instruccionFisico = this.obtener('instruccion-fisico');
        if (instruccionFisico) {
            if (resumen.retiradaCajeroCent > 0) {
                instruccionFisico.textContent = `Necesitas sacar ${formatearEuros(resumen.retiradaCajeroCent)} del cajero este mes.`;
            } else if (resumen.ingresoFisicoCent > 0) {
                instruccionFisico.textContent = `Cubierto con tu efectivo: te sobran ${formatearEuros(resumen.saldoLibreFisicoCent)} en mano.`;
            } else {
                instruccionFisico.textContent = 'Gastos pagados en billetes para absorber el dinero en mano.';
            }
        }

        const pintarLista = (idLista, listaPartidas, textoVacio, detallePorDefecto) => {
            const contenedor = this.obtener(idLista);
            if (!contenedor) return;

            if (listaPartidas.length === 0) {
                contenedor.innerHTML = `<li class="lista-vacia">${textoVacio}</li>`;
                return;
            }

            contenedor.innerHTML = [...listaPartidas]
                .sort((a, b) => b.importeCent - a.importeCent)
                .map(gasto => `
                    <li class="item-partida-canal">
                        <span>
                            <span class="concepto-item">${this.escapar(gasto.concepto)}</span>
                            <span class="detalle-item">${this.escapar(gasto.descripcion || detallePorDefecto)}</span>
                        </span>
                        <span class="importe-item">${formatearEuros(gasto.importeCent)}</span>
                    </li>
                `).join('');
        };

        pintarLista('lista-partidas-cuenta', partidasCuenta, 'Sin cargos en cuenta este mes', 'Cargo bancario');
        pintarLista('lista-partidas-fisico', partidasFisico, 'Sin gastos en efectivo este mes', 'Pago en billetes');
    }

    renderizarProyeccion() {
        const cuerpo = this.obtener('cuerpo-tabla-proyeccion');
        if (!cuerpo) return;

        const proyeccion = this.gestor.calcularProyeccion();
        const totales = this.gestor.calcularTotalesProyeccion(proyeccion);

        const filas = proyeccion.map(fila => `
            <tr>
                <td data-etiqueta="Mes" data-destacada>
                    <strong>Mes ${fila.mes}</strong>
                    ${fila.mes === this.gestor.mesVisualizado ? '<span class="insignia insignia--info">Viendo</span>' : ''}
                </td>
                <td data-etiqueta="Ingreso"><span class="celda-numerica">${formatearEuros(fila.ingresoCent)}</span></td>
                <td data-etiqueta="Gastos fijos"><span class="celda-numerica">${formatearEuros(fila.gastosFijosCent)}</span></td>
                <td data-etiqueta="Deudas"><span class="celda-numerica ${fila.deudasCent > 0 ? 'columna-deuda' : ''}">${formatearEuros(fila.deudasCent)}</span></td>
                <td data-etiqueta="Consumo total"><span class="celda-numerica">${formatearEuros(fila.consumoCent)}</span></td>
                <td data-etiqueta="Sobrante"><span class="celda-numerica columna-positiva">${formatearEuros(fila.sobranteCent, { conSigno: true })}</span></td>
                <td data-etiqueta="Ahorro mes"><span class="celda-numerica">${formatearEuros(fila.ahorroMesCent)}</span></td>
                <td data-etiqueta="Inversión mes"><span class="celda-numerica">${formatearEuros(fila.inversionMesCent)}</span></td>
                <td data-etiqueta="Ahorro acum."><span class="celda-numerica">${formatearEuros(fila.ahorroAcumuladoCent)}</span></td>
                <td data-etiqueta="Inversión acum."><span class="celda-numerica">${formatearEuros(fila.inversionAcumuladaCent)}</span></td>
                <td data-etiqueta="Patrimonio"><span class="celda-numerica columna-patrimonio">${formatearEuros(fila.patrimonioTotalCent)}</span></td>
            </tr>
        `).join('');

        const filaTotales = `
            <tr class="fila-totales">
                <td data-etiqueta="Total" data-destacada><strong>Total ${totales.meses} meses</strong></td>
                <td data-etiqueta="Ingreso"><span class="celda-numerica">${formatearEuros(totales.ingresosCent)}</span></td>
                <td data-etiqueta="Gastos fijos"><span class="celda-numerica">—</span></td>
                <td data-etiqueta="Deudas"><span class="celda-numerica">${formatearEuros(totales.deudasCent)}</span></td>
                <td data-etiqueta="Consumo total"><span class="celda-numerica">${formatearEuros(totales.consumoCent)}</span></td>
                <td data-etiqueta="Sobrante"><span class="celda-numerica columna-positiva">${formatearEuros(totales.sobranteCent, { conSigno: true })}</span></td>
                <td data-etiqueta="Ahorro mes"><span class="celda-numerica">—</span></td>
                <td data-etiqueta="Inversión mes"><span class="celda-numerica">—</span></td>
                <td data-etiqueta="Ahorro acum."><span class="celda-numerica">${formatearEuros(totales.ahorroCent)}</span></td>
                <td data-etiqueta="Inversión acum."><span class="celda-numerica">${formatearEuros(totales.inversionCent)}</span></td>
                <td data-etiqueta="Patrimonio"><span class="celda-numerica columna-patrimonio">${formatearEuros(totales.patrimonioCent)}</span></td>
            </tr>
        `;

        cuerpo.innerHTML = filas + filaTotales;
    }

    renderizarApis() {
        const contenedor = this.obtener('rejilla-apis');
        if (!contenedor) return;

        contenedor.innerHTML = APIS_INVERSION_GRATUITAS.map(api => `
            <article class="tarjeta-api">
                <div>
                    <div class="cabecera-api">
                        <h3 class="nombre-api">${this.escapar(api.nombre)}</h3>
                        <span class="insignia insignia--exito">${this.escapar(api.limiteGratis)}</span>
                    </div>
                    <p class="descripcion-api">${this.escapar(api.descripcion)}</p>
                    <p class="cobertura-api"><strong>Cobertura:</strong> ${this.escapar(api.cobertura)}</p>
                </div>
                <a class="enlace-api" href="${this.escapar(api.urlDocumentacion)}" target="_blank" rel="noopener noreferrer">
                    <span>${this.escapar(api.textoEnlace)}</span>
                    <i data-lucide="external-link" aria-hidden="true"></i>
                </a>
            </article>
        `).join('');

        this.actualizarIconos();
    }

    renderizarPie() {
        const pie = this.obtener('pie-actualizacion');
        if (!pie) return;

        const partidas = this.gestor.gastos.length;
        const movimientos = this.gestor.transacciones.length;
        pie.textContent = `${partidas} ${partidas === 1 ? 'partida' : 'partidas'} · ${movimientos} ${movimientos === 1 ? 'gasto anotado' : 'gastos anotados'}`;
    }

    // ======================================================================
    // GRÁFICOS
    // ======================================================================

    obtenerColoresTema() {
        const estilos = getComputedStyle(document.documentElement);
        const leer = (variable, respaldo) => (estilos.getPropertyValue(variable) || respaldo).trim();

        return {
            texto: leer('--texto-suave', '#94a3b8'),
            rejilla: document.documentElement.getAttribute('data-tema') === 'claro'
                ? 'rgba(15, 23, 42, 0.08)'
                : 'rgba(255, 255, 255, 0.07)',
            fondoTarjeta: leer('--superficie-solida', '#131926'),
            indigo: leer('--indigo', '#6366f1'),
            esmeralda: leer('--esmeralda', '#10b981'),
            cian: leer('--cian-claro', '#38bdf8'),
            purpura: leer('--purpura', '#8b5cf6')
        };
    }

    renderizarGraficos() {
        if (typeof Chart === 'undefined') return;

        const colores = this.obtenerColoresTema();
        const resumen = this.gestor.calcularResumenMes(this.gestor.mesVisualizado);
        const proyeccion = this.gestor.calcularProyeccion();

        const fuenteBase = { family: 'Plus Jakarta Sans, sans-serif', size: 12 };
        const formatoTooltip = contexto => {
            const valor = contexto.parsed && contexto.parsed.y !== undefined && contexto.parsed.y !== null
                ? contexto.parsed.y
                : contexto.parsed;
            return ` ${contexto.dataset.label || contexto.label}: ${formatearEuros(aCentimos(valor))}`;
        };

        const ejesMoneda = {
            y: {
                grid: { color: colores.rejilla },
                border: { display: false },
                ticks: {
                    color: colores.texto,
                    font: fuenteBase,
                    callback: valor => formatearEuros(aCentimos(valor), { compacto: true })
                }
            },
            x: {
                grid: { display: false },
                border: { color: colores.rejilla },
                ticks: { color: colores.texto, font: fuenteBase }
            }
        };

        this.destruirGrafico('categorias');
        const lienzoCategorias = this.obtener('grafico-categorias');
        if (lienzoCategorias) {
            const entradas = Object.entries(resumen.desglosePorCategoriaCent).filter(([, total]) => total > 0);
            const hayDatos = entradas.length > 0;

            this.graficos.categorias = new Chart(lienzoCategorias, {
                type: 'doughnut',
                data: {
                    labels: hayDatos ? entradas.map(([clave]) => CATEGORIAS_GASTO[clave].nombreCorto) : ['Sin datos'],
                    datasets: [{
                        data: hayDatos ? entradas.map(([, total]) => aEuros(total)) : [1],
                        backgroundColor: hayDatos ? entradas.map(([clave]) => CATEGORIAS_GASTO[clave].color) : [colores.rejilla],
                        borderColor: colores.fondoTarjeta,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '64%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: colores.texto, font: fuenteBase, boxWidth: 12, padding: 14 }
                        },
                        tooltip: { enabled: hayDatos, callbacks: { label: formatoTooltip } }
                    }
                }
            });
        }

        this.destruirGrafico('canales');
        const lienzoCanales = this.obtener('grafico-canales');
        if (lienzoCanales) {
            this.graficos.canales = new Chart(lienzoCanales, {
                type: 'bar',
                data: {
                    labels: ['Cuenta bancaria', 'Efectivo físico'],
                    datasets: [
                        {
                            label: 'Ingresado',
                            data: [aEuros(resumen.ingresoCuentaCent), aEuros(resumen.ingresoFisicoCent)],
                            backgroundColor: 'rgba(148, 163, 184, 0.35)',
                            borderRadius: 6
                        },
                        {
                            label: 'Gastado',
                            data: [aEuros(resumen.cuentaCent), aEuros(resumen.fisicoCent)],
                            backgroundColor: [colores.indigo, colores.esmeralda],
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: ejesMoneda,
                    plugins: {
                        legend: { labels: { color: colores.texto, font: fuenteBase, boxWidth: 12 } },
                        tooltip: { callbacks: { label: formatoTooltip } }
                    }
                }
            });
        }

        this.destruirGrafico('patrimonio');
        const lienzoPatrimonio = this.obtener('grafico-patrimonio');
        if (lienzoPatrimonio) {
            this.graficos.patrimonio = new Chart(lienzoPatrimonio, {
                type: 'line',
                data: {
                    labels: proyeccion.map(fila => `Mes ${fila.mes}`),
                    datasets: [
                        {
                            label: 'Patrimonio total',
                            data: proyeccion.map(fila => aEuros(fila.patrimonioTotalCent)),
                            borderColor: colores.cian,
                            backgroundColor: 'rgba(56, 189, 248, 0.12)',
                            fill: true,
                            tension: 0.32,
                            borderWidth: 3,
                            pointRadius: 3
                        },
                        {
                            label: 'Ahorro acumulado',
                            data: proyeccion.map(fila => aEuros(fila.ahorroAcumuladoCent)),
                            borderColor: colores.esmeralda,
                            borderDash: [6, 4],
                            tension: 0.32,
                            borderWidth: 2,
                            pointRadius: 2
                        },
                        {
                            label: 'Inversión acumulada',
                            data: proyeccion.map(fila => aEuros(fila.inversionAcumuladaCent)),
                            borderColor: colores.purpura,
                            borderDash: [3, 3],
                            tension: 0.32,
                            borderWidth: 2,
                            pointRadius: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: ejesMoneda,
                    plugins: {
                        legend: { labels: { color: colores.texto, font: fuenteBase, boxWidth: 12 } },
                        tooltip: { callbacks: { label: formatoTooltip } }
                    }
                }
            });
        }
    }

    destruirGrafico(nombre) {
        if (this.graficos[nombre]) {
            this.graficos[nombre].destroy();
            delete this.graficos[nombre];
        }
    }
}
