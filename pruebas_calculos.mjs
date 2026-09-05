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

console.log(`\n${pruebas} bloques de prueba ejecutados.`);
