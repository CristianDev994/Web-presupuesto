# Presupuesto Personal Inteligente 💰

Aplicación web progresiva (PWA) para el control financiero mensual con **separación bicanal** entre cuenta bancaria y efectivo físico. Diseño *mobile first*, cálculos exactos al céntimo, gestión integral de deudas con plan de amortización, sobres digitales de gasto diario, proyección configurable a 6, 12 o 24 meses y exportación profesional a Excel.

No necesita servidor ni base de datos: funciona 100 % en local y sin conexión a internet.

---

## ✨ Qué hace

- **Reparte tu sueldo al céntimo.** Introduces lo que cobras en banco y en efectivo, eliges tu situación de vida y la app genera las partidas. La suma de todas ellas es *exactamente* tu sueldo neto, sin descuadres de un céntimo.
- **Gestión integral de deudas y compromisos.** Registra préstamos, tarjetas o créditos con acreedor, saldo y cuota. Permite amortizaciones extraordinarias, calcula la fecha estimada de libertad financiera y sincroniza automáticamente las cuotas con el presupuesto y la proyección.
- **Duración de la deuda a tu manera.** Defínela por cuota mensual (y la app calcula cuánto durará) o por duración en **días, meses o años** (y la app calcula la cuota). El resultado se ve mientras escribes, incluida la última cuota cuando el reparto no es exacto.
- **Qué parte de tu sueldo se va en deudas.** Calcula el porcentaje exacto de tus ingresos netos que se destina a cuotas, lo compara con la referencia habitual del 35 %, indica cuánto margen o exceso tienes en euros y en qué mes bajarás del límite si mantienes el plan.
- **Te dice cuánto sacar del cajero.** Calcula qué gastos conviene pagar en billetes y cuánto dinero bancario queda libre para invertir.
- **Sobres digitales por categoría.** Anotas cada compra con su lugar (Mercadona, gasolinera, bar…) y ves en tiempo real cuánto te queda en cada sobre con botón rápido directo.
- **Proyección patrimonial flexible.** Horizonte temporal configurable a 6, 12 o 24 meses: evolución mensual de ingresos, gastos fijos, deudas liquidadas, ahorro, inversión y patrimonio total acumulado.
- **PWA instalable y modo sin conexión.** Service Worker y manifiesto integrados para instalar la aplicación en el móvil u ordenador como app nativa independiente.
- **Exportación real a Excel (.xlsx)** con hasta 6 hojas estructuradas (incluyendo hoja de Deudas y Compromisos) y los importes como números con formato de moneda española listos para sumar.
- **Copias de seguridad en JSON con salvaguarda.** Snapshot preventivo automático en el navegador antes de sobrescribir datos durante una importación.

---

## 📱 Diseño móvil

La interfaz está construida *mobile first*: las reglas base describen el móvil y las media queries amplían hacia tablet y escritorio.

- Barra de navegación inferior fija con botón **Más** para las secciones secundarias y las acciones de datos.
- Las tablas se convierten en **tarjetas legibles** en pantallas estrechas (nada de scroll horizontal ni de pellizcar para hacer zoom).
- Modales que funcionan como hojas inferiores, con el pie de botones siempre visible y el cuerpo desplazable.
- Áreas táctiles de 44 px como mínimo y campos de 16 px para que iOS no haga zoom al enfocarlos.
- Respeta las zonas seguras de los móviles con muesca (`env(safe-area-inset-*)`).
- Tema **claro y oscuro** con conmutador propio; por defecto sigue la preferencia del sistema.
- Verificado sin desbordamiento horizontal a 320, 360, 390, 768 y 1440 px.

---

## 🧮 Exactitud de los cálculos

Todo el dinero se maneja internamente como un **número entero de céntimos**. Nunca se suman euros en coma flotante, así que no aparecen errores del tipo `0.1 + 0.2 = 0.30000000000000004` ni totales que fallan por un céntimo.

- `utilidades_dinero.js` concentra la aritmética: conversión, reparto y formateo.
- El reparto por porcentajes usa el **método del resto mayor**: la suma de las partidas es siempre exactamente el importe repartido.
- El excedente mensual se divide entre ahorro e inversión sin perder ni duplicar céntimos, incluso con cantidades impares.
- Los campos de importe aceptan la **coma decimal española** (`1.234,56`) además del punto.
- Se cumple siempre la identidad contable: `ingreso = consumo + ahorro + inversión + balance`.
- La carga de deuda también cuadra: `cuotas + resto del sueldo = ingreso neto`.
- Los importes a amortizar se expresan siempre en céntimos, sin deducir la unidad por su magnitud.

### Ejecutar las pruebas

```bash
node pruebas_calculos.mjs
```

Cubre conversión y redondeo, repartos sin pérdida de céntimos, la identidad contable de cada mes, la proyección acumulada, los sobres, el flujo bicanal, la migración de datos guardados con versiones anteriores y el formato español.

---

## 💻 Ejecución en local

```bash
node servidor.js
```

Y abre 👉 **http://localhost:8085**

También sirve cualquier servidor estático (`npx serve`, Live Server de VS Code…). Al usar módulos ES, no funciona abriendo `index.html` con doble clic desde el sistema de archivos.

---

## 🌐 Publicación en GitHub Pages

La aplicación es 100 % estática, así que puede alojarse gratis:

1. Sube el repositorio a GitHub.
2. Ve a **Settings** → **Pages**.
3. En **Build and deployment** → **Source**, elige `Deploy from a branch`.
4. Selecciona la rama principal y la carpeta `/ (root)`, y pulsa **Save**.

---

## 📂 Estructura

| Archivo | Cometido |
|---|---|
| `index.html` | Estructura de la interfaz |
| `estilos.css` | Sistema de diseño mobile first con temas claro y oscuro |
| `app.js` | Punto de entrada |
| `controlador_interfaz.js` | Eventos, renderizado y accesibilidad |
| `gestor_financiero.js` | Motor de cálculo en céntimos enteros |
| `utilidades_dinero.js` | Aritmética monetaria exacta y formateo español |
| `datos_iniciales.js` | Categorías, perfiles presupuestarios y catálogo de APIs |
| `exportador_excel.js` | Generación del libro `.xlsx` con soporte para hoja de deudas |
| `manifest.json` | Manifiesto PWA para instalación en móviles y escritorio |
| `sw.js` | Service Worker para funcionamiento sin conexión (App Shell) |
| `icono.svg` | Icono vectorial para PWA y accesos directos |
| `pruebas_calculos.mjs` | Pruebas de exactitud del motor (47 bloques) |
| `servidor.js` | Servidor local de desarrollo sin dependencias |

---

## 🔒 Privacidad

No hay backend, ni cuentas, ni analítica. Los datos viven en el `localStorage` de tu navegador y solo salen de ahí si tú descargas una copia en JSON o en Excel.
