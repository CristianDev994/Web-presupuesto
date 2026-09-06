// Pruebas de exactitud del motor financiero.
// Ejecutar desde la raiz del proyecto con:  node pruebas_calculos.mjs
import assert from 'node:assert/strict';

// Stub mínimo de localStorage para poder instanciar el gestor fuera del navegador
const almacen = new Map();
globalThis.localStorage = {
    getItem: (clave) => (almacen.has(clave) ? almacen.get(clave) : null),
    setItem: (clave, valor) => almacen.set(clave, String(valor)),
    removeItem: (clave) => almacen.delete(clave)
};

const {
    aCentimos, aEuros, repartirPorPorcentajes, repartirProporcional,
    dividirEnPartes, formatearEuros, calcularPorcentaje, sumarCentimos
} = await import('./utilidades_dinero.js');
const { GestorFinanciero } = await import('./gestor_financiero.js');
const { ExportadorExcel } = await import('./exportador_excel.js');
const { PERFILES_PRESUPUESTO, CANALES_PAGO } = await import('./datos_iniciales.js');

let pruebas = 0;
// Intl usa espacios duros (U+00A0 / U+202F) antes del simbolo de euro
const norm = (t) => String(t).replace(/[  ]/g, ' ');
function comprobar(nombre, fn) {
    pruebas++;
    try { fn(); console.log(`  OK  ${nombre}`); }
    catch (e) { console.error(`  FALLO  ${nombre}\n        ${e.message}`); process.exitCode = 1; }
}

console.log('\n== 1. Conversión a céntimos ==');
comprobar('enteros y decimales simples', () => {
    assert.equal(aCentimos(1400), 140000);
    assert.equal(aCentimos(38.78), 3878);
    assert.equal(aCentimos(0.1), 10);
    assert.equal(aCentimos('0'), 0);
    assert.equal(aCentimos(''), 0);
    assert.equal(aCentimos(null), 0);
});
comprobar('redondeo comercial del tercer decimal', () => {
    assert.equal(aCentimos(1.005), 101);   // el clásico que falla con Math.round(x*100)
    assert.equal(aCentimos(2.675), 268);   // 2.675 se almacena como 2.67499...; su texto corto es "2.675"
    assert.equal(aCentimos(0.615), 62);
    assert.equal(aCentimos(1.004), 100);
    assert.equal(aCentimos(-1.005), -101);
});
comprobar('formatos españoles e ingleses', () => {
    assert.equal(aCentimos('1.234,56'), 123456);
    assert.equal(aCentimos('1,234.56'), 123456);
    assert.equal(aCentimos('1234.56'), 123456);
    assert.equal(aCentimos('1234,56'), 123456);
    assert.equal(aCentimos('  1.234,56 € '), 123456);
    assert.equal(aCentimos('-45,50'), -4550);
});
comprobar('no arrastra error de coma flotante al sumar', () => {
    const suma = sumarCentimos([aCentimos(0.1), aCentimos(0.2)]);
    assert.equal(suma, 30);
    assert.equal(aEuros(suma), 0.3);
    // 100 sumas de 0,07 € deben dar exactamente 7,00 €
    let total = 0;
    for (let i = 0; i < 100; i++) total += aCentimos(0.07);
    assert.equal(total, 700);
    assert.equal(aEuros(total), 7);
});

console.log('\n== 2. Reparto sin perder céntimos ==');
comprobar('porcentajes que suman 100 reparten el total exacto', () => {
    for (const total of [140000, 100001, 99999, 333333, 1, 7, 123457]) {
        for (const pcts of [[18,7,7,3,35,30], [33,8,15,10,4,15,15], [50,30,20], [25,5,35,35]]) {
            const partes = repartirPorPorcentajes(total, pcts);
            assert.equal(sumarCentimos(partes), total, `total=${total} pcts=${pcts}`);
            assert.ok(partes.every(Number.isInteger));
        }
    }
});
comprobar('porcentajes parciales dan el objetivo redondeado', () => {
    assert.equal(sumarCentimos(repartirPorPorcentajes(100000, [30, 20])), 50000);
    assert.equal(sumarCentimos(repartirPorPorcentajes(33333, [10])), Math.round(33333 * 0.1));
});
comprobar('división en dos mitades exactas con impares', () => {
    for (const valor of [1, 3, 7, 26878, 100001, 0]) {
        const partes = dividirEnPartes(valor, 2);
        assert.equal(sumarCentimos(partes), valor, `valor=${valor}`);
        assert.equal(partes.length, 2);
    }
    assert.deepEqual(dividirEnPartes(1, 2), [1, 0]);
    assert.deepEqual(dividirEnPartes(-1, 2), [-1, 0]);
});
comprobar('reparto proporcional con pesos arbitrarios', () => {
    const partes = repartirProporcional(1000, [1, 1, 1]);
    assert.equal(sumarCentimos(partes), 1000);
    assert.deepEqual(partes, [334, 333, 333]);
});

