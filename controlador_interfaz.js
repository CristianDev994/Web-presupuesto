// Controlador principal de la interfaz de usuario con soporte bicanal y seguimiento de gastos por lugares

import { CANALES_PAGO, CATEGORIAS_GASTO, PERFILES_PRESUPUESTO, LUGARES_FRECUENTES_SUGERIDOS } from './datos_iniciales.js';
import { GestorFinanciero } from './gestor_financiero.js';
import { ExportadorExcel } from './exportador_excel.js';

export class ControladorInterfaz {
    constructor() {
        this.gestor = new GestorFinanciero();
        this.exportador = new ExportadorExcel(this.gestor);
        this.filtroCanalSeleccionado = 'TODOS';
        this.idGastoEnEdicion = null;
        this.instanciasGraficos = {};
    }

    iniciar() {
        window.controladorApp = this;
        this.configurarAsistenteSueldoBicanal();
        this.configurarFormularioCompraLugar();
        this.configurarNavegacionPestanas();
        this.configurarNavegacionMovilYFab();
        this.configurarCopiaSeguridadJSON();
        this.configurarModalFormulario();
        this.configurarFiltrosYAcciones();
        this.actualizarVistaCompleta();
    }

    configurarAsistenteSueldoBicanal() {
        const formulario = document.getElementById('formulario-asistente-sueldo');
        const selectorPerfil = document.getElementById('selector-perfil-vida');
        const inputCuenta = document.getElementById('input-sueldo-cuenta');
        const inputFisico = document.getElementById('input-sueldo-fisico');
        const textoTotalNeto = document.getElementById('texto-total-neto-vivo');
        const textoPorcentaje = document.getElementById('texto-porcentaje-bicanal');
        const textoPerfil = document.getElementById('texto-explicativo-perfil');
        const botonCargarEjemplo = document.getElementById('boton-cargar-ejemplo');
        const enlaceRapidoEjemplo = document.getElementById('enlace-rapido-ejemplo');
        const botonReiniciar = document.getElementById('boton-reiniciar-limpio');

        if (inputCuenta && this.gestor.ingresoCuenta > 0) {
            inputCuenta.value = this.gestor.ingresoCuenta;
        }
        if (inputFisico && this.gestor.ingresoFisico > 0) {
            inputFisico.value = this.gestor.ingresoFisico;
        }

        const actualizarResumenEnVivo = () => {
            const valCuenta = parseFloat(inputCuenta.value) || 0;
            const valFisico = parseFloat(inputFisico.value) || 0;
            const suma = valCuenta + valFisico;

            if (textoTotalNeto) {
                textoTotalNeto.textContent = `${suma.toFixed(2)} €`;
            }

            if (textoPorcentaje) {
                if (suma > 0) {
                    const pctCuenta = Math.round((valCuenta / suma) * 100);
                    const pctFisico = Math.round((valFisico / suma) * 100);
                    textoPorcentaje.textContent = `${pctCuenta}% en Banco • ${pctFisico}% en Efectivo`;
                } else {
                    textoPorcentaje.textContent = '0% en Banco • 0% en Efectivo';
                }
            }
        };

        if (inputCuenta) inputCuenta.addEventListener('input', actualizarResumenEnVivo);
        if (inputFisico) inputFisico.addEventListener('input', actualizarResumenEnVivo);
        actualizarResumenEnVivo();

        if (selectorPerfil) {
            selectorPerfil.value = this.gestor.perfilSeleccionado || 'VIVIENDO_PADRES';
            selectorPerfil.addEventListener('change', (evento) => {
                const perfil = PERFILES_PRESUPUESTO[evento.target.value];
                if (perfil && textoPerfil) {
                    textoPerfil.textContent = `Perfil seleccionado: ${perfil.descripcion}`;
                }
            });
        }

        if (formulario) {
            formulario.addEventListener('submit', (evento) => {
                evento.preventDefault();
                const sueldoCuenta = parseFloat(inputCuenta.value) || 0;
                const sueldoFisico = parseFloat(inputFisico.value) || 0;
                const perfilId = selectorPerfil.value;

                if (sueldoCuenta + sueldoFisico <= 0) {
                    alert('Por favor, introduce un importe válido en cuenta bancaria o en efectivo (mayor a 0€)');
                    return;
                }

                this.gestor.generarPresupuestoBicanal(sueldoCuenta, sueldoFisico, perfilId);
                this.actualizarVistaCompleta();

                const seccionMetricas = document.querySelector('.rejilla-metricas');
                if (seccionMetricas) {
                    seccionMetricas.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        const accionCargarEjemplo = () => {
            this.gestor.cargarCasoEjemplo(false);
            if (inputCuenta) inputCuenta.value = 1000;
            if (inputFisico) inputFisico.value = 400;
            if (selectorPerfil) selectorPerfil.value = 'VIVIENDO_PADRES';
            actualizarResumenEnVivo();
            this.actualizarVistaCompleta();
        };

        if (botonCargarEjemplo) botonCargarEjemplo.addEventListener('click', accionCargarEjemplo);
        if (enlaceRapidoEjemplo) enlaceRapidoEjemplo.addEventListener('click', accionCargarEjemplo);

        if (botonReiniciar) {
            botonReiniciar.addEventListener('click', () => {
                if (confirm('¿Deseas reiniciar y poner el presupuesto en blanco para introducir nuevos datos?')) {
                    this.gestor.reiniciarPresupuestoEnBlanco();
                    if (inputCuenta) inputCuenta.value = '';
                    if (inputFisico) inputFisico.value = '';
                    actualizarResumenEnVivo();
                    this.actualizarVistaCompleta();
                }
            });
        }
    }

    configurarFormularioCompraLugar() {
        const datalistLugares = document.getElementById('lista-sugerencias-lugares');
        if (datalistLugares) {
            datalistLugares.innerHTML = LUGARES_FRECUENTES_SUGERIDOS.map(lugar => `
                <option value="${lugar}"></option>
            `).join('');
        }

        const formulario = document.getElementById('formulario-compra-lugar');
        const inputLugar = document.getElementById('input-lugar-compra');
        const inputImporte = document.getElementById('input-importe-compra');
        const selectCategoria = document.getElementById('selector-categoria-compra');
        const selectCanal = document.getElementById('selector-canal-compra');

        if (formulario) {
            formulario.addEventListener('submit', (evento) => {
                evento.preventDefault();
                const lugar = inputLugar.value.trim();
                const importe = parseFloat(inputImporte.value) || 0;
                const categoria = selectCategoria.value;
                const canal = selectCanal.value;

                if (!lugar || importe <= 0) {
                    alert('Por favor, introduce el lugar o comercio y un importe mayor a 0€');
                    return;
                }

                this.gestor.registrarTransaccion({
                    lugar,
                    importe,
                    categoria,
                    canal,
                    fecha: new Date().toISOString().split('T')[0]
                });

                inputLugar.value = '';
                inputImporte.value = '';
                this.actualizarVistaCompleta();
            });
        }
    }

    cambiarPestanaActiva(destinoId) {
        const botonesPestanas = document.querySelectorAll('.boton-pestana');
        const botonesMoviles = document.querySelectorAll('.item-navegacion-movil');
        const paneles = document.querySelectorAll('.panel-contenido');

        botonesPestanas.forEach(b => {
            if (b.getAttribute('data-pestana') === destinoId) {
                b.classList.add('activa');
            } else {
                b.classList.remove('activa');
            }
        });

        botonesMoviles.forEach(b => {
            if (b.getAttribute('data-pestana') === destinoId) {
                b.classList.add('activa');
            } else {
                b.classList.remove('activa');
            }
        });

        paneles.forEach(p => p.classList.remove('activo'));
        const panelDestino = document.getElementById(destinoId);
        if (panelDestino) {
            panelDestino.classList.add('activo');
        }

        if (destinoId === 'panel-graficos') {
            this.renderizarGraficos();
        } else if (destinoId === 'panel-lugares') {
            this.renderizarSobresPresupuesto();
            this.renderizarHistorialTransacciones();
        }
    }

    configurarNavegacionPestanas() {
        const botonesPestanas = document.querySelectorAll('.boton-pestana');
        botonesPestanas.forEach(boton => {
            boton.addEventListener('click', () => {
                const destinoId = boton.getAttribute('data-pestana');
                this.cambiarPestanaActiva(destinoId);
            });
        });
    }

    configurarNavegacionMovilYFab() {
        const botonesMoviles = document.querySelectorAll('.item-navegacion-movil');
        botonesMoviles.forEach(boton => {
            boton.addEventListener('click', () => {
                const destinoId = boton.getAttribute('data-pestana');
                this.cambiarPestanaActiva(destinoId);
                const panel = document.getElementById(destinoId);
                if (panel) {
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        const botonFab = document.getElementById('boton-flotante-agregar-gasto');
        if (botonFab) {
            botonFab.addEventListener('click', () => {
                this.cambiarPestanaActiva('panel-lugares');
                const formCompra = document.getElementById('formulario-compra-lugar');
                if (formCompra) {
                    formCompra.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const inputImporte = document.getElementById('input-importe-compra');
                    if (inputImporte) {
                        setTimeout(() => inputImporte.focus(), 300);
                    }
                }
            });
        }
    }

    configurarCopiaSeguridadJSON() {
        const botonExportar = document.getElementById('boton-exportar-backup');
        const botonImportar = document.getElementById('boton-importar-backup');
        const inputArchivo = document.getElementById('input-archivo-backup');

        if (botonExportar) {
            botonExportar.addEventListener('click', () => {
                const datosJSON = this.gestor.exportarCopiaSeguridadJSON();
                const blob = new Blob([datosJSON], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const enlaceDescarga = document.createElement('a');
                const fecha = new Date().toISOString().split('T')[0];
                enlaceDescarga.href = url;
                enlaceDescarga.download = `Mi_Presupuesto_Personal_${fecha}.json`;
                document.body.appendChild(enlaceDescarga);
                enlaceDescarga.click();
                document.body.removeChild(enlaceDescarga);
                URL.revokeObjectURL(url);
            });
        }

        if (botonImportar && inputArchivo) {
            botonImportar.addEventListener('click', () => {
                inputArchivo.click();
            });

            inputArchivo.addEventListener('change', (evento) => {
                const archivo = evento.target.files && evento.target.files[0];
                if (!archivo) return;

                const lector = new FileReader();
                lector.onload = (e) => {
                    const contenido = e.target.result;
                    const resultado = this.gestor.importarCopiaSeguridadJSON(contenido);
                    alert(resultado.mensaje);
                    if (resultado.exito) {
                        const inputCuenta = document.getElementById('input-sueldo-cuenta');
                        const inputFisico = document.getElementById('input-sueldo-fisico');
                        if (inputCuenta) inputCuenta.value = this.gestor.ingresoCuenta;
                        if (inputFisico) inputFisico.value = this.gestor.ingresoFisico;
                        this.actualizarVistaCompleta();
                    }
                };
                lector.readAsText(archivo);
                inputArchivo.value = '';
            });
        }
    }

    configurarFiltrosYAcciones() {
        const selectorFiltro = document.getElementById('selector-filtro-canal');
        if (selectorFiltro) {
            selectorFiltro.addEventListener('change', (evento) => {
                this.filtroCanalSeleccionado = evento.target.value;
                this.renderizarTablaGastos();
            });
        }

        const selectorMes = document.getElementById('selector-mes-activo');
        if (selectorMes) {
            selectorMes.addEventListener('change', (evento) => {
                this.gestor.mesVisualizado = parseInt(evento.target.value) || 1;
                this.actualizarVistaCompleta();
            });
        }

        const botonAbrirModal = document.getElementById('boton-abrir-modal-gasto');
        if (botonAbrirModal) {
            botonAbrirModal.addEventListener('click', () => {
                this.abrirModalGasto();
            });
        }

        const botonExportar = document.getElementById('boton-exportar-excel');
        if (botonExportar) {
            botonExportar.addEventListener('click', () => {
                this.exportador.generarYDescargarExcel();
            });
        }
    }

    configurarModalFormulario() {
        const modal = document.getElementById('modal-gasto');
        const botonCerrar = document.getElementById('boton-cerrar-modal');
        const botonCancelar = document.getElementById('boton-cancelar-modal');
        const formulario = document.getElementById('formulario-nuevo-gasto');

        const cerrar = () => {
            if (modal) modal.classList.remove('activo');
            this.idGastoEnEdicion = null;
        };

        if (botonCerrar) botonCerrar.addEventListener('click', cerrar);
        if (botonCancelar) botonCancelar.addEventListener('click', cerrar);

        if (formulario) {
            formulario.addEventListener('submit', (evento) => {
                evento.preventDefault();
                this.procesarFormularioGasto(formulario);
                cerrar();
            });
        }
    }

    abrirModalGasto(idGasto = null) {
        const modal = document.getElementById('modal-gasto');
        const tituloModal = document.getElementById('titulo-modal-gasto');
        const campoConcepto = document.getElementById('campo-gasto-concepto');
        const campoImporte = document.getElementById('campo-gasto-importe');
        const campoCategoria = document.getElementById('campo-gasto-categoria');
        const campoCanal = document.getElementById('campo-gasto-canal');
        const campoDescripcion = document.getElementById('campo-gasto-descripcion');
        const campoRecurrente = document.getElementById('campo-gasto-recurrente');

        this.idGastoEnEdicion = idGasto;

        if (idGasto) {
            const gasto = this.gestor.gastos.find(item => item.id === idGasto);
            if (gasto) {
                if (tituloModal) tituloModal.textContent = 'Editar Partida de Presupuesto';
                if (campoConcepto) campoConcepto.value = gasto.concepto;
                if (campoImporte) campoImporte.value = gasto.importe;
                if (campoCategoria) campoCategoria.value = gasto.categoria;
                if (campoCanal) campoCanal.value = gasto.canal;
                if (campoDescripcion) campoDescripcion.value = gasto.descripcion || '';
                if (campoRecurrente) campoRecurrente.checked = gasto.recurrente;
            }
        } else {
            if (tituloModal) tituloModal.textContent = 'Añadir Nueva Partida';
            if (campoConcepto) campoConcepto.value = '';
            if (campoImporte) campoImporte.value = '';
            if (campoCategoria) campoCategoria.value = 'OCIO_ESTILO_VIDA';
            if (campoCanal) campoCanal.value = CANALES_PAGO.CUENTA;
            if (campoDescripcion) campoDescripcion.value = '';
            if (campoRecurrente) campoRecurrente.checked = true;
        }

        if (modal) modal.classList.add('activo');
    }

    procesarFormularioGasto(formulario) {
        const concepto = formulario['concepto'].value.trim();
        const importe = parseFloat(formulario['importe'].value) || 0;
        const categoria = formulario['categoria'].value;
        const canal = formulario['canal'].value;
        const descripcion = formulario['descripcion'].value.trim();
        const recurrente = formulario['recurrente'].checked;

        if (!concepto || importe <= 0) {
            alert('Por favor, escribe un concepto válido y un importe mayor a 0€');
            return;
        }

        const datosGasto = {
            concepto,
            importe,
            categoria,
            canal,
            descripcion,
            recurrente
        };

        if (this.idGastoEnEdicion) {
            this.gestor.actualizarGasto(this.idGastoEnEdicion, datosGasto);
        } else {
            this.gestor.agregarGasto(datosGasto);
        }

        this.actualizarVistaCompleta();
    }

    actualizarVistaCompleta() {
        const mes = this.gestor.mesVisualizado;
        const resumen = this.gestor.calcularResumenMes(mes);

        this.renderizarMetricas(resumen);
        this.renderizarTarjetaEstrategiaEfectivo(resumen);
        this.renderizarBarraDistribucion(resumen);
        this.renderizarAvisoDidactico(resumen);
        this.renderizarTablaGastos();
        this.renderizarVistaCanales(resumen);
        this.renderizarTablaProyeccionExcel();
        this.renderizarSobresPresupuesto();
        this.renderizarHistorialTransacciones();

        const panelGraficos = document.getElementById('panel-graficos');
        if (panelGraficos && panelGraficos.classList.contains('activo')) {
            this.renderizarGraficos();
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    renderizarMetricas(resumen) {
        const elIngreso = document.getElementById('metrica-ingreso-valor');
        const elCuenta = document.getElementById('metrica-cuenta-valor');
        const elFisico = document.getElementById('metrica-fisico-valor');
        const elAhorro = document.getElementById('metrica-ahorro-valor');
        const elBalance = document.getElementById('metrica-balance-valor');
        const subIngreso = document.getElementById('subtitulo-ingreso-texto');
        const subFisico = document.getElementById('subtitulo-fisico-texto');
        const insignia = document.getElementById('insignia-estado-actual');

        if (elIngreso) elIngreso.textContent = `${resumen.ingresoActual.toFixed(2)} €`;
        if (subIngreso) {
            subIngreso.textContent = `${resumen.ingresoCuenta.toFixed(2)}€ Banco / ${resumen.ingresoFisico.toFixed(2)}€ Efectivo`;
        }

        if (elCuenta) elCuenta.textContent = `${resumen.totalCuenta.toFixed(2)} €`;
        if (elFisico) elFisico.textContent = `${resumen.totalFisico.toFixed(2)} €`;
        if (subFisico) {
            if (resumen.ingresoFisico > 0) {
                subFisico.textContent = `Absorbe ${Math.min(resumen.ingresoFisico, resumen.totalFisico).toFixed(2)}€ de tu efectivo en mano`;
            } else {
                subFisico.textContent = 'Consumo en billetes físicos';
            }
        }

        const totalAhorroInversion = resumen.totalAhorroAsignado + resumen.totalInversionAsignada;
        if (elAhorro) elAhorro.textContent = `${totalAhorroInversion.toFixed(2)} €`;

        if (elBalance) {
            if (resumen.balanceNeto < -0.05) {
                elBalance.textContent = `${resumen.balanceNeto.toFixed(2)} €`;
                elBalance.style.color = '#f87171';
            } else if (resumen.balanceNeto > 0.05) {
                elBalance.textContent = `+${resumen.balanceNeto.toFixed(2)} €`;
                elBalance.style.color = '#38bdf8';
            } else {
                elBalance.textContent = `0,00 €`;
                elBalance.style.color = '#34d399';
            }
        }

        if (insignia) {
            if (this.gestor.escenarioActual === 'ejemplo_optimizado') {
                insignia.className = 'insignia-estado insignia-optimizada';
                insignia.textContent = 'Caso Ejemplo (1.400€)';
            } else if (this.gestor.escenarioActual === 'ejemplo_original') {
                insignia.className = 'insignia-estado insignia-alerta';
                insignia.textContent = 'Caso Inicial (Déficit)';
            } else if (resumen.ingresoActual > 0) {
                insignia.className = 'insignia-estado insignia-optimizada';
                insignia.textContent = `Bicanal: ${resumen.porcentajeCuenta}% Banco / ${resumen.porcentajeFisico}% Efectivo`;
            } else {
                insignia.className = 'insignia-estado insignia-neutra';
                insignia.textContent = 'Sin Configurar (En Blanco)';
            }
        }
    }

    renderizarTarjetaEstrategiaEfectivo(resumen) {
        const bloqueEstrategia = document.getElementById('tarjeta-estrategia-efectivo-bloque');
        const parrafoEstrategia = document.getElementById('parrafo-estrategia-personalizada');

        if (!bloqueEstrategia || !parrafoEstrategia) return;

        if (resumen.ingresoFisico > 0) {
            bloqueEstrategia.style.display = 'block';
            parrafoEstrategia.innerHTML = `
                ${resumen.analisisEfectivo.recomendacion}
            `;
        } else {
            bloqueEstrategia.style.display = 'none';
        }
    }

    renderizarSobresPresupuesto() {
        const contenedorSobres = document.getElementById('cuerpo-sobres-presupuesto');
        const valorHucha = document.getElementById('valor-hucha-ahorro-acumulado');

        if (!contenedorSobres) return;

        const seguimiento = this.gestor.obtenerSeguimientoSobres();
        const dineroSalvadoTotal = this.gestor.calcularTotalSalvadoParaAhorro();

        if (valorHucha) {
            valorHucha.textContent = `+${dineroSalvadoTotal.toFixed(2)} €`;
        }

        const categoriasValidas = Object.values(seguimiento).filter(s => s.limitePresupuestado > 0 || s.dineroGastado > 0);

        if (categoriasValidas.length === 0) {
            contenedorSobres.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--color-texto-apagado);">
                    Configura tu presupuesto arriba para activar tus sobres digitales de gasto.
                </div>
            `;
            return;
        }

        contenedorSobres.innerHTML = categoriasValidas.map(sobre => {
            const cfg = sobre.configuracion;
            const claseEstado = `sobre-${sobre.estadoSobre}`;
            let textoEstado = 'Dentro de límite';
            if (sobre.estadoSobre === 'alerta') textoEstado = 'Atención (75%)';
            if (sobre.estadoSobre === 'sobregasto') textoEstado = '¡Excedido!';

            const anchoBarra = Math.min(100, sobre.porcentajeConsumido);

            return `
                <div class="tarjeta-sobre-categoria ${claseEstado}">
                    <div class="cabecera-sobre">
                        <span class="nombre-sobre">
                            <i data-lucide="${cfg.icono}" style="color: ${cfg.color}; width: 18px; height: 18px;"></i>
                            ${cfg.nombre}
                        </span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="insignia-estado-sobre">${textoEstado}</span>
                            <button class="boton-rapido-sobre" onclick="window.controladorApp.prepararGastoRapidoSobre('${sobre.categoria}')" title="Anotar compra en este sobre">
                                <i data-lucide="plus" style="width: 12px; height: 12px;"></i>
                                <span>+ Gasto</span>
                            </button>
                        </div>
                    </div>

                    <div class="cifras-sobre-detalle">
                        <span class="disponible-etiqueta">Te queda disponible:</span>
                        <span class="disponible-valor">${sobre.dineroDisponible.toFixed(2)} €</span>
                    </div>

                    <div class="gastado-vs-limite">
                        <span>Gastado: <strong>${sobre.dineroGastado.toFixed(2)} €</strong></span>
                        <span>Presupuestado: ${sobre.limitePresupuestado.toFixed(2)} €</span>
                    </div>

                    <div class="barra-progreso-sobre">
                        <div class="relleno-barra-sobre" style="width: ${anchoBarra}%;"></div>
                    </div>

                    <div class="pie-sobre-salvado">
                        <span>Consumo: ${sobre.porcentajeConsumido}%</span>
                        <span style="color: #34d399;">Salvado para ahorro: +${sobre.dineroSalvadoParaAhorro.toFixed(2)} €</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    prepararGastoRapidoSobre(claveCategoria) {
        this.cambiarPestanaActiva('panel-lugares');
        const selectorCat = document.getElementById('selector-categoria-compra');
        if (selectorCat) {
            selectorCat.value = claveCategoria;
        }
        const formulario = document.getElementById('formulario-compra-lugar');
        if (formulario) {
            formulario.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const inputImporte = document.getElementById('input-importe-compra');
        if (inputImporte) {
            setTimeout(() => inputImporte.focus(), 250);
        }
    }

    renderizarHistorialTransacciones() {
        const cuerpoHistorial = document.getElementById('cuerpo-historial-transacciones');
        const contadorTransacciones = document.getElementById('contador-transacciones-registradas');

        if (!cuerpoHistorial) return;

        const transacciones = this.gestor.transacciones;

        if (contadorTransacciones) {
            contadorTransacciones.textContent = `${transacciones.length} compras / gastos registrados`;
        }

        if (transacciones.length === 0) {
            cuerpoHistorial.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 24px; color: var(--color-texto-apagado);">
                        No hay compras registradas aún. ¡Anota arriba tu primer gasto en Mercadona, Gasolinera, Bar, etc.!
                    </td>
                </tr>
            `;
            return;
        }

        cuerpoHistorial.innerHTML = transacciones.map(t => {
            const cfg = CATEGORIAS_GASTO[t.categoria] || { nombre: t.categoria, color: '#94a3b8' };
            const esCuenta = t.canal === CANALES_PAGO.CUENTA;

            return `
                <tr>
                    <td style="color: var(--color-texto-apagado); font-size: 13px;">${t.fecha}</td>
                    <td>
                        <span class="etiqueta-lugar">
                            <i data-lucide="store" style="width: 14px; height: 14px; color: #38bdf8;"></i>
                            ${t.lugar}
                        </span>
                    </td>
                    <td>
                        <span class="insignia-categoria" style="border-left: 3px solid ${cfg.color}">
                            ${cfg.nombre}
                        </span>
                    </td>
                    <td>
                        <span class="etiqueta-canal ${esCuenta ? 'canal-cuenta' : 'canal-fisico'}" style="cursor: default; padding: 4px 8px; font-size: 11px;">
                            ${t.canal}
                        </span>
                    </td>
                    <td style="font-family: var(--fuente-titulos); font-weight: 700; color: #ffffff;">
                        ${t.importe.toFixed(2)} €
                    </td>
                    <td>
                        <button class="boton-icono eliminar" onclick="window.controladorApp.eliminarTransaccion('${t.id}')" title="Eliminar gasto">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    eliminarTransaccion(idTransaccion) {
        if (confirm('¿Deseas eliminar este gasto del historial? El dinero volverá a estar disponible en su sobre.')) {
            this.gestor.eliminarTransaccion(idTransaccion);
            this.actualizarVistaCompleta();
        }
    }

    renderizarBarraDistribucion(resumen) {
        const seccionBarra = document.getElementById('seccion-distribucion-sueldo');
        const contenedorBarra = document.getElementById('barra-progreso-segmentada');
        const leyenda = document.getElementById('leyenda-distribucion-categorias');
        const etiquetaPorcentaje = document.getElementById('etiqueta-porcentaje-total');

        if (!seccionBarra || !contenedorBarra || !leyenda) return;

        if (resumen.ingresoActual <= 0) {
            seccionBarra.style.display = 'none';
            return;
        }

        seccionBarra.style.display = 'block';

        if (etiquetaPorcentaje) {
            if (resumen.porcentajeAsignado > 100) {
                etiquetaPorcentaje.textContent = `⚠️ ${resumen.porcentajeAsignado}% Asignado (Déficit de ${Math.abs(resumen.balanceNeto).toFixed(2)}€)`;
                etiquetaPorcentaje.style.color = '#f87171';
            } else if (resumen.porcentajeAsignado === 100) {
                etiquetaPorcentaje.textContent = `✨ 100% Asignado (Cuadre perfecto)`;
                etiquetaPorcentaje.style.color = '#34d399';
            } else {
                etiquetaPorcentaje.textContent = `ℹ️ ${resumen.porcentajeAsignado}% Asignado (Quedan ${resumen.balanceNeto.toFixed(2)}€ libres)`;
                etiquetaPorcentaje.style.color = '#38bdf8';
            }
        }

        let htmlBarra = '';
        let htmlLeyenda = '';

        Object.entries(resumen.desglosePorCategoria).forEach(([clave, total]) => {
            if (total > 0) {
                const porcentaje = Math.round((total / resumen.ingresoActual) * 100);
                const cfg = CATEGORIAS_GASTO[clave] || { nombre: clave, color: '#64748b' };

                htmlBarra += `
                    <div class="segmento-barra" style="width: ${porcentaje}%; background-color: ${cfg.color};" title="${cfg.nombre}: ${total.toFixed(2)}€ (${porcentaje}%)"></div>
                `;

                htmlLeyenda += `
                    <div class="item-leyenda">
                        <span class="punto-leyenda" style="background-color: ${cfg.color};"></span>
                        <span>${cfg.nombre}: <strong>${total.toFixed(2)}€</strong> (${porcentaje}%)</span>
                    </div>
                `;
            }
        });

        contenedorBarra.innerHTML = htmlBarra;
        leyenda.innerHTML = htmlLeyenda;
    }

    renderizarAvisoDidactico(resumen) {
        const contenedorAviso = document.getElementById('tarjeta-aviso-didactico');
        if (!contenedorAviso) return;

        if (resumen.ingresoActual <= 0) {
            contenedorAviso.className = 'tarjeta-aviso-didactico modo-neutro';
            contenedorAviso.innerHTML = `
                <div class="icono-aviso">
                    <i data-lucide="info"></i>
                </div>
                <div class="contenido-aviso">
                    <h3>👋 ¡Bienvenido a tu Gestor Financiero Inteligente!</h3>
                    <p>
                        Introduce arriba tu dinero en <strong>cuenta bancaria</strong> y tu dinero en <strong>efectivo físico / en mano</strong>. 
                        El sistema calculará automáticamente la distribución de tus gastos, canalizará tu efectivo para evitar la inflación y maximizará tu inversión bancarizada.
                    </p>
                </div>
            `;
            return;
        }

        if (this.gestor.escenarioActual === 'ejemplo_optimizado') {
            contenedorAviso.className = 'tarjeta-aviso-didactico modo-exito';
            contenedorAviso.innerHTML = `
                <div class="icono-aviso">
                    <i data-lucide="check-circle-2"></i>
                </div>
                <div class="contenido-aviso">
                    <h3>✨ Caso de Estudio: 1.000€ en cuenta bancaria y 400€ en efectivo</h3>
                    <p>
                        Los 400€ de efectivo cubren íntegramente la aportación a casa (250€), las tonterías (70€) y el botellón (38,78€). 
                        De este modo, tu dinero en cuenta bancaria queda 100% libre para liquidar deudas en el Mes 1 y ahorrar/invertir en fondos indexados a partir del Mes 2.
                    </p>
                </div>
            `;
            return;
        }

        if (resumen.balanceNeto < -0.05) {
            contenedorAviso.className = 'tarjeta-aviso-didactico modo-alerta';
            contenedorAviso.innerHTML = `
                <div class="icono-aviso">
                    <i data-lucide="alert-triangle"></i>
                </div>
                <div class="contenido-aviso">
                    <h3>⚠️ Alerta de Déficit: Gastos por encima de tus ingresos en ${Math.abs(resumen.balanceNeto).toFixed(2)}€</h3>
                    <p>
                        Has presupuestado <strong>${resumen.totalPresupuestadoCompleto.toFixed(2)}€</strong> sobre un ingreso total de <strong>${resumen.ingresoActual.toFixed(2)}€</strong>. 
                        Ajusta las partidas para evitar endeudamiento.
                    </p>
                </div>
            `;
            return;
        }

        const ahorroAnualProyectado = ((resumen.totalAhorroAsignado + resumen.totalInversionAsignada) * 12).toFixed(2);
        contenedorAviso.className = 'tarjeta-aviso-didactico modo-exito';
        contenedorAviso.innerHTML = `
            <div class="icono-aviso">
                <i data-lucide="sparkles"></i>
            </div>
            <div class="contenido-aviso">
                <h3>💡 Diagnóstico Financiero: Plan Bicanal Saludable</h3>
                <p>
                    Tienes <strong>${resumen.totalCuenta.toFixed(2)}€ comprometidos en banco</strong> y <strong>${resumen.totalFisico.toFixed(2)}€ en gastos en efectivo</strong>. 
                    A este ritmo acumularás <strong>${ahorroAnualProyectado}€ al año</strong> en tu patrimonio financiero.
                </p>
            </div>
        `;
    }

    renderizarTablaGastos() {
        const cuerpoTabla = document.getElementById('cuerpo-tabla-gastos');
        if (!cuerpoTabla) return;

        const mesActivo = this.gestor.mesVisualizado;
        let gastosMostrados = this.gestor.obtenerGastosActivosMes(mesActivo);

        if (this.filtroCanalSeleccionado !== 'TODOS') {
            const canalComparar = this.filtroCanalSeleccionado === 'CUENTA' ? CANALES_PAGO.CUENTA : CANALES_PAGO.FISICO;
            gastosMostrados = gastosMostrados.filter(g => g.canal === canalComparar);
        }

        if (gastosMostrados.length === 0) {
            cuerpoTabla.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 36px 20px; color: var(--color-texto-apagado);">
                        <i data-lucide="inbox" style="width: 32px; height: 32px; margin-bottom: 8px; display: inline-block; opacity: 0.5;"></i>
                        <p>No hay partidas añadidas. Introduce tus ingresos arriba o pulsa <strong>"+ Añadir Nueva Partida"</strong>.</p>
                    </td>
                </tr>
            `;
            return;
        }

        cuerpoTabla.innerHTML = gastosMostrados.map(gasto => {
            const configCategoria = CATEGORIAS_GASTO[gasto.categoria] || { nombre: gasto.categoria, icono: 'tag', color: '#94a3b8' };
            const esCuenta = gasto.canal === CANALES_PAGO.CUENTA;

            return `
                <tr>
                    <td>
                        <div class="celda-concepto">
                            <span class="nombre-concepto">${gasto.concepto}</span>
                            <span class="descripcion-concepto">${gasto.descripcion || ''}</span>
                        </div>
                    </td>
                    <td>
                        <span class="insignia-categoria" style="border-left: 3px solid ${configCategoria.color}">
                            <i data-lucide="${configCategoria.icono}" style="width: 14px; height: 14px; color: ${configCategoria.color}"></i>
                            ${configCategoria.nombre}
                        </span>
                    </td>
                    <td>
                        <span class="etiqueta-canal ${esCuenta ? 'canal-cuenta' : 'canal-fisico'}" 
                              onclick="window.controladorApp.cambiarCanalGasto('${gasto.id}')"
                              title="Haz clic para alternar entre Cuenta Bancaria y Efectivo Físico">
                            <i data-lucide="${esCuenta ? 'credit-card' : 'banknote'}" style="width: 14px; height: 14px;"></i>
                            ${gasto.canal}
                        </span>
                    </td>
                    <td>
                        <span class="celda-importe">${gasto.importe.toFixed(2)} €</span>
                    </td>
                    <td>
                        <div class="acciones-fila">
                            <button class="boton-icono" onclick="window.controladorApp.abrirModalGasto('${gasto.id}')" title="Editar partida">
                                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                            </button>
                            <button class="boton-icono eliminar" onclick="window.controladorApp.eliminarGasto('${gasto.id}')" title="Eliminar partida">
                                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderizarVistaCanales(resumen) {
        const mesActivo = this.gestor.mesVisualizado;
        const gastosMes = this.gestor.obtenerGastosActivosMes(mesActivo);

        const gastosCuenta = gastosMes.filter(g => g.canal === CANALES_PAGO.CUENTA);
        const gastosFisico = gastosMes.filter(g => g.canal === CANALES_PAGO.FISICO);

        const contenedorCuenta = document.getElementById('lista-partidas-cuenta');
        const contenedorFisico = document.getElementById('lista-partidas-fisico');
        const totalCuentaDestacado = document.getElementById('total-destacado-cuenta');
        const totalFisicoDestacado = document.getElementById('total-destacado-fisico');
        const instruccionFisico = document.getElementById('instruccion-canal-fisico');

        if (totalCuentaDestacado) totalCuentaDestacado.textContent = `${resumen.totalCuenta.toFixed(2)} €`;
        if (totalFisicoDestacado) totalFisicoDestacado.textContent = `${resumen.totalFisico.toFixed(2)} €`;

        if (instruccionFisico) {
            if (resumen.ingresoFisico > 0) {
                if (resumen.ingresoFisico >= resumen.totalFisico) {
                    instruccionFisico.textContent = `¡Cubierto al 100% con tu dinero en mano! No necesitas ir al cajero.`;
                } else {
                    const restante = resumen.totalFisico - resumen.ingresoFisico;
                    instruccionFisico.textContent = `Tu efectivo en mano cubre ${resumen.ingresoFisico.toFixed(2)}€. Solo necesitas sacar ${restante.toFixed(2)}€ del cajero.`;
                }
            } else {
                instruccionFisico.textContent = `Retirar del cajero a principio de mes para gastos en mano`;
            }
        }

        if (contenedorCuenta) {
            if (gastosCuenta.length === 0) {
                contenedorCuenta.innerHTML = `<li style="color: var(--color-texto-apagado); padding: 12px; text-align: center;">Sin cargos en cuenta</li>`;
            } else {
                contenedorCuenta.innerHTML = gastosCuenta.map(g => `
                    <li class="item-partida-canal">
                        <div>
                            <div class="concepto-item">${g.concepto}</div>
                            <div style="font-size: 11px; color: var(--color-texto-apagado);">${g.descripcion || 'Cargo bancario'}</div>
                        </div>
                        <span class="importe-item">${g.importe.toFixed(2)} €</span>
                    </li>
                `).join('');
            }
        }

        if (contenedorFisico) {
            if (gastosFisico.length === 0) {
                contenedorFisico.innerHTML = `<li style="color: var(--color-texto-apagado); padding: 12px; text-align: center;">Sin gastos en efectivo</li>`;
            } else {
                contenedorFisico.innerHTML = gastosFisico.map(g => `
                    <li class="item-partida-canal">
                        <div>
                            <div class="concepto-item">${g.concepto}</div>
                            <div style="font-size: 11px; color: var(--color-texto-apagado);">${g.descripcion || 'Efectivo en mano'}</div>
                        </div>
                        <span class="importe-item">${g.importe.toFixed(2)} €</span>
                    </li>
                `).join('');
            }
        }
    }

    renderizarTablaProyeccionExcel() {
        const cuerpoExcel = document.getElementById('cuerpo-tabla-proyeccion-excel');
        if (!cuerpoExcel) return;

        const proyeccion = this.gestor.calcularProyeccion6Meses();

        cuerpoExcel.innerHTML = proyeccion.map(item => `
            <tr>
                <td><strong>Mes ${item.mes}</strong> ${item.mes === 1 ? '<span style="font-size: 11px; color: #38bdf8;">(Actual)</span>' : ''}</td>
                <td>${item.ingreso.toFixed(2)} €</td>
                <td>${item.gastosFijos.toFixed(2)} €</td>
                <td class="${item.deudas > 0 ? 'columna-deuda-pagada' : ''}">
                    ${item.deudas > 0 ? `${item.deudas.toFixed(2)} €` : '0,00 €'}
                </td>
                <td>${item.gastosTotales.toFixed(2)} €</td>
                <td style="color: #34d399; font-weight: 700;">+${item.sobrante.toFixed(2)} €</td>
                <td>${item.ahorroMensual.toFixed(2)} €</td>
                <td>${item.inversionMensual.toFixed(2)} €</td>
                <td>${item.ahorroAcumulado.toFixed(2)} €</td>
                <td>${item.inversionAcumulada.toFixed(2)} €</td>
                <td class="columna-patrimonio">${item.patrimonioTotal.toFixed(2)} €</td>
            </tr>
        `).join('');

        const ultimoMes = proyeccion[proyeccion.length - 1];
        const sumaIngresos = proyeccion.reduce((acc, fila) => acc + fila.ingreso, 0);
        const sumaGastos = proyeccion.reduce((acc, fila) => acc + fila.gastosTotales, 0);
        const sumaSobrantes = proyeccion.reduce((acc, fila) => acc + fila.sobrante, 0);

        cuerpoExcel.innerHTML += `
            <tr class="fila-totales">
                <td>TOTAL 6 MESES</td>
                <td>${sumaIngresos.toFixed(2)} €</td>
                <td>-</td>
                <td>-</td>
                <td>${sumaGastos.toFixed(2)} €</td>
                <td>+${sumaSobrantes.toFixed(2)} €</td>
                <td>${ultimoMes.ahorroAcumulado.toFixed(2)} €</td>
                <td>${ultimoMes.inversionAcumulada.toFixed(2)} €</td>
                <td>${ultimoMes.ahorroAcumulado.toFixed(2)} €</td>
                <td>${ultimoMes.inversionAcumulada.toFixed(2)} €</td>
                <td class="columna-patrimonio">${ultimoMes.patrimonioTotal.toFixed(2)} €</td>
            </tr>
        `;
    }

    renderizarGraficos() {
        if (typeof Chart === 'undefined') return;

        const resumen = this.gestor.calcularResumenMes(this.gestor.mesVisualizado);
        const proyeccion = this.gestor.calcularProyeccion6Meses();

        // 1. Gráfico de Categorías (Donut)
        const lienzoCategorias = document.getElementById('grafico-categorias');
        if (lienzoCategorias) {
            if (this.instanciasGraficos.categorias) {
                this.instanciasGraficos.categorias.destroy();
            }

            const etiquetas = [];
            const datos = [];
            const colores = [];

            Object.entries(resumen.desglosePorCategoria).forEach(([clave, total]) => {
                if (total > 0) {
                    const cfg = CATEGORIAS_GASTO[clave];
                    etiquetas.push(cfg ? cfg.nombre : clave);
                    datos.push(total);
                    colores.push(cfg ? cfg.color : '#64748b');
                }
            });

            if (datos.length === 0) {
                etiquetas.push('Sin datos');
                datos.push(1);
                colores.push('#334155');
            }

            this.instanciasGraficos.categorias = new Chart(lienzoCategorias, {
                type: 'doughnut',
                data: {
                    labels: etiquetas,
                    datasets: [{
                        data: datos,
                        backgroundColor: colores,
                        borderColor: '#0e131f',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 12 } }
                        }
                    },
                    cutout: '68%'
                }
            });
        }

        // 2. Gráfico Cuenta vs Físico
        const lienzoCanales = document.getElementById('grafico-canales');
        if (lienzoCanales) {
            if (this.instanciasGraficos.canales) {
                this.instanciasGraficos.canales.destroy();
            }

            this.instanciasGraficos.canales = new Chart(lienzoCanales, {
                type: 'bar',
                data: {
                    labels: ['Cuenta Bancaria (Banco/Cargos)', 'Efectivo Físico (Consumo en Mano)'],
                    datasets: [{
                        label: 'Importe (€)',
                        data: [resumen.totalCuenta, resumen.totalFisico],
                        backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(16, 185, 129, 0.7)'],
                        borderColor: ['#6366f1', '#10b981'],
                        borderWidth: 2,
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            ticks: { color: '#cbd5e1' }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 3. Gráfico de Evolución Patrimonial a 6 Meses
        const lienzoPatrimonio = document.getElementById('grafico-patrimonio');
        if (lienzoPatrimonio) {
            if (this.instanciasGraficos.patrimonio) {
                this.instanciasGraficos.patrimonio.destroy();
            }

            const etiquetasMeses = proyeccion.map(p => `Mes ${p.mes}`);
            const datosAhorro = proyeccion.map(p => p.ahorroAcumulado);
            const datosInversion = proyeccion.map(p => p.inversionAcumulada);
            const datosPatrimonio = proyeccion.map(p => p.patrimonioTotal);

            this.instanciasGraficos.patrimonio = new Chart(lienzoPatrimonio, {
                type: 'line',
                data: {
                    labels: etiquetasMeses,
                    datasets: [
                        {
                            label: 'Patrimonio Total (€)',
                            data: datosPatrimonio,
                            borderColor: '#38bdf8',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 3
                        },
                        {
                            label: 'Ahorro Acumulado (€)',
                            data: datosAhorro,
                            borderColor: '#10b981',
                            borderDash: [5, 5],
                            tension: 0.35,
                            borderWidth: 2
                        },
                        {
                            label: 'Inversión Acumulada (€)',
                            data: datosInversion,
                            borderColor: '#8b5cf6',
                            borderDash: [3, 3],
                            tension: 0.35,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            ticks: { color: '#cbd5e1' }
                        }
                    },
                    plugins: {
                        legend: {
                            labels: { color: '#cbd5e1', font: { family: 'Outfit', size: 12 } }
                        }
                    }
                }
            });
        }
    }

    cambiarCanalGasto(idGasto) {
        this.gestor.cambiarCanalPagoGasto(idGasto);
        this.actualizarVistaCompleta();
    }

    eliminarGasto(idGasto) {
        if (confirm('¿Estás seguro de que deseas eliminar esta partida?')) {
            this.gestor.eliminarGasto(idGasto);
            this.actualizarVistaCompleta();
        }
    }
}
