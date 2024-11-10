document.addEventListener("DOMContentLoaded", () => {

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

            this.loadImages();  // Carica le immagini
        }

        async loadImages() {
            const loadImagePromises = [];

            // Crea una promessa per ciascuna immagine
            for (let i = 0; i < this.totalImages; i++) {
                const img = new Image();
                const loadImagePromise = new Promise((resolve) => {
                    img.onload = resolve;  // Risolvi la promessa quando l'immagine è caricata
                });

                img.src = `./js/GoldenCage/videoIntro${String(i).padStart(4, '0')}.png`;
                this.images.push(img);
                loadImagePromises.push(loadImagePromise);  // Aggiungi la promessa all'array
            }

            // Aspetta che tutte le immagini siano caricate
            await Promise.all(loadImagePromises);

            // Una volta che tutte le immagini sono caricate, esegui il resto del codice
            this.addEventListeners();
            this.render();
            this.initGSAP();
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
            const animElements = document.querySelectorAll('#anim');

            gsap.set(animElements, { opacity: 0, x: -10, y: -100, scale: 0.2 });

            animElements.forEach((element, index) => {
                gsap.to(element, {
                    scrollTrigger: {
                        trigger: element,
                        start: "bottom 84%",  // Inizio dell'animazione quando l'elemento è nella parte superiore della viewport
                        end: "bottom 85%", // Fine dell'animazione quando l'elemento raggiunge la fine della viewport
                        // markers: true,
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
    }

    window.onload = () => {
        window.app = new Application();
    };

});

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
