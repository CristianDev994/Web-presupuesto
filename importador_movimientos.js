/* ========================================================================== 
   IMPORTADOR LOCAL DE MOVIMIENTOS BANCARIOS CSV

   Este modulo es deliberadamente puro: recibe texto y devuelve datos. No lee
   archivos, no usa localStorage y no realiza ninguna peticion de red. El
   controlador es quien debe obtener el texto con File.text() o FileReader.
   ========================================================================== */

export const CANAL_BANCO_IMPORTADO = 'Cuenta Bancaria';

export const LIMITES_IMPORTACION_MOVIMIENTOS = Object.freeze({
    TAMANO_MAXIMO_BYTES: 5 * 1024 * 1024,
    FILAS_MAXIMAS: 20000,
    LONGITUD_CONCEPTO_MAXIMA: 500,
    IMPORTE_MAXIMO_CENTIMOS: 100000000000000
});

const SEPARADORES_ADMITIDOS = Object.freeze([';', ',', '\t']);

/** Error identificable para que la interfaz pueda mostrar mensajes claros. */
export class ErrorImportacionMovimientos extends Error {
    constructor(codigo, mensaje, fila = null) {
        super(mensaje);
        this.name = 'ErrorImportacionMovimientos';
        this.codigo = codigo;
        this.fila = fila;
    }
}

function quitarBom(texto) {
    return texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto;
}

function calcularBytesUtf8(texto) {
    return new TextEncoder().encode(texto).byteLength;
}

function limpiarTexto(valor) {
    return String(valor ?? '').trim().replace(/\s+/g, ' ');
}

/** Convierte una cabecera a una clave comparable, tolerando tildes y signos. */
export function normalizarCabecera(cabecera) {
    return String(cabecera ?? '')
        .replace(/^\uFEFF/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '');
}

function crearConjuntoAliases(valores) {
    return new Set(valores.map(normalizarCabecera));
}

const ALIASES_CABECERAS = Object.freeze({
    fecha: crearConjuntoAliases([
        'fecha', 'date', 'fecha operación', 'fecha operacion', 'f. operación',
        'f. operacion', 'fecha movimiento', 'transaction date', 'booking date',
        'fecha valor', 'value date', 'posting date'
    ]),
    concepto: crearConjuntoAliases([
        'concepto', 'concept', 'descripción', 'descripcion', 'description',
        'detalle', 'details', 'memo', 'movimiento', 'transaction description',
        'beneficiario', 'payee', 'comercio', 'merchant', 'narrative',
        'observaciones'
    ]),
    importe: crearConjuntoAliases([
        'importe', 'amount', 'monto', 'cuantía', 'cuantia', 'cantidad',
        'importe operación', 'importe operacion', 'transaction amount',
        'importe eur', 'amount eur'
    ]),
    cargo: crearConjuntoAliases([
        'cargo', 'débito', 'debito', 'debit', 'debe', 'withdrawal',
        'charge', 'importe cargo', 'debit amount', 'amount debit',
        'cargo eur', 'debit eur'
    ]),
    abono: crearConjuntoAliases([
        'abono', 'crédito', 'credito', 'credit', 'haber', 'ingreso',
        'deposit', 'importe abono', 'credit amount', 'amount credit'
    ]),
    referencia: crearConjuntoAliases([
        'referencia', 'reference', 'id movimiento', 'transaction id',
        'número operación', 'numero operacion', 'operation id'
    ])
});

function tipoCabecera(cabeceraNormalizada) {
    for (const [tipo, aliases] of Object.entries(ALIASES_CABECERAS)) {
        if (aliases.has(cabeceraNormalizada)) return tipo;
    }
    return null;
}

function esFilaVacia(campos) {
    return campos.every(campo => String(campo ?? '').trim() === '');
}

/**
 * Parser de registros CSV compatible con campos entrecomillados, comillas
 * escapadas, CRLF y saltos de linea dentro de un campo entrecomillado.
 */
