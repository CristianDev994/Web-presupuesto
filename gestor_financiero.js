// Motor de cálculo financiero universal, adaptativo y configurable por el usuario

import { 
    CANALES_PAGO, 
    CATEGORIAS_GASTO, 
    PERFILES_PRESUPUESTO, 
    CASO_EJEMPLO_INICIAL 
} from './datos_iniciales.js';

export class GestorFinanciero {
    constructor() {
        this.escenarioActual = 'personalizado'; // 'personalizado' | 'ejemplo_optimizado' | 'ejemplo_original'
        this.ingresoMes1 = 0;
        this.ingresoMesSiguientes = 0;
        this.horizonteMeses = 6;
        this.gastos = [];
        this.mesVisualizado = 1;
        this.perfilSeleccionado = 'VIVIENDO_PADRES';

        // Intentar recuperar sesión previa del usuario; si no existe, arrancar limpio en blanco
        const tieneDatosPrevios = this.cargarDeAlmacenamientoLocal();
        if (!tieneDatosPrevios) {
            this.reiniciarPresupuestoEnBlanco();
        }
    }

    tieneDatosConfigurados() {
        return this.ingresoMes1 > 0 && this.gastos.length > 0;
    }

    reiniciarPresupuestoEnBlanco() {
        this.ingresoMes1 = 0;
        this.ingresoMesSiguientes = 0;
        this.gastos = [];
        this.escenarioActual = 'personalizado';
        this.guardarEnAlmacenamientoLocal();
    }

    generarPresupuestoAutomatico(sueldoNeto, idPerfil = 'VIVIENDO_PADRES') {
        const sueldo = parseFloat(sueldoNeto) || 0;
        if (sueldo <= 0) return false;

        this.ingresoMes1 = sueldo;
        this.ingresoMesSiguientes = sueldo;
        this.perfilSeleccionado = idPerfil;
        this.escenarioActual = 'personalizado';
        this.gastos = [];

        const configuracionPerfil = PERFILES_PRESUPUESTO[idPerfil] || PERFILES_PRESUPUESTO.VIVIENDO_PADRES;
        let sumaCalculada = 0;

        configuracionPerfil.partidas.forEach((partida, indice) => {
            let importe = Math.round((sueldo * (partida.porcentaje / 100)) * 100) / 100;
            
            // Si es la última partida, ajustar céntimos de redondeo para cuadrar al 100% exacto
            if (indice === configuracionPerfil.partidas.length - 1) {
                const resto = Math.round((sueldo - sumaCalculada) * 100) / 100;
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
        if (esOriginalConDeficit) {
            this.escenarioActual = 'ejemplo_original';
            this.ingresoMes1 = CASO_EJEMPLO_INICIAL.ingresoMes1;
            this.ingresoMesSiguientes = CASO_EJEMPLO_INICIAL.ingresoMesSiguientes;
            this.gastos = JSON.parse(JSON.stringify(CASO_EJEMPLO_INICIAL.gastosOriginalesConDeficit));
        } else {
            this.escenarioActual = 'ejemplo_optimizado';
            this.ingresoMes1 = CASO_EJEMPLO_INICIAL.ingresoMes1;
            this.ingresoMesSiguientes = CASO_EJEMPLO_INICIAL.ingresoMesSiguientes;
            this.gastos = JSON.parse(JSON.stringify(CASO_EJEMPLO_INICIAL.gastosOptimizados));
        }
        this.guardarEnAlmacenamientoLocal();
    }

    obtenerIngresoParaMes(numeroMes) {
        return numeroMes === 1 ? this.ingresoMes1 : this.ingresoMesSiguientes;
    }

    actualizarIngreso(tipo, nuevoValor) {
        const valorNumerico = parseFloat(nuevoValor) || 0;
        if (tipo === 'mes1') {
            this.ingresoMes1 = valorNumerico;
            if (this.ingresoMesSiguientes === 0) {
                this.ingresoMesSiguientes = valorNumerico;
            }
        } else {
            this.ingresoMesSiguientes = valorNumerico;
        }
        this.guardarEnAlmacenamientoLocal();
    }

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

        // Diagnóstico y salud financiera
        let estadoSalud = 'optimo';
        let mensajeEstado = 'Finanzas equilibradas con capacidad de ahorro e inversión';

        if (ingresoActual === 0) {
            estadoSalud = 'vacio';
            mensajeEstado = 'Introduce tu dinero neto para comenzar a calcular';
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

        return {
            numeroMes,
            ingresoActual,
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
            desglosePorCategoria
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

            // Si hay sobrante positivo no asignado, repartir 50/50 por defecto
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
                ingresoMes1: this.ingresoMes1,
                ingresoMesSiguientes: this.ingresoMesSiguientes,
                perfilSeleccionado: this.perfilSeleccionado,
                gastos: this.gastos
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
                this.ingresoMes1 = parseFloat(objeto.ingresoMes1) || 0;
                this.ingresoMesSiguientes = parseFloat(objeto.ingresoMesSiguientes) || 0;
                this.perfilSeleccionado = objeto.perfilSeleccionado || 'VIVIENDO_PADRES';
                if (Array.isArray(objeto.gastos) && objeto.gastos.length > 0) {
                    this.gastos = objeto.gastos;
                    return true;
                }
            }
        } catch (error) {
            console.warn('Error al leer almacenamiento local:', error);
        }
        return false;
    }
}