console.log('\n== 3. Generación de presupuesto por perfil ==');
comprobar('cada perfil reparte el sueldo al céntimo exacto', () => {
    for (const idPerfil of Object.keys(PERFILES_PRESUPUESTO)) {
        for (const [cuenta, fisico] of [[1000, 400], [1333.33, 0], [0, 987.65], [2500.01, 149.99]]) {
            const g = new GestorFinanciero();
            g.reiniciarPresupuestoEnBlanco();
            g.generarPresupuestoBicanal(cuenta, fisico, idPerfil);
            const resumen = g.calcularResumenMes(1);
            assert.equal(resumen.ingresoCent, aCentimos(cuenta) + aCentimos(fisico));
            assert.equal(resumen.totalPresupuestadoCent, resumen.ingresoCent,
                `${idPerfil} ${cuenta}/${fisico}: presupuestado != ingreso`);
            assert.equal(resumen.balanceNetoCent, 0, `${idPerfil}: balance debe ser cero`);
            assert.equal(resumen.porcentajeAsignado, 100);
        }
    }
});
comprobar('los porcentajes de todos los perfiles suman 100', () => {
    for (const [id, perfil] of Object.entries(PERFILES_PRESUPUESTO)) {
        const suma = perfil.partidas.reduce((t, p) => t + p.porcentaje, 0);
        assert.equal(suma, 100, `${id} suma ${suma}`);
    }
});

console.log('\n== 4. Identidad contable del resumen mensual ==');
comprobar('ingreso = consumo + ahorro + inversión + balance', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    for (let mes = 1; mes <= 6; mes++) {
        const r = g.calcularResumenMes(mes);
        assert.equal(r.consumoCent + r.ahorroCent + r.inversionCent + r.balanceNetoCent, r.ingresoCent,
            `mes ${mes} descuadra`);
        assert.equal(r.cuentaCent + r.fisicoCent, r.totalPresupuestadoCent, `mes ${mes}: canales descuadran`);
        assert.equal(
            Object.values(r.desglosePorCategoriaCent).reduce((a, b) => a + b, 0),
            r.totalPresupuestadoCent, `mes ${mes}: categorías descuadran`);
    }
});
comprobar('el caso de ejemplo cuadra a cero en el mes 1', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    const r = g.calcularResumenMes(1);
    assert.equal(r.ingresoCent, 140000);
    assert.equal(r.balanceNetoCent, 0);
    assert.equal(norm(formatearEuros(r.ingresoCent)), '1400,00 €'); // es-ES no agrupa hasta 5 cifras
});
comprobar('las deudas desaparecen a partir del mes 2', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    assert.ok(g.calcularResumenMes(1).deudasCent > 0);
    assert.equal(g.calcularResumenMes(2).deudasCent, 0);
    assert.ok(g.calcularResumenMes(2).balanceNetoCent > 0);
});

console.log('\n== 5. Proyección multi-mes ==');
comprobar('el patrimonio acumulado cuadra con la suma de aportaciones', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    const proyeccion = g.calcularProyeccion(6);
    let ahorro = 0, inversion = 0;
    proyeccion.forEach(fila => {
        ahorro += fila.ahorroMesCent;
        inversion += fila.inversionMesCent;
        assert.equal(fila.ahorroAcumuladoCent, ahorro, `mes ${fila.mes} ahorro`);
        assert.equal(fila.inversionAcumuladaCent, inversion, `mes ${fila.mes} inversión`);
        assert.equal(fila.patrimonioTotalCent, ahorro + inversion, `mes ${fila.mes} patrimonio`);
        // El reparto del excedente no puede crear ni destruir céntimos
        const r = g.calcularResumenMes(fila.mes);
        const excedente = Math.max(0, r.balanceNetoCent);
        assert.equal(fila.ahorroMesCent + fila.inversionMesCent, r.ahorroCent + r.inversionCent + excedente,
            `mes ${fila.mes}: reparto del excedente descuadra`);
    });
});
comprobar('excedente impar se reparte sin perder el céntimo', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1000.01);
    g.ingresoFisicoCent = 0;
    g.agregarGasto({ concepto: 'Alquiler', importe: 500, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA });
    const r = g.calcularResumenMes(1);
    assert.equal(r.balanceNetoCent, 50001);
    const fila = g.calcularProyeccion(1)[0];
    assert.equal(fila.ahorroMesCent + fila.inversionMesCent, 50001);
});
comprobar('totales del horizonte coinciden con las filas', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    const proyeccion = g.calcularProyeccion(6);
    const totales = g.calcularTotalesProyeccion(proyeccion);
    assert.equal(totales.ingresosCent, proyeccion.reduce((t, f) => t + f.ingresoCent, 0));
    assert.equal(totales.patrimonioCent, totales.ahorroCent + totales.inversionCent);
});

