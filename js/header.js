const hamMenu = document.querySelector('.ham-menu');
const offScreenMenu = document.querySelector('.off-screen-menu');
const items = document.querySelectorAll('#items');

const splitTypes = document.querySelectorAll('#revealType1')
const tl = gsap.timeline({ paused: true, reversed:false, defaults:{duration:0.8, ease:"none"} });

splitTypes.forEach((char,i) => {

    const text = new SplitType(char, {types: 'chars'});
            

        tl
        .to(items, {y: 300, opacity: 1, duration: 0.7}, "<")
        .to (offScreenMenu, {
            y: 0,
            duration: 0.15,
            ease: 'back.in'
        }, "<")

            .from(text.chars, 
            {
                y: 30,
                opacity: 0,
                stagger: 0.1,
                duration: .7,
                ease: "back.out"
            }, "<")
            
            .to(["#logo, .logo"],
                {
                    y:20,
                    x: 15,
                    stagger: .9,
                    duration: 1,
                    ease: "back.out"
                }, "<")

            
            });
            

    hamMenu.addEventListener('click', function() {
        this.classList.toggle('active');

        if (this.classList.contains('active')) {
            tl.timeScale(1).play();
        } else {
            tl.timeScale(2).reverse();
        }

        
    })

    function copyEmail() {
        const copy = document.querySelector(".copy")
        const originalText = copy.innerText;
 
      
        navigator.clipboard.writeText(originalText)
          .then(() => {
            copy.style.color = '#008000'
            copy.innerText = "Copied!";
            setTimeout(() => {
              copy.innerText = originalText;
              copy.style.color = '#595858'
            }, 6000); // Torna al testo originale dopo 2 secondi
          })
          .catch((err) => {
            console.error("Errore nella copia: ", err);
          });
      }
      
      document.addEventListener("DOMContentLoaded", () => {
        const copy = document.querySelector(".copy");
        copy.innerText = "click to copy"; // Sostituisci con l'email originale
      });


