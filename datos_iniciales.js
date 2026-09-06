// Constantes, perfiles presupuestarios, estrategias de efectivo, lugares y APIs de inversión

export const CANALES_PAGO = {
    CUENTA: 'Cuenta Bancaria',
    FISICO: 'Efectivo Físico'
};

// Subtipo explícito de las partidas de patrimonio: evita clasificar por texto libre
export const SUBTIPOS_PATRIMONIO = {
    AHORRO: 'AHORRO',
    INVERSION: 'INVERSION'
};

// "liberaAhorro" indica si el dinero NO gastado de esa categoria puede considerarse
// ahorro real. Las deudas y las reservas son compromisos ya adquiridos: aunque no
// se hayan pagado todavia, ese dinero no esta libre y no cuenta como ahorro.
export const CATEGORIAS_GASTO = {
    VIVIENDA_COMIDA: { nombre: 'Comida y Aportación Hogar', nombreCorto: 'Comida y Hogar', icono: 'utensils', color: '#10b981', liberaAhorro: true },
    DIGITAL_SUSCRIPCIONES: { nombre: 'Suscripciones y Facturas', nombreCorto: 'Suscripciones', icono: 'laptop', color: '#6366f1', liberaAhorro: true },
    DEUDAS_OBLIGACIONES: { nombre: 'Deudas y Obligaciones', nombreCorto: 'Deudas', icono: 'credit-card', color: '#ef4444', liberaAhorro: false },
    OCIO_ESTILO_VIDA: { nombre: 'Ocio y Gastos Personales', nombreCorto: 'Ocio', icono: 'sparkles', color: '#f59e0b', liberaAhorro: true },
    PREVISION_RESERVAS: { nombre: 'Previsión de Recibos / Fondo', nombreCorto: 'Previsión', icono: 'calendar-check', color: '#8b5cf6', liberaAhorro: false },
    AHORRO_INVERSION: { nombre: 'Ahorro e Inversión', nombreCorto: 'Ahorro', icono: 'trending-up', color: '#06b6d4', liberaAhorro: false }
};

// Unidades admitidas para indicar cuanto durara una deuda.
// El presupuesto es mensual, asi que los dias y los anios se convierten a meses
// completos: la duracion en dias se redondea al alza porque una deuda que dura
// 40 dias sigue ocupando dos cuotas mensuales.
export const UNIDADES_PLAZO_DEUDA = {
    DIAS: {
        id: 'DIAS',
        etiqueta: 'días',
        etiquetaSingular: 'día',
        // Media del calendario gregoriano: 365,2425 / 12
        diasPorMes: 30.436875
    },
    MESES: {
        id: 'MESES',
        etiqueta: 'meses',
        etiquetaSingular: 'mes'
    },
    ANIOS: {
        id: 'ANIOS',
        etiqueta: 'años',
        etiquetaSingular: 'año',
        mesesPorUnidad: 12
    }
};

// Tramos de referencia para la parte del sueldo que se va en pagar deudas.
// El 35 % es la orientacion que suele usarse en banca para el conjunto de cuotas
// mensuales sobre los ingresos netos; no es una norma legal, sino una referencia
// habitual que la aplicacion muestra como orientacion.
export const REFERENCIA_CARGA_DEUDA = {
    // Porcentaje del ingreso neto a partir del cual la carga se considera elevada
    limiteRecomendado: 35,
    fuente: 'Referencia habitual en banca: las cuotas no deberían superar el 35 % de los ingresos netos.',
    tramos: [
        {
            nivel: 'sin_deuda',
            hasta: 0,
            etiqueta: 'Sin deudas',
            simbolo: '✓',
            resumen: 'No tienes cuotas de deuda este mes.',
            consejo: 'Todo tu sueldo queda disponible para gastos, ahorro e inversión.'
        },
        {
            nivel: 'holgado',
            hasta: 15,
            etiqueta: 'Margen amplio',
            simbolo: '✓',
            resumen: 'Tus deudas ocupan una parte pequeña del sueldo.',
            consejo: 'Puedes amortizar capital para terminar antes sin apretar el mes.'
        },
        {
            nivel: 'razonable',
            hasta: 30,
            etiqueta: 'Bajo control',
            simbolo: '✓',
            resumen: 'La carga es asumible, pero ya se nota en el mes.',
            consejo: 'Evita añadir nuevas cuotas hasta liquidar alguna de las actuales.'
        },
        {
            nivel: 'ajustado',
            hasta: 35,
            etiqueta: 'Cerca del límite',
            simbolo: '!',
            resumen: 'Estás rozando la referencia del 35 % de tus ingresos.',
            consejo: 'Prioriza amortizar la deuda con la cuota más alta antes de asumir otra.'
        },
        {
            nivel: 'elevado',
            hasta: Infinity,
            etiqueta: 'Por encima de la referencia',
            simbolo: '↑',
            resumen: 'Tus cuotas superan el 35 % de lo que ingresas.',
            consejo: 'Reduce cuota renegociando plazos o amortizando; evita financiar nuevas compras.'
        }
    ]
};

