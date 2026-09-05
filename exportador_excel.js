// Exportador profesional a Excel (.xlsx) con 5 hojas de cálculo.
// Los importes se escriben como NÚMEROS reales en euros (no como texto) para que
// Excel pueda sumarlos, y con formato de moneda española aplicado a cada celda.

import { CATEGORIAS_GASTO, CANALES_PAGO, SUBTIPOS_PATRIMONIO } from './datos_iniciales.js';
import { aEuros, formatearEuros, formatearPorcentaje } from './utilidades_dinero.js';

/** Marca un importe en centimos como celda monetaria de la hoja. */
const moneda = (centimos) => ({ esMoneda: true, valor: aEuros(centimos) });

const FORMATO_MONEDA = '#,##0.00\\ "€"';

export class ExportadorExcel {
    constructor(gestorFinanciero) {
        this.gestor = gestorFinanciero;
    }

    generarYDescargarExcel() {
        if (typeof XLSX === 'undefined') {
            return {
                exito: false,
                mensaje: 'La librería de Excel aún se está cargando. Inténtalo de nuevo en unos segundos.'
            };
        }

        try {
            const libro = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(libro, this.construirHojaProyeccion(), 'Presupuesto_6_Meses');
            XLSX.utils.book_append_sheet(libro, this.construirHojaComprasLugares(), 'Gastos_Por_Lugares');
            XLSX.utils.book_append_sheet(libro, this.construirHojaCanalesPago(), 'Cuenta_vs_Fisico');
            XLSX.utils.book_append_sheet(libro, this.construirHojaDesglosePartidas(), 'Desglose_Partidas');
            XLSX.utils.book_append_sheet(libro, this.construirHojaDiagnostico(), 'Salud_Financiera');

            XLSX.writeFile(libro, `Mi_Presupuesto_${this.gestor.obtenerFechaHoy()}.xlsx`);
            return { exito: true, mensaje: 'Excel generado correctamente.' };
        } catch (error) {
            return { exito: false, mensaje: `No se pudo generar el Excel: ${error.message}` };
        }
    }

    /**
     * Convierte la matriz de filas en una hoja aplicando el formato de moneda
     * SOLO a las celdas marcadas con moneda(), nunca a contadores o posiciones.
     */
    prepararHoja(filas, anchosColumnas) {
        const celdasMoneda = [];

        const datos = filas.map((fila, indiceFila) => (fila || []).map((celda, indiceColumna) => {
            if (celda && typeof celda === 'object' && celda.esMoneda) {
                celdasMoneda.push({ r: indiceFila, c: indiceColumna });
                return celda.valor;
            }
            return celda;
        }));

        const hoja = XLSX.utils.aoa_to_sheet(datos);

        celdasMoneda.forEach(({ r, c }) => {
            const referencia = XLSX.utils.encode_cell({ r, c });
            if (hoja[referencia] && hoja[referencia].t === 'n') {
                hoja[referencia].z = FORMATO_MONEDA;
            }
        });

        hoja['!cols'] = anchosColumnas;
        return hoja;
    }

    nombreCategoria(clave) {
        return CATEGORIAS_GASTO[clave] ? CATEGORIAS_GASTO[clave].nombre : clave;
    }

