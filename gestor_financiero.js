// Motor de cálculo financiero universal con soporte bicanal y seguimiento de gastos por lugares

import { 
    CANALES_PAGO, 
    CATEGORIAS_GASTO, 
    PERFILES_PRESUPUESTO, 
    CASO_EJEMPLO_INICIAL 
} from './datos_iniciales.js';

export class GestorFinanciero {
    constructor() {
        this.escenarioActual = 'personalizado';
        this.ingresoCuenta = 0;
        this.ingresoFisico = 0;
        this.ingresoMes1 = 0;
        this.ingresoMesSiguientes = 0;
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

    tieneDatosConfigurados() {
        return (this.ingresoCuenta > 0 || this.ingresoFisico > 0) && this.gastos.length > 0;
    }

    reiniciarPresupuestoEnBlanco() {
        this.ingresoCuenta = 0;
        this.ingresoFisico = 0;
        this.ingresoMes1 = 0;
        this.ingresoMesSiguientes = 0;
        this.gastos = [];
        this.transacciones = [];
        this.escenarioActual = 'personalizado';
        this.guardarEnAlmacenamientoLocal();
    }

    generarPresupuestoBicanal(ingresoBanco, ingresoMano, idPerfil = 'VIVIENDO_PADRES') {
        const cuenta = Math.max(0, parseFloat(ingresoBanco) || 0);
        const fisico = Math.max(0, parseFloat(ingresoMano) || 0);
        const sueldoTotal = cuenta + fisico;

        if (sueldoTotal <= 0) return false;

        this.ingresoCuenta = cuenta;
        this.ingresoFisico = fisico;
        this.ingresoMes1 = sueldoTotal;
        this.ingresoMesSiguientes = sueldoTotal;
        this.perfilSeleccionado = idPerfil;
        this.escenarioActual = 'personalizado';
        this.gastos = [];

        const configuracionPerfil = PERFILES_PRESUPUESTO[idPerfil] || PERFILES_PRESUPUESTO.VIVIENDO_PADRES;
        let sumaCalculada = 0;

        configuracionPerfil.partidas.forEach((partida, indice) => {
            let importe = Math.round((sueldoTotal * (partida.porcentaje / 100)) * 100) / 100;

            if (indice === configuracionPerfil.partidas.length - 1) {
                const resto = Math.round((sueldoTotal - sumaCalculada) * 100) / 100;
                if (resto > 0) importe = resto;
            } else {
                sumaCalculada += importe;
            }

            this.gastos.push({
                id: 'partida-auto-' + (indice + 1) + '-' + Date.now(),
                concepto: partida.concepto,
                importe: importe,
                categoria: partida.categoria,
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

    cargarCasoEjemplo(esOriginalConDeficit = false) {
        this.ingresoCuenta = CASO_EJEMPLO_INICIAL.ingresoCuenta || 1000.00;
        this.ingresoFisico = CASO_EJEMPLO_INICIAL.ingresoFisico || 400.00;
        this.ingresoMes1 = CASO_EJEMPLO_INICIAL.ingresoMes1;
        this.ingresoMesSiguientes = CASO_EJEMPLO_INICIAL.ingresoMesSiguientes;

        if (esOriginalConDeficit) {
            this.escenarioActual = 'ejemplo_original';
            this.gastos = JSON.parse(JSON.stringify(CASO_EJEMPLO_INICIAL.gastosOriginalesConDeficit));
            this.transacciones = [];
        } else {
            this.escenarioActual = 'ejemplo_optimizado';
            this.gastos = JSON.parse(JSON.stringify(CASO_EJEMPLO_INICIAL.gastosOptimizados));
            this.transacciones = JSON.parse(JSON.stringify(CASO_EJEMPLO_INICIAL.transaccionesEjemplo || []));
        }
        this.guardarEnAlmacenamientoLocal();
    }

    obtenerIngresoParaMes(numeroMes) {
        return numeroMes === 1 ? this.ingresoMes1 : this.ingresoMesSiguientes;
    }

    // --- MÉTODOS DE TRANSACCIONES Y SEGUIMIENTO POR LUGAR ---

    registrarTransaccion(datosCompra) {
        const idUnico = 'trans-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const hoy = new Date().toISOString().split('T')[0];

        const nuevaTransaccion = {
            id: idUnico,
            fecha: datosCompra.fecha || hoy,
            lugar: (datosCompra.lugar || 'Comercio / Lugar').trim(),
            importe: parseFloat(datosCompra.importe) || 0,
            categoria: datosCompra.categoria || 'VIVIENDA_COMIDA',
            canal: datosCompra.canal || CANALES_PAGO.FISICO,
            notas: (datosCompra.notas || '').trim()
        };

        this.transacciones.unshift(nuevaTransaccion);
        this.guardarEnAlmacenamientoLocal();
        return nuevaTransaccion;
    }

    eliminarTransaccion(idTransaccion) {
        const indice = this.transacciones.findIndex(t => t.id === idTransaccion);
        if (indice !== -1) {
            const eliminada = this.transacciones.splice(indice, 1)[0];
            this.guardarEnAlmacenamientoLocal();
            return eliminada;
        }
        return null;
    }

    obtenerSeguimientoSobres() {
        const resumen = this.calcularResumenMes(this.mesVisualizado);
        const seguimiento = {};

        Object.keys(CATEGORIAS_GASTO).forEach(clave => {
            const limitePresupuestado = resumen.desglosePorCategoria[clave] || 0;
            
            // Sumar lo gastado real en transacciones para esta categoría
            const gastosReales = this.transacciones
                .filter(t => t.categoria === clave)
                .reduce((acumulado, t) => acumulado + t.importe, 0);

            const dineroGastado = Math.round(gastosReales * 100) / 100;
            const dineroDisponible = Math.round((limitePresupuestado - dineroGastado) * 100) / 100;
            const porcentajeConsumido = limitePresupuestado > 0 
                ? Math.round((dineroGastado / limitePresupuestado) * 100) 
                : 0;

            let estadoSobre = 'saludable';
            if (dineroDisponible < 0) {
                estadoSobre = 'sobregasto';
            } else if (porcentajeConsumido >= 75) {
                estadoSobre = 'alerta';
            }

            seguimiento[clave] = {
                categoria: clave,
                configuracion: CATEGORIAS_GASTO[clave],
                limitePresupuestado,
                dineroGastado,
                dineroDisponible,
                porcentajeConsumido,
                estadoSobre,
                dineroSalvadoParaAhorro: Math.max(0, dineroDisponible)
            };
        });

        return seguimiento;
    }

    calcularTotalSalvadoParaAhorro() {
        const seguimiento = this.obtenerSeguimientoSobres();
        let totalSalvado = 0;

        // Sumar remanente de categorías de consumo (no incluye lo ya asignado como AHORRO_INVERSION)
        Object.values(seguimiento).forEach(item => {
            if (item.categoria !== 'AHORRO_INVERSION') {
                totalSalvado += item.dineroSalvadoParaAhorro;
            }
        });

        return Math.round(totalSalvado * 100) / 100;
    }

    // --- MÉTODOS DE GASTOS Y RESÚMENES ---

    agregarGasto(nuevoGasto) {
        const identificadorUnico = 'gasto-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const gastoCompleto = {
            id: identificadorUnico,
            concepto: nuevoGasto.concepto || 'Nuevo Concepto',
            importe: parseFloat(nuevoGasto.importe) || 0,
            categoria: nuevoGasto.categoria || 'OCIO_ESTILO_VIDA',
            canal: nuevoGasto.canal || CANALES_PAGO.CUENTA,
            esencial: Boolean(nuevoGasto.esencial),
            recurrente: nuevoGasto.recurrente !== undefined ? Boolean(nuevoGasto.recurrente) : true,
            mesFiniquito: nuevoGasto.mesFiniquito ? parseInt(nuevoGasto.mesFiniquito) : null,
            descripcion: nuevoGasto.descripcion || ''
        };
        this.gastos.push(gastoCompleto);
        this.guardarEnAlmacenamientoLocal();
        return gastoCompleto;
    }

    actualizarGasto(idGasto, datosModificados) {
        const indice = this.gastos.findIndex(gasto => gasto.id === idGasto);
        if (indice !== -1) {
            this.gastos[indice] = {
                ...this.gastos[indice],
                ...datosModificados,
                importe: datosModificados.importe !== undefined ? parseFloat(datosModificados.importe) : this.gastos[indice].importe
            };
            this.guardarEnAlmacenamientoLocal();
            return this.gastos[indice];
        }
        return null;
    }

    eliminarGasto(idGasto) {
        const indice = this.gastos.findIndex(gasto => gasto.id === idGasto);
        if (indice !== -1) {
            const gastoEliminado = this.gastos.splice(indice, 1)[0];
            this.guardarEnAlmacenamientoLocal();
            return gastoEliminado;
        }
        return null;
    }

    cambiarCanalPagoGasto(idGasto) {
        const gasto = this.gastos.find(item => item.id === idGasto);
        if (gasto) {
            gasto.canal = (gasto.canal === CANALES_PAGO.CUENTA) ? CANALES_PAGO.FISICO : CANALES_PAGO.CUENTA;
            this.guardarEnAlmacenamientoLocal();
            return gasto;
        }
        return null;
    }

    obtenerGastosActivosMes(numeroMes) {
        return this.gastos.filter(gasto => {
            if (gasto.mesFiniquito && numeroMes > gasto.mesFiniquito) return false;
            if (!gasto.recurrente && numeroMes > 1) return false;
            return true;
        });
    }

    calcularResumenMes(numeroMes = 1) {
        const ingresoActual = this.obtenerIngresoParaMes(numeroMes);
        const gastosActivos = this.obtenerGastosActivosMes(numeroMes);

        let totalGastosConsumo = 0;
        let totalCuenta = 0;
        let totalFisico = 0;
        let totalDeudas = 0;
        let totalSuscripciones = 0;
        let totalViviendaComida = 0;
        let totalOcio = 0;
        let totalAhorroAsignado = 0;
        let totalInversionAsignada = 0;

        const desglosePorCategoria = {};
        Object.keys(CATEGORIAS_GASTO).forEach(clave => {
            desglosePorCategoria[clave] = 0;
        });

        gastosActivos.forEach(gasto => {
            const importe = gasto.importe;

            if (gasto.categoria === 'AHORRO_INVERSION') {
                const conceptoMin = gasto.concepto.toLowerCase();
                if (conceptoMin.includes('inversión') || conceptoMin.includes('inversion')) {
                    totalInversionAsignada += importe;
                } else {
                    totalAhorroAsignado += importe;
                }
            } else {
                totalGastosConsumo += importe;
            }

            if (gasto.canal === CANALES_PAGO.CUENTA) {
                totalCuenta += importe;
            } else {
                totalFisico += importe;
            }

            if (gasto.categoria === 'DEUDAS_OBLIGACIONES') totalDeudas += importe;
            if (gasto.categoria === 'DIGITAL_SUSCRIPCIONES') totalSuscripciones += importe;
            if (gasto.categoria === 'VIVIENDA_COMIDA') totalViviendaComida += importe;
            if (gasto.categoria === 'OCIO_ESTILO_VIDA') totalOcio += importe;

            if (desglosePorCategoria[gasto.categoria] !== undefined) {
                desglosePorCategoria[gasto.categoria] += importe;
            }
        });

        const totalPresupuestadoCompleto = totalGastosConsumo + totalAhorroAsignado + totalInversionAsignada;
        const balanceNeto = ingresoActual - totalPresupuestadoCompleto;
        const sobranteConsumo = ingresoActual - totalGastosConsumo;

        const analisisEfectivo = this.analizarFlujoEfectivo(totalFisico);

        let estadoSalud = 'optimo';
        let mensajeEstado = 'Finanzas equilibradas con capacidad de ahorro e inversión';

        if (ingresoActual === 0) {
            estadoSalud = 'vacio';
            mensajeEstado = 'Introduce tu dinero neto (cuenta y efectivo) para comenzar';
        } else if (balanceNeto < -0.05) {
            estadoSalud = 'deficit';
            mensajeEstado = `Déficit de ${Math.abs(balanceNeto).toFixed(2)}€. Gastas más de lo que ingresas.`;
        } else if (balanceNeto > 0.05 && totalAhorroAsignado === 0 && totalInversionAsignada === 0) {
            estadoSalud = 'sin_asignar';
            mensajeEstado = `Tienes un excedente de ${balanceNeto.toFixed(2)}€ sin asignar a ahorro o inversión.`;
        }

        const porcentajeAsignado = ingresoActual > 0 
            ? Math.round((totalPresupuestadoCompleto / ingresoActual) * 100) 
            : 0;

        const porcentajeCuenta = ingresoActual > 0 ? Math.round((this.ingresoCuenta / ingresoActual) * 100) : 0;
        const porcentajeFisico = ingresoActual > 0 ? Math.round((this.ingresoFisico / ingresoActual) * 100) : 0;

        return {
            numeroMes,
            ingresoActual,
            ingresoCuenta: this.ingresoCuenta,
            ingresoFisico: this.ingresoFisico,
            porcentajeCuenta,
            porcentajeFisico,
            totalGastosConsumo,
            totalCuenta,
            totalFisico,
            totalDeudas,
            totalSuscripciones,
            totalViviendaComida,
            totalOcio,
            totalAhorroAsignado,
            totalInversionAsignada,
            totalPresupuestadoCompleto,
            balanceNeto: Math.round(balanceNeto * 100) / 100,
            sobranteConsumo: Math.round(sobranteConsumo * 100) / 100,
            porcentajeAsignado,
            estadoSalud,
            mensajeEstado,
            desglosePorCategoria,
            analisisEfectivo
        };
    }

    analizarFlujoEfectivo(totalGastosEnFisico) {
        const dineroManoIngresado = this.ingresoFisico;
        const gastosConsumoFisico = totalGastosEnFisico;

        let situacion = 'equilibrado';
        let dineroLiberadoParaInvertir = 0;
        let dineroSobranteEnMano = 0;
        let recomendacion = '';

        if (dineroManoIngresado === 0) {
            situacion = 'retirada_cajero';
            recomendacion = `Retira ${gastosConsumoFisico.toFixed(2)}€ del cajero al principio de mes para llevar en billetes físicos.`;
        } else if (dineroManoIngresado <= gastosConsumoFisico) {
            situacion = 'absorcion_completa';
            dineroLiberadoParaInvertir = dineroManoIngresado;
            const diferenciaARetirar = gastosConsumoFisico - dineroManoIngresado;
            recomendacion = `¡Absorción perfecta! Tus ${dineroManoIngresado.toFixed(2)}€ en mano cubren parte de tu consumo diario (supermercado, ocio, gasolina). Solo necesitas sacar ${diferenciaARetirar.toFixed(2)}€ del cajero. Has liberado ${dineroLiberadoParaInvertir.toFixed(2)}€ limpios en tu cuenta bancaria para inversión o ahorro.`;
        } else {
            situacion = 'excedente_efectivo';
            dineroLiberadoParaInvertir = gastosConsumoFisico;
            dineroSobranteEnMano = dineroManoIngresado - gastosConsumoFisico;
            recomendacion = `Tienes un excedente de ${dineroSobranteEnMano.toFixed(2)}€ en efectivo que supera tus gastos corrientes de este mes. NUNCA lo ingreses de golpe en cajeros automáticos para evitar avisos bancarios. Canalízalo adelantando compras cotidianas, adquiriendo tarjetas regalo en supermercados o usándolo en meses venideros para no perder poder adquisitivo por inflación.`;
        }

        return {
            dineroManoIngresado,
            gastosConsumoFisico,
            situacion,
            dineroLiberadoParaInvertir,
            dineroSobranteEnMano,
            recomendacion
        };
    }

    calcularProyeccion6Meses() {
        const proyeccion = [];
        let ahorroAcumulado = 0;
        let inversionAcumulada = 0;

        for (let mes = 1; mes <= this.horizonteMeses; mes++) {
            const resumen = this.calcularResumenMes(mes);

            let ahorroMes = resumen.totalAhorroAsignado;
            let inversionMes = resumen.totalInversionAsignada;

            if (resumen.balanceNeto > 0) {
                ahorroMes += Math.round((resumen.balanceNeto * 0.5) * 100) / 100;
                inversionMes += Math.round((resumen.balanceNeto * 0.5) * 100) / 100;
            }

            ahorroAcumulado += ahorroMes;
            inversionAcumulada += inversionMes;
            const patrimonioTotal = ahorroAcumulado + inversionAcumulada;

            proyeccion.push({
                mes,
                ingreso: resumen.ingresoActual,
                gastosFijos: resumen.totalGastosConsumo - resumen.totalDeudas,
                deudas: resumen.totalDeudas,
                gastosTotales: resumen.totalGastosConsumo,
                sobrante: resumen.sobranteConsumo,
                ahorroMensual: Math.round(ahorroMes * 100) / 100,
                inversionMensual: Math.round(inversionMes * 100) / 100,
                ahorroAcumulado: Math.round(ahorroAcumulado * 100) / 100,
                inversionAcumulada: Math.round(inversionAcumulada * 100) / 100,
                patrimonioTotal: Math.round(patrimonioTotal * 100) / 100,
                totalCuenta: resumen.totalCuenta,
                totalFisico: resumen.totalFisico
            });
        }

        return proyeccion;
    }

    guardarEnAlmacenamientoLocal() {
        try {
            const estadoAGuardar = {
                escenarioActual: this.escenarioActual,
                ingresoCuenta: this.ingresoCuenta,
                ingresoFisico: this.ingresoFisico,
                ingresoMes1: this.ingresoMes1,
                ingresoMesSiguientes: this.ingresoMesSiguientes,
                perfilSeleccionado: this.perfilSeleccionado,
                gastos: this.gastos,
                transacciones: this.transacciones
            };
            localStorage.setItem('presupuesto_personal_universal', JSON.stringify(estadoAGuardar));
        } catch (error) {
            console.warn('Almacenamiento local no disponible:', error);
        }
    }

    cargarDeAlmacenamientoLocal() {
        try {
            const datosGuardados = localStorage.getItem('presupuesto_personal_universal');
            if (datosGuardados) {
                const objeto = JSON.parse(datosGuardados);
                this.escenarioActual = objeto.escenarioActual || 'personalizado';
                this.ingresoCuenta = parseFloat(objeto.ingresoCuenta) || 0;
                this.ingresoFisico = parseFloat(objeto.ingresoFisico) || 0;
                this.ingresoMes1 = parseFloat(objeto.ingresoMes1) || (this.ingresoCuenta + this.ingresoFisico);
                this.ingresoMesSiguientes = parseFloat(objeto.ingresoMesSiguientes) || this.ingresoMes1;
                this.perfilSeleccionado = objeto.perfilSeleccionado || 'VIVIENDO_PADRES';
                if (Array.isArray(objeto.gastos) && objeto.gastos.length > 0) {
                    this.gastos = objeto.gastos;
                }
                if (Array.isArray(objeto.transacciones)) {
                    this.transacciones = objeto.transacciones;
                }
                return true;
            }
        } catch (error) {
            console.warn('Error al leer almacenamiento local:', error);
        }
        return false;
    }
}
