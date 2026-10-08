// Progress Bar Animation for Radio Cards
class ProgressBarManager {
    constructor() {
        this.init();
    }
    
    init() {
        // Inizializza tutte le progress bar
        const radioCards = document.querySelectorAll('.radio-card[data-progress]');
        
        radioCards.forEach(card => {
            const progress = parseInt(card.getAttribute('data-progress')) || 100;
            const progressFill = card.querySelector('.progress-bar-fill');
            const percentageSpan = card.querySelector('.progress-percentage');
            
            if (progressFill) {
                // Imposta la variabile CSS per la larghezza
                progressFill.style.setProperty('--progress-width', `${progress}%`);
                
                // Se la card è già selezionata, anima il numero
                const input = card.querySelector('.card-input');
                if (input && input.checked) {
                    this.animateNumber(percentageSpan, 0, progress, 600);
                }
            }
            
            // Listener per il cambio di selezione
            const input = card.querySelector('.card-input');
            if (input) {
                input.addEventListener('change', () => {
                    if (input.checked) {
                        // Anima il numero da 0 alla percentuale target
                        setTimeout(() => {
                            this.animateNumber(percentageSpan, 0, progress, 600);
                        }, 100);
                    } else {
                        // Reset immediato quando deselezionato
                        if (percentageSpan) {
                            percentageSpan.textContent = '0%';
                        }
                    }
                });
            }
        });
    }
    
    animateNumber(element, start, end, duration) {
        if (!element) return;
        
        const startTime = performance.now();
        const range = end - start;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const currentValue = Math.round(start + (range * easeProgress));
            element.textContent = `${currentValue}%`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    new ProgressBarManager();
});
