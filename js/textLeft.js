const container = document.querySelector('.wrapper')
const sections = document.querySelectorAll('.container')


let scrollTween = gsap
    .to(sections, {
    xPercent: -100 * (sections.length - 1),
    ease: "none",
    scrollTrigger:{
        trigger: container,
        pin: true,
        scrub: 1,
        end: "+=3000",
        // markers: true,
    }
})

sections.forEach(section => {
    let text = section.querySelectorAll('.anim');
    
    let animation = gsap.from(text, {
        y: -130,
        opacity: 0,
        duration: 1,
        ease: "bounce.Out",
        stagger: 0.1,
    });

    ScrollTrigger.create({
        trigger: section,
        containerAnimation: scrollTween,
        start: "left center",
        // markers: true,
        animation: animation,
        toggleActions: "play none none reverse",
        onLeaveBack: () => animation.reverse()
    });
});
