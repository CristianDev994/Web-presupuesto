// Motor de cálculo financiero universal con soporte bicanal y seguimiento de gastos por lugares.
// TODO el dinero se maneja en céntimos enteros (sufijo "Cent") para que los cálculos
// sean exactos al céntimo y los totales cuadren siempre sin arrastres de coma flotante.

import {
    CANALES_PAGO,
    CATEGORIAS_GASTO,
    SUBTIPOS_PATRIMONIO,
    PERFILES_PRESUPUESTO,
    REFERENCIA_CARGA_DEUDA,
    UNIDADES_PLAZO_DEUDA,
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
const CLAVE_RESPALDO_IMPORTACION = `${CLAVE_ALMACENAMIENTO}_respaldo_importacion`;
const VERSION_ESTADO = '4.0.0';
const MAX_MESES_PLAN_DEUDA = 1200;
const TIPOS_DEUDA = new Set(['PRESTAMO', 'TARJETA', 'HIPOTECA', 'COMPRA_APLAZADA', 'OTRA']);

const tienePropiedad = (objeto, propiedad) => Object.prototype.hasOwnProperty.call(objeto, propiedad);

function esObjetoPlano(valor) {
    return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor);
}

function enteroSeguroNoNegativo(valor, valorPorDefecto = 0) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return valorPorDefecto;
    const entero = Math.round(numero);
    return Number.isSafeInteger(entero) ? Math.max(0, entero) : valorPorDefecto;
}

function normalizarPorcentajeAPuntosBasicos(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    const numero = Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(numero) || numero < 0) return 0;
    return Math.min(100000, Math.round(numero * 100));
}

function esFechaISOValida(valor) {
    if (valor === null || valor === undefined || valor === '') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return false;
    const [anio, mes, dia] = String(valor).split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return fecha.getUTCFullYear() === anio
        && fecha.getUTCMonth() === mes - 1
        && fecha.getUTCDate() === dia;
}

export class GestorFinanciero {
    constructor() {
        this.escenarioActual = 'personalizado';
        this.ingresoCuentaCent = 0;
        this.ingresoFisicoCent = 0;
        this.horizonteMeses = 6;
        this.gastos = [];
        this.deudas = [];
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
        return this.obtenerIngresoTotalCent() > 0 && (this.gastos.length > 0 || this.deudas.length > 0);
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
        this.deudas = [];
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
        this.deudas = (CASO_EJEMPLO_INICIAL.deudasEjemplo || []).map(deuda => this.normalizarDeuda(deuda));
        this.gastos = CASO_EJEMPLO_INICIAL.gastosOptimizados.map(gasto => {
            const gastoNormal = this.normalizarGasto(gasto);
            if (gasto.id === 'ejemplo-7') gastoNormal.idDeuda = 'deuda-ejemplo-1';
            if (gasto.id === 'ejemplo-8') gastoNormal.idDeuda = 'deuda-ejemplo-2';
            return gastoNormal;
        });
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
            subtipo: null,
            idDeuda: gastoOrigen.idDeuda || null
        };

