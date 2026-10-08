// Slot Machine Counter Animation con GSAP
// Anima i numeri .card-text-display con effetto slot dall'alto verso il basso

class SlotCounter {
    constructor() {
        this.counters = [];
        this.initialized = false;
        this.timerCounter = null; // Riferimento al counter timer
        this.timerInterval = null; // Intervallo per aggiornamento timer
        this.init();
    }
    
    init() {
        // Aspetta che GSAP sia caricato e DOM pronto
        if (typeof gsap === 'undefined') {
            window.addEventListener('load', () => this.setup());
        } else if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        // Cerca i counter dentro .data-value-container
        this.counters = document.querySelectorAll('.data-value-container .card-text-display[data-value]');
        
        if (this.counters.length === 0) {
            // Fallback: cerca ovunque
            this.counters = document.querySelectorAll('.card-text-display[data-value]');
        }
        
        if (this.counters.length === 0) return;
        
        // PRIMA: Configura il timer speciale #timerWebDev
        this.setupTimerCounter();
        this.setupBirthdayCounter();
        
        // POI: Prepara tutti i counter (il timer avrà già il valore corretto)
        this.counters.forEach(counter => {
            this.prepareCounter(counter);
        });
        
        // Avvia animazione quando loading finisce
        this.waitForLoading();
    }
    
    // Calcola le ore dal 1 Gennaio 2022
    getHoursSinceDate() {
        const startDate = new Date('2022-01-01T00:00:00');
        const now = new Date();
        const diffMs = now - startDate;
        return Math.floor(diffMs / (1000 * 60 * 60)); // Converti in ore
    }
    
    // Setup speciale per il timer counter
    setupTimerCounter() {
        const timerData = document.querySelector('#timerWebDev');
        if (!timerData) return;
        
        const counter = timerData.querySelector('.card-text-display');
        if (!counter) return;
        
        this.timerCounter = counter;
        
        // Calcola il valore attuale in ore
        const currentHours = this.getHoursSinceDate();
        
        // Aggiorna il data-value PRIMA che prepareCounter lo legga
        counter.setAttribute('data-value', currentHours.toString());
        counter._isTimer = true; // Flag per identificarlo
    }