function parsearConSeparador(contenido, separador, filasMaximas) {
    const registros = [];
    let campos = [];
    let campo = '';
    let entreComillas = false;
    let comillaCerrada = false;
    let numeroLinea = 1;
    let lineaInicioRegistro = 1;

    const agregarRegistro = () => {
        campos.push(campo);
        registros.push({ numeroFila: lineaInicioRegistro, campos });
        campos = [];
        campo = '';
        comillaCerrada = false;

        // Se permite una cabecera adicional a las filas de datos configuradas.
        if (registros.length > filasMaximas + 1) {
            throw new ErrorImportacionMovimientos(
                'DEMASIADAS_FILAS',
                `El CSV supera el limite de ${filasMaximas.toLocaleString('es-ES')} filas de datos.`
            );
        }
    };

    for (let indice = 0; indice < contenido.length; indice += 1) {
        const caracter = contenido[indice];

        if (entreComillas) {
            if (caracter === '"') {
                if (contenido[indice + 1] === '"') {
                    campo += '"';
                    indice += 1;
                } else {
                    entreComillas = false;
                    comillaCerrada = true;
                }
            } else if (caracter === '\r') {
                if (contenido[indice + 1] === '\n') indice += 1;
                campo += '\n';
                numeroLinea += 1;
            } else {
                campo += caracter;
                if (caracter === '\n') numeroLinea += 1;
            }
            continue;
        }

        if (comillaCerrada) {
            if (caracter === separador) {
                campos.push(campo);
                campo = '';
                comillaCerrada = false;
                continue;
            }
            if (caracter === '\r' || caracter === '\n') {
                agregarRegistro();
                if (caracter === '\r' && contenido[indice + 1] === '\n') indice += 1;
                numeroLinea += 1;
                lineaInicioRegistro = numeroLinea;
                continue;
            }
            if (/\s/.test(caracter)) continue;
            throw new ErrorImportacionMovimientos(
                'CSV_MALFORMADO',
                `Hay texto inesperado despues de una comilla de cierre en la fila ${numeroLinea}.`,
                numeroLinea
            );
        }

        if (caracter === '"') {
            if (campo.trim() !== '') {
                throw new ErrorImportacionMovimientos(
                    'CSV_MALFORMADO',
                    `Hay una comilla inesperada dentro de un campo en la fila ${numeroLinea}.`,
                    numeroLinea
                );
            }
            campo = '';
            entreComillas = true;
        } else if (caracter === separador) {
            campos.push(campo);
            campo = '';
        } else if (caracter === '\r' || caracter === '\n') {
            agregarRegistro();
            if (caracter === '\r' && contenido[indice + 1] === '\n') indice += 1;
            numeroLinea += 1;
            lineaInicioRegistro = numeroLinea;
        } else {
            campo += caracter;
        }
    }

    if (entreComillas) {
        throw new ErrorImportacionMovimientos(
            'CSV_MALFORMADO',
            `Falta cerrar un campo entrecomillado iniciado en la fila ${lineaInicioRegistro}.`,
            lineaInicioRegistro
        );
    }

    if (campo !== '' || campos.length > 0 || comillaCerrada) agregarRegistro();
    return registros;
}

function puntuacionPosibleCabecera(campos) {
    const tipos = new Set(campos.map(normalizarCabecera).map(tipoCabecera).filter(Boolean));
    let puntos = tipos.size * 100 + Math.min(campos.length, 30);
    if (tipos.has('fecha')) puntos += 200;
    if (tipos.has('concepto')) puntos += 200;
    if (tipos.has('importe') || tipos.has('cargo')) puntos += 200;
    return puntos;
}

/** Detecta punto y coma, coma o tabulador utilizando las primeras filas. */
export function detectarSeparadorCSV(contenido) {
    const texto = quitarBom(String(contenido ?? ''));
    let mejor = null;

    for (const separador of SEPARADORES_ADMITIDOS) {
        try {
            const registros = parsearConSeparador(
                texto,
                separador,
                LIMITES_IMPORTACION_MOVIMIENTOS.FILAS_MAXIMAS
            );
            const candidatos = registros.filter(registro => !esFilaVacia(registro.campos)).slice(0, 15);
            const puntos = candidatos.reduce(
                (maximo, registro) => Math.max(maximo, puntuacionPosibleCabecera(registro.campos)),
                0
            );
            const columnas = candidatos.reduce(
                (maximo, registro) => Math.max(maximo, registro.campos.length),
                0
            );
            const candidato = { separador, puntos, columnas };
            if (!mejor
                || candidato.puntos > mejor.puntos
                || (candidato.puntos === mejor.puntos && candidato.columnas > mejor.columnas)) {
                mejor = candidato;
            }
        } catch (error) {
            // Un candidato erroneo no impide probar los otros separadores.
        }
    }

    return mejor && mejor.columnas > 1 ? mejor.separador : null;
}

