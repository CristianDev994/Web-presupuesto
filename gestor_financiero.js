// Motor de cálculo financiero universal con soporte bicanal y seguimiento de gastos por lugares.
// TODO el dinero se maneja en céntimos enteros (sufijo "Cent") para que los cálculos
// sean exactos al céntimo y los totales cuadren siempre sin arrastres de coma flotante.

import {
    CANALES_PAGO,
    CATEGORIAS_GASTO,
    SUBTIPOS_PATRIMONIO,
    PERFILES_PRESUPUESTO,
    CASO_EJEMPLO_INICIAL
} from './datos_iniciales.js';

import {
    aCentimos,
    aEuros,
    sumarCampo,
    repartirPorPorcentajes,
    dividirEnPartes,
    calcularPorcentaje,
    formatearEuros
} from './utilidades_dinero.js';

const CLAVE_ALMACENAMIENTO = 'presupuesto_personal_universal';
const VERSION_ESTADO = '3.0.0';

export class GestorFinanciero {
    constructor() {
        this.escenarioActual = 'personalizado';
        this.ingresoCuentaCent = 0;
        this.ingresoFisicoCent = 0;
        this.horizonteMeses = 6;
        this.gastos = [];
        this.transacciones = [];
        this.mesVisualizado = 1;
        this.perfilSeleccionado = 'VIVIENDO_PADRES';

        const tieneDatosPrevios = this.cargarDeAlmacenamientoLocal();
        if (!tieneDatosPrevios) {
            this.reiniciarPresupuestoEnBlanco();
        }
    }

    // ----------------------------------------------------------------------
    // ESTADO GENERAL
    // ----------------------------------------------------------------------

    tieneDatosConfigurados() {
        return this.obtenerIngresoTotalCent() > 0 && this.gastos.length > 0;
    }

    obtenerIngresoTotalCent() {
        return this.ingresoCuentaCent + this.ingresoFisicoCent;
    }

    obtenerIngresoParaMes() {
        // El ingreso neto bicanal es el mismo cada mes; lo que cambia mes a mes
        // son las partidas (deudas liquidadas y gastos puntuales no recurrentes).
        return this.obtenerIngresoTotalCent();
    }

    reiniciarPresupuestoEnBlanco() {
        this.ingresoCuentaCent = 0;
        this.ingresoFisicoCent = 0;
        this.gastos = [];
        this.transacciones = [];
        this.mesVisualizado = 1;
        this.escenarioActual = 'personalizado';
        this.guardarEnAlmacenamientoLocal();
    }

    generarIdentificador(prefijo) {
        const aleatorio = Math.random().toString(36).slice(2, 8);
        return `${prefijo}-${Date.now().toString(36)}-${aleatorio}`;
    }

    // ----------------------------------------------------------------------
    // GENERACIÓN AUTOMÁTICA DE PRESUPUESTO POR PERFIL
    // ----------------------------------------------------------------------

    /**
     * Reparte el sueldo neto entre las partidas del perfil elegido con el método
     * del resto mayor: la suma de todas las partidas es EXACTAMENTE el sueldo neto.
     */
    generarPresupuestoBicanal(ingresoBanco, ingresoMano, idPerfil = 'VIVIENDO_PADRES') {
        const cuentaCent = Math.max(0, aCentimos(ingresoBanco));
        const fisicoCent = Math.max(0, aCentimos(ingresoMano));
        const sueldoTotalCent = cuentaCent + fisicoCent;

        if (sueldoTotalCent <= 0) return false;

        this.ingresoCuentaCent = cuentaCent;
        this.ingresoFisicoCent = fisicoCent;
        this.perfilSeleccionado = idPerfil;
        this.escenarioActual = 'personalizado';
        this.gastos = [];

        const configuracionPerfil = PERFILES_PRESUPUESTO[idPerfil] || PERFILES_PRESUPUESTO.VIVIENDO_PADRES;
        const porcentajes = configuracionPerfil.partidas.map(partida => partida.porcentaje);
        const importesCent = repartirPorPorcentajes(sueldoTotalCent, porcentajes);

        configuracionPerfil.partidas.forEach((partida, indice) => {
            this.gastos.push({
                id: this.generarIdentificador(`partida-${indice + 1}`),
                concepto: partida.concepto,
                importeCent: importesCent[indice],
                categoria: partida.categoria,
                subtipo: partida.subtipo || null,
                canal: partida.canal,
                esencial: partida.categoria === 'VIVIENDA_COMIDA' || partida.categoria === 'AHORRO_INVERSION',
                recurrente: partida.recurrente,
                mesFiniquito: null,
                descripcion: `${partida.descripcion} (${partida.porcentaje}% del sueldo)`
            });
        });

        this.guardarEnAlmacenamientoLocal();
        return true;
    }

