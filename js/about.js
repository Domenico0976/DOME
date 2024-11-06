class Application {
    constructor() {
        this.canvas = document.querySelector('#canvas-video');
        this.ctx = this.canvas.getContext('2d');
        this.images = [];
        this.loadedImages = 0;
        this.totalImages = 143;
        this.currentFrameIndex = 1;

        // Imposta le dimensioni iniziali del canvas
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));

        for (let i = 0; i < this.totalImages; i++) {
            const img = new Image();
            img.onload = () => {
                this.loadedImages++;
                if (this.loadedImages === this.totalImages) {
                    this.addEventListeners();
                    this.render();
                    this.initGSAP();  // Inizializza GSAP dopo il caricamento delle immagini
                    // Inizializza animazione di uscita del canvas
                }
            };

            img.src = `../GoldenCage/videoIntro${String(i).padStart(4, '0')}.png`;
            this.images.push(img);
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    }

    addEventListeners() {
        window.addEventListener('scroll', () => {
            const scrollTop = document.documentElement.scrollTop;
            const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
            const scrollFraction = scrollTop / maxScrollTop;
            const frameCount = this.totalImages;
            const frameIndex = Math.min(
                frameCount - 1,
                Math.floor(scrollFraction * frameCount)
            );
            this.currentFrameIndex = frameIndex;
            this.render();
        });
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const img = this.images[this.currentFrameIndex];
        if (!img) return;

        const canvasRatio = this.canvas.width / this.canvas.height;
        const imgRatio = img.width / img.height;

        let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

        if (canvasRatio > imgRatio) {
            drawWidth = this.canvas.width;
            drawHeight = drawWidth / imgRatio;
            offsetY = (this.canvas.height - drawHeight) / 2;
        } else {
            drawHeight = this.canvas.height;
            drawWidth = drawHeight * imgRatio;
            offsetX = (this.canvas.width - drawWidth) / 2;
        }

        this.ctx.save();
        // GESTIONE ALPHA
        if (this.totalImages - this.currentFrameIndex < 40) {
            this.ctx.globalAlpha = (this.totalImages - this.currentFrameIndex) / 10;
        }
        this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        this.ctx.restore();
    }

    initGSAP() {
        const sections = document.querySelectorAll('.outro');
        const animElements = document.querySelectorAll('#anim');
        const container = document.querySelectorAll('.list');

        gsap.set(sections, { opacity: 2, y: 100 });

        sections.forEach((section, index) => {
            gsap.to(section, {
                scrollTrigger: {
                    trigger: section,
                    start: "center 15%",
                    end: "bottom bottom",
                    // markers: true,
                    toggleActions: "play none none reverse",
             
                },
                opacity: 0,
                y: -300,
                duration: 0.6,
                stagger: 0.3,
                ease: "ease",
                scale:1.3
            },"<");
        });

        gsap.set(animElements, { opacity: 0, x:-10, y: 250, scale: 0.2 });

        animElements.forEach((element, index) => {
            gsap.to(element, {
                scrollTrigger: {
                    trigger: element,
                    start: "center 65%",  // Inizio dell'animazione quando l'elemento è nella parte superiore della viewport
                    end: "bottom 85%", // Fine dell'animazione quando l'elemento raggiunge la fine della viewport
                    markers: true,
                    scrub: 2,
                    toggleActions: "play none none reverse",

                },
                opacity: 1,
                y: 0,
                x: 0,
                scale: 1,               
            }, "<");
        });
        
}



initLenis() {
    // Inizializza Lenis
    const lenis = new Lenis({
        duration: 1.2,
        smooth: true,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
    });

    lenis.on('scroll', ({ scroll }) => {
        const maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
        const scrollFraction = scroll / maxScrollTop;
        const frameIndex = Math.min(
            this.totalImages - 1,
            Math.floor(scrollFraction * this.totalImages)
        );
        this.currentFrameIndex = frameIndex;
        this.render();
    });

    // Usa requestAnimationFrame per aggiornare Lenis ad ogni frame
    const animate = () => {
        lenis.raf();
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
}
}


window.onload = () => {
    window.app = new Application();
};

function copyEmail() {
  const emailElement = document.getElementById("email");
  const originalText = emailElement.innerText;

  navigator.clipboard.writeText(originalText)
    .then(() => {
      emailElement.innerText = "Copied!";
      setTimeout(() => {
        emailElement.innerText = originalText;
      }, 6000); // Torna al testo originale dopo 2 secondi
    })
    .catch((err) => {
      console.error("Errore nella copia: ", err);
    });
}

// Ripristina il testo originale all'apertura o al refresh della pagina
document.addEventListener("DOMContentLoaded", () => {
  const emailElement = document.getElementById("email");
  emailElement.innerText = "domenicofusto55@gmail.com"; // Sostituisci con l'email originale
});