/**
 * Parsea CSV sin interpretar su contenido financiero.
 * Devuelve cada registro junto a la linea fisica en la que comienza.
 */
export function parsearCSV(contenido, opciones = {}) {
    if (typeof contenido !== 'string') {
        throw new ErrorImportacionMovimientos(
            'CONTENIDO_INVALIDO',
            'El contenido CSV debe proporcionarse como texto.'
        );
    }

    const texto = quitarBom(contenido);
    if (!texto.trim()) {
        throw new ErrorImportacionMovimientos('ARCHIVO_VACIO', 'El archivo CSV esta vacio.');
    }
    if (texto.includes('\0')) {
        throw new ErrorImportacionMovimientos(
            'CONTENIDO_INVALIDO',
            'El archivo contiene caracteres nulos y no parece ser un CSV de texto valido.'
        );
    }

    const filasMaximasSolicitadas = Number.isInteger(opciones.filasMaximas)
        ? opciones.filasMaximas
        : LIMITES_IMPORTACION_MOVIMIENTOS.FILAS_MAXIMAS;
    const filasMaximas = Math.max(
        1,
        Math.min(filasMaximasSolicitadas, LIMITES_IMPORTACION_MOVIMIENTOS.FILAS_MAXIMAS)
    );
    const separador = opciones.separador || detectarSeparadorCSV(texto);

    if (!SEPARADORES_ADMITIDOS.includes(separador)) {
        throw new ErrorImportacionMovimientos(
            'SEPARADOR_NO_DETECTADO',
            'No se pudo detectar el separador del CSV. Usa coma, punto y coma o tabulador e incluye una fila de cabeceras.'
        );
    }

    return {
        separador,
        registros: parsearConSeparador(texto, separador, filasMaximas)
    };
}

