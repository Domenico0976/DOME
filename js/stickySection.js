
document.addEventListener("DOMContentLoaded", () => {
    // Seleziona tutte le sezioni sticky
    const stickySections = document.querySelectorAll(".sticky");

    stickySections.forEach(stickySection => {
        const stickyHeader = stickySection.querySelector(".sticky-header");
        const cards = stickySection.querySelectorAll(".card");
        const stickyHeight = window.innerHeight * 3;

        const trasforms = [
            [[10, 50, -10, 10], [20, -10, -45, 20]],
            [[0, 47.5, -10, 15], [-25, 15, -45, 30]],
            [[0, 52.5, -10, 5], [15, -5, 40, 60]],
            [[0, 50, 30, -80], [20, -10, 60, 5]],
            [[0, 55, -15, 30], [25, -15, 60, 95]],
            [[10, 50, -10, 10], [20, -10, -45, 20]],
            [[0, 47.5, -10, 15], [-25, 15, -45, 30]],
            [[0, 52.5, -10, 5], [15, -5, 40, 60]],
            [[0, 50, 30, -80], [20, -10, 60, 5]],
            [[0, 55, -15, 30], [25, -15, 60, 95]],
        ];

        ScrollTrigger.create({
            trigger: stickySection,
            start: "top top",
            end: `+=${stickyHeight}px`,
            pin: true,
            pinSpacing: true,
            onUpdate: (self) => {
                const progress = self.progress;

                const maxTranslate = stickyHeader.offsetWidth - window.innerWidth;
                const translateX = -progress * maxTranslate;
                gsap.set(stickyHeader, { x: translateX });

                cards.forEach((card, index) => {
                    const delay = index * 0.1125;
                    const cardProgress = Math.max(0, Math.min((progress - delay) * 2, 1));

                    if (cardProgress > 0) {
                        const cardStartX = 25;
                        const cardEndX = -650;
                        const yPos = trasforms[index][0];
                        const rotations = trasforms[index][1]

                        const cardX = gsap.utils.interpolate(cardStartX, cardEndX, cardProgress);

                        const yProgress = cardProgress * 3;
                        const yIndex = Math.min(Math.floor(yProgress), yPos.length - 2);
                        const yInterpolation = yProgress - yIndex;
                        const cardY = gsap.utils.interpolate(yPos[yIndex], yPos[yIndex + 1], yInterpolation);

                        const cardRotation = gsap.utils.interpolate(rotations[yIndex], rotations[yIndex + 1], yInterpolation);

                        gsap.set(card, {
                            xPercent: cardX,
                            yPercent: cardY,
                            rotation: cardRotation,
                            opacity: 1,
                        });
                    }
                });
            }
        });
        return true;
    });

    
});