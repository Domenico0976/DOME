
document.addEventListener("DOMContentLoaded", () => {
    // Seleziona tutte le sezioni sticky
    const stickySections = document.querySelectorAll(".sticky");

    stickySections.forEach(stickySection => {
        const stickyHeader = stickySection.querySelector(".sticky-header");
        const cards = stickySection.querySelectorAll(".card");
        const stickyHeight = window.innerHeight * 4;

        const trasforms = [
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
            [[10, 50, -10, 10], [10, 50, -10, 10]],
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
                        const cardEndX = -450;
                        const yPos = trasforms[index][0];
                        const rotations = trasforms[index][1]

                        const cardX = gsap.utils.interpolate(cardStartX, cardEndX, cardProgress);

                        const yProgress = cardProgress * 2;
                        const yIndex = Math.min(Math.floor(yProgress), yPos.length - 2);
                        const yInterpolation = yProgress - yIndex;
                        const cardY = gsap.utils.interpolate(yPos[yIndex], yPos[yIndex + 1], yInterpolation);

                        const cardRotation = gsap.utils.interpolate(rotations[yIndex], rotations[yIndex + 1], yInterpolation);

                        gsap.set(card, {
                            xPercent: cardX,
                            yPercent: cardY,
                            opacity: 1,
                        });
                    }
                });
            }
        });
        return true;
    });

    
});
