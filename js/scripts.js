gsap.registerPlugin(ScrollTrigger, SplitText);

// Seleziona tutti i blocchi testo
const textBlocks = document.querySelectorAll(".text-block");

textBlocks.forEach(block => {
  // Crea SplitText a livello di parole
  const split = new SplitText(block, { type: "words" });
  const words = split.words;

  // Imposta opacity e posizione iniziale delle parole
  gsap.set(words, { opacity: 0, y: 40 });

  // Animazione che fa apparire le parole a cascata
  gsap.to(words, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: "power2.out",
    stagger: 0.05, // animazione parola dopo parola
    scrollTrigger: {
      trigger: block,
      start: "top 70%",
      end: "top 40%",
      toggleActions: "play reverse play reverse",
      scrub: true
    }
  });
});

// Pin della sezione canvas
ScrollTrigger.create({
  trigger: ".canvas-section",
  start: "top top",
  end: "bottom bottom",
  pin: ".canvas-wrapper",
  scrub: true
});
