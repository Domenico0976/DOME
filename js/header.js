const hamMenu = document.querySelector('.ham-menu'); 
const offScreenMenu = document.querySelector('.off-screen-menu');
const items = document.querySelectorAll('.item'); // Usa una classe se ci sono più elementi

const splitTypes = document.querySelectorAll('#revealType1');
const tl = gsap.timeline({ paused: true, reversed: false, defaults: { duration: 0.8, ease: "none" } });

document.addEventListener("DOMContentLoaded", () => {

    splitTypes.forEach((char, i) => {
        const text = new SplitType(char, { types: 'chars' });

        tl
        .to(items, { y: 300, opacity: 1, duration: 3 }, "<")
        .to(offScreenMenu, { y: 100, duration: 0.5, ease: "back.in" }, "<")
        .from(text.chars, { y: 30, opacity: 0, stagger: 0.1, ease: "back.out" }, "<")
        .to(".logo", { y: 20, x: 15, ease: "back.out" }, "<");
    });

    hamMenu.addEventListener('click', function() {

        this.classList.toggle('active');
        const body = document.body;

        if (this.classList.contains('active')) {
            bodyScrollLockUpgrade.disableBodyScroll(body); // Blocco scroll
            tl.timeScale(1).play();
        } else {
            tl.timeScale(2).reverse();
                bodyScrollLockUpgrade.enableBodyScroll(body); // Ripristino scroll
            
        }
    });
});


function copyEmail() {
    const emailToCopy = "domenicofusto55@gmail.com";
    const copyElements = document.getElementsByClassName('copy');

    // Copia l'email negli appunti
    navigator.clipboard.writeText(emailToCopy).then(() => {
        Array.from(copyElements).forEach(copyElement => {
            const originalText = copyElement.textContent;
            const originalStyle = copyElement.style.cssText;

            // Aggiorna il testo e lo stile
            copyElement.textContent = "Copied!";
            copyElement.style.color = "#006400";
            copyElement.style.fontWeight = "700";

            // Dopo 2 secondi, ripristina il testo e lo stile originali
            setTimeout(() => {
                copyElement.textContent = originalText;
                copyElement.style.cssText = originalStyle;
            }, 2000);
        });
    }).catch(err => {
        console.error("Something went wrong! Copy this: domenicofusto55@gmail.com", err);
    });
}
