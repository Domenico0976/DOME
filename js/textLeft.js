const container = document.querySelector('.wrapper')
const sections = document.querySelectorAll('.container')


let scrollTween = gsap
    .to(sections, {
    xPercent: -100 * (sections.length - 1),
    ease: "none",
    scrollTrigger:{
        trigger: container,
        pin: true,
        scrub: true,
        end: "+=3500",
        // markers: true,
    }
});

sections.forEach(section => {
    let text = section.querySelectorAll('.anim');
    let whgt = section.querySelectorAll("#title");

    let tl = gsap.timeline({repeat: -1, yoyo: true});

    let animation = 
        gsap.from(text, 1, {
            y: -130,
            opacity: 0,
            duration: 1,
            ease: "bounce.Out",
            stagger: 0.05,
        }, "<")
        tl.to(whgt, 1, {
            ease: "none",
            stagger: 0.1,
            fontWeight: 300,
        }, "<");

    ScrollTrigger.create({
        trigger: section,
        containerAnimation: scrollTween,
        start: "left right",
        // markers: true,
        animation: animation,
        toggleActions: "play none none reverse",
        onLeaveBack: () => animation.reverse()
    });
});
