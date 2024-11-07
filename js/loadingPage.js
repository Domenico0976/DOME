
function startLoader() {
        let counterElement = document.querySelector(".counter");
        let currentValue = 0;

        function updateCounter() {
            if (currentValue === 100){
                return;
            }
            currentValue += Math.floor(Math.random() * 10) + 1;

            if(currentValue > 100){
                currentValue = 100;
            }
            counterElement.textContent = currentValue;
            let delay = Math.floor(Math.random() * 200) + 50;
            setTimeout(updateCounter, delay);
        }
        updateCounter();


    }
    startLoader()

    gsap.from(".counter",{
        opacity: 1,
        y: 50
    })

        gsap.to(".bar", 1.24, {
            delay: 2,
            height: 0,
            stagger: 0.18,
        
            ease: "power1.inOut",
        })
        gsap.to("#items",{
            x:-500,
            delay: 5,
            opacity: 0,
            onComplete: ()=>{
                window.location.href = "./homepage.html";
            }
            }
        )
