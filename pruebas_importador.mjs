import assert from 'node:assert/strict';

import {
    CANAL_BANCO_IMPORTADO,
    LIMITES_IMPORTACION_MOVIMIENTOS,
    analizarImporteMonetario,
    crearHuellaMovimiento,
    detectarSeparadorCSV,
    importarMovimientosCSV,
    normalizarFechaMovimiento,
    parsearCSV,
    parsearImporteMovimiento,
    sugerirCategoriaMovimiento
} from './importador_movimientos.js';

let bloquesEjecutados = 0;

function comprobar(nombre, prueba) {
    prueba();
    bloquesEjecutados += 1;
    console.log(`  OK  ${nombre}`);
}

console.log('\n== Importador local de movimientos bancarios ==');

comprobar('CSV español con BOM, CRLF, punto y coma y comillas RFC4180', () => {
    const csv = [
        '\uFEFFFecha;Concepto;Importe',
        '"01/09/2026";"SUPERMERCADO ""DIA""; CENTRO";"-1.234,56 €"',
        '02/09/2026;Nómina;"2.000,00"'
    ].join('\r\n');

    assert.equal(detectarSeparadorCSV(csv), ';');
    const resultado = importarMovimientosCSV(csv, { nombreArchivo: 'banco.csv' });
    assert.equal(resultado.exito, true);
    assert.equal(resultado.movimientos.length, 1);
    assert.equal(resultado.movimientos[0].fecha, '2026-09-01');
    assert.equal(resultado.movimientos[0].concepto, 'SUPERMERCADO "DIA"; CENTRO');
    assert.equal(resultado.movimientos[0].importeCent, 123456);
    assert.equal(resultado.movimientos[0].canal, CANAL_BANCO_IMPORTADO);
    assert.equal(resultado.movimientos[0].categoriaSugerida, 'VIVIENDA_COMIDA');
    assert.equal(resultado.diagnostico.ingresosIgnorados, 1);
    assert.equal(resultado.diagnostico.procesamientoLocal, true);
});

comprobar('CSV inglés separado por coma y concepto con coma', () => {
    const csv = [
        'Date,Description,Amount',
        '2026-09-03,"Coffee, shop",-12.34',
        '2026-09-04,Refund,5.00'
    ].join('\n');
    const resultado = importarMovimientosCSV(csv);

    assert.equal(resultado.diagnostico.separador, ',');
    assert.equal(resultado.diagnostico.filasValidas, 1);
    assert.equal(resultado.movimientos[0].importeCent, 1234);
    assert.equal(resultado.movimientos[0].concepto, 'Coffee, shop');
    assert.equal(resultado.diagnostico.ingresosIgnorados, 1);
});

comprobar('columna Debit positiva y columna Credit se interpretan correctamente', () => {
    const csv = [
        'Booking Date\tDescription\tDebit\tCredit',
        '05/09/2026\tNetflix\t15,99\t',
        '06/09/2026\tSalary\t\t1500,00'
    ].join('\r\n');
    const resultado = importarMovimientosCSV(csv);

    assert.equal(resultado.diagnostico.separador, '\t');
    assert.equal(resultado.movimientos.length, 1);
    assert.equal(resultado.movimientos[0].importeCent, 1599);
    assert.equal(resultado.movimientos[0].categoriaSugerida, 'DIGITAL_SUSCRIPCIONES');
    assert.equal(resultado.diagnostico.ingresosIgnorados, 1);
});

comprobar('los importes positivos genericos requieren una opción explícita', () => {
    const csv = 'Fecha;Concepto;Importe\n07/09/2026;Compra tarjeta;24,50';
    const seguro = importarMovimientosCSV(csv);
    const positivoEsGasto = importarMovimientosCSV(csv, { importesPositivosSonGastos: true });

    assert.equal(seguro.movimientos.length, 0);
    assert.equal(seguro.diagnostico.ingresosIgnorados, 1);
    assert.equal(positivoEsGasto.movimientos.length, 1);
    assert.equal(positivoEsGasto.movimientos[0].importeCent, 2450);
});

comprobar('fechas DD/MM/AAAA y AAAA-MM-DD se validan contra el calendario', () => {
    assert.equal(normalizarFechaMovimiento('29/02/2024'), '2024-02-29');
    assert.equal(normalizarFechaMovimiento('2026-12-31'), '2026-12-31');
    assert.equal(normalizarFechaMovimiento('29/02/2023'), null);
    assert.equal(normalizarFechaMovimiento('31/04/2026'), null);
    assert.equal(normalizarFechaMovimiento('1/9/2026'), null);
    assert.equal(normalizarFechaMovimiento('2026-02-29'), null);
});

comprobar('importes españoles, ingleses, negativos y entre paréntesis', () => {
    assert.equal(parsearImporteMovimiento('1.234,56 EUR'), 123456);
    assert.equal(parsearImporteMovimiento('-1,234.56'), -123456);
    assert.equal(parsearImporteMovimiento('(45,90 €)'), -4590);
    assert.equal(parsearImporteMovimiento('12,3'), 1230);
    assert.equal(parsearImporteMovimiento('1.234'), 123400);
    assert.equal(parsearImporteMovimiento('12'), 1200);
    assert.equal(parsearImporteMovimiento('1,23,4'), null);
    assert.equal(parsearImporteMovimiento('12.3456'), null);
    assert.equal(analizarImporteMonetario('$10.00').valido, false);
});

comprobar('parser admite comillas escapadas y saltos de línea internos', () => {
    const csv = 'Date,Description,Amount\r\n2026-09-01,"Cafe ""Central""\nMadrid",-10.00';
    const parseado = parsearCSV(csv);
    assert.equal(parseado.registros.length, 2);
    assert.equal(parseado.registros[1].numeroFila, 2);
    assert.equal(parseado.registros[1].campos[1], 'Cafe "Central"\nMadrid');
});

