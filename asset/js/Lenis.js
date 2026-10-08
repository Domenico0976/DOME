// Global Lenis singleton and stable callback reference
window.myLenisInstance = null;

// Mantieni riferimento stabile alla callback per gsap.ticker
window.myLenisUpdate = (t) => {
  if (window.myLenisInstance) {
    window.myLenisInstance.raf(t * 1000);
  }
};

function startLenisGlobal() {
  if (window.myLenisInstance) return window.myLenisInstance;

  window.myLenisInstance = new Lenis({
    lerp: 0.09,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: true,
    syncTouchLerp: 0.075,
    wheelMultiplier: 0.7,
    touchMultiplier: 0.9,
    orientation: 'vertical',
    gestureOrientation: 'vertical'
  });

  gsap.ticker.add(window.myLenisUpdate);

  return window.myLenisInstance;
}

function stopLenisGlobal() {
  if (window.myLenisInstance) {
    gsap.ticker.remove(window.myLenisUpdate);
    try {
      window.myLenisInstance.destroy();
    } catch {}
    window.myLenisInstance = null;
  }
}

function disableScroll() {
  if (window.myLenisInstance) {
    window.myLenisInstance.stop(); // Ferma Lenis SENZA distruggere l'istanza
  }
  //document.documentElement.style.overflow = "hidden";
}

function enableScroll() {
  document.documentElement.style.overflow = "";
  if (window.myLenisInstance) {
    window.myLenisInstance.start(); // Riavvia Lenis dalla stessa posizione
  }
}
// Avvia Lenis globalmente alla fine del caricamento della pagina
window.addEventListener('load', () => {
  startLenisGlobal();
});