// Sugerencias de lugares y comercios habituales para autocompletado rápido
export const LUGARES_FRECUENTES_SUGERIDOS = [
    'Mercadona',
    'Carrefour',
    'Lidl',
    'Supermercado Día',
    'Gasolinera Repsol',
    'Gasolinera Cepsa',
    'Bar de Tapas / Cerveza',
    'Restaurante Cena',
    'Botellón / Copas Feria',
    'Amazon',
    'Farmacia',
    'Peluquería',
    'Zara / Tienda de Ropa',
    'Panadería / Frutería local',
    'Aportación en mano a Padres'
];

// Pautas financieras para canalizar el efectivo en mano sin perder por inflación ni alertar a bancos
export const ESTRATEGIAS_CANALIZACION_EFECTIVO = {
    REGLA_ORO: 'Nunca ingreses efectivo acumulado de golpe en cajeros automáticos (los bancos emiten alertas automáticas por ingresos recurrentes o superiores a 1.000€).',
    TECNICA_SUSTITUCION: 'Usa el efectivo para pagar la totalidad de tus compras cotidianas en mano (supermercado, gasolina, restaurantes, ocio, farmacia, ropa y aportación familiar).',
    BLINDAJE_INVERSION: 'Al pagar todo tu consumo diario con el efectivo, tu nómina en la cuenta bancaria queda 100% limpia y disponible para transferir a fondos indexados, acciones o cuentas remuneradas.',
    LIMITE_LEGAL: 'En España, el límite legal para pagos en efectivo a comercios y profesionales es de 1.000€ por transacción.'
};

// Catálogo de APIs gratuitas para consulta de costes y cotizaciones de inversión
export const APIS_INVERSION_GRATUITAS = [
    {
        nombre: 'Yahoo Finance (Endpoints Públicos)',
        gratuita: true,
        requiereClave: false,
        limiteGratis: 'Sin clave de API',
        cobertura: 'ETFs globales (MSCI World, S&P 500), fondos indexados, acciones y divisas.',
        descripcion: 'La fuente más utilizada en finanzas personales. Permite consultar cotizaciones históricas, precios en tiempo real y ratios de gastos (TER).',
        urlDocumentacion: 'https://query1.finance.yahoo.com/v8/finance/chart/VWCE.DE',
        textoEnlace: 'Ver endpoint de ejemplo (VWCE)'
    },
    {
        nombre: 'Alpha Vantage',
        gratuita: true,
        requiereClave: true,
        limiteGratis: '25 peticiones / día',
        cobertura: 'Renta variable global, ETFs, divisas (Forex) y criptomonedas.',
        descripcion: 'API muy sólida con datos ajustados por dividendos y splits. Excelente para simulaciones de carteras a largo plazo.',
        urlDocumentacion: 'https://www.alphavantage.co/documentation/',
        textoEnlace: 'Documentación Alpha Vantage'
    },
    {
        nombre: 'CoinGecko API',
        gratuita: true,
        requiereClave: false,
        limiteGratis: '30 peticiones / minuto',
        cobertura: 'Precios en tiempo real, capitalización y evolución de criptoactivos.',
        descripcion: 'Totalmente abierta y gratuita sin necesidad de registrarse ni tarjeta de crédito.',
        urlDocumentacion: 'https://www.coingecko.com/es/api',
        textoEnlace: 'Documentación CoinGecko'
    },
    {
        nombre: 'Frankfurter API (Banco Central Europeo)',
        gratuita: true,
        requiereClave: false,
        limiteGratis: 'Ilimitada / Open Source',
        cobertura: 'Tipos de cambio oficiales entre Euro, Dólar y más de 30 divisas mundiales.',
        descripcion: 'Datos del Banco Central Europeo actualizados a diario para conversión exacta de inversiones en divisa extranjera.',
        urlDocumentacion: 'https://www.frankfurter.app/',
        textoEnlace: 'Documentación Frankfurter'
    }
];

