/* ==========================================================================
   ARITMÉTICA MONETARIA EXACTA
   Todo el dinero de la aplicación se representa internamente como un número
   ENTERO de céntimos. Nunca se suman, restan ni acumulan euros en coma
   flotante, de modo que jamás aparecen errores del tipo 0.1 + 0.2 = 0.30000000004
   ni descuadres de un céntimo en los totales.
   ========================================================================== */

const FORMATEADOR_EUROS = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const FORMATEADOR_EUROS_COMPACTO = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

const FORMATEADOR_DECIMAL = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

/**
 * Convierte un número de JavaScript a su representación decimal en texto
 * evitando la notación científica (1e-7) que rompería el parseo posterior.
 */
function numeroATextoDecimal(numero) {
    const texto = String(numero);
    if (!/[eE]/.test(texto)) return texto;
    // toFixed(20) cubre con holgura cualquier importe monetario razonable
    return numero.toFixed(20);
}

/**
 * Convierte una cadena decimal estricta ("-1234.567") a céntimos enteros,
 * redondeando el tercer decimal al alza en valor absoluto (redondeo comercial).
 */
function textoDecimalACentimos(texto) {
    const coincidencia = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(texto);
    if (!coincidencia) return 0;

    const signo = coincidencia[1] === '-' ? -1 : 1;
    const parteEntera = coincidencia[2] || '0';
    const parteDecimal = coincidencia[3] || '';

    const dosPrimerosDecimales = (parteDecimal + '00').slice(0, 2);
    const decimalesSobrantes = parteDecimal.slice(2);

    let centimos = (Number(parteEntera) * 100) + Number(dosPrimerosDecimales);
    if (decimalesSobrantes.length > 0 && Number(decimalesSobrantes[0]) >= 5) {
        centimos += 1;
    }

    return signo * centimos;
}

/**
 * Punto de entrada universal: acepta números, cadenas españolas ("1.234,56 €"),
 * cadenas inglesas ("1234.56") o valores vacíos y devuelve céntimos enteros.
 */
export function aCentimos(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') {
        if (!Number.isFinite(valor)) return 0;
        return textoDecimalACentimos(numeroATextoDecimal(valor));
    }

    let texto = String(valor).trim();
    if (!texto) return 0;

    // Limpieza de símbolos, espacios normales y espacios duros del formato español
    texto = texto.replace(/[\s €]/g, '');

    const posicionComa = texto.lastIndexOf(',');
    const posicionPunto = texto.lastIndexOf('.');

    if (posicionComa !== -1 && posicionPunto !== -1) {
        // Conviven ambos: el último separador que aparece es el decimal real
        if (posicionComa > posicionPunto) {
            texto = texto.replace(/\./g, '').replace(',', '.');
        } else {
            texto = texto.replace(/,/g, '');
        }
    } else if (posicionComa !== -1) {
        texto = texto.replace(',', '.');
    }

    const numero = Number(texto);
    if (!Number.isFinite(numero)) return 0;
    return textoDecimalACentimos(texto);
}

/** Convierte céntimos enteros a euros con dos decimales exactos (para Excel/JSON). */
export function aEuros(centimos) {
    return Math.round(centimos) / 100;
}

/** Redondea un valor decimal en euros a céntimos enteros (medio al alza). */
export function redondearACentimos(valorEnEuros) {
    return aCentimos(valorEnEuros);
}

/** Suma una lista de céntimos de forma exacta. */
export function sumarCentimos(listaCentimos) {
    let total = 0;
    for (const valor of listaCentimos) total += Math.round(valor || 0);
    return total;
}

/** Suma el campo indicado (en céntimos) de una colección de objetos. */
export function sumarCampo(coleccion, nombreCampo) {
    let total = 0;
    for (const elemento of coleccion) total += Math.round(elemento[nombreCampo] || 0);
    return total;
}

/**
 * Reparte un importe entre varios pesos con el método del resto mayor.
 * Garantiza que la suma de las partes es EXACTAMENTE el importe original:
 * los céntimos sobrantes se asignan a las fracciones más altas.
 */
