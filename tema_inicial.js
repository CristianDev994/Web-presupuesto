// Aplica la preferencia visual antes del primer pintado para evitar parpadeos.
(function aplicarTemaInicial() {
    try {
        const temaGuardado = localStorage.getItem('presupuesto_tema');
        const prefiereClaro = window.matchMedia('(prefers-color-scheme: light)').matches;
        document.documentElement.setAttribute('data-tema', temaGuardado || (prefiereClaro ? 'claro' : 'oscuro'));
    } catch (_error) {
        document.documentElement.setAttribute('data-tema', 'oscuro');
    }
})();