    // Calcola l'età esatta
    getAge(dateString) {
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    // Setup speciale per il counter compleanno
    setupBirthdayCounter() {
        const birthdayLabel = document.getElementById('birthday');
        if (!birthdayLabel) return;
        
        // Trova il contenitore padre .card-style (l'elemento card)
        const card = birthdayLabel.closest('.card-style');
        if (!card) return;
        
        const counter = card.querySelector('.card-text-display');
        if (!counter) return;

        // Estrai la data dal testo dell'elemento #birthday (es. " ... 25/05/1998")
        // Cerchiamo una data nel formato DD/MM/YYYY
        const text = birthdayLabel.textContent;
        const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        
        let age = 0;
        if (dateMatch) {
            // Converti DD/MM/YYYY in YYYY-MM-DD per il costruttore Date
            const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            age = this.getAge(isoDate);
        } else {
            // Fallback se il parsing fallisce, usa data fissa fornita
            age = this.getAge('1998-05-25');
        }
        
        counter.setAttribute('data-value', age.toString());
    }
    
    // Formatta il numero con punti per le migliaia (stile italiano)
    formatNumber(num) {
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
    
    // Prepara la struttura HTML per l'effetto slot
    prepareCounter(counter) {
        const targetValue = parseInt(counter.dataset.value) || 0;
        const prefix = counter.dataset.prefix || '';
        const suffix = counter.dataset.suffix || '';
        
        // Salva i dati
        counter._targetValue = targetValue;
        counter._prefix = prefix;
        counter._suffix = suffix;
        counter._animated = false;
        
        // Preserva il flag _isTimer se già impostato da setupTimerCounter
        if (!counter._isTimer) {
            counter._isTimer = false;
        }
        
        // Imposta il valore iniziale a 0
        counter.textContent = prefix + '0' + suffix;
    }
    
    // Aspetta che il loading finisca (rimozione classe noscroll)
    waitForLoading() {
        // Observer per la classe noscroll
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (!document.body.classList.contains('noscroll') && !this.initialized) {
                        this.initialized = true;
                        observer.disconnect();
                        // Delay per permettere alle animazioni di upgrade di completarsi
                        setTimeout(() => this.animateAll(), 800);
                    }
                }
            });
        });
        
        // Se noscroll non c'è già, anima subito
        if (!document.body.classList.contains('noscroll')) {
            setTimeout(() => this.animateAll(), 500);
        } else {
            observer.observe(document.body, { attributes: true });
        }
    }
    
    // Anima tutti i counter con stagger
    animateAll() {
        if (this.counters.length === 0) return;
        
        this.counters.forEach((counter, index) => {
            if (!counter._animated) {
                setTimeout(() => {
                    this.animateCounter(counter);
                }, index * 250);
            }
        });
    }
    
    // Animazione counter con GSAP
    animateCounter(counter) {
        if (counter._animated) return;
        counter._animated = true;
        
        // Se è il timer, aggiorna il valore target prima di animare
        if (counter._isTimer) {
            counter._targetValue = this.getHoursSinceDate();
        }
        
        const targetValue = counter._targetValue;
        const prefix = counter._prefix;
        const suffix = counter._suffix;
        
        // Oggetto per GSAP
        const counterObj = { val: 0 };
        
        // Timeline
        const tl = gsap.timeline({
            onComplete: () => {
                // Se è il timer, avvia l'aggiornamento ogni minuto
                if (counter._isTimer) {
                    this.startTimerUpdates(counter);
                }
            }
        });
        
        // Animazione principale del conteggio
        tl.to(counterObj, {
            val: targetValue,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => {
                counter.textContent = prefix + this.formatNumber(counterObj.val) + suffix;
            }
        });
        
        // Bounce finale sul counter
        tl.to(counter, {
            scale: 1.05,
            duration: 0.1,
            ease: 'power2.out'
        }, '-=0.2');
        
        tl.to(counter, {
            scale: 1,
            duration: 0.3,
            ease: 'elastic.out(1, 0.5)'
        });
    }
    
    // Avvia gli aggiornamenti periodici per il timer (ogni ora)
    startTimerUpdates(counter) {
        // Pulisci eventuali intervalli precedenti
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Calcola millisecondi fino alla prossima ora
        const now = new Date();
        const msUntilNextHour = ((60 - now.getMinutes()) * 60 - now.getSeconds()) * 1000 - now.getMilliseconds();
        
        // Primo aggiornamento alla prossima ora esatta
        setTimeout(() => {
            this.updateTimerWithSlot(counter);
            
            // Poi aggiorna ogni ora
            this.timerInterval = setInterval(() => {
                this.updateTimerWithSlot(counter);
            }, 3600000); // Ogni ora
        }, msUntilNextHour);
    }
    
    // Aggiorna il timer con effetto slot
    updateTimerWithSlot(counter) {
        const currentValue = parseInt(counter.textContent.replace(/\./g, '')) || 0;
        const newValue = this.getHoursSinceDate();
        
        // Solo se il valore è cambiato
        if (newValue <= currentValue) return;
        
        const prefix = counter._prefix;
        const suffix = counter._suffix;
        
        // Animazione slot per l'incremento
        const counterObj = { val: currentValue };
        
        gsap.timeline()
            // Piccolo shake per indicare l'aggiornamento
            .to(counter, {
                y: -3,
                duration: 0.1,
                ease: 'power2.out'
            })
            // Conta verso il nuovo valore
            .to(counterObj, {
                val: newValue,
                duration: 0.8,
                ease: 'power2.out',
                onUpdate: () => {
                    counter.textContent = prefix + this.formatNumber(counterObj.val) + suffix;
                }
            }, '<')
            // Ritorna in posizione
            .to(counter, {
                y: 0,
                duration: 0.2,
                ease: 'bounce.out'
            });
        
        // Aggiorna il valore target
        counter._targetValue = newValue;
    }
}

// Inizializza
new SlotCounter();