console.log('\n== 6. Sobres digitales y transacciones ==');
comprobar('las transacciones solo afectan a su propio mes', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    g.mesVisualizado = 1;
    const sobresMes1 = g.obtenerSeguimientoSobres(1);
    const sobresMes2 = g.obtenerSeguimientoSobres(2);
    assert.equal(sobresMes1.VIVIENDA_COMIDA.gastadoCent, 4250);
    assert.equal(sobresMes2.VIVIENDA_COMIDA.gastadoCent, 0);
});
comprobar('disponible = presupuestado - gastado, exacto', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.generarPresupuestoBicanal(1000, 400, 'VIVIENDO_PADRES');
    g.mesVisualizado = 1;
    g.registrarTransaccion({ lugar: 'Mercadona', importe: 33.33, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO });
    g.registrarTransaccion({ lugar: 'Bar', importe: 12.12, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO });
    const sobre = g.obtenerSeguimientoSobres(1).VIVIENDA_COMIDA;
    assert.equal(sobre.gastadoCent, 4545);
    assert.equal(sobre.disponibleCent, sobre.limitePresupuestadoCent - 4545);
});
comprobar('sobregasto produce disponible negativo y estado correcto', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = 100000;
    g.agregarGasto({ concepto: 'Ocio', importe: 100, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO });
    g.registrarTransaccion({ lugar: 'Bar', importe: 150, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO });
    const sobre = g.obtenerSeguimientoSobres(1).OCIO_ESTILO_VIDA;
    assert.equal(sobre.disponibleCent, -5000);
    assert.equal(sobre.estadoSobre, 'sobregasto');
    assert.equal(sobre.salvadoParaAhorroCent, 0);
});

comprobar('el remanente de deudas y reservas no cuenta como ahorro', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = 100000;
    g.agregarGasto({ concepto: 'Deuda tarjeta', importe: 200, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA });
    g.agregarGasto({ concepto: 'Reserva IBI', importe: 100, categoria: 'PREVISION_RESERVAS', canal: CANALES_PAGO.CUENTA });
    g.agregarGasto({ concepto: 'Ocio', importe: 150, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO });

    const sobres = g.obtenerSeguimientoSobres(1);
    assert.equal(sobres.DEUDAS_OBLIGACIONES.disponibleCent, 20000);
    assert.equal(sobres.DEUDAS_OBLIGACIONES.salvadoParaAhorroCent, 0);
    assert.equal(sobres.PREVISION_RESERVAS.salvadoParaAhorroCent, 0);
    assert.equal(sobres.OCIO_ESTILO_VIDA.salvadoParaAhorroCent, 15000);
    assert.equal(g.calcularTotalSalvadoParaAhorroCent(1), 15000);

    g.registrarTransaccion({ lugar: 'Bar', importe: 40, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, mes: 1 });
    assert.equal(g.calcularTotalSalvadoParaAhorroCent(1), 11000);
});

console.log('\n== 7. Flujo de efectivo bicanal ==');
comprobar('retirada de cajero y saldo por canal exactos', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1000);
    g.ingresoFisicoCent = aCentimos(400);
    g.agregarGasto({ concepto: 'Compra', importe: 550, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO });
    g.agregarGasto({ concepto: 'Netflix', importe: 12.99, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA });
    const r = g.calcularResumenMes(1);
    assert.equal(r.fisicoCent, 55000);
    assert.equal(r.retiradaCajeroCent, 15000);
    assert.equal(r.saldoLibreCuentaCent, 100000 - 1299);
    assert.equal(r.saldoLibreFisicoCent, 40000 - 55000);
    assert.equal(r.analisisEfectivo.situacion, 'absorcion_completa');
    assert.equal(r.analisisEfectivo.aRetirarDelCajeroCent, 15000);
});
comprobar('excedente de efectivo detectado correctamente', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoFisicoCent = aCentimos(400);
    g.agregarGasto({ concepto: 'Ocio', importe: 50, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO });
    const r = g.calcularResumenMes(1);
    assert.equal(r.analisisEfectivo.situacion, 'excedente_efectivo');
    assert.equal(r.analisisEfectivo.sobranteEnManoCent, 35000);
});

