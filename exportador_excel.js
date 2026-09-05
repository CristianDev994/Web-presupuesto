// Exportador profesional a Excel (.xlsx) adaptable a cualquier presupuesto e ingreso neto

export class ExportadorExcel {
    constructor(gestorFinanciero) {
        this.gestor = gestorFinanciero;
    }

    generarYDescargarExcel() {
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS (XLSX) se está cargando. Por favor, inténtalo de nuevo en unos instantes.');
            return;
        }

        const libroTrabajo = XLSX.utils.book_new();

        // 1. Hoja: Presupuesto y Proyección a 6 Meses
        const hojaProyeccion = this.construirHojaProyeccion();
        XLSX.utils.book_append_sheet(libroTrabajo, hojaProyeccion, 'Presupuesto_6_Meses');

        // 2. Hoja: Cuenta Bancaria vs. Efectivo Físico
        const hojaCanales = this.construirHojaCanalesPago();
        XLSX.utils.book_append_sheet(libroTrabajo, hojaCanales, 'Cuenta_vs_Fisico');

        // 3. Hoja: Catálogo Completo de Gastos y Partidas
        const hojaDesglose = this.construirHojaDesgloseGastos();
        XLSX.utils.book_append_sheet(libroTrabajo, hojaDesglose, 'Desglose_Partidas');

        // 4. Hoja: Diagnóstico y Salud Financiera
        const hojaDiagnostico = this.construirHojaDiagnostico();
        XLSX.utils.book_append_sheet(libroTrabajo, hojaDiagnostico, 'Salud_Financiera');