// Perfiles presupuestarios inteligentes (los porcentajes de cada perfil suman exactamente 100)
export const PERFILES_PRESUPUESTO = {
    VIVIENDO_PADRES: {
        id: 'VIVIENDO_PADRES',
        nombre: 'Viviendo con padres (Aportación al hogar)',
        descripcion: 'Gastos fijos bajos. Ideal para liquidar deudas, acumular colchón y maximizar inversión.',
        partidas: [
            { concepto: 'Aportación comida y gastos del hogar', porcentaje: 18, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Contribución justa para la compra y casa (ideal para pagar en efectivo)' },
            { concepto: 'Dinero de bolsillo y gastos diarios', porcentaje: 7, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Efectivo en mano para compras cotidianas' },
            { concepto: 'Ocio, salidas de fin de semana y social', porcentaje: 7, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Restaurantes, copas o actividades en efectivo' },
            { concepto: 'Suscripciones digitales y telefonía', porcentaje: 3, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Herramientas digitales, streaming o móvil en cuenta' },
            { concepto: 'Ahorro líquido (Fondo de emergencia)', porcentaje: 35, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.AHORRO, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Colchón intocable en cuenta bancaria remunerada' },
            { concepto: 'Inversión a largo plazo (Fondos indexados)', porcentaje: 30, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.INVERSION, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Patrimonio bancarizado para rentabilidad compuesta' }
        ]
    },
    INDEPENDIENTE_ALQUILER: {
        id: 'INDEPENDIENTE_ALQUILER',
        nombre: 'Viviendo independiente / Alquiler',
        descripcion: 'Para quienes pagan vivienda propia o alquiler, suministros y cesta de la compra completa.',
        partidas: [
            { concepto: 'Alquiler o cuota de vivienda', porcentaje: 33, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Pago principal de techo por transferencia' },
            { concepto: 'Suministros (Luz, agua, gas e internet)', porcentaje: 8, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Facturas domiciliadas en cuenta bancaria' },
            { concepto: 'Cesta de la compra y alimentación', porcentaje: 15, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Supermercado y comida fresca (absorción prioritaria en efectivo)' },
            { concepto: 'Ocio, salidas y compras personales', porcentaje: 10, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Disfrute personal pagado en efectivo' },
            { concepto: 'Suscripciones y servicios digitales', porcentaje: 4, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Servicios en la nube y suscripciones en cuenta' },
            { concepto: 'Ahorro para imprevistos', porcentaje: 15, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.AHORRO, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Reserva para emergencias domésticas' },
            { concepto: 'Inversión patrimonial', porcentaje: 15, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.INVERSION, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Crecimiento de capital a largo plazo' }
        ]
    },
    REGLA_50_30_20: {
        id: 'REGLA_50_30_20',
        nombre: 'Regla Clásica 50 / 30 / 20',
        descripcion: 'El estándar financiero global: 50% Necesidades básicas, 30% Deseos y 20% Ahorro.',
        partidas: [
            { concepto: 'Necesidades básicas y hogar (50%)', porcentaje: 50, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Vivienda, facturas y alimentación indispensable' },
            { concepto: 'Deseos, ocio y estilo de vida (30%)', porcentaje: 30, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Caprichos y salidas pagados en efectivo' },
            { concepto: 'Ahorro e inversión futura (20%)', porcentaje: 20, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.AHORRO, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Construcción de colchón financiero e inversión' }
        ]
    },
    MAXIMO_AHORRO: {
        id: 'MAXIMO_AHORRO',
        nombre: 'Modo Ahorro Agresivo (Libertad Financiera)',
        descripcion: 'Para quienes tienen una meta urgente (comprar piso, crear empresa o ahorrar el 60-70%).',
        partidas: [
            { concepto: 'Gastos esenciales mínimos', porcentaje: 25, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Lo estrictamente necesario para vivir' },
            { concepto: 'Ocio controlado y caprichos', porcentaje: 5, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Mínimo indispensable en efectivo' },
            { concepto: 'Ahorro acelerado de emergencia', porcentaje: 35, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.AHORRO, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Fondo blindado de seguridad bancarizado' },
            { concepto: 'Inversión agresiva a largo plazo', porcentaje: 35, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.INVERSION, canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Generación de patrimonio compuesto en bróker' }
        ]
    }
};

// Caso de ejemplo personal guardado (importes en euros; se convierten a céntimos al cargarlos)
export const CASO_EJEMPLO_INICIAL = {
    ingresoCuenta: 1000.00,
    ingresoFisico: 400.00,
    gastosOptimizados: [
        { id: 'ejemplo-1', concepto: 'Aportación comida y hogar (Padres)', importe: 250.00, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, esencial: true, recurrente: true, descripcion: 'Aportación justa viviendo con padres en efectivo' },
        { id: 'ejemplo-2', concepto: 'Tonterías / Dinero de bolsillo', importe: 70.00, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: true, descripcion: 'Efectivo en mano para compras cotidianas' },
        { id: 'ejemplo-3', concepto: 'Suscripción ChatGPT Plus', importe: 20.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Herramienta de IA en tarjeta' },
        { id: 'ejemplo-4', concepto: 'Suscripción Google One', importe: 12.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Almacenamiento en la nube' },
        { id: 'ejemplo-5', concepto: 'API DeepSeek', importe: 5.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Consumo por uso de modelos de lenguaje' },
        { id: 'ejemplo-6', concepto: 'Botellón y salida de Feria', importe: 38.78, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: false, descripcion: 'Gasto puntual de ocio en efectivo' },
        { id: 'ejemplo-7', concepto: 'Deuda general pendiente', importe: 140.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Liquidada en Mes 1' },
        { id: 'ejemplo-8', concepto: 'Deuda FL Studio', importe: 40.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Liquidada en Mes 1' },
        { id: 'ejemplo-9', concepto: 'Reserva para recibo próximo mes', importe: 50.00, categoria: 'PREVISION_RESERVAS', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Apartado para Mes 2' },
        { id: 'ejemplo-10', concepto: 'Ahorro líquido de emergencia', importe: 474.22, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.AHORRO, canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: true, descripcion: 'Colchón intocable en cuenta remunerada' },
        { id: 'ejemplo-11', concepto: 'Inversión en fondo indexado MSCI World', importe: 300.00, categoria: 'AHORRO_INVERSION', subtipo: SUBTIPOS_PATRIMONIO.INVERSION, canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Aportación periódica automatizada al bróker' }
    ],
    transaccionesEjemplo: [
        { id: 'trans-ejemplo-1', fecha: '2026-09-02', mes: 1, lugar: 'Mercadona', importe: 42.50, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, notas: 'Compra semanal de comida fresca' },
        { id: 'trans-ejemplo-2', fecha: '2026-09-03', mes: 1, lugar: 'Bar de Tapas / Cerveza', importe: 18.00, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, notas: 'Salida con amigos tarde de viernes' },
        { id: 'trans-ejemplo-3', fecha: '2026-09-04', mes: 1, lugar: 'Suscripción ChatGPT Plus', importe: 20.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, notas: 'Cargo automático en tarjeta virtual' }
    ],
    deudasEjemplo: [
        { id: 'deuda-ejemplo-1', concepto: 'Deuda general pendiente', importeTotal: 140.00, cuotaMensual: 140.00, canal: CANALES_PAGO.CUENTA, notas: 'Liquidada en Mes 1' },
        { id: 'deuda-ejemplo-2', concepto: 'Deuda FL Studio', importeTotal: 40.00, cuotaMensual: 40.00, canal: CANALES_PAGO.CUENTA, notas: 'Liquidada en Mes 1' }
    ]
};