console.log('\n== 8. Persistencia y migración de datos antiguos ==');
comprobar('carga un estado v2 con importes en euros', () => {
    const estadoAntiguo = {
        version: '2.0.0',
        ingresoCuenta: 1000, ingresoFisico: 400,
        ingresoMes1: 1400, ingresoMesSiguientes: 1600,
        perfilSeleccionado: 'VIVIENDO_PADRES', mesVisualizado: 1,
        gastos: [
            { id: 'g1', concepto: 'Aportación hogar', importe: 250.55, categoria: 'VIVIENDA_COMIDA', canal: 'Efectivo Físico', recurrente: true },
            { id: 'g2', concepto: 'Inversión a largo plazo', importe: 300, categoria: 'AHORRO_INVERSION', canal: 'Cuenta Bancaria', recurrente: true },
            { id: 'g3', concepto: 'Ahorro líquido', importe: 200, categoria: 'AHORRO_INVERSION', canal: 'Cuenta Bancaria', recurrente: true }
        ],
        transacciones: [{ id: 't1', fecha: '2026-09-02', lugar: 'Lidl', importe: 20.10, categoria: 'VIVIENDA_COMIDA', canal: 'Efectivo Físico' }]
    };
    almacen.set('presupuesto_personal_universal', JSON.stringify(estadoAntiguo));
    const g = new GestorFinanciero();
    assert.equal(g.ingresoCuentaCent, 100000);
    assert.equal(g.gastos[0].importeCent, 25055);
    assert.equal(g.gastos[1].subtipo, 'INVERSION');
    assert.equal(g.gastos[2].subtipo, 'AHORRO');
    assert.equal(g.transacciones[0].mes, 1);
    assert.equal(g.transacciones[0].importeCent, 2010);
    const r = g.calcularResumenMes(1);
    assert.equal(r.inversionCent, 30000);
    assert.equal(r.ahorroCent, 20000);
    almacen.clear();
});
comprobar('exportar e importar JSON conserva los importes al céntimo', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.generarPresupuestoBicanal(1333.33, 466.67, 'INDEPENDIENTE_ALQUILER');
    g.registrarTransaccion({ lugar: 'Mercadona', importe: 78.91, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO });
    const copia = g.exportarCopiaSeguridadJSON();

    const g2 = new GestorFinanciero();
    g2.reiniciarPresupuestoEnBlanco();
    const resultado = g2.importarCopiaSeguridadJSON(copia);
    assert.ok(resultado.exito);
    assert.equal(g2.ingresoCuentaCent, g.ingresoCuentaCent);
    assert.equal(g2.obtenerIngresoTotalCent(), 180000);
    assert.deepEqual(g2.gastos.map(x => x.importeCent), g.gastos.map(x => x.importeCent));
    assert.equal(g2.transacciones[0].importeCent, 7891);
    assert.equal(g2.calcularResumenMes(1).balanceNetoCent, 0);
});
comprobar('importar un JSON corrupto no rompe el estado', () => {
    const g = new GestorFinanciero();
    const resultado = g.importarCopiaSeguridadJSON('{ esto no es json');
    assert.equal(resultado.exito, false);
    assert.ok(resultado.mensaje.length > 0);
});

console.log('\n== 9. Formateo español ==');
comprobar('formato de moneda es-ES', () => {
    assert.equal(norm(formatearEuros(140000)), '1400,00 €');   // CLDR es-ES: sin punto de millar con 4 cifras
    assert.equal(norm(formatearEuros(1234567)), '12.345,67 €'); // a partir de 5 cifras sí agrupa
    assert.equal(norm(formatearEuros(0)), '0,00 €');
    assert.equal(norm(formatearEuros(-3878)), '-38,78 €');
    assert.equal(norm(formatearEuros(12345, { conSigno: true })), '+123,45 €');
    assert.equal(calcularPorcentaje(3300, 10000, 1), 33);
    assert.equal(calcularPorcentaje(3333, 10000, 1), 33.3);
});

console.log('\n== 10. Gestión integral de deudas ==');
comprobar('crear y calcular métricas de deuda pendiente', () => {
    const gestor = new GestorFinanciero();
    gestor.reiniciarPresupuestoEnBlanco();
    gestor.ingresoCuentaCent = aCentimos(1200);

    const deuda1 = gestor.agregarDeuda({
        concepto: 'Préstamo Coche',
        importeTotal: 2400,
        cuotaMensual: 200,
        canal: CANALES_PAGO.CUENTA
    });

    assert.equal(deuda1.importeTotalCent, 240000);
    assert.equal(deuda1.cuotaMensualCent, 20000);
    assert.equal(gestor.calcularTotalDeudaPendienteCent(), 240000);
    assert.equal(gestor.calcularCuotaMensualTotalDeudasCent(), 20000);
    assert.equal(gestor.calcularMesesRestantesDeuda(deuda1), 12);
    assert.equal(gestor.calcularMesesParaLibertadDeDeudas(), 12);

    // Debe existir la partida de gasto vinculada en el presupuesto
    const gastoVinculado = gestor.gastos.find(g => g.idDeuda === deuda1.id);
    assert.ok(gastoVinculado);
    assert.equal(gastoVinculado.importeCent, 20000);
    assert.equal(gastoVinculado.categoria, 'DEUDAS_OBLIGACIONES');
    assert.equal(gastoVinculado.mesFiniquito, 12);
});