    cargarCasoEjemplo() {
        this.ingresoCuentaCent = aCentimos(CASO_EJEMPLO_INICIAL.ingresoCuenta);
        this.ingresoFisicoCent = aCentimos(CASO_EJEMPLO_INICIAL.ingresoFisico);
        this.escenarioActual = 'ejemplo_optimizado';
        this.mesVisualizado = 1;
        this.gastos = CASO_EJEMPLO_INICIAL.gastosOptimizados.map(gasto => this.normalizarGasto(gasto));
        this.transacciones = (CASO_EJEMPLO_INICIAL.transaccionesEjemplo || []).map(t => this.normalizarTransaccion(t));
        this.guardarEnAlmacenamientoLocal();
    }

    // ----------------------------------------------------------------------
    // NORMALIZACIÓN Y MIGRACIÓN DE DATOS (compatibilidad con versiones previas)
    // ----------------------------------------------------------------------

    /** Deduce el subtipo de patrimonio de datos antiguos que no lo declaraban. */
    deducirSubtipoPatrimonio(gasto) {
        if (gasto.categoria !== 'AHORRO_INVERSION') return null;
        if (gasto.subtipo === SUBTIPOS_PATRIMONIO.AHORRO || gasto.subtipo === SUBTIPOS_PATRIMONIO.INVERSION) {
            return gasto.subtipo;
        }
        const textoConcepto = `${gasto.concepto || ''} ${gasto.descripcion || ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const esInversion = /invers|indexad|broker|bróker|etf|bolsa|accion|fondo/.test(textoConcepto);
        return esInversion ? SUBTIPOS_PATRIMONIO.INVERSION : SUBTIPOS_PATRIMONIO.AHORRO;
    }

    normalizarGasto(gastoOrigen) {
        const importeCent = gastoOrigen.importeCent !== undefined
            ? Math.round(gastoOrigen.importeCent)
            : aCentimos(gastoOrigen.importe);

        const gasto = {
            id: gastoOrigen.id || this.generarIdentificador('gasto'),
            concepto: String(gastoOrigen.concepto || 'Partida sin nombre'),
            importeCent: Math.max(0, importeCent),
            categoria: CATEGORIAS_GASTO[gastoOrigen.categoria] ? gastoOrigen.categoria : 'OCIO_ESTILO_VIDA',
            canal: gastoOrigen.canal === CANALES_PAGO.FISICO ? CANALES_PAGO.FISICO : CANALES_PAGO.CUENTA,
            esencial: Boolean(gastoOrigen.esencial),
            recurrente: gastoOrigen.recurrente !== undefined ? Boolean(gastoOrigen.recurrente) : true,
            mesFiniquito: gastoOrigen.mesFiniquito ? Math.max(1, parseInt(gastoOrigen.mesFiniquito, 10)) : null,
            descripcion: String(gastoOrigen.descripcion || ''),
            subtipo: null
        };

        gasto.subtipo = this.deducirSubtipoPatrimonio({ ...gastoOrigen, categoria: gasto.categoria });
        return gasto;
    }

    normalizarTransaccion(transaccionOrigen) {
        const importeCent = transaccionOrigen.importeCent !== undefined
            ? Math.round(transaccionOrigen.importeCent)
            : aCentimos(transaccionOrigen.importe);

        const mes = parseInt(transaccionOrigen.mes, 10);

        return {
            id: transaccionOrigen.id || this.generarIdentificador('trans'),
            fecha: transaccionOrigen.fecha || this.obtenerFechaHoy(),
            mes: Number.isFinite(mes) && mes >= 1 ? Math.min(mes, this.horizonteMeses) : 1,
            lugar: String(transaccionOrigen.lugar || 'Comercio / Lugar').trim(),
            importeCent: Math.max(0, importeCent),
            categoria: CATEGORIAS_GASTO[transaccionOrigen.categoria] ? transaccionOrigen.categoria : 'VIVIENDA_COMIDA',
            canal: transaccionOrigen.canal === CANALES_PAGO.CUENTA ? CANALES_PAGO.CUENTA : CANALES_PAGO.FISICO,
            notas: String(transaccionOrigen.notas || '').trim()
        };
    }

    obtenerFechaHoy() {
        const ahora = new Date();
        const desfaseMinutos = ahora.getTimezoneOffset();
        const fechaLocal = new Date(ahora.getTime() - desfaseMinutos * 60000);
        return fechaLocal.toISOString().split('T')[0];
    }

    // ----------------------------------------------------------------------
    // TRANSACCIONES REALES (CONTROL DIARIO POR LUGAR)
    // ----------------------------------------------------------------------

    registrarTransaccion(datosCompra) {
        const nuevaTransaccion = this.normalizarTransaccion({
            ...datosCompra,
            id: this.generarIdentificador('trans'),
            mes: datosCompra.mes || this.mesVisualizado,
            fecha: datosCompra.fecha || this.obtenerFechaHoy()
        });

        this.transacciones.unshift(nuevaTransaccion);
        this.guardarEnAlmacenamientoLocal();
        return nuevaTransaccion;
    }

    eliminarTransaccion(idTransaccion) {
        const indice = this.transacciones.findIndex(t => t.id === idTransaccion);
        if (indice === -1) return null;
        const eliminada = this.transacciones.splice(indice, 1)[0];
        this.guardarEnAlmacenamientoLocal();
        return eliminada;
    }

    obtenerTransaccionesDelMes(numeroMes = this.mesVisualizado) {
        return this.transacciones.filter(t => t.mes === numeroMes);
    }

    /**
     * Estado de los "sobres digitales": presupuesto asignado por categoría frente
     * al gasto real registrado en ese mismo mes.
     */
    obtenerSeguimientoSobres(numeroMes = this.mesVisualizado) {
        const resumen = this.calcularResumenMes(numeroMes);
        const transaccionesDelMes = this.obtenerTransaccionesDelMes(numeroMes);
        const seguimiento = {};

        Object.keys(CATEGORIAS_GASTO).forEach(clave => {
            const limitePresupuestadoCent = resumen.desglosePorCategoriaCent[clave] || 0;
            const gastadoCent = sumarCampo(
                transaccionesDelMes.filter(t => t.categoria === clave),
                'importeCent'
            );
            const disponibleCent = limitePresupuestadoCent - gastadoCent;
            const porcentajeConsumido = limitePresupuestadoCent > 0
                ? calcularPorcentaje(gastadoCent, limitePresupuestadoCent, 1)
                : (gastadoCent > 0 ? 100 : 0);

            let estadoSobre = 'saludable';
            if (disponibleCent < 0) {
                estadoSobre = 'sobregasto';
            } else if (porcentajeConsumido >= 75) {
                estadoSobre = 'alerta';
            }

            // Solo el remanente de las categorias discrecionales es ahorro real
            const liberaAhorro = CATEGORIAS_GASTO[clave].liberaAhorro === true;

            seguimiento[clave] = {
                categoria: clave,
                configuracion: CATEGORIAS_GASTO[clave],
                limitePresupuestadoCent,
                gastadoCent,
                disponibleCent,
                porcentajeConsumido,
                estadoSobre,
                liberaAhorro,
                salvadoParaAhorroCent: liberaAhorro ? Math.max(0, disponibleCent) : 0,
                numeroMovimientos: transaccionesDelMes.filter(t => t.categoria === clave).length
            };
        });

        return seguimiento;
    }

    /** Remanente no gastado en las categorías discrecionales (no cuenta deudas ni reservas). */
    calcularTotalSalvadoParaAhorroCent(numeroMes = this.mesVisualizado) {
        const seguimiento = this.obtenerSeguimientoSobres(numeroMes);
        let totalCent = 0;
        Object.values(seguimiento).forEach(sobre => {
            totalCent += sobre.salvadoParaAhorroCent;
        });
        return totalCent;
    }

    /** Ranking de lugares por gasto acumulado en el mes indicado. */
    obtenerRankingLugares(numeroMes = this.mesVisualizado, limite = 5) {
        const acumuladoPorLugar = new Map();

        this.obtenerTransaccionesDelMes(numeroMes).forEach(t => {
            const clave = t.lugar.toLowerCase();
            const registro = acumuladoPorLugar.get(clave) || { lugar: t.lugar, totalCent: 0, visitas: 0 };
            registro.totalCent += t.importeCent;
            registro.visitas += 1;
            acumuladoPorLugar.set(clave, registro);
        });

        return Array.from(acumuladoPorLugar.values())
            .sort((a, b) => b.totalCent - a.totalCent)
            .slice(0, limite);
    }

    // ----------------------------------------------------------------------
    // PARTIDAS DE PRESUPUESTO
    // ----------------------------------------------------------------------

    agregarGasto(nuevoGasto) {
        const gastoCompleto = this.normalizarGasto({
            ...nuevoGasto,
            id: this.generarIdentificador('gasto')
        });
        this.gastos.push(gastoCompleto);
        this.guardarEnAlmacenamientoLocal();
        return gastoCompleto;
    }

    actualizarGasto(idGasto, datosModificados) {
        const indice = this.gastos.findIndex(gasto => gasto.id === idGasto);
        if (indice === -1) return null;

        const gastoFusionado = { ...this.gastos[indice], ...datosModificados, id: this.gastos[indice].id };

        // Si llega un importe en euros desde el formulario, prevalece sobre el valor anterior
        if (datosModificados.importe !== undefined) {
            gastoFusionado.importeCent = aCentimos(datosModificados.importe);
        }

        this.gastos[indice] = this.normalizarGasto(gastoFusionado);
        this.guardarEnAlmacenamientoLocal();
        return this.gastos[indice];
    }

    eliminarGasto(idGasto) {
        const indice = this.gastos.findIndex(gasto => gasto.id === idGasto);
        if (indice === -1) return null;
        const gastoEliminado = this.gastos.splice(indice, 1)[0];
        this.guardarEnAlmacenamientoLocal();
        return gastoEliminado;
    }

    cambiarCanalPagoGasto(idGasto) {
        const gasto = this.gastos.find(item => item.id === idGasto);
        if (!gasto) return null;
        gasto.canal = (gasto.canal === CANALES_PAGO.CUENTA) ? CANALES_PAGO.FISICO : CANALES_PAGO.CUENTA;
        this.guardarEnAlmacenamientoLocal();
        return gasto;
    }

    obtenerGastosActivosMes(numeroMes) {
        return this.gastos.filter(gasto => {
            if (gasto.mesFiniquito && numeroMes > gasto.mesFiniquito) return false;
            if (!gasto.recurrente && !gasto.mesFiniquito && numeroMes > 1) return false;
            return true;
        });
    }

    // ----------------------------------------------------------------------
    // RESUMEN MENSUAL
    // ----------------------------------------------------------------------

    calcularResumenMes(numeroMes = 1) {
        const ingresoCent = this.obtenerIngresoParaMes(numeroMes);
        const gastosActivos = this.obtenerGastosActivosMes(numeroMes);

        let consumoCent = 0;
        let cuentaCent = 0;
        let fisicoCent = 0;
        let deudasCent = 0;
        let suscripcionesCent = 0;
        let viviendaComidaCent = 0;
        let ocioCent = 0;
        let ahorroCent = 0;
        let inversionCent = 0;

        const desglosePorCategoriaCent = {};
        Object.keys(CATEGORIAS_GASTO).forEach(clave => {
            desglosePorCategoriaCent[clave] = 0;
        });

        gastosActivos.forEach(gasto => {
            const importeCent = gasto.importeCent;

            if (gasto.categoria === 'AHORRO_INVERSION') {
                if (gasto.subtipo === SUBTIPOS_PATRIMONIO.INVERSION) {
                    inversionCent += importeCent;
                } else {
                    ahorroCent += importeCent;
                }
            } else {
                consumoCent += importeCent;
            }

            if (gasto.canal === CANALES_PAGO.CUENTA) {
                cuentaCent += importeCent;
            } else {
                fisicoCent += importeCent;
            }

            if (gasto.categoria === 'DEUDAS_OBLIGACIONES') deudasCent += importeCent;
            if (gasto.categoria === 'DIGITAL_SUSCRIPCIONES') suscripcionesCent += importeCent;
            if (gasto.categoria === 'VIVIENDA_COMIDA') viviendaComidaCent += importeCent;
            if (gasto.categoria === 'OCIO_ESTILO_VIDA') ocioCent += importeCent;

            desglosePorCategoriaCent[gasto.categoria] += importeCent;
        });

        const patrimonioAsignadoCent = ahorroCent + inversionCent;
        const totalPresupuestadoCent = consumoCent + patrimonioAsignadoCent;
        const balanceNetoCent = ingresoCent - totalPresupuestadoCent;
        const sobranteConsumoCent = ingresoCent - consumoCent;

        // Cuadre por canal: cuánto queda libre en el banco y cuánto efectivo sobra o falta
        const saldoLibreCuentaCent = this.ingresoCuentaCent - cuentaCent;
        const saldoLibreFisicoCent = this.ingresoFisicoCent - fisicoCent;
        const retiradaCajeroCent = Math.max(0, fisicoCent - this.ingresoFisicoCent);

        const analisisEfectivo = this.analizarFlujoEfectivo(fisicoCent);

        let estadoSalud = 'optimo';
        let mensajeEstado = 'Finanzas equilibradas con capacidad de ahorro e inversión.';

        if (ingresoCent === 0) {
            estadoSalud = 'vacio';
            mensajeEstado = 'Introduce tu dinero neto (cuenta y efectivo) para comenzar.';
        } else if (balanceNetoCent < 0) {
            estadoSalud = 'deficit';
            mensajeEstado = `Déficit de ${formatearEuros(-balanceNetoCent)}. Gastas más de lo que ingresas.`;
        } else if (balanceNetoCent > 0 && patrimonioAsignadoCent === 0) {
            estadoSalud = 'sin_asignar';
            mensajeEstado = `Tienes un excedente de ${formatearEuros(balanceNetoCent)} sin asignar a ahorro o inversión.`;
        } else if (balanceNetoCent > 0) {
            estadoSalud = 'excedente';
            mensajeEstado = `Te quedan ${formatearEuros(balanceNetoCent)} libres sin asignar.`;
        }

        return {
            numeroMes,
            ingresoCent,
            ingresoCuentaCent: this.ingresoCuentaCent,
            ingresoFisicoCent: this.ingresoFisicoCent,
            porcentajeIngresoCuenta: calcularPorcentaje(this.ingresoCuentaCent, ingresoCent, 0),
            porcentajeIngresoFisico: calcularPorcentaje(this.ingresoFisicoCent, ingresoCent, 0),
            consumoCent,
            cuentaCent,
            fisicoCent,
            deudasCent,
            suscripcionesCent,
            viviendaComidaCent,
            ocioCent,
            ahorroCent,
            inversionCent,
            patrimonioAsignadoCent,
            totalPresupuestadoCent,
            balanceNetoCent,
            sobranteConsumoCent,
            saldoLibreCuentaCent,
            saldoLibreFisicoCent,
            retiradaCajeroCent,
            porcentajeAsignado: calcularPorcentaje(totalPresupuestadoCent, ingresoCent, 1),
            porcentajeAhorroReal: calcularPorcentaje(patrimonioAsignadoCent + Math.max(0, balanceNetoCent), ingresoCent, 1),
            numeroPartidas: gastosActivos.length,
            estadoSalud,
            mensajeEstado,
            desglosePorCategoriaCent,
            analisisEfectivo
        };
    }

    analizarFlujoEfectivo(gastosEnFisicoCent) {
        const efectivoDisponibleCent = this.ingresoFisicoCent;

        let situacion = 'equilibrado';
        let liberadoParaInvertirCent = 0;
        let sobranteEnManoCent = 0;
        let aRetirarDelCajeroCent = 0;
        let recomendacion = '';

        if (efectivoDisponibleCent === 0) {
            situacion = 'retirada_cajero';
            aRetirarDelCajeroCent = gastosEnFisicoCent;
            recomendacion = gastosEnFisicoCent > 0
                ? `Retira ${formatearEuros(gastosEnFisicoCent)} del cajero a principio de mes para llevarlos en billetes y no romper el presupuesto con la tarjeta.`
                : 'Todavía no tienes gastos asignados a efectivo. Marca en efectivo la compra o el ocio para empezar a controlar el dinero en mano.';
        } else if (efectivoDisponibleCent <= gastosEnFisicoCent) {
            situacion = 'absorcion_completa';
            liberadoParaInvertirCent = efectivoDisponibleCent;
            aRetirarDelCajeroCent = gastosEnFisicoCent - efectivoDisponibleCent;
            recomendacion = `Absorción perfecta: tus ${formatearEuros(efectivoDisponibleCent)} en mano cubren tu consumo diario (supermercado, ocio, gasolina). Solo necesitas sacar ${formatearEuros(aRetirarDelCajeroCent)} del cajero y dejas ${formatearEuros(liberadoParaInvertirCent)} limpios en el banco para ahorro o inversión.`;
        } else {
            situacion = 'excedente_efectivo';
            liberadoParaInvertirCent = gastosEnFisicoCent;
            sobranteEnManoCent = efectivoDisponibleCent - gastosEnFisicoCent;
            recomendacion = `Te sobran ${formatearEuros(sobranteEnManoCent)} en efectivo por encima de tus gastos corrientes. No lo ingreses de golpe en el cajero: adelanta compras cotidianas, compra tarjetas regalo de supermercado o resérvalo para los meses siguientes y evita perder poder adquisitivo por inflación.`;
        }

        return {
            efectivoDisponibleCent,
            gastosEnFisicoCent,
            situacion,
            liberadoParaInvertirCent,
            sobranteEnManoCent,
            aRetirarDelCajeroCent,
            recomendacion
        };
    }

    // ----------------------------------------------------------------------
    // PROYECCIÓN A VARIOS MESES
    // ----------------------------------------------------------------------

    calcularProyeccion(horizonte = this.horizonteMeses) {
        const proyeccion = [];
        let ahorroAcumuladoCent = 0;
        let inversionAcumuladaCent = 0;

        for (let mes = 1; mes <= horizonte; mes++) {
            const resumen = this.calcularResumenMes(mes);

            let ahorroMesCent = resumen.ahorroCent;
            let inversionMesCent = resumen.inversionCent;

            // El excedente libre se reparte al 50% entre ahorro e inversión
            // sin perder ni duplicar céntimos (importante con importes impares).
            if (resumen.balanceNetoCent > 0) {
                const [mitadAhorro, mitadInversion] = dividirEnPartes(resumen.balanceNetoCent, 2);
                ahorroMesCent += mitadAhorro;
                inversionMesCent += mitadInversion;
            }

            ahorroAcumuladoCent += ahorroMesCent;
            inversionAcumuladaCent += inversionMesCent;

            proyeccion.push({
                mes,
                ingresoCent: resumen.ingresoCent,
                gastosFijosCent: resumen.consumoCent - resumen.deudasCent,
                deudasCent: resumen.deudasCent,
                consumoCent: resumen.consumoCent,
                sobranteCent: resumen.sobranteConsumoCent,
                balanceNetoCent: resumen.balanceNetoCent,
                ahorroMesCent,
                inversionMesCent,
                ahorroAcumuladoCent,
                inversionAcumuladaCent,
                patrimonioTotalCent: ahorroAcumuladoCent + inversionAcumuladaCent,
                cuentaCent: resumen.cuentaCent,
                fisicoCent: resumen.fisicoCent
            });
        }

        return proyeccion;
    }

    /** Totales agregados del horizonte completo, calculados sobre las mismas filas. */
    calcularTotalesProyeccion(proyeccion = this.calcularProyeccion()) {
        if (proyeccion.length === 0) {
            return {
                ingresosCent: 0, consumoCent: 0, deudasCent: 0, sobranteCent: 0,
                ahorroCent: 0, inversionCent: 0, patrimonioCent: 0, meses: 0
            };
        }

        const ultimaFila = proyeccion[proyeccion.length - 1];
        return {
            meses: proyeccion.length,
            ingresosCent: proyeccion.reduce((total, fila) => total + fila.ingresoCent, 0),
            consumoCent: proyeccion.reduce((total, fila) => total + fila.consumoCent, 0),
            deudasCent: proyeccion.reduce((total, fila) => total + fila.deudasCent, 0),
            sobranteCent: proyeccion.reduce((total, fila) => total + fila.sobranteCent, 0),
            ahorroCent: ultimaFila.ahorroAcumuladoCent,
            inversionCent: ultimaFila.inversionAcumuladaCent,
            patrimonioCent: ultimaFila.patrimonioTotalCent
        };
    }

    // ----------------------------------------------------------------------
    // PERSISTENCIA LOCAL Y COPIAS DE SEGURIDAD
    // ----------------------------------------------------------------------

    construirEstadoSerializable() {
        return {
            version: VERSION_ESTADO,
            ultimaActualizacion: new Date().toISOString(),
            escenarioActual: this.escenarioActual,
            ingresoCuentaCent: this.ingresoCuentaCent,
            ingresoFisicoCent: this.ingresoFisicoCent,
            // Copia legible en euros para quien abra el JSON a mano
            ingresoCuenta: aEuros(this.ingresoCuentaCent),
            ingresoFisico: aEuros(this.ingresoFisicoCent),
            perfilSeleccionado: this.perfilSeleccionado,
            mesVisualizado: this.mesVisualizado,
            horizonteMeses: this.horizonteMeses,
            gastos: this.gastos.map(gasto => ({ ...gasto, importe: aEuros(gasto.importeCent) })),
            transacciones: this.transacciones.map(t => ({ ...t, importe: aEuros(t.importeCent) }))
        };
    }

    aplicarEstado(objeto) {
        if (!objeto || typeof objeto !== 'object') return false;

        this.ingresoCuentaCent = Math.max(0, objeto.ingresoCuentaCent !== undefined
            ? Math.round(objeto.ingresoCuentaCent)
            : aCentimos(objeto.ingresoCuenta));

        this.ingresoFisicoCent = Math.max(0, objeto.ingresoFisicoCent !== undefined
            ? Math.round(objeto.ingresoFisicoCent)
            : aCentimos(objeto.ingresoFisico));

        this.perfilSeleccionado = PERFILES_PRESUPUESTO[objeto.perfilSeleccionado]
            ? objeto.perfilSeleccionado
            : 'VIVIENDO_PADRES';

        this.horizonteMeses = Math.min(24, Math.max(1, parseInt(objeto.horizonteMeses, 10) || 6));
        const mes = parseInt(objeto.mesVisualizado, 10);
        this.mesVisualizado = Number.isFinite(mes) ? Math.min(Math.max(1, mes), this.horizonteMeses) : 1;
        this.escenarioActual = objeto.escenarioActual || 'personalizado';

        this.gastos = Array.isArray(objeto.gastos)
            ? objeto.gastos.map(gasto => this.normalizarGasto(gasto))
            : [];

        this.transacciones = Array.isArray(objeto.transacciones)
            ? objeto.transacciones.map(t => this.normalizarTransaccion(t))
            : [];

        return true;
    }

    guardarEnAlmacenamientoLocal() {
        try {
            localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(this.construirEstadoSerializable()));
            return true;
        } catch (error) {
            console.warn('Almacenamiento local no disponible:', error);
            return false;
        }
    }

    cargarDeAlmacenamientoLocal() {
        try {
            const datosGuardados = localStorage.getItem(CLAVE_ALMACENAMIENTO);
            if (!datosGuardados) return false;
            return this.aplicarEstado(JSON.parse(datosGuardados));
        } catch (error) {
            console.warn('Error al leer el almacenamiento local:', error);
            return false;
        }
    }

    exportarCopiaSeguridadJSON() {
        return JSON.stringify({
            aplicacion: 'Presupuesto Personal Inteligente Bicanal',
            fechaExportacion: new Date().toISOString(),
            ...this.construirEstadoSerializable()
        }, null, 2);
    }

    importarCopiaSeguridadJSON(contenidoTextoJSON) {
        try {
            const objeto = JSON.parse(contenidoTextoJSON);
            if (!objeto || typeof objeto !== 'object') {
                throw new Error('El archivo no contiene un objeto JSON válido.');
            }

            this.aplicarEstado(objeto);
            this.guardarEnAlmacenamientoLocal();

            return {
                exito: true,
                mensaje: `Copia restaurada: ${this.gastos.length} partidas y ${this.transacciones.length} gastos registrados.`
            };
        } catch (error) {
            return { exito: false, mensaje: `No se pudo leer el archivo de copia: ${error.message}` };
        }
    }
}
