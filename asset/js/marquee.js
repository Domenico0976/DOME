// Marquee effect for elements with #marquee id
document.addEventListener('DOMContentLoaded', () => {
    const marqueeElements = document.querySelectorAll('.marquee');

    if (!marqueeElements) return;

    marqueeElements.forEach(marqueeElement => {
        // Salva il testo originale
        const originalText = marqueeElement.textContent;
    
    // Crea il wrapper per il marquee che eredita la classe CSS
    const marqueeWrapper = document.createElement('div');
    marqueeWrapper.className = 'marquee';
    marqueeWrapper.style.cssText = `
        overflow: hidden;
        white-space: nowrap;
    `;
    
    // Crea il contenuto scorrevole che eredita gli stili CSS
    const marqueeContent = document.createElement('div');
    marqueeContent.style.cssText = `
        display: inline-block;
        white-space: nowrap;
        font-size: inherit;
        color: inherit;
        font-family: inherit;
        font-weight: inherit;
        background-color: inherit;
        opacity: inherit;
    `;

    // Duplica il testo per creare un loop seamless con spaziatura controllata
    const separator = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'; // Spazio controllato
    marqueeContent.innerHTML = `${originalText}${separator}${originalText}${separator}${originalText}${separator}${originalText}${separator}`;

    // Non copiare NESSUNO stile - usa solo la classe CSS .marquee
    // Tutti gli stili vengono dalla classe CSS

    // Sostituisci l'elemento originale con il nuovo wrapper
    marqueeWrapper.appendChild(marqueeContent);
    marqueeElement.parentNode.replaceChild(marqueeWrapper, marqueeElement);

    let currentAnimation;
    let isHovered = false;
    
    // Funzione per inizializzare/riavviare l'animazione
    function initMarqueeAnimation() {
        // Ferma l'animazione esistente se presente
        if (currentAnimation) {
            currentAnimation.kill();
        }
        
        // Ricalcola la larghezza totale del contenuto
        const totalWidth = marqueeContent.scrollWidth;
        const segmentWidth = totalWidth / 4; // Diviso per 4 ripetizioni
        
        // Non modificare la larghezza - è gestita dal CSS
        
        // Animazione GSAP seamless usando fromTo per evitare scatti
        currentAnimation = gsap.fromTo(marqueeContent, 
            { x: 0 },
            {
                x: -segmentWidth,
                duration: 10, // Velocizzato da 15 a 10 secondi
                ease: "none",
                repeat: -1,
                repeatDelay: 0,
                // Usa modifiers per un loop matematicamente perfetto
                modifiers: {
                    x: function(x) {
                        return (parseFloat(x) % segmentWidth) + "px";
                    }
                }
            }
        );
    }

    // Funzione per fermare gentilmente l'animazione
    function pauseMarqueeAnimation() {
        if (currentAnimation && !isHovered) {
            isHovered = true;
            gsap.to(currentAnimation, {
                timeScale: 0,
                duration: 0.65,
                ease: "power2.out"
            });
        }
    }

    // Funzione per riprendere gentilmente l'animazione
    function resumeMarqueeAnimation() {
        if (currentAnimation && isHovered) {
            isHovered = false;
            gsap.to(currentAnimation, {
                timeScale: 1,
                duration: 0.65,
                ease: "power2.out"
            });
        }
    }
    
    // Inizializza l'animazione dopo il render del DOM
    setTimeout(() => {
        initMarqueeAnimation();
    }, 100);
    
    // Listener per il resize della finestra
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // Debounce per evitare troppi ricalcoli durante il resize
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            initMarqueeAnimation();
        }, 150);
    });

    // Listener per hover - pausa e riprendi l'animazione
    marqueeWrapper.addEventListener('mouseenter', pauseMarqueeAnimation);
    marqueeWrapper.addEventListener('mouseleave', resumeMarqueeAnimation);

    // Non serve listener per il tema - il CSS si aggiorna automaticamente
    // Le variabili CSS --scheme-txt e --scheme-bg cambiano da sole
});
});
