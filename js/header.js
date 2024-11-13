const hamMenu = document.querySelector('.ham-menu'); 
const offScreenMenu = document.querySelector('.off-screen-menu');
const items = document.querySelectorAll('#items');
const body = document.documentElement;
const splitsTypes = document.querySelectorAll('#revealType1');

const tl = gsap.timeline({ paused: true, reversed: false, });


splitsTypes.forEach((char, i) => {
    const text = new SplitType(char, { types: 'chars' });

    tl
    .to(items, { y: 300, opacity: 1, duration: 3 }, "<")
    .to(offScreenMenu, { y: 90, duration: 0.5, ease: "back.in" }, "<")
    .from(text.chars, { y: 30, opacity: 0, stagger: 0.1, ease: "back.out" }, "<")
    .to(".logo", { x: 15, ease: "back.out" }, "<");
});

hamMenu.addEventListener('click', function() {
    this.classList.toggle('active');

    if (this.classList.contains('active')) {
        tl.timeScale(1).play();
        body.classList.add('no-scroll');

    } else {
        tl.timeScale(2).reverse();
        tl.eventCallback("onReverseComplete", () => {
            body.classList.remove('no-scroll');
        })
    }
});


function copyEmail() {
    const emailToCopy = "domenicofusto55@gmail.com";
    const copyElements = document.getElementsByClassName('copy');

    //copia
    navigator.clipboard.writeText(emailToCopy).then(() => {
        Array.from(copyElements).forEach(copyElement => {
            const originalText = copyElement.textContent;
            const originalStyle = copyElement.style.cssText;

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
