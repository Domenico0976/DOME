// Masonry Layout dinamico per Bento Grid
class MasonryLayout {
    constructor(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;
        
        this.init();
        
        // Riapplica layout su resize
        window.addEventListener('resize', () => this.debounce(() => this.applyLayout(), 200));
        
        // Osserva cambiamenti nel DOM
        this.observeChanges();
        
        // Osserva quando la classe noscroll viene rimossa dal body (fine loading)
        this.observeBodyClass();
    }
    
    init() {
        // Applica layout dopo che il DOM è caricato
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.applyLayout());
        } else {
            this.applyLayout();
        }
        
        // Riapplica dopo il caricamento delle immagini
        window.addEventListener('load', () => this.applyLayout());
    }
    
    observeBodyClass() {
        // Osserva quando la classe noscroll viene rimossa dal body
        const bodyObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Ricalcola layout quando cambia la classe del body
                    this.debounce(() => this.applyLayout(), 100);
                }
            });
        });
        
        bodyObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    applyLayout() {
        const items = Array.from(this.container.children);
        if (items.length === 0) return;
        
        // Determina numero di colonne in base alla larghezza dello schermo
        // Tablet (<=1000px) e Mobile (<=768px): 1 colonna, Desktop: 2 colonne
        const isTabletOrMobile = window.innerWidth <= 1000;
        const columnCount = isTabletOrMobile ? 1 : 2;
        
        if (columnCount === 1) {
            // Mobile: rimuovi posizionamento assoluto
            items.forEach(item => {
                item.style.position = '';
                item.style.top = '';
                item.style.left = '';
                item.style.width = '';
            });
            this.container.style.position = '';
            this.container.style.height = '';
            return;
        }
        
        // Desktop/Tablet: calcola posizioni per effetto masonry
        const gap = 24; // deve corrispondere al gap CSS
        const containerStyle = window.getComputedStyle(this.container);
        const paddingLeft = parseFloat(containerStyle.paddingLeft);
        const paddingRight = parseFloat(containerStyle.paddingRight);
        const paddingTop = parseFloat(containerStyle.paddingTop);
        const containerWidth = this.container.clientWidth - paddingLeft - paddingRight;
        const columnWidth = (containerWidth - (gap * (columnCount - 1))) / columnCount;
        
        // Array per tracciare l'altezza di ogni colonna
        const columnHeights = new Array(columnCount).fill(0);
        
        items.forEach((item, index) => {
            // Trova la colonna più corta
            const shortestColumn = columnHeights.indexOf(Math.min(...columnHeights));
            
            // Posiziona l'elemento - aggiungi paddingLeft per rispettare il padding del container
            const left = paddingLeft + shortestColumn * (columnWidth + gap);
            const top = paddingTop + columnHeights[shortestColumn];
            
            item.style.position = 'absolute';
            item.style.left = `${left}px`;
            item.style.top = `${top}px`;
            item.style.width = `${columnWidth}px`;
            
            // Aggiorna l'altezza della colonna
            const itemHeight = item.offsetHeight;
            columnHeights[shortestColumn] += itemHeight + gap;
        });
        
        // Imposta altezza del container (includi padding top e bottom)
        const paddingBottom = parseFloat(containerStyle.paddingBottom);
        const maxHeight = Math.max(...columnHeights) + paddingTop + paddingBottom;
        this.container.style.height = `${maxHeight}px`;
        this.container.style.position = 'relative';
    }
    
    observeChanges() {
        // Osserva modifiche agli elementi figli
        const observer = new MutationObserver(() => {
            this.debounce(() => this.applyLayout(), 100);
        });
        
        observer.observe(this.container, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    }
    
    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }
}

// Inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MasonryLayout('.bento-grid');
    });
} else {
    new MasonryLayout('.bento-grid');
}
