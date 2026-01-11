document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === 'undefined') {
    return;
  }

  const sliderList = document.querySelector('[data-slider="list"]');
  const slides = document.querySelectorAll('[data-slider="slide"]');
  const prevBtn = document.querySelector('[data-slider="button-prev"]');
  const nextBtn = document.querySelector('[data-slider="button-next"]');
  const stepElement = document.querySelector('[data-slide-count="step"]');
  const totalElement = document.querySelector('[data-slide-count="total"]');

  // Controlla se esistono gli elementi necessari per lo slider
  if (!sliderList || slides.length === 0) {
    return;
  }

  const totalSlides = slides.length;
  let currentIndex = 0;
  let isAnimating = false;

  if (totalElement) {
    totalElement.textContent = totalSlides < 10 ? `0${totalSlides}` : totalSlides;
  }

  // determina la slide iniziale dal DOM (se esiste .active) per mantenere coerenza al refresh
  const domActiveIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));
  if (domActiveIndex >= 0) currentIndex = domActiveIndex;

  // Centra e applica stato iniziale senza animazione
  updateSlider(currentIndex, true);

  // Ricalcola posizione alla resize per mantenere il centro corretto
  window.addEventListener('resize', () => {
    // usa instant=true per evitare animazioni indesiderate durante il resize
    updateSlider(currentIndex, true);
  });

  function updateSlider(newIndex, instant = false) {
    if(isAnimating && !instant) {
      return;
    }
    if(!instant) isAnimating = true;

    // Calcola la larghezza e il centro del wrapper per centrare la slide attiva
    const wrapper = sliderList.parentElement; // .slider-wrap
    const wrapperWidth = wrapper.clientWidth;

    // Calcola la posizione del centro della slide attiva relativamente alla sliderList (offsetLeft + half width)
    const slide = slides[newIndex];
    if (!slide) {
        isAnimating = false;
        return;
    }
    
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;

    // L'obiettivo è portare il centro della slide al centro del wrapper
    // const targetX = wrapperWidth / 2 - slideCenter;
    
    // MODIFICA: Allinea la slide a sinistra (come richiesto)
    const targetX = -slide.offsetLeft;
    
    // Define activeSlide early for usage
    const activeSlide = slides[newIndex];

    // Aggiorna contatore prima dell'animazione per evitare discrepanze visive
    const indexForCounter = parseInt(activeSlide.getAttribute('data-slide-index')) || (newIndex + 1);
    stepElement.textContent = indexForCounter < 10 ? `0${indexForCounter}` : indexForCounter;

    // --- Aggiorna titolo e descrizione collegati ai meta della slide ---
    const titleEl = document.getElementById('slider-title');
    const descEl = document.getElementById('slider-description');
    
    if (titleEl || descEl) {
      const newTitle = activeSlide.getAttribute('meta-title') || titleEl && titleEl.textContent || '';
      const newDesc = activeSlide.getAttribute('meta-description') || (activeSlide.querySelector('.caption') ? activeSlide.querySelector('.caption').textContent.trim() : (descEl && descEl.textContent) ) || '';

      if (instant) {
        if (titleEl) titleEl.textContent = newTitle;
        if (descEl) descEl.textContent = newDesc;
      } else {
        const targets = [];
        if (titleEl) targets.push(titleEl);
        if (descEl) targets.push(descEl);

        // Fade out, swap text, fade in
        gsap.to(targets, {
          opacity: 0,
          y: 6,
          duration: 0.18,
          ease: 'power1.in',
          onComplete: () => {
            if (titleEl) titleEl.textContent = newTitle;
            if (descEl) descEl.textContent = newDesc;
            gsap.fromTo(targets, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.36, ease: 'power2.out' });
          }
        });
      }
    }

    // Applica trasformazione istantanea o animata
    if (instant) {
      gsap.set(sliderList, { x: targetX });

      slides.forEach((slideEl, i) => {
        const isActive = i === newIndex;
        slideEl.classList.toggle('active', isActive);
        gsap.set(slideEl, { opacity: isActive ? 1 : 0.3 });
      });

      currentIndex = newIndex;
      // non impostare isAnimating quando instant
      return;
    }

    gsap.to(sliderList, {
      x: targetX,
      duration: 0.7,
      ease: "power3.inOut",
      onComplete: () => isAnimating = false
    });

    slides.forEach((slideEl, i) => {
      const isActive = i === newIndex;
      slideEl.classList.toggle('active', isActive);
      gsap.to(slideEl, {
        opacity: isActive ? 1 : 0.3,
        duration: 0.6,
        ease: "power2.inOut"
      });
    });

    currentIndex = newIndex;
  }

  prevBtn.onclick = (e) => {
    e.preventDefault();
    const prevIndex = (currentIndex - 1 + totalSlides) % totalSlides;
    updateSlider(prevIndex);
  };

  nextBtn.onclick = (e) => {
    e.preventDefault();
    const nextIndex = (currentIndex + 1) % totalSlides;
    updateSlider(nextIndex);
  };

  // Pulsante per aprire la pagina del progetto attivo
  const openBtn = document.querySelector('[data-slider="button-open"]');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      const activeSlide = slides[currentIndex];
      if (!activeSlide) return;
      const metaTitle = activeSlide.getAttribute('meta-title') || '';
      // Normalizza in slug: minuscolo, sostituisci spazi con '-', rimuovi caratteri non alfanumerici tranne '-'
      const slug = metaTitle.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
      const path = `/` + encodeURIComponent(slug);
      // naviga alla path
      window.location.href = path;
    });
  }
});
