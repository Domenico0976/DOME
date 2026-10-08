// Pop It Antistress Game
class PopItGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 8; // Griglia 8x8
        this.buttonSize = 0;
        this.gap = 2; // Gap ridotto per design organico
        this.buttons = [];
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.createButtons();
        this.draw();
        this.setupEventListeners();
        
        // Ridisegna al resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.createButtons();
            this.draw();
        });
    }
    
    setupCanvas() {
        const parent = this.canvas.parentElement;
        const rect = parent.getBoundingClientRect();
        
        // Imposta dimensioni canvas con scaling per alta risoluzione
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Scala il contesto
        this.ctx.scale(dpr, dpr);
        
        // Salva dimensioni logiche
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        
        // Calcola dimensione dei pulsanti per riempire tutto il contenitore
        const totalGapWidth = this.gap * (this.gridSize + 1);
        const totalGapHeight = this.gap * (this.gridSize + 1);
        
        const buttonWidth = (this.canvasWidth - totalGapWidth) / this.gridSize;
        const buttonHeight = (this.canvasHeight - totalGapHeight) / this.gridSize;
        
        // Usa dimensione quadrata basata sulla minore
        this.buttonSize = Math.min(buttonWidth, buttonHeight);
    }
    
    createButtons() {
        this.buttons = [];
        
        // Calcola offset per centrare la griglia
        const totalWidth = (this.buttonSize + this.gap) * this.gridSize + this.gap;
        const totalHeight = (this.buttonSize + this.gap) * this.gridSize + this.gap;
        const offsetX = (this.canvasWidth - totalWidth) / 2;
        const offsetY = (this.canvasHeight - totalHeight) / 2;
        
        // Crea griglia estesa per mostrare pulsanti tagliati ai bordi
        for (let row = -1; row < this.gridSize + 1; row++) {
            for (let col = -1; col < this.gridSize + 1; col++) {
                const x = offsetX + this.gap + col * (this.buttonSize + this.gap);
                const y = offsetY + this.gap + row * (this.buttonSize + this.gap);
                
                // I pulsanti ai bordi non sono cliccabili
                const isClickable = row >= 0 && row < this.gridSize && col >= 0 && col < this.gridSize;
                
                // Colore a scacchiera (bianco e nero)
                const isWhite = (row + col) % 2 === 0;
                
                this.buttons.push({
                    x: x,
                    y: y,
                    size: this.buttonSize,
                    pressed: false,
                    clickable: isClickable,
                    isWhite: isWhite,
                    resetTimeout: null
                });
            }
        }
    }
    
    draw() {
        // Sfondo trasparente per mostrare il gradiente CSS
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Disegna tutti i pulsanti
        this.buttons.forEach(button => {
            this.drawButton(button);
        });
    }
    
    drawButton(button) {
        const ctx = this.ctx;
        const x = button.x;
        const y = button.y;
        const size = button.size;
        const radius = size * 0.48; // Pulsanti circolari leggermente più piccoli per effetto organico
        
        ctx.save();
        
        // Centro del cerchio
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        
        // Colori a scacchiera - bianco e nero con trasparenza
        const whiteColor = 'rgba(255, 255, 255, 0.95)';
        const blackColor = 'rgba(30, 30, 30, 0.85)';
        const baseColor = button.isWhite ? whiteColor : blackColor;
        
        if (button.pressed) {
            // Pulsante premuto - ombra interna scura
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            
            // Colore base più scuro quando premuto
            ctx.fillStyle = button.isWhite ? 'rgba(220, 220, 220, 0.95)' : 'rgba(20, 20, 20, 0.85)';
            ctx.fill();
            
            // Ombra interna per effetto profondità
            const innerShadow = ctx.createRadialGradient(
                centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.1,
                centerX, centerY, radius * 0.9
            );
            innerShadow.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
            innerShadow.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
            innerShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = innerShadow;
            ctx.fill();
            
            // Bordo sottile scuro
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            
        } else {
            // Pulsante non premuto - rigonfiato verso l'esterno
            
            // Ombra esterna morbida
            ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 3;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = baseColor;
            ctx.fill();
            
            ctx.shadowColor = 'transparent';
            
            // Highlight per effetto 3D rigonfiato
            const highlight = ctx.createRadialGradient(
                centerX - radius * 0.35, centerY - radius * 0.35, radius * 0.05,
                centerX, centerY, radius * 1.1
            );
            
            if (button.isWhite) {
                highlight.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                highlight.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)');
                highlight.addColorStop(0.7, 'rgba(200, 200, 200, 0.1)');
                highlight.addColorStop(1, 'rgba(150, 150, 150, 0.2)');
            } else {
                highlight.addColorStop(0, 'rgba(80, 80, 80, 0.6)');
                highlight.addColorStop(0.4, 'rgba(50, 50, 50, 0.2)');
                highlight.addColorStop(0.7, 'rgba(30, 30, 30, 0)');
                highlight.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            }
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = highlight;
            ctx.fill();
            
            // Bordo sottile per definizione
            ctx.strokeStyle = button.isWhite ? 'rgba(200, 200, 200, 0.5)' : 'rgba(80, 80, 80, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }
    
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Trova quale pulsante è stato cliccato
        this.buttons.forEach(button => {
            if (!button.clickable || button.pressed) return;
            
            const centerX = button.x + button.size / 2;
            const centerY = button.y + button.size / 2;
            const radius = button.size * 0.48; // Stesso raggio usato per disegnare
            
            // Controlla se il click è dentro il cerchio
            const distance = Math.sqrt(
                Math.pow(clickX - centerX, 2) + 
                Math.pow(clickY - centerY, 2)
            );
            
            if (distance <= radius) {
                this.pressButton(button);
            }
        });
    }
    
    pressButton(button) {
        button.pressed = true;
        this.draw();
        
        // Genera tempo casuale tra 1 e 5 secondi
        const resetTime = Math.random() * 4000 + 1000; // 1000-5000ms
        
        // Cancella timeout precedente se esiste
        if (button.resetTimeout) {
            clearTimeout(button.resetTimeout);
        }
        
        // Imposta nuovo timeout per far riapparire il pulsante
        button.resetTimeout = setTimeout(() => {
            button.pressed = false;
            button.resetTimeout = null;
            this.draw();
        }, resetTime);
    }
}

// Inizializza il gioco quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    new PopItGame('popItCanvas');
});
