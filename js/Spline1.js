import { Application } from 'https://unpkg.com/@splinetool/runtime@latest/build/runtime.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas3d');
    const app = new Application(canvas);
    
    app
        .load('https://prod.spline.design/gSpwmaTGq2eKo9wL/scene.splinecode')
        .then(() => {
        const spherePlanet = app.findObjectByName('spherePlanet');
        gsap.set(spherePlanet.scale,{ x: 2, y: 2, z: 2});
        gsap.set(spherePlanet.position, { x: 0, y: 0 });
       
        gsap.timeline({
            scrollTrigger: {
                trigger: ".Anicontainer",
                start: "top 55%",
                end: "bottom bottom ",
                // markers: true,
                scrub: 4,
                toggleActions: "play none none reverse",
            }
        })
        .to(spherePlanet.scale, {
            x: 2,
            y: 2,
            z: 2
        })

        .to(spherePlanet.position, {
            x: -800,
            y: -200,
        }, "<")
    })

});


const canvas2 = document.getElementById('canvas3d-2');
const app2 = new Application(canvas2);
const trigger = document.getElementById('part2')

    app2
        .load('https://prod.spline.design/5VUtouFw1z8sBvvz/scene.splinecode')
        .then(() => {
            const all = app2.findObjectByName('ALL');
            const camera = app2.findObjectByName('Camera');
            gsap.set(all.scale, {x:2, y:2, z:2})
            gsap.set(all.position,{ x: 0, y: -180 });
            gsap.set(camera.position,{ z: 910 });

        })