export function repartirProporcional(totalCentimos, pesos) {
    const total = Math.round(totalCentimos);
    if (!Array.isArray(pesos) || pesos.length === 0) return [];

    if (total < 0) {
        // "0 - parte" en lugar de "-parte" para no generar -0 en las partes nulas
        return repartirProporcional(-total, pesos).map(parte => 0 - parte);
    }

    const sumaPesos = pesos.reduce((acumulado, peso) => acumulado + Math.max(0, peso || 0), 0);
    if (sumaPesos <= 0 || total === 0) return pesos.map(() => 0);

    const valoresExactos = pesos.map(peso => (total * Math.max(0, peso || 0)) / sumaPesos);
    const partes = valoresExactos.map(valor => Math.floor(valor));

    let centimosRepartidos = partes.reduce((acumulado, parte) => acumulado + parte, 0);
    let centimosPendientes = total - centimosRepartidos;

    const ordenPorFraccion = valoresExactos
        .map((valor, indice) => ({ indice, fraccion: valor - Math.floor(valor) }))
        .sort((a, b) => (b.fraccion - a.fraccion) || (a.indice - b.indice));

    let posicion = 0;
    while (centimosPendientes > 0 && ordenPorFraccion.length > 0) {
        partes[ordenPorFraccion[posicion % ordenPorFraccion.length].indice] += 1;
        centimosPendientes -= 1;
        posicion += 1;
    }

    return partes;
}

/**
 * Reparte un importe según una lista de porcentajes.
 * Si los porcentajes suman 100, el resultado suma exactamente el total.
 * Si suman menos (o más), el objetivo se calcula y se reparte sin perder céntimos.
 */
export function repartirPorPorcentajes(totalCentimos, porcentajes) {
    const sumaPorcentajes = porcentajes.reduce((acumulado, pct) => acumulado + (pct || 0), 0);
    if (sumaPorcentajes <= 0) return porcentajes.map(() => 0);

    const objetivo = Math.round((Math.round(totalCentimos) * sumaPorcentajes) / 100);
    return repartirProporcional(objetivo, porcentajes);
}

/** Divide un importe en N partes iguales sin perder ni inventar céntimos. */
export function dividirEnPartes(centimos, numeroPartes) {
    if (numeroPartes <= 0) return [];
    return repartirProporcional(centimos, new Array(numeroPartes).fill(1));
}

/** Porcentaje exacto de una parte sobre un total, con los decimales indicados. */
export function calcularPorcentaje(parteCentimos, totalCentimos, decimales = 1) {
    if (!totalCentimos) return 0;
    const factor = Math.pow(10, decimales);
    return Math.round((parteCentimos / totalCentimos) * 100 * factor) / factor;
}

/** Formatea céntimos como moneda española: 1.234,56 € */
export function formatearEuros(centimos, opciones = {}) {
    const { conSigno = false, compacto = false } = opciones;
    const valor = aEuros(centimos);
    const formateador = compacto ? FORMATEADOR_EUROS_COMPACTO : FORMATEADOR_EUROS;
    const texto = formateador.format(valor);
    if (conSigno && centimos > 0) return `+${texto}`;
    return texto;
}

/** Formatea céntimos como número plano sin símbolo: 1.234,56 */
export function formatearDecimal(centimos) {
    return FORMATEADOR_DECIMAL.format(aEuros(centimos));
}

/**
 * Formato para rellenar campos de texto editables: coma decimal española y sin
 * separador de miles, de modo que vuelva a parsearse sin ambigüedad.
 */
export function formatearParaEntrada(centimos) {
    return (Math.round(centimos) / 100).toFixed(2).replace('.', ',');
}

/** Formatea un porcentaje eliminando decimales innecesarios: 33,3 % / 50 % */
export function formatearPorcentaje(valor, decimales = 1) {
    const formateador = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimales
    });
    return `${formateador.format(valor)} %`;
}

/** Valor absoluto en céntimos (evita el -0 en las plantillas). */
export function absCentimos(centimos) {
    return Math.abs(Math.round(centimos)) || 0;
}