        // Descarga directa del archivo .xlsx
        const nombreArchivo = 'Mi_Presupuesto_Personal.xlsx';
        XLSX.writeFile(libroTrabajo, nombreArchivo);
    }

    construirHojaProyeccion() {
        const proyeccion = this.gestor.calcularProyeccion6Meses();
        const ingresoM1 = this.gestor.obtenerIngresoParaMes(1);
        const ingresoM2 = this.gestor.obtenerIngresoParaMes(2);

        const filasDatos = [
            ['PLANIFICACIÓN FINANCIERA Y PROYECCIÓN A 6 MESES'],
            [`Ingreso Mes 1: ${ingresoM1.toFixed(2)} € | Ingreso Meses Siguientes: ${ingresoM2.toFixed(2)} €`],
            ['Generado automáticamente con el Gestor de Presupuesto Personal Universal'],
            [],
            [
                'Mes',
                'Ingreso Neto (€)',
                'Gastos Fijos/Consumo (€)',
                'Deudas Liquidadas (€)',
                'Gasto Total Consumo (€)',
                'Sobrante Libre (€)',
                'Ahorro Mensual (€)',
                'Inversión Mensual (€)',
                'Ahorro Acumulado (€)',
                'Inversión Acumulada (€)',
                'Patrimonio Total (€)'
            ]
        ];

        proyeccion.forEach(item => {
            filasDatos.push([
                `Mes ${item.mes}`,
                item.ingreso,
                item.gastosFijos,
                item.deudas,
                item.gastosTotales,
                item.sobrante,
                item.ahorroMensual,
                item.inversionMensual,
                item.ahorroAcumulado,
                item.inversionAcumulada,
                item.patrimonioTotal
            ]);
        });

        const ultimoMes = proyeccion[proyeccion.length - 1];
        const sumaIngresos = proyeccion.reduce((acc, fila) => acc + fila.ingreso, 0);
        const sumaGastos = proyeccion.reduce((acc, fila) => acc + fila.gastosTotales, 0);
        const sumaSobrantes = proyeccion.reduce((acc, fila) => acc + fila.sobrante, 0);

        filasDatos.push([]);
        filasDatos.push([
            'TOTAL ACUMULADO 6 MESES',
            sumaIngresos,
            '-',
            '-',
            sumaGastos,
            sumaSobrantes,
            ultimoMes.ahorroAcumulado,
            ultimoMes.inversionAcumulada,
            ultimoMes.ahorroAcumulado,
            ultimoMes.inversionAcumulada,
            ultimoMes.patrimonioTotal
        ]);

        const hoja = XLSX.utils.aoa_to_sheet(filasDatos);
        hoja['!cols'] = [
            { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 22 }, 
            { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, 
            { wch: 22 }, { wch: 24 }, { wch: 22 }
        ];

        return hoja;
    }

    construirHojaCanalesPago() {
        const resumenMes1 = this.gestor.calcularResumenMes(1);
        const gastosMes1 = this.gestor.obtenerGastosActivosMes(1);

        const gastosCuenta = gastosMes1.filter(item => item.canal === 'Cuenta Bancaria');
        const gastosFisico = gastosMes1.filter(item => item.canal === 'Efectivo Físico');

        const filasDatos = [
            ['PLAN OPERATIVO: CUENTA BANCARIA VS. EFECTIVO FÍSICO'],
            [`Ingreso mensual neto considerado: ${resumenMes1.ingresoActual.toFixed(2)} €`],
            [],
            ['1. DINERO A RETIRAR EN EL CAJERO AUTOMÁTICO (EFECTIVO EN MANO)'],
            ['Concepto', 'Categoría', 'Importe (€)', 'Finalidad y Recomendación']
        ];

        let subtotalFisico = 0;
        gastosFisico.forEach(gasto => {
            subtotalFisico += gasto.importe;
            filasDatos.push([
                gasto.concepto,
                gasto.categoria,
                gasto.importe,
                gasto.descripcion || 'Gasto en billetes para control cotidiano'
            ]);
        });

        filasDatos.push(['TOTAL A RETIRAR EN CAJERO', '', subtotalFisico, 'Retirar a principio de mes en billetes']);
        filasDatos.push([]);
        filasDatos.push(['2. DINERO A MANTENER INTACTO EN LA CUENTA BANCARIA']);
        filasDatos.push(['Concepto', 'Categoría', 'Importe (€)', 'Finalidad y Cobro']);

        let subtotalCuenta = 0;
        gastosCuenta.forEach(gasto => {
            subtotalCuenta += gasto.importe;
            filasDatos.push([
                gasto.concepto,
                gasto.categoria,
                gasto.importe,
                gasto.descripcion || 'Cobro por recibo domiciliado o tarjeta'
            ]);
        });

        filasDatos.push(['TOTAL CARGOS EN CUENTA', '', subtotalCuenta, 'Mantener en cuenta corriente']);
        filasDatos.push([]);
        filasDatos.push(['3. RESUMEN GLOBAL DE DISTRIBUCIÓN']);
        filasDatos.push(['Destino Financiero', 'Medio', 'Importe (€)', 'Instrucción Operativa']);
        filasDatos.push(['Gastos en Efectivo Físico', 'Cajero', subtotalFisico, 'Llevar en cartera / sobres']);
        filasDatos.push(['Gastos en Cuenta Bancaria', 'Banco', subtotalCuenta, 'Dejar para recibos automáticos']);
        filasDatos.push(['Ahorro Líquido Asignado', 'Cuenta Remunerada', resumenMes1.totalAhorroAsignado, 'Fondo de seguridad / emergencia']);
        filasDatos.push(['Inversión a Largo Plazo', 'Bróker / Fondos', resumenMes1.totalInversionAsignada, 'Construcción de patrimonio compuesto']);
        filasDatos.push(['TOTAL ASIGNADO', '', resumenMes1.totalPresupuestadoCompleto, 'Cuadre presupuestario total']);

        const hoja = XLSX.utils.aoa_to_sheet(filasDatos);
        hoja['!cols'] = [{ wch: 38 }, { wch: 25 }, { wch: 16 }, { wch: 48 }];
        return hoja;
    }

    construirHojaDesgloseGastos() {
        const filasDatos = [
            ['CATÁLOGO DETALLADO DE PARTIDAS PRESUPUESTARIAS'],
            [],
            ['ID', 'Concepto', 'Importe (€)', 'Categoría', 'Canal de Pago', 'Recurrente', 'Notas / Descripción']
        ];

        this.gestor.gastos.forEach(gasto => {
            filasDatos.push([
                gasto.id,
                gasto.concepto,
                gasto.importe,
                gasto.categoria,
                gasto.canal,
                gasto.recurrente ? 'Sí' : 'No (Puntual)',
                gasto.descripcion || ''
            ]);
        });

        const hoja = XLSX.utils.aoa_to_sheet(filasDatos);
        hoja['!cols'] = [
            { wch: 18 }, { wch: 38 }, { wch: 15 }, { wch: 26 }, { wch: 18 }, { wch: 14 }, { wch: 55 }
        ];
        return hoja;
    }

    construirHojaDiagnostico() {
        const resumen = this.gestor.calcularResumenMes(1);

        const filasDatos = [
            ['DIAGNÓSTICO Y SALUD FINANCIERA DEL PRESUPUESTO'],
            [],
            ['Métrica Financiera', 'Valor Calculado', 'Evaluación / Recomendación'],
            ['Ingreso Neto Mensual', `${resumen.ingresoActual.toFixed(2)} €`, 'Base de cálculo disponible'],
            ['Gastos de Consumo Totales', `${resumen.totalGastosConsumo.toFixed(2)} €`, 'Total destinado a gastos corrientes'],
            ['Total en Efectivo (Cajero)', `${resumen.totalFisico.toFixed(2)} €`, 'Retirada para evitar compras impulsivas'],
            ['Total en Cuenta (Banco)', `${resumen.totalCuenta.toFixed(2)} €`, 'Reservado para domiciliaciones y suscripciones'],
            ['Ahorro Líquido Mensual', `${resumen.totalAhorroAsignado.toFixed(2)} €`, 'Fondo de emergencia intocable'],
            ['Inversión a Largo Plazo', `${resumen.totalInversionAsignada.toFixed(2)} €`, 'Aportación a fondos indexados'],
            ['Balance Neto (Excedente/Déficit)', `${resumen.balanceNeto.toFixed(2)} €`, resumen.balanceNeto >= 0 ? 'Finanzas cuadradas con éxito' : 'ALERTA: Reducir partidas para eliminar déficit'],
            ['Porcentaje Asignado del Sueldo', `${resumen.porcentajeAsignado} %`, resumen.porcentajeAsignado === 100 ? '100% de los ingresos asignados con propósito' : 'Presupuesto no ajustado al 100%'],
            ['Diagnóstico Global', resumen.mensajeEstado, 'Evaluación automatizada']
        ];

        const hoja = XLSX.utils.aoa_to_sheet(filasDatos);
        hoja['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 50 }];
        return hoja;
    }
}
