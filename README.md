# Presupuesto Personal Inteligente 💰

Aplicación web interactiva, moderna y universal para el control financiero mensual, cálculo automático de gastos según sueldo neto y separación operativa entre **Cuenta Bancaria** y **Efectivo Físico**. Incluye simulación a 6 meses, gráficos interactivos y exportación directa a Excel (`.xlsx`).

---

## 🚀 Características Principales

- **Asistente de Sueldo Neto Universal**: Introduce tus ingresos limpios mensuales y calcula automáticamente las partidas sugeridas de acuerdo a tu situación de vida:
  - 🏠 *Viviendo con padres* (Aportación justa al hogar + Ahorro explosivo).
  - 🔑 *Viviendo independiente / Alquiler* (Vivienda, facturas domésticas y compra).
  - ⚖️ *Regla Clásica 50 / 30 / 20* (50% Necesidades, 30% Deseos, 20% Ahorro).
  - 🚀 *Modo Ahorro Agresivo* (Reducción de gastos y 70% ahorro e inversión).
- **Separación Cuenta Bancaria vs. Efectivo Físico**:
  - Indica con exactitud cuánto dinero retirar en billetes del cajero a principios de mes y cuánto mantener en el banco para recibos automáticos.
  - Alterna el canal de pago de cualquier gasto con un solo clic sobre su etiqueta.
- **Visualizador Tipo Excel a 6 Meses**: Proyección mensual de ingresos, gastos, liquidación de deudas y acumulación patrimonial.
- **Exportación Real a Excel (.xlsx)**: Genera y descarga un libro de cálculo nativo con 4 hojas detalladas (`Presupuesto_6_Meses`, `Cuenta_vs_Fisico`, `Desglose_Partidas` y `Salud_Financiera`).
- **Gráficos Dinámicos**: Donut por categorías de gasto, comparador de canales de pago y evolución del patrimonio a largo plazo con Chart.js.
- **Privacidad Total**: No requiere backend ni base de datos externa; todos tus datos se almacenan de forma privada y local en tu navegador (`localStorage`).

---

## 💻 Ejecución en Local

Para probar o usar la aplicación en tu propio ordenador:

```powershell
# Iniciar el servidor local incluido (Node.js)
node servidor.js
```

Luego abre en tu navegador:
👉 **http://localhost:8085**

*(Opcionalmente, puedes abrir directamente el archivo `index.html` con cualquier servidor estático como Live Server en VS Code o `npx serve`)*.

---

## 🌐 Publicación Gratuita en GitHub Pages

Esta aplicación es 100% estática, por lo que puedes alojarla en GitHub Pages con coste 0€:

1. Crea un repositorio en tu cuenta de GitHub (ejemplo: `mi-presupuesto`).
2. Sube los archivos:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/mi-presupuesto.git
   git branch -M main
   git push -u origin main
   ```
3. En tu repositorio de GitHub, ve a **Settings** > **Pages**.
4. En **Build and deployment** > **Source**, selecciona `Deploy from a branch`.
5. Elige la rama `main` y la carpeta `/ (root)`, luego pulsa **Save**.
6. ¡Listo! Tu web estará disponible públicamente en `https://TU_USUARIO.github.io/mi-presupuesto/`.