        gasto.subtipo = this.deducirSubtipoPatrimonio({ ...gastoOrigen, categoria: gasto.categoria });
        return gasto;
    }

    normalizarDeuda(deudaOrigen) {
        const importeTotalCent = deudaOrigen.importeTotalCent !== undefined
            ? Math.round(deudaOrigen.importeTotalCent)
            : aCentimos(deudaOrigen.importeTotal || 0);

        // La deuda puede definirse por cuota mensual o por duración (días,
        // meses o años). Si se define por duración, la cuota se deriva del plazo.
        const modoDefinicion = deudaOrigen.modoDefinicion === 'PLAZO' ? 'PLAZO' : 'CUOTA';

        let plazo = null;
        if (deudaOrigen.plazo && deudaOrigen.plazo.valor) {
            const unidad = UNIDADES_PLAZO_DEUDA[deudaOrigen.plazo.unidad] ? deudaOrigen.plazo.unidad : 'MESES';
            const valor = aEuros(aCentimos(deudaOrigen.plazo.valor));
            if (valor > 0) plazo = { valor, unidad };
        }

        let cuotaMensualCent;
        if (modoDefinicion === 'PLAZO' && plazo) {
            cuotaMensualCent = this.calcularCuotaDesdePlazoCent(
                importeTotalCent,
                this.convertirPlazoAMeses(plazo.valor, plazo.unidad)
            );
        } else {
            cuotaMensualCent = deudaOrigen.cuotaMensualCent !== undefined
                ? Math.round(deudaOrigen.cuotaMensualCent)
                : aCentimos(deudaOrigen.cuotaMensual || 0);
        }

        const totalAmortizadoCent = deudaOrigen.totalAmortizadoCent !== undefined
            ? Math.round(deudaOrigen.totalAmortizadoCent)
            : (deudaOrigen.totalAmortizado !== undefined ? aCentimos(deudaOrigen.totalAmortizado) : 0);

        const canal = deudaOrigen.canal === CANALES_PAGO.FISICO ? CANALES_PAGO.FISICO : CANALES_PAGO.CUENTA;
        const concepto = String(deudaOrigen.concepto || 'Deuda sin nombre').trim();
        const notas = String(deudaOrigen.notas || '').trim();
        const pagada = Boolean(deudaOrigen.pagada || importeTotalCent <= 0);

        return {
            id: deudaOrigen.id || this.generarIdentificador('deuda'),
            concepto,
            importeTotalCent: Math.max(0, importeTotalCent),
            cuotaMensualCent: Math.max(0, cuotaMensualCent),
            totalAmortizadoCent: Math.max(0, totalAmortizadoCent),
            canal,
            notas,
            pagada,
            modoDefinicion,
            plazo,
            fechaCreacion: deudaOrigen.fechaCreacion || this.obtenerFechaHoy()
        };
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
    // GESTIÓN DE DEUDAS Y OBLIGACIONES
    // ----------------------------------------------------------------------

    agregarDeuda(datosDeuda) {
        const nuevaDeuda = this.normalizarDeuda({
            ...datosDeuda,
            id: this.generarIdentificador('deuda')
        });
        this.deudas.push(nuevaDeuda);
        this.sincronizarPartidasConDeudas();
        this.guardarEnAlmacenamientoLocal();
        return nuevaDeuda;
    }

    actualizarDeuda(idDeuda, datosModificados) {
        const indice = this.deudas.findIndex(d => d.id === idDeuda);
        if (indice === -1) return null;

        const deudaFusionada = { ...this.deudas[indice], ...datosModificados, id: this.deudas[indice].id };
        if (datosModificados.importeTotal !== undefined) {
            deudaFusionada.importeTotalCent = aCentimos(datosModificados.importeTotal);
        }
        if (datosModificados.cuotaMensual !== undefined) {
            deudaFusionada.cuotaMensualCent = aCentimos(datosModificados.cuotaMensual);
        }
        if (datosModificados.totalAmortizado !== undefined) {
            deudaFusionada.totalAmortizadoCent = aCentimos(datosModificados.totalAmortizado);
        }

        this.deudas[indice] = this.normalizarDeuda(deudaFusionada);
        this.sincronizarPartidasConDeudas();
        this.guardarEnAlmacenamientoLocal();
        return this.deudas[indice];
    }

    eliminarDeuda(idDeuda) {
        const indice = this.deudas.findIndex(d => d.id === idDeuda);
        if (indice === -1) return null;
        const deudaEliminada = this.deudas.splice(indice, 1)[0];
        this.sincronizarPartidasConDeudas();
        this.guardarEnAlmacenamientoLocal();
        return deudaEliminada;
    }

    /**
     * Amortiza capital de una deuda. El abono se expresa SIEMPRE en céntimos
     * enteros: adivinar la unidad a partir de la magnitud hacía que amortizar
     * 5 € descontase 500 € de la deuda.
     */
    amortizarDeuda(idDeuda, abonoCentimos) {
        const deuda = this.deudas.find(d => d.id === idDeuda);
        if (!deuda) return null;

        const abonoCent = Math.max(0, Math.round(Number(abonoCentimos) || 0));

        const abonoRealCent = Math.min(deuda.importeTotalCent, abonoCent);
        deuda.importeTotalCent -= abonoRealCent;
        deuda.totalAmortizadoCent = (deuda.totalAmortizadoCent || 0) + abonoRealCent;

        // Amortizar acorta el plazo manteniendo la cuota. Se fija el modo a
        // CUOTA para que una edición posterior no recalcule la cuota desde el
        // plazo original y deshaga sin avisar la reducción del plazo.
        if (deuda.modoDefinicion === 'PLAZO') {
            deuda.modoDefinicion = 'CUOTA';
        }

        if (deuda.importeTotalCent <= 0) {
            deuda.importeTotalCent = 0;
            deuda.pagada = true;
        }

        this.sincronizarPartidasConDeudas();
        this.guardarEnAlmacenamientoLocal();
        return deuda;
    }

    obtenerDeudaPorId(idDeuda) {
        return this.deudas.find(d => d.id === idDeuda) || null;
    }

    obtenerDeudasActivas() {
        return this.deudas.filter(d => !d.pagada && d.importeTotalCent > 0);
    }

    calcularTotalDeudaPendienteCent() {
        return this.obtenerDeudasActivas()
            .reduce((total, d) => total + d.importeTotalCent, 0);
    }

    calcularCuotaMensualTotalDeudasCent() {
        return this.obtenerDeudasActivas()
            .reduce((total, d) => total + Math.min(d.importeTotalCent, d.cuotaMensualCent), 0);
    }

    calcularMesesRestantesDeuda(deuda) {
        if (!deuda || deuda.pagada || deuda.importeTotalCent <= 0 || deuda.cuotaMensualCent <= 0) return 0;
        return Math.ceil(deuda.importeTotalCent / deuda.cuotaMensualCent);
    }

    calcularMesesParaLibertadDeDeudas() {
        const deudasActivas = this.obtenerDeudasActivas();
        if (deudasActivas.length === 0) return 0;
        return Math.max(...deudasActivas.map(d => this.calcularMesesRestantesDeuda(d)));
    }

    // ----------------------------------------------------------------------
    // DURACIÓN DE LAS DEUDAS (DÍAS, MESES O AÑOS)
    // ----------------------------------------------------------------------

    /**
     * Convierte una duración expresada en días, meses o años a meses completos.
     * El presupuesto es mensual, así que los días se redondean al alza: una
     * deuda de 40 días sigue ocupando dos cuotas mensuales.
     */
    convertirPlazoAMeses(valor, unidad = 'MESES') {
        // aCentimos admite la coma decimal española ("1,5" años)
        const valorNumerico = aEuros(aCentimos(valor));
        if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return 0;

        const configuracion = UNIDADES_PLAZO_DEUDA[unidad] || UNIDADES_PLAZO_DEUDA.MESES;

        let meses;
        if (configuracion.id === 'DIAS') {
            meses = Math.ceil(valorNumerico / configuracion.diasPorMes);
        } else if (configuracion.id === 'ANIOS') {
            meses = Math.round(valorNumerico * configuracion.mesesPorUnidad);
        } else {
            meses = Math.round(valorNumerico);
        }

        return Math.min(MAX_MESES_PLAN_DEUDA, Math.max(1, meses));
    }

    /**
     * Cuota mensual necesaria para liquidar un importe en el número de meses
     * indicado. Se redondea al alza para que la última cuota sea la que absorbe
     * el resto y nunca quede saldo pendiente tras el último pago.
     */
    calcularCuotaDesdePlazoCent(importeTotalCent, meses) {
        const total = Math.max(0, Math.round(importeTotalCent));
        const numeroMeses = Math.max(1, Math.round(meses));
        if (total <= 0) return 0;
        return Math.ceil(total / numeroMeses);
    }

    /**
     * Planifica una deuda a partir de una duración y devuelve la cuota junto con
     * los meses que realmente durará. Con importes muy pequeños repartidos en
     * muchos meses no existe una cuota constante que cubra el plazo exacto, así
     * que se informa de la duración real en lugar de dar por buena la pedida.
     */
    planificarDeudaPorPlazo(importeTotalCent, valor, unidad = 'MESES') {
        const mesesSolicitados = this.convertirPlazoAMeses(valor, unidad);
        const cuotaMensualCent = this.calcularCuotaDesdePlazoCent(importeTotalCent, mesesSolicitados);
        const mesesReales = cuotaMensualCent > 0
            ? Math.ceil(Math.max(0, Math.round(importeTotalCent)) / cuotaMensualCent)
            : 0;

        return {
            mesesSolicitados,
            mesesReales,
            cuotaMensualCent,
            coincide: mesesReales === mesesSolicitados,
            // Lo que se paga en la última cuota, que absorbe el resto
            ultimaCuotaCent: mesesReales > 0
                ? Math.max(0, Math.round(importeTotalCent) - cuotaMensualCent * (mesesReales - 1))
                : 0
        };
    }

    /** Describe un número de meses en lenguaje natural: "1 año y 8 meses". */
    describirPlazoEnMeses(meses) {
        const total = Math.max(0, Math.round(meses));
        if (total === 0) return 'Sin plazo';
        if (total < 12) return `${total} ${total === 1 ? 'mes' : 'meses'}`;

        const anios = Math.floor(total / 12);
        const resto = total % 12;
        const textoAnios = `${anios} ${anios === 1 ? 'año' : 'años'}`;
        if (resto === 0) return textoAnios;
        return `${textoAnios} y ${resto} ${resto === 1 ? 'mes' : 'meses'}`;
    }

    /**
     * Qué parte del sueldo se va en pagar deudas ese mes.
     * Se calcula sobre las cuotas realmente activas en el mes indicado, de modo
     * que la carga baja sola a medida que las deudas se liquidan.
     */
    calcularCargaDeuda(numeroMes = this.mesVisualizado) {
        const cuotaDeudaCent = this.obtenerGastosActivosMes(numeroMes)
            .filter(gasto => gasto.categoria === 'DEUDAS_OBLIGACIONES')
            .reduce((total, gasto) => total + gasto.importeCent, 0);

        return this.construirCargaDeuda(numeroMes, this.obtenerIngresoParaMes(numeroMes), cuotaDeudaCent);
    }

    /**
     * Construye el detalle de la carga a partir de importes ya calculados, para
     * que el resumen mensual no tenga que recorrer las partidas por segunda vez.
     */
    construirCargaDeuda(numeroMes, ingresoCent, cuotaDeudaCent) {
        const porcentaje = calcularPorcentaje(cuotaDeudaCent, ingresoCent, 1);
        const ingresoLibreCent = ingresoCent - cuotaDeudaCent;

        // Cuántos euros de cada 100 € ingresados se destinan a cuotas
        const euroPorCada100Cent = ingresoCent > 0
            ? Math.round((cuotaDeudaCent * 10000) / ingresoCent)
            : 0;

        const tramo = cuotaDeudaCent <= 0
            ? REFERENCIA_CARGA_DEUDA.tramos[0]
            : REFERENCIA_CARGA_DEUDA.tramos.find(t => t.hasta > 0 && porcentaje <= t.hasta)
                || REFERENCIA_CARGA_DEUDA.tramos[REFERENCIA_CARGA_DEUDA.tramos.length - 1];

        // Importe máximo de cuota que encaja dentro de la referencia recomendada
        const cuotaMaximaRecomendadaCent = Math.round(
            (ingresoCent * REFERENCIA_CARGA_DEUDA.limiteRecomendado) / 100
        );
        const excesoSobreReferenciaCent = Math.max(0, cuotaDeudaCent - cuotaMaximaRecomendadaCent);
        const margenHastaReferenciaCent = Math.max(0, cuotaMaximaRecomendadaCent - cuotaDeudaCent);

        return {
            numeroMes,
            ingresoCent,
            cuotaDeudaCent,
            ingresoLibreCent,
            porcentaje,
            euroPorCada100Cent,
            nivel: tramo.nivel,
            etiqueta: tramo.etiqueta,
            simbolo: tramo.simbolo,
            resumen: tramo.resumen,
            consejo: tramo.consejo,
            limiteRecomendado: REFERENCIA_CARGA_DEUDA.limiteRecomendado,
            cuotaMaximaRecomendadaCent,
            excesoSobreReferenciaCent,
            margenHastaReferenciaCent,
            superaReferencia: cuotaDeudaCent > cuotaMaximaRecomendadaCent
        };
    }

    /**
     * Primer mes del horizonte en el que la carga de deuda baja del límite de
     * referencia. Devuelve null si nunca ocurre dentro del horizonte.
     */
    calcularMesAlivioCargaDeuda(mesInicio = this.mesVisualizado, horizonte = this.horizonteMeses) {
        const primerMes = Math.max(1, parseInt(mesInicio, 10) || 1);
        if (!this.calcularCargaDeuda(primerMes).superaReferencia) return null;

        for (let mes = primerMes + 1; mes <= horizonte; mes++) {
            if (!this.calcularCargaDeuda(mes).superaReferencia) return mes;
        }
        return null;
    }

    sincronizarPartidasConDeudas() {
        const idsDeudasExistentes = new Set(this.deudas.map(d => d.id));
        this.gastos = this.gastos.filter(g => !g.idDeuda || idsDeudasExistentes.has(g.idDeuda));

        this.deudas.forEach(deuda => {
            const indiceGasto = this.gastos.findIndex(g => g.idDeuda === deuda.id);
            const mesesRestantes = this.calcularMesesRestantesDeuda(deuda);

            if (deuda.pagada || deuda.importeTotalCent <= 0) {
                if (indiceGasto !== -1) {
                    this.gastos.splice(indiceGasto, 1);
                }
                return;
            }

            const cuotaCent = Math.min(deuda.importeTotalCent, deuda.cuotaMensualCent);
            const conceptoGasto = deuda.concepto;
            const descripcionGasto = deuda.notas
                ? `${deuda.notas} (Quedan ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'})`
                : `Cuota de ${deuda.concepto} (Quedan ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'})`;

            if (indiceGasto !== -1) {
                this.gastos[indiceGasto].concepto = conceptoGasto;
                this.gastos[indiceGasto].importeCent = cuotaCent;
                this.gastos[indiceGasto].canal = deuda.canal;
                this.gastos[indiceGasto].mesFiniquito = mesesRestantes;
                this.gastos[indiceGasto].descripcion = descripcionGasto;
                this.gastos[indiceGasto].recurrente = false;
            } else {
                this.gastos.push({
                    id: this.generarIdentificador('gasto-deuda'),
                    idDeuda: deuda.id,
                    concepto: conceptoGasto,
                    importeCent: cuotaCent,
                    categoria: 'DEUDAS_OBLIGACIONES',
                    canal: deuda.canal,
                    esencial: true,
                    recurrente: false,
                    mesFiniquito: mesesRestantes,
                    descripcion: descripcionGasto,
                    subtipo: null
                });
            }
        });
    }

    establecerHorizonteMeses(meses) {
        const horizonteNumerico = parseInt(meses, 10);
        if (!Number.isFinite(horizonteNumerico)) return this.horizonteMeses;
        this.horizonteMeses = Math.min(60, Math.max(1, horizonteNumerico));
        if (this.mesVisualizado > this.horizonteMeses) {
            this.mesVisualizado = this.horizonteMeses;
        }
        this.guardarEnAlmacenamientoLocal();
        return this.horizonteMeses;
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
            porcentajeDeudaSobreIngreso: calcularPorcentaje(deudasCent, ingresoCent, 1),
            cargaDeuda: this.construirCargaDeuda(numeroMes, ingresoCent, deudasCent),
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
            deudas: this.deudas.map(deuda => ({
                ...deuda,
                importeTotal: aEuros(deuda.importeTotalCent),
                cuotaMensual: aEuros(deuda.cuotaMensualCent),
                totalAmortizado: aEuros(deuda.totalAmortizadoCent || 0)
            })),
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

        this.horizonteMeses = Math.min(60, Math.max(1, parseInt(objeto.horizonteMeses, 10) || 6));
        const mes = parseInt(objeto.mesVisualizado, 10);
        this.mesVisualizado = Number.isFinite(mes) ? Math.min(Math.max(1, mes), this.horizonteMeses) : 1;
        this.escenarioActual = objeto.escenarioActual || 'personalizado';

        this.deudas = Array.isArray(objeto.deudas)
            ? objeto.deudas.map(deuda => this.normalizarDeuda(deuda))
            : [];

        this.gastos = Array.isArray(objeto.gastos)
            ? objeto.gastos.map(gasto => this.normalizarGasto(gasto))
            : [];

        // Si se restauran datos antiguos sin deudas estructuradas, detectamos si hay
        // partidas de DEUDAS_OBLIGACIONES para crear las deudas y enlazarlas
        if (this.deudas.length === 0 && this.gastos.length > 0) {
            const partidasDeuda = this.gastos.filter(g => g.categoria === 'DEUDAS_OBLIGACIONES' && !g.idDeuda);
            partidasDeuda.forEach(partida => {
                const meses = partida.mesFiniquito ? Math.max(1, partida.mesFiniquito) : 1;
                const cuotaCent = partida.importeCent;
                const nuevaDeuda = this.normalizarDeuda({
                    id: this.generarIdentificador('deuda'),
                    concepto: partida.concepto,
                    importeTotalCent: cuotaCent * meses,
                    cuotaMensualCent: cuotaCent,
                    canal: partida.canal,
                    notas: partida.descripcion || 'Deuda recuperada',
                    pagada: false
                });
                partida.idDeuda = nuevaDeuda.id;
                this.deudas.push(nuevaDeuda);
            });
        }

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
