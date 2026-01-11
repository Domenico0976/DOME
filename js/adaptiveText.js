// Adaptive Text Size per card-header
class AdaptiveText {
    constructor() {
        this.init();
    }
    
    init() {
        this.adjustAllTexts();
        
        // Riadatta al resize della finestra
        window.addEventListener('resize', () => {
            this.adjustAllTexts();
        });
        
        // Osserva i cambiamenti nel DOM per testi che vengono aggiornati dinamicamente
        const observer = new MutationObserver(() => {
            this.adjustAllTexts();
        });
        
        // Osserva tutte le card-header per cambiamenti
        document.querySelectorAll('.card-header').forEach(header => {
            observer.observe(header, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });
    }
    
    adjustAllTexts() {
        const citySpans = document.querySelectorAll('.card-header span:first-child');
        
        citySpans.forEach(span => {
            this.adjustTextSize(span);
        });
    }
    
    adjustTextSize(element) {
        const card = element.closest('.card');
        if (!card) return;
        
        const cardWidth = card.offsetWidth;
        const targetWidth = cardWidth * 0.7; // 70% della larghezza della card
        
        // Reset font size per calcolare correttamente
        element.style.fontSize = '';
        
        // Font size massimo e minimo
        const maxFontSize = cardWidth * 0.15; // 15% della larghezza della card
        const minFontSize = cardWidth * 0.05; // 5% della larghezza della card
        
        let fontSize = maxFontSize;
        element.style.fontSize = `${fontSize}px`;
        
        // Riduci il font size finché il testo non sta in una linea entro il 70%
        while (element.scrollWidth > targetWidth && fontSize > minFontSize) {
            fontSize -= 0.5;
            element.style.fontSize = `${fontSize}px`;
        }
        
        // Se il testo è troppo corto, aumenta gradualmente
        if (element.scrollWidth < targetWidth * 0.5 && fontSize < maxFontSize) {
            while (element.scrollWidth < targetWidth && fontSize < maxFontSize) {
                fontSize += 0.25;
                element.style.fontSize = `${fontSize}px`;
                
                // Previeni overflow
                if (element.scrollWidth > targetWidth) {
                    fontSize -= 0.55;
                    element.style.fontSize = `${fontSize}px`;
                    break;
                }
            }
        }
    }
}

// Inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.adaptiveTextInstance = new AdaptiveText();
    });
} else {
    window.adaptiveTextInstance = new AdaptiveText();
}