    // ----------------------------------------------------------------------
    // HOJA 1: PROYECCIÓN
    // ----------------------------------------------------------------------
    construirHojaProyeccion() {
        const proyeccion = this.gestor.calcularProyeccion();
        const totales = this.gestor.calcularTotalesProyeccion(proyeccion);
        const resumen = this.gestor.calcularResumenMes(1);

        const filas = [
            ['PLANIFICACIÓN FINANCIERA Y PROYECCIÓN A 6 MESES'],
            [`Ingreso neto mensual: ${formatearEuros(resumen.ingresoCent)} (${formatearEuros(resumen.ingresoCuentaCent)} en banco + ${formatearEuros(resumen.ingresoFisicoCent)} en efectivo)`],
            ['Generado con el Gestor de Presupuesto Personal Universal. Importes exactos al céntimo.'],
            [],
            [
                'Mes', 'Ingreso neto', 'Gastos fijos', 'Deudas liquidadas', 'Consumo total',
                'Sobrante libre', 'Ahorro del mes', 'Inversión del mes',
                'Ahorro acumulado', 'Inversión acumulada', 'Patrimonio total'
            ]
        ];

        proyeccion.forEach(fila => {
            filas.push([
                `Mes ${fila.mes}`,
                moneda(fila.ingresoCent),
                moneda(fila.gastosFijosCent),
                moneda(fila.deudasCent),
                moneda(fila.consumoCent),
                moneda(fila.sobranteCent),
                moneda(fila.ahorroMesCent),
                moneda(fila.inversionMesCent),
                moneda(fila.ahorroAcumuladoCent),
                moneda(fila.inversionAcumuladaCent),
                moneda(fila.patrimonioTotalCent)
            ]);
        });

        filas.push([]);
        filas.push([
            `TOTAL ${totales.meses} MESES`,
            moneda(totales.ingresosCent),
            '',
            moneda(totales.deudasCent),
            moneda(totales.consumoCent),
            moneda(totales.sobranteCent),
            '',
            '',
            moneda(totales.ahorroCent),
            moneda(totales.inversionCent),
            moneda(totales.patrimonioCent)
        ]);

        const hoja = this.prepararHoja(filas, [
            { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
            { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }
        ]);
        hoja['!freeze'] = { xSplit: 1, ySplit: 5 };
        return hoja;
    }

    // ----------------------------------------------------------------------
    // HOJA 2: GASTOS POR LUGAR Y SOBRES
    // ----------------------------------------------------------------------
    construirHojaComprasLugares() {
        const mes = this.gestor.mesVisualizado;
        const seguimiento = this.gestor.obtenerSeguimientoSobres(mes);
        const salvadoCent = this.gestor.calcularTotalSalvadoParaAhorroCent(mes);
        const transacciones = this.gestor.obtenerTransaccionesDelMes(mes);

        const filas = [
            [`CONTROL DIARIO DE GASTOS POR LUGAR — MES ${mes}`],
            [`Dinero aún no gastado que engorda tu ahorro: ${formatearEuros(salvadoCent)}`],
            [],
            ['1. ESTADO DE LOS SOBRES DIGITALES'],
            ['Categoría', 'Presupuestado', 'Gastado real', 'Disponible', 'Consumo', 'Movimientos', 'Estado']
        ];

        const textosEstado = { saludable: 'Dentro del límite', alerta: 'Atención', sobregasto: 'Excedido' };

        Object.values(seguimiento).forEach(sobre => {
            filas.push([
                sobre.configuracion.nombre,
                moneda(sobre.limitePresupuestadoCent),
                moneda(sobre.gastadoCent),
                moneda(sobre.disponibleCent),
                formatearPorcentaje(sobre.porcentajeConsumido),
                sobre.numeroMovimientos,
                textosEstado[sobre.estadoSobre]
            ]);
        });

        filas.push([]);
        filas.push(['2. RANKING DE LUGARES CON MÁS GASTO']);
        filas.push(['Posición', 'Lugar', 'Total gastado', 'Visitas']);

        const ranking = this.gestor.obtenerRankingLugares(mes, 10);
        if (ranking.length === 0) {
            filas.push(['-', 'Sin gastos registrados', 0, 0]);
        } else {
            ranking.forEach((item, indice) => {
                filas.push([indice + 1, item.lugar, moneda(item.totalCent), item.visitas]);
            });
        }

        filas.push([]);
        filas.push(['3. HISTORIAL COMPLETO DE GASTOS REGISTRADOS']);
        filas.push(['Fecha', 'Lugar / Establecimiento', 'Categoría', 'Canal de pago', 'Importe', 'Notas']);

        if (transacciones.length === 0) {
            filas.push(['-', 'Sin gastos registrados en este mes', '-', '-', 0, '']);
        } else {
            transacciones.forEach(transaccion => {
                filas.push([
                    transaccion.fecha,
                    transaccion.lugar,
                    this.nombreCategoria(transaccion.categoria),
                    transaccion.canal,
                    moneda(transaccion.importeCent),
                    transaccion.notas || ''
                ]);
            });
        }

        return this.prepararHoja(filas, [
            { wch: 30 }, { wch: 32 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 20 }
        ]);
    }

    // ----------------------------------------------------------------------
    // HOJA 3: CUENTA BANCARIA VS EFECTIVO
    // ----------------------------------------------------------------------
    construirHojaCanalesPago() {
        const resumen = this.gestor.calcularResumenMes(1);
        const partidas = this.gestor.obtenerGastosActivosMes(1);
        const partidasCuenta = partidas.filter(gasto => gasto.canal === CANALES_PAGO.CUENTA);
        const partidasFisico = partidas.filter(gasto => gasto.canal === CANALES_PAGO.FISICO);

        const filas = [
            ['PLAN OPERATIVO: CUENTA BANCARIA VS. EFECTIVO FÍSICO'],
            [`Ingreso neto mensual: ${formatearEuros(resumen.ingresoCent)}`],
            [resumen.analisisEfectivo.recomendacion],
            [],
            ['1. GASTOS A PAGAR EN EFECTIVO FÍSICO'],
            ['Concepto', 'Categoría', 'Importe', 'Finalidad']
        ];

        partidasFisico.forEach(gasto => {
            filas.push([
                gasto.concepto,
                this.nombreCategoria(gasto.categoria),
                moneda(gasto.importeCent),
                gasto.descripcion || 'Gasto en billetes para control cotidiano'
            ]);
        });
        filas.push(['TOTAL EN EFECTIVO', '', moneda(resumen.fisicoCent), 'Consumo en billetes físicos']);

        filas.push([]);
        filas.push(['2. GASTOS DOMICILIADOS EN LA CUENTA BANCARIA']);
        filas.push(['Concepto', 'Categoría', 'Importe', 'Finalidad']);

        partidasCuenta.forEach(gasto => {
            filas.push([
                gasto.concepto,
                this.nombreCategoria(gasto.categoria),
                moneda(gasto.importeCent),
                gasto.descripcion || 'Cobro por recibo domiciliado o tarjeta'
            ]);
        });
        filas.push(['TOTAL EN CUENTA', '', moneda(resumen.cuentaCent), 'Mantener disponible en cuenta corriente']);

        filas.push([]);
        filas.push(['3. CUADRE OPERATIVO POR CANAL']);
        filas.push(['Concepto', 'Canal', 'Importe', 'Instrucción']);
        filas.push(['Ingreso en cuenta bancaria', 'Banco', moneda(resumen.ingresoCuentaCent), 'Dinero oficial recibido']);
        filas.push(['Gasto comprometido en banco', 'Banco', moneda(resumen.cuentaCent), 'Recibos, tarjeta y aportaciones']);
        filas.push(['Saldo libre en banco', 'Banco', moneda(resumen.saldoLibreCuentaCent), 'Disponible para invertir o transferir']);
        filas.push(['Ingreso en efectivo', 'Mano', moneda(resumen.ingresoFisicoCent), 'Billetes recibidos']);
        filas.push(['Gasto comprometido en efectivo', 'Mano', moneda(resumen.fisicoCent), 'Compra, ocio y consumo diario']);
        filas.push(['A retirar del cajero', 'Cajero', moneda(resumen.retiradaCajeroCent), 'Sacar a principio de mes si es mayor que cero']);
        filas.push(['Ahorro líquido asignado', 'Cuenta remunerada', moneda(resumen.ahorroCent), 'Fondo de seguridad']);
        filas.push(['Inversión asignada', 'Bróker / fondos', moneda(resumen.inversionCent), 'Patrimonio a largo plazo']);
        filas.push(['TOTAL ASIGNADO', '', moneda(resumen.totalPresupuestadoCent), 'Suma de todas las partidas']);
        filas.push(['BALANCE (ingreso - asignado)', '', moneda(resumen.balanceNetoCent), resumen.balanceNetoCent === 0 ? 'Cuadre perfecto al céntimo' : resumen.mensajeEstado]);

        return this.prepararHoja(filas, [{ wch: 38 }, { wch: 26 }, { wch: 16 }, { wch: 50 }]);
    }

    // ----------------------------------------------------------------------
    // HOJA 4: CATÁLOGO DE PARTIDAS
    // ----------------------------------------------------------------------
    construirHojaDesglosePartidas() {
        const filas = [
            ['CATÁLOGO DETALLADO DE PARTIDAS PRESUPUESTARIAS'],
            [],
            ['Concepto', 'Importe', 'Categoría', 'Tipo de patrimonio', 'Canal de pago', 'Esencial', 'Duración', 'Notas']
        ];

        this.gestor.gastos.forEach(gasto => {
            let duracion = 'Todos los meses';
            if (!gasto.recurrente) {
                duracion = gasto.mesFiniquito ? `Hasta el mes ${gasto.mesFiniquito}` : 'Solo el mes 1';
            } else if (gasto.mesFiniquito) {
                duracion = `Hasta el mes ${gasto.mesFiniquito}`;
            }

            let tipoPatrimonio = '-';
            if (gasto.categoria === 'AHORRO_INVERSION') {
                tipoPatrimonio = gasto.subtipo === SUBTIPOS_PATRIMONIO.INVERSION ? 'Inversión' : 'Ahorro líquido';
            }

            filas.push([
                gasto.concepto,
                moneda(gasto.importeCent),
                this.nombreCategoria(gasto.categoria),
                tipoPatrimonio,
                gasto.canal,
                gasto.esencial ? 'Sí' : 'No',
                duracion,
                gasto.descripcion || ''
            ]);
        });

        return this.prepararHoja(filas, [
            { wch: 38 }, { wch: 15 }, { wch: 28 }, { wch: 18 },
            { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 50 }
        ]);
    }

    // ----------------------------------------------------------------------
    // HOJA 5: DIAGNÓSTICO
    // ----------------------------------------------------------------------
    construirHojaDiagnostico() {
        const resumen = this.gestor.calcularResumenMes(1);
        const totales = this.gestor.calcularTotalesProyeccion();

        const filas = [
            ['DIAGNÓSTICO Y SALUD FINANCIERA'],
            [],
            ['Métrica', 'Valor', 'Lectura'],
            ['Ingreso neto mensual', moneda(resumen.ingresoCent), 'Base de cálculo disponible'],
            ['Gastos de consumo', moneda(resumen.consumoCent), 'Todo lo que no es ahorro ni inversión'],
            ['Gasto en efectivo', moneda(resumen.fisicoCent), 'Consumo pagado en billetes'],
            ['Gasto en cuenta bancaria', moneda(resumen.cuentaCent), 'Recibos, tarjeta y domiciliaciones'],
            ['A retirar del cajero', moneda(resumen.retiradaCajeroCent), resumen.retiradaCajeroCent > 0 ? 'Saca este importe a principio de mes' : 'Tu efectivo en mano cubre el consumo'],
            ['Ahorro líquido mensual', moneda(resumen.ahorroCent), 'Fondo de emergencia'],
            ['Inversión mensual', moneda(resumen.inversionCent), 'Aportación a fondos o bróker'],
            ['Balance del mes', moneda(resumen.balanceNetoCent), resumen.balanceNetoCent === 0 ? 'Cuentas cuadradas al céntimo' : resumen.mensajeEstado],
            ['Porcentaje del sueldo asignado', formatearPorcentaje(resumen.porcentajeAsignado), resumen.porcentajeAsignado === 100 ? 'Todo el sueldo tiene un destino' : 'Aún queda sueldo sin destino asignado'],
            ['Tasa de ahorro real', formatearPorcentaje(resumen.porcentajeAhorroReal), 'Ahorro + inversión + excedente sobre el ingreso'],
            ['Número de partidas activas', resumen.numeroPartidas, 'Partidas vigentes en el mes 1'],
            [],
            ['PROYECCIÓN A 6 MESES'],
            ['Ingresos acumulados', moneda(totales.ingresosCent), 'Suma de los seis meses'],
            ['Consumo acumulado', moneda(totales.consumoCent), 'Gasto corriente total'],
            ['Ahorro acumulado', moneda(totales.ahorroCent), 'Colchón al final del periodo'],
            ['Inversión acumulada', moneda(totales.inversionCent), 'Capital invertido al final del periodo'],
            ['Patrimonio total', moneda(totales.patrimonioCent), 'Ahorro + inversión acumulados'],
            [],
            ['ESTRATEGIA DE EFECTIVO'],
            [resumen.analisisEfectivo.recomendacion]
        ];

        return this.prepararHoja(filas, [{ wch: 34 }, { wch: 20 }, { wch: 62 }]);
    }
}
