// Constantes, perfiles presupuestarios y plantillas iniciales

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

// Perfiles inteligentes para autocalcular el presupuesto según la situación de vida del usuario
export const PERFILES_PRESUPUESTO = {
    VIVIENDO_PADRES: {
        id: 'VIVIENDO_PADRES',
        nombre: 'Viviendo con padres (Aportación al hogar)',
        descripcion: 'Gastos fijos bajos. Ideal para liquidar deudas, acumular colchón y maximizar inversión.',
        partidas: [
            { concepto: 'Aportación comida y gastos del hogar', porcentaje: 18, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Contribución justa para la compra y casa' },
            { concepto: 'Dinero de bolsillo y gastos diarios', porcentaje: 7, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Efectivo en mano para imprevistos y compras menores' },
            { concepto: 'Ocio, salidas de fin de semana y social', porcentaje: 7, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Restaurantes, copas o actividades sociales' },
            { concepto: 'Suscripciones digitales y telefonía', porcentaje: 3, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Herramientas digitales, streaming o móvil' },
            { concepto: 'Ahorro líquido (Fondo de emergencia)', porcentaje: 35, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Colchón intocable en cuenta remunerada' },
            { concepto: 'Inversión a largo plazo (Fondos indexados)', porcentaje: 30, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Patrimonio para el futuro e interés compuesto' }
        ]
    },
    INDEPENDIENTE_ALQUILER: {
        id: 'INDEPENDIENTE_ALQUILER',
        nombre: 'Viviendo independiente / Alquiler',
        descripcion: 'Para quienes pagan vivienda propia o alquiler, suministros y cesta de la compra completa.',
        partidas: [
            { concepto: 'Alquiler o cuota de vivienda', porcentaje: 33, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Pago principal de techo y vivienda' },
            { concepto: 'Suministros (Luz, agua, gas e internet)', porcentaje: 8, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Facturas domésticas mensuales' },
            { concepto: 'Cesta de la compra y alimentación', porcentaje: 15, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Supermercado y comida fresca en efectivo o tarjeta' },
            { concepto: 'Ocio, ocio personal y tonterías', porcentaje: 10, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Disfrute personal y desconexión' },
            { concepto: 'Suscripciones y servicios digitales', porcentaje: 4, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Servicios en la nube y suscripciones' },
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
            { concepto: 'Deseos, ocio y estilo de vida (30%)', porcentaje: 30, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Caprichos, salidas, viajes y compras personales' },
            { concepto: 'Ahorro e inversión futura (20%)', porcentaje: 20, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Construcción de colchón financiero e inversión' }
        ]
    },
    MAXIMO_AHORRO: {
        id: 'MAXIMO_AHORRO',
        nombre: 'Modo Ahorro Agresivo (Libertad Financiera)',
        descripcion: 'Para quienes tienen una meta urgente (comprar piso, crear empresa o ahorrar el 60-70%).',
        partidas: [
            { concepto: 'Gastos esenciales mínimos', porcentaje: 25, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Lo estrictamente necesario para vivir' },
            { concepto: 'Ocio controlado y caprichos', porcentaje: 5, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, recurrente: true, descripcion: 'Mínimo indispensable para disfrute' },
            { concepto: 'Ahorro acelerado de emergencia', porcentaje: 35, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Fondo blindado de seguridad' },
            { concepto: 'Inversión agresiva a largo plazo', porcentaje: 35, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, recurrente: true, descripcion: 'Generación de patrimonio compuesto' }
        ]
    }
};

// Caso de ejemplo personal (guardado para demostración y consulta del usuario)
export const CASO_EJEMPLO_INICIAL = {
    ingresoMes1: 1400.00,
    ingresoMesSiguientes: 1600.00,
    gastosOptimizados: [
        { id: 'ejemplo-1', concepto: 'Aportación comida y hogar (Padres)', importe: 250.00, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, esencial: true, recurrente: true, descripcion: 'Aportación justa viviendo con padres (frente a los 770€ insostenibles)' },
        { id: 'ejemplo-2', concepto: 'Tonterías / Dinero de bolsillo', importe: 70.00, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: true, descripcion: 'Efectivo en mano para compras cotidianas' },
        { id: 'ejemplo-3', concepto: 'Suscripción ChatGPT Plus', importe: 20.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Inteligencia artificial para desarrollo personal' },
        { id: 'ejemplo-4', concepto: 'Suscripción Google One', importe: 12.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Almacenamiento en la nube' },
        { id: 'ejemplo-5', concepto: 'API DeepSeek', importe: 5.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Consumo de modelos de IA' },
        { id: 'ejemplo-6', concepto: 'Botellón y salida de Feria', importe: 38.78, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: false, descripcion: 'Gasto puntual de ocio en efectivo' },
        { id: 'ejemplo-7', concepto: 'Deuda general pendiente', importe: 140.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Se liquida completamente en el Mes 1' },
        { id: 'ejemplo-8', concepto: 'Deuda FL Studio', importe: 40.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Cuota de software liquidada en Mes 1' },
        { id: 'ejemplo-9', concepto: 'Reserva para recibo próximo mes', importe: 50.00, categoria: 'PREVISION_RESERVAS', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Reserva para pagar recibo entero en Mes 2' }
    ],
    gastosOriginalesConDeficit: [
        { id: 'ejemplo-orig-1', concepto: 'Comida indispensables (Supuesto inicial)', importe: 770.00, categoria: 'VIVIENDA_COMIDA', canal: CANALES_PAGO.FISICO, esencial: true, recurrente: true, descripcion: 'Gasto desmedido que provocaba déficit de -165,78€' },
        { id: 'ejemplo-orig-2', concepto: 'Tonterías / Caprichos', importe: 70.00, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: true, descripcion: 'Gastos personales en efectivo' },
        { id: 'ejemplo-orig-3', concepto: 'Suscripciones digitales (ChatGPT, Google, DeepSeek)', importe: 37.00, categoria: 'DIGITAL_SUSCRIPCIONES', canal: CANALES_PAGO.CUENTA, esencial: false, recurrente: true, descripcion: 'Servicios en la nube e IA' },
        { id: 'ejemplo-orig-4', concepto: 'Botellón feria', importe: 38.78, categoria: 'OCIO_ESTILO_VIDA', canal: CANALES_PAGO.FISICO, esencial: false, recurrente: false, descripcion: 'Ocio social' },
        { id: 'ejemplo-orig-5', concepto: 'Deudas totales', importe: 180.00, categoria: 'DEUDAS_OBLIGACIONES', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Deuda general (140€) + FL Studio (40€)' },
        { id: 'ejemplo-orig-6', concepto: 'Reserva recibo', importe: 50.00, categoria: 'PREVISION_RESERVAS', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: false, mesFiniquito: 1, descripcion: 'Apartado para el mes que viene' },
        { id: 'ejemplo-orig-7', concepto: 'Ahorro pretendido', importe: 210.00, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: true, descripcion: 'Meta inalcanzable con 770€ de comida' },
        { id: 'ejemplo-orig-8', concepto: 'Inversión pretendida', importe: 210.00, categoria: 'AHORRO_INVERSION', canal: CANALES_PAGO.CUENTA, esencial: true, recurrente: true, descripcion: 'Meta inalcanzable con 770€ de comida' }
    ]
};