function analizarFecha(fecha) {
    const texto = String(fecha ?? '').trim();
    let anio;
    let mes;
    let dia;
    let coincidencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);

    if (coincidencia) {
        dia = Number(coincidencia[1]);
        mes = Number(coincidencia[2]);
        anio = Number(coincidencia[3]);
    } else {
        coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
        if (!coincidencia) {
            return {
                valido: false,
                mensaje: 'La fecha debe usar DD/MM/AAAA o AAAA-MM-DD.'
            };
        }
        anio = Number(coincidencia[1]);
        mes = Number(coincidencia[2]);
        dia = Number(coincidencia[3]);
    }

    if (anio < 1000 || anio > 9999 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
        return { valido: false, mensaje: `La fecha "${texto}" no existe en el calendario.` };
    }

    const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
    if (fechaUtc.getUTCFullYear() !== anio
        || fechaUtc.getUTCMonth() !== mes - 1
        || fechaUtc.getUTCDate() !== dia) {
        return { valido: false, mensaje: `La fecha "${texto}" no existe en el calendario.` };
    }

    return {
        valido: true,
        fecha: `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    };
}

/** Devuelve una fecha ISO valida o null cuando el texto no es admisible. */
export function normalizarFechaMovimiento(fecha) {
    const resultado = analizarFecha(fecha);
    return resultado.valido ? resultado.fecha : null;
}

function validarAgrupacion(parteEntera, separadorMiles) {
    if (!separadorMiles || !parteEntera.includes(separadorMiles)) {
        return /^\d+$/.test(parteEntera) ? parteEntera : null;
    }

    const grupos = parteEntera.split(separadorMiles);
    if (!/^\d{1,3}$/.test(grupos[0]) || !grupos.slice(1).every(grupo => /^\d{3}$/.test(grupo))) {
        return null;
    }
    return grupos.join('');
}

/**
 * Interpreta importes españoles e ingleses sin usar coma flotante.
 * Ejemplos: 1.234,56; -1,234.56; (45,90); 25 EUR.
 */
export function analizarImporteMonetario(valor) {
    const original = String(valor ?? '').trim();
    if (!original) return { valido: false, centimos: null, mensaje: 'El importe esta vacio.' };

    if (/(?:\$|£|¥|\bUSD\b|\bGBP\b|\bCHF\b|\bJPY\b)/i.test(original)) {
        return {
            valido: false,
            centimos: null,
            mensaje: 'La aplicacion solo admite importes en euros; no convierte otras divisas.'
        };
    }

    let texto = original
        .replace(/\bEUR\b/gi, '')
        .replace(/€/g, '')
        .replace(/[\s\u00A0\u202F']/g, '');

    let signo = 1;
    const parentesis = /^\((.*)\)$/.exec(texto);
    if (parentesis) {
        signo = -1;
        texto = parentesis[1];
    }

    const signoInicial = /^[+-]/.exec(texto);
    const signoFinal = /[+-]$/.exec(texto);
    if (signoInicial && signoFinal) {
        return { valido: false, centimos: null, mensaje: `El importe "${original}" tiene mas de un signo.` };
    }
    if (signoInicial) {
        if (signoInicial[0] === '-') signo *= -1;
        texto = texto.slice(1);
    } else if (signoFinal) {
        if (signoFinal[0] === '-') signo *= -1;
        texto = texto.slice(0, -1);
    }

    if (!/^\d+(?:[.,]\d+)*$/.test(texto)) {
        return { valido: false, centimos: null, mensaje: `El importe "${original}" no tiene un formato valido.` };
    }

    const ultimaComa = texto.lastIndexOf(',');
    const ultimoPunto = texto.lastIndexOf('.');
    let entero = texto;
    let decimales = '';

    if (ultimaComa >= 0 && ultimoPunto >= 0) {
        const separadorDecimal = ultimaComa > ultimoPunto ? ',' : '.';
        const separadorMiles = separadorDecimal === ',' ? '.' : ',';
        const posicionDecimal = texto.lastIndexOf(separadorDecimal);
        const parteEntera = texto.slice(0, posicionDecimal);
        decimales = texto.slice(posicionDecimal + 1);
        entero = validarAgrupacion(parteEntera, separadorMiles);

        if (entero === null || !/^\d{1,2}$/.test(decimales)) {
            return { valido: false, centimos: null, mensaje: `El importe "${original}" mezcla separadores de forma invalida.` };
        }
    } else if (ultimaComa >= 0 || ultimoPunto >= 0) {
        const separador = ultimaComa >= 0 ? ',' : '.';
        const grupos = texto.split(separador);

        if (grupos.length === 2 && /^\d{1,2}$/.test(grupos[1])) {
            entero = grupos[0];
            decimales = grupos[1];
        } else if (/^\d{1,3}$/.test(grupos[0])
            && grupos.length > 1
            && grupos.slice(1).every(grupo => /^\d{3}$/.test(grupo))) {
            entero = grupos.join('');
        } else if (grupos.length > 2
            && /^\d{1,2}$/.test(grupos.at(-1))
            && /^\d{1,3}$/.test(grupos[0])
            && grupos.slice(1, -1).every(grupo => /^\d{3}$/.test(grupo))) {
            entero = grupos.slice(0, -1).join('');
            decimales = grupos.at(-1);
        } else {
            return { valido: false, centimos: null, mensaje: `El importe "${original}" tiene separadores ambiguos o invalidos.` };
        }
    }

    if (!/^\d+$/.test(entero) || (decimales && !/^\d{1,2}$/.test(decimales))) {
        return { valido: false, centimos: null, mensaje: `El importe "${original}" no tiene un formato valido.` };
    }

    const centimosBigInt = (BigInt(entero) * 100n) + BigInt((decimales + '00').slice(0, 2));
    if (centimosBigInt > BigInt(LIMITES_IMPORTACION_MOVIMIENTOS.IMPORTE_MAXIMO_CENTIMOS)) {
        return {
            valido: false,
            centimos: null,
            mensaje: `El importe "${original}" supera el maximo admitido.`
        };
    }

    return { valido: true, centimos: signo * Number(centimosBigInt), mensaje: null };
}

/** Atajo que devuelve centimos o null, sin confundir cero con un error. */
export function parsearImporteMovimiento(valor) {
    const resultado = analizarImporteMonetario(valor);
    return resultado.valido ? resultado.centimos : null;
}

function normalizarTextoClasificacion(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const REGLAS_CATEGORIZACION = Object.freeze([
    {
        categoria: 'DEUDAS_OBLIGACIONES',
        motivo: 'El concepto parece una cuota de deuda.',
        patrones: [
            /\b(?:cuota|pago) (?:de )?(?:prestamo|credito|hipoteca|tarjeta)\b/,
            /\b(?:loan|mortgage|credit card) payment\b/,
            /\bamortizacion (?:prestamo|credito|hipoteca)\b/
        ]
    },
    {
        categoria: 'DIGITAL_SUSCRIPCIONES',
        motivo: 'Se reconoce un proveedor o una suscripcion digital.',
        patrones: [
            /\b(?:netflix|spotify|hbo|disney plus|amazon prime|google one|dropbox|adobe|microsoft 365|youtube premium)\b/,
            /\b(?:suscripcion|subscription)\b/
        ]
    },
    {
        categoria: 'VIVIENDA_COMIDA',
        motivo: 'Se reconoce un gasto de alimentacion o vivienda.',
        patrones: [
            /\b(?:mercadona|carrefour|lidl|aldi|supermercado|hipercor|eroski|alcampo|grocery)\b/,
            /\b(?:alquiler|rent payment|iberdrola|endesa|naturgy|suministro de agua)\b/
        ]
    },
    {
        categoria: 'AHORRO_INVERSION',
        motivo: 'Se reconoce un proveedor o concepto de ahorro/inversion.',
        patrones: [
            /\b(?:myinvestor|trade republic|degiro|interactive brokers|fondo indexado|plan de ahorro)\b/
        ]
    },
    {
        categoria: 'OCIO_ESTILO_VIDA',
        motivo: 'Se reconoce un gasto personal o de ocio.',
        patrones: [
            /\b(?:restaurante|restaurant|cafeteria|cine|cinema|teatro|bar |pub |zara|bershka|steam games)\b/
        ]
    }
]);

/**
 * Solo sugiere una categoria cuando hay una coincidencia suficientemente
 * especifica. Los conceptos dudosos quedan sin clasificar para revision.
 */
export function sugerirCategoriaMovimiento(concepto) {
    const texto = normalizarTextoClasificacion(concepto);
    for (const regla of REGLAS_CATEGORIZACION) {
        if (regla.patrones.some(patron => patron.test(texto))) {
            return {
                categoria: regla.categoria,
                confianza: 'alta',
                motivo: regla.motivo
            };
        }
    }
    return {
        categoria: null,
        confianza: 'sin_sugerencia',
        motivo: 'No hay una coincidencia suficientemente fiable; requiere revision.'
    };
}

function normalizarTextoHuella(texto) {
    return String(texto ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function fnv1a64(texto) {
    let hash = 0xcbf29ce484222325n;
    const primo = 0x100000001b3n;
    const mascara = 0xffffffffffffffffn;
    for (let indice = 0; indice < texto.length; indice += 1) {
        hash ^= BigInt(texto.charCodeAt(indice));
        hash = (hash * primo) & mascara;
    }
    return hash.toString(16).padStart(16, '0');
}

/** Crea una huella determinista sin exponer el concepto completo. */
export function crearHuellaMovimiento({ fecha, concepto, importeCent, referencia = '' }) {
    const material = [
        'v1',
        fecha,
        normalizarTextoHuella(concepto),
        Math.round(Number(importeCent)),
        normalizarTextoHuella(referencia)
    ].join('|');
    return `mov-v1-${fnv1a64(material)}`;
}

function localizarColumnas(cabeceras) {
    const columnas = {
        fecha: -1,
        concepto: -1,
        importe: -1,
        cargo: -1,
        abono: -1,
        referencia: -1
    };

    cabeceras.forEach((cabecera, indice) => {
        const tipo = tipoCabecera(normalizarCabecera(cabecera));
        if (tipo && columnas[tipo] === -1) columnas[tipo] = indice;
    });
    return columnas;
}

function columnasObligatoriasPresentes(columnas) {
    return columnas.fecha >= 0
        && columnas.concepto >= 0
        && (columnas.importe >= 0 || columnas.cargo >= 0);
}

function buscarCabecera(registros) {
    let mejor = null;
    registros.filter(registro => !esFilaVacia(registro.campos)).slice(0, 20).forEach(registro => {
        const columnas = localizarColumnas(registro.campos);
        const puntuacion = puntuacionPosibleCabecera(registro.campos);
        if (!mejor || puntuacion > mejor.puntuacion) {
            mejor = { registro, columnas, puntuacion };
        }
    });
    return mejor && columnasObligatoriasPresentes(mejor.columnas) ? mejor : null;
}

function crearDiagnosticoBase(nombreArchivo, bytes) {
    return {
        nombreArchivo: nombreArchivo || null,
        procesamientoLocal: true,
        bytes,
        separador: null,
        cabecerasDetectadas: null,
        filaCabecera: null,
        filasPreviasCabeceraIgnoradas: 0,
        totalFilasDatos: 0,
        filasVaciasIgnoradas: 0,
        filasValidas: 0,
        ingresosIgnorados: 0,
        duplicadosIgnorados: 0,
        filasConError: 0,
        sinCategoriaSugerida: 0,
        importeTotalCent: 0,
        filasIngresosIgnorados: [],
        filasDuplicadas: [],
        errores: [],
        avisos: []
    };
}

function crearResultadoFatal(diagnostico, error) {
    diagnostico.errores.push({
        fila: error.fila ?? null,
        codigo: error.codigo || 'IMPORTACION_FALLIDA',
        mensaje: error.message || 'No se pudo procesar el CSV.'
    });
    diagnostico.filasConError = diagnostico.errores.length;
    return { exito: false, movimientos: [], diagnostico };
}

function obtenerImporteFila(campos, columnas) {
    const valorCargo = columnas.cargo >= 0 ? String(campos[columnas.cargo] ?? '').trim() : '';
    if (valorCargo !== '') return { valor: valorCargo, tipo: 'cargo' };

    const valorImporte = columnas.importe >= 0 ? String(campos[columnas.importe] ?? '').trim() : '';
    if (valorImporte !== '') return { valor: valorImporte, tipo: 'importe' };

    return { valor: '', tipo: columnas.cargo >= 0 ? 'cargo' : 'importe' };
}

/**
 * Importa cargos bancarios desde CSV ya leido localmente.
 *
 * Opciones relevantes:
 * - importesPositivosSonGastos: permite CSV cuya columna Amount usa positivos.
 * - huellasExistentes: iterable de huellas ya guardadas para omitir duplicados.
 * - nombreArchivo: solo se incluye en el diagnostico.
 */
export function importarMovimientosCSV(contenido, opciones = {}) {
    const bytes = typeof contenido === 'string' ? calcularBytesUtf8(contenido) : 0;
    const diagnostico = crearDiagnosticoBase(opciones.nombreArchivo, bytes);

    try {
        if (typeof contenido !== 'string') {
            throw new ErrorImportacionMovimientos(
                'CONTENIDO_INVALIDO',
                'El archivo debe leerse como texto antes de importarlo.'
            );
        }

        const limiteSolicitado = Number.isInteger(opciones.tamanoMaximoBytes)
            ? opciones.tamanoMaximoBytes
            : LIMITES_IMPORTACION_MOVIMIENTOS.TAMANO_MAXIMO_BYTES;
        const limiteBytes = Math.max(
            1,
            Math.min(limiteSolicitado, LIMITES_IMPORTACION_MOVIMIENTOS.TAMANO_MAXIMO_BYTES)
        );
        if (bytes > limiteBytes) {
            throw new ErrorImportacionMovimientos(
                'ARCHIVO_DEMASIADO_GRANDE',
                `El archivo ocupa ${bytes.toLocaleString('es-ES')} bytes y supera el limite de ${limiteBytes.toLocaleString('es-ES')} bytes.`
            );
        }

        const parseado = parsearCSV(contenido, {
            separador: opciones.separador,
            filasMaximas: opciones.filasMaximas
        });
        diagnostico.separador = parseado.separador;

        const cabecera = buscarCabecera(parseado.registros);
        if (!cabecera) {
            const primeraFila = parseado.registros.find(registro => !esFilaVacia(registro.campos));
            const recibidas = primeraFila
                ? primeraFila.campos.map(limpiarTexto).filter(Boolean).join(', ')
                : 'ninguna';
            throw new ErrorImportacionMovimientos(
                'CABECERAS_NO_RECONOCIDAS',
                `No se reconocen las cabeceras obligatorias. Se necesita fecha/date, concepto/description y una columna importe/amount o cargo/debit. Cabeceras recibidas: ${recibidas}.`,
                primeraFila ? primeraFila.numeroFila : null
            );
        }

        const { registro: registroCabecera, columnas } = cabecera;
        const cabeceras = registroCabecera.campos.map(limpiarTexto);
        const indiceCabecera = parseado.registros.indexOf(registroCabecera);
        const registrosDatos = parseado.registros.slice(indiceCabecera + 1);

        diagnostico.filaCabecera = registroCabecera.numeroFila;
        diagnostico.filasPreviasCabeceraIgnoradas = parseado.registros
            .slice(0, indiceCabecera)
            .filter(registro => !esFilaVacia(registro.campos)).length;
        diagnostico.cabecerasDetectadas = {
            fecha: cabeceras[columnas.fecha],
            concepto: cabeceras[columnas.concepto],
            importe: columnas.importe >= 0 ? cabeceras[columnas.importe] : null,
            cargo: columnas.cargo >= 0 ? cabeceras[columnas.cargo] : null,
            abono: columnas.abono >= 0 ? cabeceras[columnas.abono] : null,
            referencia: columnas.referencia >= 0 ? cabeceras[columnas.referencia] : null
        };

        const movimientos = [];
        const huellasExistentes = new Set(
            opciones.huellasExistentes ? Array.from(opciones.huellasExistentes, String) : []
        );
        const repeticionesHuella = new Map();

        for (const registro of registrosDatos) {
            if (esFilaVacia(registro.campos)) {
                diagnostico.filasVaciasIgnoradas += 1;
                continue;
            }
            diagnostico.totalFilasDatos += 1;

            if (registro.campos.length !== cabeceras.length) {
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'COLUMNAS_INCONSISTENTES',
                    mensaje: `La fila tiene ${registro.campos.length} columnas y la cabecera tiene ${cabeceras.length}.`
                });
                continue;
            }

            const concepto = limpiarTexto(registro.campos[columnas.concepto]);
            if (!concepto) {
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'CONCEPTO_VACIO',
                    mensaje: 'Falta el concepto o descripcion del movimiento.'
                });
                continue;
            }
            if (concepto.length > LIMITES_IMPORTACION_MOVIMIENTOS.LONGITUD_CONCEPTO_MAXIMA) {
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'CONCEPTO_DEMASIADO_LARGO',
                    mensaje: `El concepto supera los ${LIMITES_IMPORTACION_MOVIMIENTOS.LONGITUD_CONCEPTO_MAXIMA} caracteres.`
                });
                continue;
            }

            const fechaAnalizada = analizarFecha(registro.campos[columnas.fecha]);
            if (!fechaAnalizada.valido) {
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'FECHA_INVALIDA',
                    mensaje: fechaAnalizada.mensaje
                });
                continue;
            }

            const datoImporte = obtenerImporteFila(registro.campos, columnas);
            if (!datoImporte.valor) {
                const valorAbono = columnas.abono >= 0
                    ? String(registro.campos[columnas.abono] ?? '').trim()
                    : '';
                if (valorAbono) {
                    const abono = analizarImporteMonetario(valorAbono);
                    diagnostico.ingresosIgnorados += 1;
                    diagnostico.filasIngresosIgnorados.push({
                        fila: registro.numeroFila,
                        motivo: 'La fila contiene un abono o ingreso, no un cargo.',
                        importeCent: abono.valido ? abono.centimos : null
                    });
                    continue;
                }
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'IMPORTE_VACIO',
                    mensaje: 'Falta el importe o cargo del movimiento.'
                });
                continue;
            }

            const importeAnalizado = analizarImporteMonetario(datoImporte.valor);
            if (!importeAnalizado.valido) {
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'IMPORTE_INVALIDO',
                    mensaje: importeAnalizado.mensaje
                });
                continue;
            }
            if (importeAnalizado.centimos === 0) {
                diagnostico.errores.push({
                    fila: registro.numeroFila,
                    codigo: 'IMPORTE_CERO',
                    mensaje: 'El movimiento tiene importe cero y no se puede importar como gasto.'
                });
                continue;
            }

            let importeGastoCent;
            if (datoImporte.tipo === 'cargo') {
                if (importeAnalizado.centimos < 0) {
                    diagnostico.ingresosIgnorados += 1;
                    diagnostico.filasIngresosIgnorados.push({
                        fila: registro.numeroFila,
                        motivo: 'Un valor negativo en la columna cargo se considera un abono o reverso.',
                        importeCent: importeAnalizado.centimos
                    });
                    continue;
                }
                importeGastoCent = importeAnalizado.centimos;
            } else if (importeAnalizado.centimos < 0) {
                importeGastoCent = Math.abs(importeAnalizado.centimos);
            } else if (opciones.importesPositivosSonGastos === true) {
                importeGastoCent = importeAnalizado.centimos;
            } else {
                diagnostico.ingresosIgnorados += 1;
                diagnostico.filasIngresosIgnorados.push({
                    fila: registro.numeroFila,
                    motivo: 'El importe positivo se considera un ingreso. Activa importesPositivosSonGastos solo si el banco exporta los cargos en positivo.',
                    importeCent: importeAnalizado.centimos
                });
                continue;
            }

            const referencia = columnas.referencia >= 0
                ? limpiarTexto(registro.campos[columnas.referencia])
                : '';
            const sugerencia = sugerirCategoriaMovimiento(concepto);
            const huellaBase = crearHuellaMovimiento({
                fecha: fechaAnalizada.fecha,
                concepto,
                importeCent: importeGastoCent,
                referencia
            });
            const repeticion = (repeticionesHuella.get(huellaBase) || 0) + 1;
            repeticionesHuella.set(huellaBase, repeticion);
            const huella = repeticion === 1 ? huellaBase : `${huellaBase}-${repeticion}`;

            if (huellasExistentes.has(huella)) {
                diagnostico.duplicadosIgnorados += 1;
                diagnostico.filasDuplicadas.push({
                    fila: registro.numeroFila,
                    huella,
                    motivo: 'Ya existe un movimiento con la misma huella estable.'
                });
                continue;
            }

            movimientos.push({
                fecha: fechaAnalizada.fecha,
                concepto,
                lugar: concepto,
                importeCent: importeGastoCent,
                canal: CANAL_BANCO_IMPORTADO,
                categoriaSugerida: sugerencia.categoria,
                confianzaCategoria: sugerencia.confianza,
                motivoCategoria: sugerencia.motivo,
                referencia: referencia || null,
                huella,
                huellaBase,
                filaOrigen: registro.numeroFila
            });
            diagnostico.importeTotalCent += importeGastoCent;
            if (!sugerencia.categoria) diagnostico.sinCategoriaSugerida += 1;
        }

        diagnostico.filasValidas = movimientos.length;
        diagnostico.filasConError = diagnostico.errores.length;
        if (diagnostico.sinCategoriaSugerida > 0) {
            diagnostico.avisos.push(
                `${diagnostico.sinCategoriaSugerida} movimiento(s) requieren revisar su categoria antes de guardarlos.`
            );
        }
        if (diagnostico.duplicadosIgnorados > 0) {
            diagnostico.avisos.push(
                `${diagnostico.duplicadosIgnorados} movimiento(s) duplicados no se han importado.`
            );
        }

        return { exito: true, movimientos, diagnostico };
    } catch (error) {
        const errorImportacion = error instanceof ErrorImportacionMovimientos
            ? error
            : new ErrorImportacionMovimientos(
                'IMPORTACION_FALLIDA',
                `No se pudo procesar el CSV: ${error.message || 'error desconocido'}.`
            );
        return crearResultadoFatal(diagnostico, errorImportacion);
    }
}