comprobar('amortización extraordinaria reduce saldo y meses restantes', () => {
    const gestor = new GestorFinanciero();
    gestor.reiniciarPresupuestoEnBlanco();
    const deuda = gestor.agregarDeuda({
        concepto: 'Tarjeta Crédito',
        importeTotal: 1000,
        cuotaMensual: 100,
        canal: CANALES_PAGO.CUENTA
    });

    assert.equal(gestor.calcularMesesRestantesDeuda(deuda), 10);

    // Amortizar 400 €
    gestor.amortizarDeuda(deuda.id, aCentimos(400));
    assert.equal(deuda.importeTotalCent, 60000);
    assert.equal(deuda.totalAmortizadoCent, 40000);
    assert.equal(gestor.calcularMesesRestantesDeuda(deuda), 6);

    const gastoActualizado = gestor.gastos.find(g => g.idDeuda === deuda.id);
    assert.equal(gastoActualizado.mesFiniquito, 6);
});

comprobar('liquidación total de deuda la marca como pagada y retira la cuota', () => {
    const gestor = new GestorFinanciero();
    gestor.reiniciarPresupuestoEnBlanco();
    const deuda = gestor.agregarDeuda({
        concepto: 'Deuda Pequeña',
        importeTotal: 150,
        cuotaMensual: 50,
        canal: CANALES_PAGO.CUENTA
    });

    // Amortizar todo el saldo restante
    gestor.amortizarDeuda(deuda.id, aCentimos(150));
    assert.equal(deuda.importeTotalCent, 0);
    assert.equal(deuda.pagada, true);
    assert.equal(gestor.calcularTotalDeudaPendienteCent(), 0);

    // Ya no debe haber partida de gasto activa para esa deuda
    const gasto = gestor.gastos.find(g => g.idDeuda === deuda.id);
    assert.equal(gasto, undefined);
});

comprobar('deudas y horizonte configurable en proyección y persistencia JSON', () => {
    const gestor = new GestorFinanciero();
    gestor.reiniciarPresupuestoEnBlanco();
    gestor.ingresoCuentaCent = aCentimos(1000);
    gestor.establecerHorizonteMeses(12);
    assert.equal(gestor.horizonteMeses, 12);

    gestor.agregarDeuda({
        concepto: 'Financiación Portátil',
        importeTotal: 300,
        cuotaMensual: 100,
        canal: CANALES_PAGO.CUENTA
    });

    const proyeccion = gestor.calcularProyeccion(12);
    assert.equal(proyeccion.length, 12);
    // En los meses 1, 2 y 3 hay cuota de deuda de 100 €
    assert.equal(proyeccion[0].deudasCent, 10000);
    assert.equal(proyeccion[1].deudasCent, 10000);
    assert.equal(proyeccion[2].deudasCent, 10000);
    // En el mes 4 la deuda ya está liquidada y deudasCent es 0
    assert.equal(proyeccion[3].deudasCent, 0);

    // Persistencia en JSON
    const jsonExportado = gestor.exportarCopiaSeguridadJSON();
    const gestorRestaurado = new GestorFinanciero();
    gestorRestaurado.reiniciarPresupuestoEnBlanco();
    const resultado = gestorRestaurado.importarCopiaSeguridadJSON(jsonExportado);
    assert.ok(resultado.exito);
    assert.equal(gestorRestaurado.deudas.length, 1);
    assert.equal(gestorRestaurado.deudas[0].concepto, 'Financiación Portátil');
    assert.equal(gestorRestaurado.deudas[0].importeTotalCent, 30000);
    assert.equal(gestorRestaurado.horizonteMeses, 12);
});

