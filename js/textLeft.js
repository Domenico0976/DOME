const container = document.querySelector('.Anicontainer')
const sections = gsap.utils.toArray('.Anicontainer section')


let scrollTween = gsap
    .to(sections, {
    xPercent: -100 * (sections.length - 1),
    ease: "none",
    scrollTrigger:{
        trigger: container,
        pin: true,
        scrub: 1,
        end: "+=4000",
        // markers: true,
    }
})

sections.forEach(section => {
    let text = section.querySelectorAll('.anim')

    let animation = gsap.from(text, {
        y: -130,
        opacity: 0.2,
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


   