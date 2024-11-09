document.addEventListener("DOMContentLoaded", () =>{
    

const hamMenu = document.querySelector('.ham-menu');
const offScreenMenu = document.querySelector('.off-screen-menu');
const items = document.querySelectorAll('#items');

const splitTypes = document.querySelectorAll('#revealType1')
const tl = gsap.timeline({ paused: true, reversed:false, defaults:{duration:0.8, ease:"none"} });

splitTypes.forEach((char,i) => {

    const text = new SplitType(char, {types: 'chars'});
            

        tl
        .to(items, {y: 300, opacity: 1, duration: 3}, "<")
        .to (offScreenMenu, {
            y: 100,
            duration: 0.5,
            ease: "back.in"
        }, "<")

        .from(text.chars, 
        {
            y: 30,
            opacity: 0,
            stagger: 0.1,
            ease: "back.out"
        }, "<")
        
        .to(["#logo"],
            {
                y:20,
                x: 15,
                ease: "back.out",
            }, "<")          
  });

    hamMenu.addEventListener('click', function() {
        this.classList.toggle('active');
        
        if (this.classList.contains('active')) {
            document.body.classList.add('no-scroll'); //PROBLEMA HEADER CHE NON TIENE LO SCROLL
            tl.timeScale(1).play();
        } else {
            tl.timeScale(2).reverse();
            tl.eventCallback("onReverseComplete", () => {
                document.body.classList.remove('no-scroll');});
        }
    });
});

function copyEmail() {
    const copyButton = document.querySelector('.copy');
    const originalText = copyButton.textContent; 
    const emailToCopy = "domenicofusto55@gmail.com";
    const originalStyle = copyButton.style.cssText;

    navigator.clipboard.writeText(emailToCopy).then(() => {
        copyButton.textContent = "Copied!";
        copyButton.style.color = "#006400";
        copyButton.style.fontWeight = "700";

        setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.cssText = originalStyle;
        }, 2000);
    }).catch(err => {
        console.error("somebody goes wrong! copy this   domenicofusto55@gmail.com", err);
    });
}