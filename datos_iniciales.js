// Constantes, perfiles presupuestarios, estrategias de efectivo, lugares y APIs de inversión

export const CANALES_PAGO = {
    CUENTA: 'Cuenta Bancaria',
    FISICO: 'Efectivo Físico'
};

export const CATEGORIAS_GASTO = {
    VIVIENDA_COMIDA: { nombre: 'Comida y Aportación Hogar', icono: 'utensils', color: '#10b981' },
    DIGITAL_SUSCRIPCIONES: { nombre: 'Suscripciones y Facturas', icono: 'laptop', color: '#6366f1' },
    DEUDAS_OBLIGACIONES: { nombre: 'Deudas y Obligaciones', icono: 'credit-card', color: '#ef4444' },
    OCIO_ESTILO_VIDA: { nombre: 'Ocio y Gastos Personales', icono: 'sparkles', color: '#f59e0b' },
    PREVISION_RESERVAS: { nombre: 'Previsión de Recibos / Fondo', icono: 'calendar-check', color: '#8b5cf6' },
    AHORRO_INVERSION: { nombre: 'Ahorro e Inversión', icono: 'trending-up', color: '#06b6d4' }
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
        cobertura: 'ETFs globales (MSCI World, S&P 500), fondos indexados, acciones y divisas.',
        descripcion: 'La fuente más utilizada en finanzas personales. Permite consultar cotizaciones históricas, precios en tiempo real y ratios de gastos (TER).',
        urlDocumentacion: 'https://query1.finance.yahoo.com/v8/finance/chart/'
    },
    {
        nombre: 'Alpha Vantage',
        gratuita: true,
        requiereClave: true,
        limiteGratis: '25 peticiones / día',
        cobertura: 'Renta variable global, ETFs, divisas (Forex) y criptomonedas.',
        descripcion: 'API muy sólida con datos ajustados por dividendos y splits. Excelente para simulaciones de carteras a largo plazo.',
        urlDocumentacion: 'https://www.alphavantage.co/'
    },
    {
        nombre: 'CoinGecko API',
        gratuita: true,
        requiereClave: false,
        limiteGratis: '30 peticiones / minuto',
        cobertura: 'Precios en tiempo real, capitalización y evolución de criptoactivos.',
        descripcion: 'Totalmente abierta y gratuita sin necesidad de registrarse ni tarjeta de crédito.',
        urlDocumentacion: 'https://www.coingecko.com/es/api'
    },
    {
        nombre: 'Frankfurter API (Banco Central Europeo)',
        gratuita: true,
        requiereClave: false,
        limiteGratis: 'Ilimitada / Open Source',
        cobertura: 'Tipos de cambio oficiales entre Euro, Dólar y más de 30 divisas mundiales.',
        descripcion: 'Datos del Banco Central Europeo actualizados a diario para conversión exacta de inversiones en divisa extranjera.',
        urlDocumentacion: 'https://www.frankfurter.app/'
    }
];

// Perfiles presupuestarios inteligentes
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
            { concepto: 'Ahorro líquido (Fondo de emergencia)', porcentaje: 35, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Colchón intocable en cuenta bancaria remunerada' },
            { concepto: 'Inversión a largo plazo (Fondos indexados)', porcentaje: 30, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Patrimonio bancarizado para rentabilidad compuesta' }
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
            { concepto: 'Ahorro para imprevistos', porcentaje: 15, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Reserva para emergencias domésticas' },
            { concepto: 'Inversión patrimonial', porcentaje: 15, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Crecimiento de capital a largo plazo' }
        ]
    },
    REGLA_50_30_20: {
        id: 'REGLA_50_30_20',
        nombre: 'Regla Clásica 50 / 30 / 20',
        descripcion: 'El estándar financiero global: 50% Necesidades básicas, 30% Deseos y 20% Ahorro.',
        partidas: [
            { concepto: 'Necesidades básicas y hogar (50%)', porcentaje: 50, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Vivienda, facturas y alimentación indispensable' },
            { concepto: 'Deseos, ocio y estilo de vida (30%)', porcentaje: 30, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Caprichos y salidas pagados en efectivo' },
            { concepto: 'Ahorro e inversión futura (20%)', porcentaje: 20, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Construcción de colchón financiero e inversión' }
        ]
    },
    MAXIMO_AHORRO: {
        id: 'MAXIMO_AHORRO',
        nombre: 'Modo Ahorro Agresivo (Libertad Financiera)',
        descripcion: 'Para quienes tienen una meta urgente (comprar piso, crear empresa o ahorrar el 60-70%).',
        partidas: [
            { concepto: 'Gastos esenciales mínimos', porcentaje: 25, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Lo estrictamente necesario para vivir' },
            { concepto: 'Ocio controlado y caprichos', porcentaje: 5, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Mínimo indispensable en efectivo' },
            { concepto: 'Ahorro acelerado de emergencia', porcentaje: 35, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Fondo blindado de seguridad bancarizado' },
            { concepto: 'Inversión agresiva a largo plazo', porcentaje: 35, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Generación de patrimonio compuesto en bróker' }
        ]
    }
};

// Caso de ejemplo personal guardado
export const CASO_EJEMPLO_INICIAL = {
    ingresoCuenta: 1000.00,
    ingresoFisico: 400.00,
    ingresoMes1: 1400.00,
    ingresoMesSiguientes: 1600.00,
    gastosOptimizados: [
        { id: 'ejemplo-1', concepto: 'Aportación comida y hogar (Padres)', importe: 250.00, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, esencial: true, recurrente: true, descripcion: 'Aportación justa viviendo con padres en efectivo' },
        { id: 'ejemplo-2', concepto: 'Tonterías / Dinero de bolsillo', importe: 70.00, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: true, descripcion: 'Efectivo en mano para compras cotidianas' },
        { id: 'ejemplo-3', concepto: 'Suscripción ChatGPT Plus', importe: 20.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Herramienta de IA en tarjeta' },
        { id: 'ejemplo-4', concepto: 'Suscripción Google One', importe: 12.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Almacenamiento en la nube' },
        { id: 'ejemplo-5', concepto: 'API DeepSeek', importe: 5.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Consumo por uso de modelos de lenguaje' },
        { id: 'ejemplo-6', concepto: 'Botellón y salida de Feria', importe: 38.78, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: false, descripcion: 'Gasto puntual de ocio en efectivo' },
        { id: 'ejemplo-7', concepto: 'Deuda general pendiente', importe: 140.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Liquidada en Mes 1' },
        { id: 'ejemplo-8', concepto: 'Deuda FL Studio', importe: 40.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Liquidada en Mes 1' },
        { id: 'ejemplo-9', concepto: 'Reserva para recibo próximo mes', importe: 50.00, categoria: 'PREVISION_RESERVAS', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Apartado para Mes 2' }
    ],
    transaccionesEjemplo: [
        { id: 'trans-ejemplo-1', fecha: '2026-09-02', lugar: 'Mercadona', importe: 42.50, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, notas: 'Compra semanal de comida fresca' },
        { id: 'trans-ejemplo-2', fecha: '2026-09-03', lugar: 'Bar de Tapas / Cerveza', importe: 18.00, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, notas: 'Salida con amigos tarde de viernes' },
        { id: 'trans-ejemplo-3', fecha: '2026-09-04', lugar: 'Suscripción ChatGPT Plus', importe: 20.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, notas: 'Cargo automático en tarjeta virtual' }
    ]
};
