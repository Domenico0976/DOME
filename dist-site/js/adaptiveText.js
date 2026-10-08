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
        const cardHeader = element.closest('.card-header');
        if (!cardHeader) return;
        
        const flex2 = cardHeader.closest('.flex-2');
        if (!flex2) return;
        
        // Larghezza disponibile nel card-header (considerando padding)
        const cardHeaderWidth = cardHeader.offsetWidth - 24; // 12px padding left + margine
        
        // Reset font size per calcolare correttamente
        element.style.fontSize = '';
        
        // Font size basato sulla larghezza del card-header
        // Min: 16px, Max: basato sulla larghezza disponibile
        const minFontSize = 16;
        const maxFontSize = Math.min(cardHeaderWidth * 0.15, 72); // Max 72px o 15% della larghezza
        
        // Calcola font size ottimale basato sulla lunghezza del testo
        const textLength = element.textContent.length;
        let fontSize = maxFontSize;
        
        // Se il testo è molto lungo, riduci la dimensione base
        if (textLength > 20) {
            fontSize = Math.max(maxFontSize * 0.6, minFontSize);
        } else if (textLength > 12) {
            fontSize = Math.max(maxFontSize * 0.75, minFontSize);
        } else if (textLength > 8) {
            fontSize = Math.max(maxFontSize * 0.85, minFontSize);
        }
        
        element.style.fontSize = `${fontSize}px`;
        
        // Verifica se il testo va a capo correttamente
        // Se occupa troppo spazio verticalmente, riduci leggermente
        const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
        const maxLines = 3; // Massimo 3 righe
        
        while (element.offsetHeight > (lineHeight * maxLines) && fontSize > minFontSize) {
            fontSize -= 1;
            element.style.fontSize = `${fontSize}px`;
        }
        
        // Assicurati che il font non sia mai sotto il minimo
        if (fontSize < minFontSize) {
            element.style.fontSize = `${minFontSize}px`;
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
