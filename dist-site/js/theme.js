document.addEventListener('DOMContentLoaded', function () {
const schemeBtn = document.getElementById('scheme-btn');

schemeBtn.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
});

const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

const hamMenu = document.querySelector('.ham-menu'); 
const offScreenMenu = document.querySelector('.off-screen-menu');
const items = document.querySelectorAll('#items');
const body = document.documentElement;
const splitsTypes = document.querySelectorAll('#revealType1');

const tl = gsap.timeline({ paused: true, reversed: true });

splitsTypes.forEach((char, i) => {
    const text = new SplitType(char, { types: 'words' });

    // Nascondi inizialmente il menu con visibility e opacity
    gsap.set(offScreenMenu, { visibility: 'hidden', opacity: 0, transform: 'translateY(-100%)' });

    tl
        .to(offScreenMenu, { y: 0, opacity: 1, visibility: 'visible', duration: 0.6, ease: "linear" }, "<")
        .to(items, { y: 300, opacity: 1, duration: 0.5 }, "<")
        .from(text.words, { y: 130, opacity: 0, stagger: 0.25, ease: "power2.out" }, "<")
        .to(".logo", { x: 15, ease: "back.out" }, "<");

    // Al reverse, nascondi il menu solo dopo che gli elementi sono spariti
    tl.eventCallback("onReverseComplete", () => {
        gsap.set(offScreenMenu, { visibility: 'hidden', opacity: 0, transform: 'translateY(-100%)' });
    });
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


    gsap.from(items, {
        y:110,
        opacity: 0
    })


function copyEmail() {
    const emailToCopy = "domenicofusto55@gmail.com";
    const copyElement = document.getElementById('email-btn'); // Usa l'ID specifico

    if (!copyElement) {
        console.error('Element not found');
        return;
    }

    // Funzione fallback per HTTP
    function unsecuredCopyToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch (err) {
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }

    // Copia con fallback
    const copyPromise = navigator.clipboard 
        ? navigator.clipboard.writeText(emailToCopy)
        : Promise.resolve(unsecuredCopyToClipboard(emailToCopy));

    copyPromise.then(() => {
        const originalText = copyElement.textContent;
        const originalStyle = copyElement.style.cssText;

        copyElement.textContent = "Copied!";
        copyElement.style.color = "#006400";
        copyElement.style.fontWeight = "700";

        setTimeout(() => {
            copyElement.textContent = originalText;
            copyElement.style.cssText = originalStyle;
        }, 2000);
    }).catch(err => {
        console.error("Copy failed:", err);
        alert("Failed to copy. Please copy manually: " + emailToCopy);
    });
}
// Aggiungi event listener quando il DOM è pronto
    const emailLink = document.getElementById('email-btn');
    if (emailLink) {
        emailLink.addEventListener('click', function(e) {
            e.preventDefault();
            copyEmail();
        });
    }

})