comprobar('exportación a Excel incluye hoja de deudas con datos estructurados', () => {
    globalThis.XLSX = {
        utils: {
            aoa_to_sheet: (datos) => ({ '!datos': datos }),
            encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`
        }
    };

    const gestor = new GestorFinanciero();
    gestor.reiniciarPresupuestoEnBlanco();
    gestor.ingresoCuentaCent = 200000;
    gestor.agregarDeuda({ concepto: 'Prestamo coche', importeTotal: 6000, cuotaMensual: 300, canal: CANALES_PAGO.CUENTA });

    const exportador = new ExportadorExcel(gestor);
    const hojaDeudas = exportador.construirHojaDeudas();
    assert.ok(hojaDeudas && hojaDeudas['!datos']);

    const filas = hojaDeudas['!datos'];
    const cabecera = filas.find(f => Array.isArray(f) && f[0] === 'Acreedor / Concepto');
    assert.ok(cabecera, 'falta la fila de cabecera');

    const filaDeuda = filas[filas.indexOf(cabecera) + 1];
    // Los campos deben coincidir con el modelo real: nada de columnas vacias
    assert.equal(filaDeuda[0], 'Prestamo coche');
    assert.equal(filaDeuda[1], 6000);              // saldo pendiente, en euros
    assert.equal(filaDeuda[2], 300);               // cuota mensual
    assert.equal(filaDeuda[3], '15 %');            // parte del sueldo
    assert.equal(filaDeuda[5], 20);                // meses restantes
    assert.equal(filaDeuda[6], 'Activa');
    filaDeuda.forEach((celda, indice) => {
        assert.ok(celda !== undefined && celda !== null, `columna ${indice} sin valor`);
    });
});

comprobar('amortizar interpreta siempre centimos, tambien importes pequenos', () => {
    // La interfaz envía céntimos: 5 € deben descontar 5 €, nunca 500 €
    for (const euros of [1, 5, 10, 10.5, 15, 999, 1000, 1500]) {
        const g = new GestorFinanciero();
        g.reiniciarPresupuestoEnBlanco();
        g.agregarDeuda({ concepto: 'Prueba', importeTotal: 6000, cuotaMensual: 300, canal: CANALES_PAGO.CUENTA });
        g.amortizarDeuda(g.deudas[0].id, aCentimos(euros));
        assert.equal(g.deudas[0].totalAmortizadoCent, aCentimos(euros), `amortizando ${euros} €`);
        assert.equal(g.deudas[0].importeTotalCent, aCentimos(6000) - aCentimos(euros), `saldo tras amortizar ${euros} €`);
    }
});

console.log('\n== 11. Parte del sueldo que se va en deudas ==');

comprobar('el porcentaje sobre el sueldo es exacto', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1500);
    g.ingresoFisicoCent = aCentimos(500);          // 2.000,00 € netos
    g.agregarGasto({ concepto: 'Prestamo coche', importe: 300, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA });
    g.agregarGasto({ concepto: 'Tarjeta', importe: 200, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA });
    g.agregarGasto({ concepto: 'Compra', importe: 400, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO });

    const carga = g.calcularCargaDeuda(1);
    assert.equal(carga.cuotaDeudaCent, 50000);
    assert.equal(carga.porcentaje, 25);                    // 500 de 2000
    assert.equal(carga.ingresoLibreCent, 150000);
    assert.equal(carga.euroPorCada100Cent, 2500);          // 25,00 € de cada 100 €
    assert.equal(carga.nivel, 'razonable');
    assert.equal(carga.superaReferencia, false);
    assert.equal(carga.cuotaMaximaRecomendadaCent, 70000); // 35 % de 2.000 €
    assert.equal(carga.margenHastaReferenciaCent, 20000);
    assert.equal(carga.excesoSobreReferenciaCent, 0);
});

comprobar('el resumen mensual expone la misma cifra que el calculo directo', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.cargarCasoEjemplo();
    for (let mes = 1; mes <= 6; mes++) {
        const r = g.calcularResumenMes(mes);
        const carga = g.calcularCargaDeuda(mes);
        assert.equal(r.cargaDeuda.cuotaDeudaCent, r.deudasCent, `mes ${mes}: la carga no coincide con las deudas del resumen`);
        assert.equal(r.cargaDeuda.porcentaje, carga.porcentaje, `mes ${mes}: porcentaje distinto`);
        assert.equal(r.porcentajeDeudaSobreIngreso, carga.porcentaje, `mes ${mes}: campo del resumen distinto`);
        // La parte de deuda mas lo que queda libre reconstruye el ingreso
        assert.equal(carga.cuotaDeudaCent + carga.ingresoLibreCent, r.ingresoCent, `mes ${mes}: no cuadra con el ingreso`);
    }
});

comprobar('los tramos se asignan en los limites exactos', () => {
    const g = new GestorFinanciero();
    const casos = [
        [0, 'sin_deuda'],
        [10, 'holgado'],
        [15, 'holgado'],
        [15.1, 'razonable'],
        [30, 'razonable'],
        [30.1, 'ajustado'],
        [35, 'ajustado'],
        [35.1, 'elevado'],
        [80, 'elevado']
    ];
    for (const [porcentaje, nivelEsperado] of casos) {
        g.reiniciarPresupuestoEnBlanco();
        g.ingresoCuentaCent = 100000;                       // 1.000,00 €
        if (porcentaje > 0) {
            g.agregarGasto({
                concepto: 'Cuota', importe: porcentaje * 10,
                categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA
            });
        }
        const carga = g.calcularCargaDeuda(1);
        assert.equal(carga.porcentaje, porcentaje, `porcentaje calculado para ${porcentaje}`);
        assert.equal(carga.nivel, nivelEsperado, `tramo para ${porcentaje} %`);
    }
});

comprobar('superar la referencia calcula el exceso exacto', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1200);
    g.agregarGasto({ concepto: 'Prestamo', importe: 600, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA });

    const carga = g.calcularCargaDeuda(1);
    assert.equal(carga.porcentaje, 50);
    assert.equal(carga.nivel, 'elevado');
    assert.equal(carga.superaReferencia, true);
    assert.equal(carga.cuotaMaximaRecomendadaCent, 42000);  // 35 % de 1.200 €
    assert.equal(carga.excesoSobreReferenciaCent, 18000);   // 600 - 420
    assert.equal(carga.margenHastaReferenciaCent, 0);
});

comprobar('sin ingresos no se inventa un porcentaje', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.agregarGasto({ concepto: 'Deuda', importe: 100, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA });
    const carga = g.calcularCargaDeuda(1);
    assert.equal(carga.ingresoCent, 0);
    assert.equal(carga.porcentaje, 0);
    assert.equal(carga.euroPorCada100Cent, 0);
    assert.equal(carga.cuotaMaximaRecomendadaCent, 0);
});

comprobar('la carga baja sola al liquidarse las deudas', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1000);
    g.agregarDeuda({ concepto: 'Prestamo corto', importeTotal: 600, cuotaMensual: 300, canal: CANALES_PAGO.CUENTA });

    assert.equal(g.calcularCargaDeuda(1).porcentaje, 30);
    assert.equal(g.calcularCargaDeuda(2).porcentaje, 30);
    assert.equal(g.calcularCargaDeuda(3).porcentaje, 0);   // liquidada tras dos cuotas
    assert.equal(g.calcularCargaDeuda(3).nivel, 'sin_deuda');
});

comprobar('el mes de alivio senala cuando se baja de la referencia', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1000);
    // 500 €/mes durante 2 meses: 50 % del sueldo, por encima del 35 %
    g.agregarDeuda({ concepto: 'Deuda fuerte', importeTotal: 1000, cuotaMensual: 500, canal: CANALES_PAGO.CUENTA });

    assert.equal(g.calcularCargaDeuda(1).superaReferencia, true);
    assert.equal(g.calcularMesAlivioCargaDeuda(1, 6), 3);

    // Si no supera la referencia, no hay nada que anunciar
    g.reiniciarPresupuestoEnBlanco();
    g.ingresoCuentaCent = aCentimos(1000);
    g.agregarDeuda({ concepto: 'Deuda pequena', importeTotal: 200, cuotaMensual: 100, canal: CANALES_PAGO.CUENTA });
    assert.equal(g.calcularMesAlivioCargaDeuda(1, 6), null);
});

console.log('\n== 12. Duracion de las deudas en dias, meses y anios ==');

comprobar('conversion de dias, meses y anios a meses completos', () => {
    const g = new GestorFinanciero();
    // Anios: multiplicacion exacta
    assert.equal(g.convertirPlazoAMeses(1, 'ANIOS'), 12);
    assert.equal(g.convertirPlazoAMeses(2, 'ANIOS'), 24);
    assert.equal(g.convertirPlazoAMeses('1,5', 'ANIOS'), 18);
    // Meses: se toman tal cual
    assert.equal(g.convertirPlazoAMeses(18, 'MESES'), 18);
    assert.equal(g.convertirPlazoAMeses('7', 'MESES'), 7);
    // Dias: se redondean al alza porque una deuda de 40 dias ocupa 2 cuotas
    assert.equal(g.convertirPlazoAMeses(30, 'DIAS'), 1);
    assert.equal(g.convertirPlazoAMeses(31, 'DIAS'), 2);
    assert.equal(g.convertirPlazoAMeses(40, 'DIAS'), 2);
    assert.equal(g.convertirPlazoAMeses(365, 'DIAS'), 12);   // un anio natural
    assert.equal(g.convertirPlazoAMeses(730, 'DIAS'), 24);   // dos anios naturales
    // Valores invalidos no producen plazos absurdos
    assert.equal(g.convertirPlazoAMeses(0, 'MESES'), 0);
    assert.equal(g.convertirPlazoAMeses(-5, 'MESES'), 0);
    assert.equal(g.convertirPlazoAMeses('abc', 'MESES'), 0);
    assert.equal(g.convertirPlazoAMeses(0.4, 'MESES'), 1);   // nunca menos de un mes
});

comprobar('la cuota derivada del plazo liquida la deuda sin dejar resto', () => {
    const g = new GestorFinanciero();
    for (const [totalEuros, valor, unidad] of [
        [6000, 12, 'MESES'], [6000, 1, 'ANIOS'], [5000, 7, 'MESES'],
        [1234.56, 18, 'MESES'], [999.99, 2, 'ANIOS'], [300, 90, 'DIAS']
    ]) {
        const totalCent = aCentimos(totalEuros);
        const plan = g.planificarDeudaPorPlazo(totalCent, valor, unidad);

        // Con mesesReales cuotas se cubre exactamente el total, ni mas ni menos
        const pagadoAntesDeLaUltima = plan.cuotaMensualCent * (plan.mesesReales - 1);
        assert.ok(pagadoAntesDeLaUltima < totalCent, `${totalEuros} en ${valor} ${unidad}: sobra una cuota`);
        assert.equal(pagadoAntesDeLaUltima + plan.ultimaCuotaCent, totalCent,
            `${totalEuros} en ${valor} ${unidad}: las cuotas no suman el total`);
        assert.ok(plan.ultimaCuotaCent > 0 && plan.ultimaCuotaCent <= plan.cuotaMensualCent,
            `${totalEuros} en ${valor} ${unidad}: ultima cuota fuera de rango`);
    }
});

comprobar('el plazo pedido se respeta y el motor coincide con el plan', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.agregarDeuda({
        concepto: 'Prestamo a 2 anios',
        importeTotal: 6000,
        modoDefinicion: 'PLAZO',
        plazo: { valor: 2, unidad: 'ANIOS' },
        canal: CANALES_PAGO.CUENTA
    });

    const deuda = g.deudas[0];
    assert.equal(deuda.modoDefinicion, 'PLAZO');
    assert.deepEqual(deuda.plazo, { valor: 2, unidad: 'ANIOS' });
    assert.equal(deuda.cuotaMensualCent, 25000);                    // 6000 / 24
    assert.equal(g.calcularMesesRestantesDeuda(deuda), 24);
    // La partida del presupuesto se sincroniza con el plazo
    const partida = g.gastos.find(x => x.idDeuda === deuda.id);
    assert.equal(partida.importeCent, 25000);
    assert.equal(partida.mesFiniquito, 24);
});

comprobar('cambiar el total recalcula la cuota si se definio por plazo', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.agregarDeuda({
        concepto: 'Financiacion', importeTotal: 1200, modoDefinicion: 'PLAZO',
        plazo: { valor: 12, unidad: 'MESES' }, canal: CANALES_PAGO.CUENTA
    });
    assert.equal(g.deudas[0].cuotaMensualCent, 10000);   // 1200 / 12

    g.actualizarDeuda(g.deudas[0].id, { importeTotalCent: aCentimos(2400) });
    assert.equal(g.deudas[0].cuotaMensualCent, 20000);   // 2400 / 12, mismo plazo
    assert.equal(g.calcularMesesRestantesDeuda(g.deudas[0]), 12);
});

comprobar('amortizar acorta el plazo en vez de rebajar la cuota', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.agregarDeuda({
        concepto: 'Prestamo', importeTotal: 1200, modoDefinicion: 'PLAZO',
        plazo: { valor: 12, unidad: 'MESES' }, canal: CANALES_PAGO.CUENTA
    });
    assert.equal(g.calcularMesesRestantesDeuda(g.deudas[0]), 12);

    g.amortizarDeuda(g.deudas[0].id, aCentimos(600));
    assert.equal(g.deudas[0].cuotaMensualCent, 10000, 'la cuota no debe cambiar');
    assert.equal(g.calcularMesesRestantesDeuda(g.deudas[0]), 6, 'el plazo debe acortarse');
    // Una edicion posterior no debe deshacer la amortizacion recalculando la cuota
    g.actualizarDeuda(g.deudas[0].id, { notas: 'revisada' });
    assert.equal(g.calcularMesesRestantesDeuda(g.deudas[0]), 6);
});

comprobar('un plazo imposible informa de la duracion real', () => {
    const g = new GestorFinanciero();
    // 7 centimos no pueden repartirse en 5 cuotas mensuales constantes
    const plan = g.planificarDeudaPorPlazo(7, 5, 'MESES');
    assert.equal(plan.mesesSolicitados, 5);
    assert.equal(plan.cuotaMensualCent, 2);
    assert.equal(plan.mesesReales, 4);
    assert.equal(plan.coincide, false);
    // Aun asi las cuotas siguen sumando exactamente el total
    assert.equal(plan.cuotaMensualCent * (plan.mesesReales - 1) + plan.ultimaCuotaCent, 7);
});

comprobar('el plazo se describe en lenguaje natural', () => {
    const g = new GestorFinanciero();
    assert.equal(g.describirPlazoEnMeses(1), '1 mes');
    assert.equal(g.describirPlazoEnMeses(7), '7 meses');
    assert.equal(g.describirPlazoEnMeses(12), '1 año');
    assert.equal(g.describirPlazoEnMeses(18), '1 año y 6 meses');
    assert.equal(g.describirPlazoEnMeses(24), '2 años');
    assert.equal(g.describirPlazoEnMeses(25), '2 años y 1 mes');
    assert.equal(g.describirPlazoEnMeses(0), 'Sin plazo');
});

comprobar('el plazo sobrevive a guardar y restaurar la copia JSON', () => {
    const g = new GestorFinanciero();
    g.reiniciarPresupuestoEnBlanco();
    g.agregarDeuda({
        concepto: 'Hipoteca', importeTotal: 60000, modoDefinicion: 'PLAZO',
        plazo: { valor: 5, unidad: 'ANIOS' }, canal: CANALES_PAGO.CUENTA
    });
    const copia = g.exportarCopiaSeguridadJSON();

    const g2 = new GestorFinanciero();
    g2.reiniciarPresupuestoEnBlanco();
    assert.ok(g2.importarCopiaSeguridadJSON(copia).exito);
    assert.equal(g2.deudas[0].modoDefinicion, 'PLAZO');
    assert.deepEqual(g2.deudas[0].plazo, { valor: 5, unidad: 'ANIOS' });
    assert.equal(g2.deudas[0].cuotaMensualCent, g.deudas[0].cuotaMensualCent);
    assert.equal(g2.calcularMesesRestantesDeuda(g2.deudas[0]), 60);
});

console.log(`\n${pruebas} bloques de prueba ejecutados.`);
