class Particle {
    constructor(x, y, canvas) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.size = Math.random() * 2 + 1;
        this.alpha = Math.random() * 0.5 + 0.5;
        this.canvas = canvas;
        
        // Colori tra #cc8c38 e #da3731
        // Interpolazione lineare tra i due colori
        const colorMix = Math.random();
        this.color = this.lerpColor('#cc8c38', '#da3731', colorMix);
        
        // Proprietà fisica
        this.friction = 0.97;
        this.magnetism = 0.055;
    }
    
    // Funzione per interpolare tra due colori hex
    lerpColor(colorA, colorB, amount) {
        const ah = parseInt(colorA.replace(/#/g, ''), 16);
        const ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff;
        
        const bh = parseInt(colorB.replace(/#/g, ''), 16);
        const br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff;
        
        const rr = Math.round(ar + amount * (br - ar));
        const rg = Math.round(ag + amount * (bg - ag));
        const rb = Math.round(ab + amount * (bb - ab));
        
        return '#' + ((4 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
    }
    
    update(mouse) {
        // Calcola distanza dal mouse
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 120;
        
        // Applica forza magnetica se il mouse è vicino
        if (distance < maxDistance && mouse.isActive) {
            const force = (maxDistance - distance) / maxDistance;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force * this.magnetism;
            this.vy += Math.sin(angle) * force * this.magnetism;
        }
        
        // Applica movimento e attrito
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Rimbalzo sui bordi
        if (this.x < 0 || this.x > this.canvas.width) {
            this.vx *= -1;
            this.x = Math.max(0, Math.min(this.canvas.width, this.x));
        }
        if (this.y < 0 || this.y > this.canvas.height) {
            this.vy *= -1;
            this.y = Math.max(0, Math.min(this.canvas.height, this.y));
        }
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Disegna particella con gradiente radiale usando il colore interpolato
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.size
        );
        gradient.addColorStop(0, `${this.color}33`); // 0.2 alpha in hex = 33
        gradient.addColorStop(1, `${this.color}00`); // 0 alpha in hex = 00
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // Verifica collisione con altra particella
    checkCollision(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = this.size + other.size;
        
        if (distance < minDistance) {
            const angle = Math.atan2(dy, dx);
            const targetX = this.x + Math.cos(angle) * minDistance;
            const targetY = this.y + Math.sin(angle) * minDistance;
            
            const ax = (targetX - other.x) * 0.05;
            const ay = (targetY - other.y) * 0.05;
            
            this.vx -= ax;
            this.vy -= ay;
            other.vx += ax;
            other.vy += ay;
        }
    }
}


class ParticleSystem {
    constructor(canvasId, particleCount = 150) {
        this.canvas = document.getElementById(canvasId);
        
        // Controlla se il canvas esiste prima di procedere
        if (!this.canvas) {
            console.warn(`Canvas with id "${canvasId}" not found. Particle system disabled.`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = particleCount;

        // Dimensione base del 'contenitore' in CSS pixels (assunta al primo init)
        this.baseWidth = window.innerWidth;
        this.baseHeight = window.innerHeight;

        // Scala corrente applicata al canvas tramite CSS transform
        this.currentScale = 1;

        this.mouse = {
            x: 0,
            y: 0,
            isActive: false
        };

        this.init();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        this.resize();

        // Crea particelle usando coordinate in CSS pixels (baseWidth/baseHeight)
        for (let i = 0; i < this.particleCount; i++) {
            const x = Math.random() * this.baseWidth;
            const y = Math.random() * this.baseHeight;
            this.particles.push(new Particle(x, y, this.canvas));
        }
    }

    resize() {
        // Calcola devicePixelRatio
        const dpr = window.devicePixelRatio || 1;

        // Memorizza le dimensioni CSS previste (non cambiare le posizioni delle particelle)
        // baseWidth/baseHeight rimangono quelle iniziali (come 'cover frame')
        this.cssWidth = this.baseWidth;
        this.cssHeight = this.baseHeight;

        // Imposta dimensioni fisiche (pixel) del canvas basate sulla dimensione CSS di riferimento
        this.canvas.width = this.cssWidth * dpr;
        this.canvas.height = this.cssHeight * dpr;
        this.canvas.style.width = `${this.cssWidth}px`;
        this.canvas.style.height = `${this.cssHeight}px`;

        // Resetta trasformazioni del contesto e scala per DPR
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        // Non applichiamo più alcuno scaling: scala = 1 sempre
        const scale = 1;
        this.currentScale = scale;

        // Calcola traduzione per centrare il canvas (se necessario) senza ridimensionare
        const translateX = (window.innerWidth - this.cssWidth) / 2;
        const translateY = (window.innerHeight - this.cssHeight) / 2;

        // Applica trasformazione CSS (solo translate + scale=1)
        this.canvas.style.transformOrigin = 'top left';
        this.canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
    }

    setupEventListeners() {
        // Mouse move con correzione offset per lo scroll e per la scala applicata
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // rect.left/top sono già affetti da translate+scale; la posizione relativa del mouse rispetto al canvas in CSS px va divisa per la scala
            const scale = this.currentScale || 1;
            this.mouse.x = (e.clientX - rect.left) / scale;
            this.mouse.y = (e.clientY - rect.top) / scale;
            this.mouse.isActive = true;
        });

        // Mouse leave
        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.isActive = false;
        });

        // Resize
        window.addEventListener('resize', () => this.resize());
    }
    
    connectParticles() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Disegna linee tra particelle vicine con colore interpolato
                if (distance < 80) {
                    this.ctx.save();
                    this.ctx.globalAlpha = (1 - distance / 100) * 0.2; // Opacità ridotta a 0.2
                    
                    // Usa il colore medio tra le due particelle
                    this.ctx.strokeStyle = this.particles[i].color;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            }
        }
    }
    
    animate() {
        // Clear con effetto trail
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.0)';
        this.ctx.fillRect(0, 0, this.canvas.width / (window.devicePixelRatio || 1), 
                          this.canvas.height / (window.devicePixelRatio || 1));
        
        // Aggiorna e disegna particelle
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].update(this.mouse);
            this.particles[i].draw(this.ctx);
            
            // Controlla collisioni
            for (let j = i + 1; j < this.particles.length; j++) {
                this.particles[i].checkCollision(this.particles[j]);
            }
        }
        
        // Connetti particelle con linee
        this.connectParticles();
        
        requestAnimationFrame(() => this.animate());
    }
}


// Inizializza il sistema solo se esiste il canvas
if (document.getElementById('particleCanvas')) {
    new ParticleSystem('particleCanvas', 250);
}