comprobar('cabeceras no reconocidas producen un error fatal comprensible', () => {
    const resultado = importarMovimientosCSV('A;B;C\n1;2;3');
    assert.equal(resultado.exito, false);
    assert.equal(resultado.movimientos.length, 0);
    assert.equal(resultado.diagnostico.errores[0].codigo, 'CABECERAS_NO_RECONOCIDAS');
    assert.match(resultado.diagnostico.errores[0].mensaje, /fecha\/date/);
});

comprobar('diagnóstico separa filas válidas, ingresos y errores de fila', () => {
    const csv = [
        'Fecha;Concepto;Importe',
        '01/09/2026;Compra válida;-10,00',
        '31/02/2026;Fecha imposible;-4,00',
        '02/09/2026;;-3,00',
        '03/09/2026;Importe malo;doce',
        '04/09/2026;Importe cero;0,00',
        '05/09/2026;Ingreso;100,00',
        '06/09/2026;Columnas;de;más'
    ].join('\n');
    const resultado = importarMovimientosCSV(csv);

    assert.equal(resultado.exito, true);
    assert.equal(resultado.diagnostico.totalFilasDatos, 7);
    assert.equal(resultado.diagnostico.filasValidas, 1);
    assert.equal(resultado.diagnostico.ingresosIgnorados, 1);
    assert.equal(resultado.diagnostico.filasConError, 5);
    assert.deepEqual(
        resultado.diagnostico.errores.map(error => error.codigo),
        ['FECHA_INVALIDA', 'CONCEPTO_VACIO', 'IMPORTE_INVALIDO', 'IMPORTE_CERO', 'COLUMNAS_INCONSISTENTES']
    );
});

comprobar('busca cabeceras tras metadatos iniciales', () => {
    const csv = [
        'Extracto bancario;;',
        'Generado el 06/09/2026;;',
        'F. operación;Descripción;Importe EUR',
        '06/09/2026;Mercadona;-35,20'
    ].join('\n');
    const resultado = importarMovimientosCSV(csv);

    assert.equal(resultado.exito, true);
    assert.equal(resultado.diagnostico.filaCabecera, 3);
    assert.equal(resultado.diagnostico.filasPreviasCabeceraIgnoradas, 2);
    assert.equal(resultado.movimientos[0].importeCent, 3520);
});

comprobar('huella estable, sensible a datos y apta para deduplicar', () => {
    const base = {
        fecha: '2026-09-01',
        concepto: 'Café Central',
        importeCent: 1090,
        referencia: 'ABC-1'
    };
    const huella = crearHuellaMovimiento(base);
    assert.equal(huella, crearHuellaMovimiento({ ...base, concepto: '  cafe   central ' }));
    assert.notEqual(huella, crearHuellaMovimiento({ ...base, importeCent: 1091 }));

    const csv = 'Fecha;Concepto;Importe;Referencia\n01/09/2026;Café Central;-10,90;ABC-1';
    const primera = importarMovimientosCSV(csv);
    const segunda = importarMovimientosCSV(csv, {
        huellasExistentes: new Set([primera.movimientos[0].huella])
    });
    assert.equal(segunda.movimientos.length, 0);
    assert.equal(segunda.diagnostico.duplicadosIgnorados, 1);
});

comprobar('dos cargos idénticos de un mismo CSV conservan huellas distintas y estables', () => {
    const csv = [
        'Fecha;Concepto;Importe',
        '01/09/2026;Peaje;-2,50',
        '01/09/2026;Peaje;-2,50'
    ].join('\n');
    const uno = importarMovimientosCSV(csv);
    const dos = importarMovimientosCSV(csv);

    assert.equal(uno.movimientos.length, 2);
    assert.notEqual(uno.movimientos[0].huella, uno.movimientos[1].huella);
    assert.deepEqual(uno.movimientos.map(m => m.huella), dos.movimientos.map(m => m.huella));
});

comprobar('categorización conservadora deja sin clasificar lo dudoso', () => {
    assert.equal(sugerirCategoriaMovimiento('Cuota préstamo coche').categoria, 'DEUDAS_OBLIGACIONES');
    assert.equal(sugerirCategoriaMovimiento('Mercadona 0234').categoria, 'VIVIENDA_COMIDA');
    assert.equal(sugerirCategoriaMovimiento('TRANSFERENCIA 839201').categoria, null);
});

comprobar('límites de bytes y filas no se pueden ampliar por opciones', () => {
    const grande = importarMovimientosCSV(
        'Fecha;Concepto;Importe\n01/09/2026;Compra;-1,00',
        { tamanoMaximoBytes: 20 }
    );
    assert.equal(grande.exito, false);
    assert.equal(grande.diagnostico.errores[0].codigo, 'ARCHIVO_DEMASIADO_GRANDE');

    const demasiadas = importarMovimientosCSV([
        'Fecha;Concepto;Importe',
        '01/09/2026;Uno;-1,00',
        '02/09/2026;Dos;-2,00'
    ].join('\n'), { filasMaximas: 1 });
    assert.equal(demasiadas.exito, false);
    assert.equal(demasiadas.diagnostico.errores[0].codigo, 'DEMASIADAS_FILAS');

    assert.equal(LIMITES_IMPORTACION_MOVIMIENTOS.TAMANO_MAXIMO_BYTES, 5 * 1024 * 1024);
    assert.equal(LIMITES_IMPORTACION_MOVIMIENTOS.FILAS_MAXIMAS, 20000);
});

console.log(`\n${bloquesEjecutados} bloques de prueba del importador ejecutados.\n`);
