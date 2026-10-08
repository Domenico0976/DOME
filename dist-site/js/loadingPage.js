// Context GSAP globale per gestire le animazioni della loading page
let loadingCtx = null;

// Reset completo al ricaricamento/navigazione
function resetLoadingAnimations() {
    if (loadingCtx) {
        loadingCtx.revert(); // Ripristina tutti gli stili iniziali e rimuove animazioni
        loadingCtx = null;
    }
}

// Reset prima del ricaricamento pagina
window.addEventListener('beforeunload', resetLoadingAnimations);

// Reset anche su pagehide (per bfcache)
window.addEventListener('pagehide', resetLoadingAnimations);

// Gestione pageshow per bfcache (back/forward cache)
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // La pagina è stata ripristinata dalla cache, reinizializza
        resetLoadingAnimations();
        initLoadingAnimations();
    }
});

function initLoadingAnimations() {
    function startLoader() {
        let counterElement = document.querySelector('.counter');
        let currentValue = 0;

        function updateCounter() {
            if (currentValue === 100) {
                return;
            }
            currentValue += Math.floor(Math.random() * 10) + 1;

            if (currentValue > 100) {
                currentValue = 100;
            }
            if (counterElement) counterElement.textContent = currentValue;
            let delay = Math.floor(Math.random() * 200) + 50;
            setTimeout(updateCounter, delay);
        }
        updateCounter();
    }

    startLoader();

    // Animazione counter
    if (typeof gsap !== 'undefined') {
        // Crea un context GSAP per gestire tutte le animazioni
        loadingCtx = gsap.context(() => {
            // Riferimenti agli elementi (stato iniziale gestito dal CSS)
            const upgradeEl = document.querySelector('.upgrade');
            const upgradeChildren = upgradeEl ? upgradeEl.querySelectorAll('.bento-grid > *, .flex-3 > *') : [];

            gsap.from('.counter', {
                opacity: 1,
                y: 50
            });

            // Timeline principale per sincronizzare my-tu, bars e #items
            const mainTl = gsap.timeline();

            // Animazione testo .my-tu sui caratteri (usa SplitType se disponibile)
            const myEls = Array.from(document.querySelectorAll('.my-tu'));
            let allChars = [];
            if (myEls.length) {
                try {
                    if (typeof SplitType !== 'undefined') {
                        myEls.forEach(el => {
                            const split = new SplitType(el, { types: 'chars', tagName: 'span' });
                            if (split.chars && split.chars.length) allChars.push(...split.chars);
                        });
                    } else {
                        // fallback: avvolgi manualmente i caratteri
                        myEls.forEach(el => {
                            const txt = el.textContent || '';
                            el.innerHTML = txt.split('').map(c => `<span class="char">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
                            allChars.push(...el.querySelectorAll('.char'));
                        });
                    }
                } catch (e) {
                    // fallback semplice
                    myEls.forEach(el => {
                        const txt = el.textContent || '';
                        el.innerHTML = txt.split('').map(c => `<span class="char">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
                        allChars.push(...el.querySelectorAll('.char'));
                    });
                }
            }

            if (allChars.length) {
                gsap.set(allChars, { opacity: 0, y: 40 });
                // animazione dei caratteri dalla baseline verso l'alto
                mainTl.to(allChars, {
                    opacity: 1,
                    delay: 0.5,
                    y: 0,
                    duration: 1,
                    ease: 'power1.out',
                    stagger: 0.05
                }, 0); // inizia all'inizio della timeline
            }

            // Seleziona tutte le .bar-n (bar-1, bar-2, ...)
            const bars = Array.from(document.querySelectorAll('[class^="bar-"]'));
            if (bars.length) {
                // animazione delle barre in parallelo all'inizio della timeline
                mainTl.to(bars, {
                    height: 0,
                    delay: 1,
                    duration: 1.54,
                    ease: 'power1.inOut',
                    stagger: 0.18
                }, 0);
            }

            // Animazione di .background .container (il box con il testo DomenicoFusto)
            mainTl.to('.background .container', {
                x: -100,
                opacity: 0,
                duration: 0.55,
                scale: 0.7,
                ease: 'power1.in',
                onComplete: () => {
                    // Avvia animazione di .upgrade
                    revealUpgrade();
                }
            }, 4);
            
            // Nascondi anche il counter
            mainTl.to('.counter', {
                opacity: 0,
                duration: 0.3,
                ease: 'power1.in'
            }, 4);

            // Funzione per rivelare .upgrade con animazione
            function revealUpgrade() {
                if (!upgradeEl) return;
                
                // Timeline per reveal di .upgrade
                const revealTl = gsap.timeline();
                
                // 1. Mostra il container .upgrade
                revealTl.to(upgradeEl, {
                    opacity: 1,
                    visibility: 'visible',
                    duration: 0.3,
                    ease: 'power2.out'
                });
                
                // 2. Anima gli elementi figli con stagger (scale + opacity + y)
                revealTl.to(upgradeChildren, {
                    scale: 1,
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                    stagger: {
                        amount: 0.6,
                        from: 'start'
                    },
                    onStart: () => {
                        // Sblocca overflow durante l'animazione (a metà circa)
                        setTimeout(() => {
                            document.body.classList.remove('noscroll');
                        }, 300);
                    }
                }, '-=0.1');
            }

            // Nota: il contatore rimane gestito da startLoader() senza modifiche
        }); // Fine gsap.context()
    }
}

// Inizializza al caricamento della pagina
window.addEventListener('load', initLoadingAnimations);
