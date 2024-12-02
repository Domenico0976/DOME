var imgNames = document.querySelectorAll(".img-name");
var imgPreviewContainer = document.querySelector(".img-preview-container");
var imgViewContainer = document.querySelector(".img-modal .img-view");
var modalReveal = document.querySelector(".modal-name-revealer");
var modalImgReveal = document.querySelector(".modal-image-container");
var containerGallery = document.querySelector(".img-names");
var bodyAll = document.documentElement;

var closeBtn = document.querySelector(".close-btn");
var modalName = document.querySelector(".modal-name");
let tlGallery = gsap.timeline({paused:true});

imgNames.forEach((imgName) => {
    imgName.addEventListener("mouseover", () => {
        var dataImg = parseInt(imgName.getAttribute("data-img"), 10);
        if(dataImg < 7 || dataImg > 12 ){
            imgPreviewContainer.innerHTML = `<img loading="lazy" src="../asset/gallery/${dataImg}/${dataImg}.png" alt="Preview image project ${dataImg}" />`;
        } else {imgPreviewContainer.innerHTML = `<video src="../asset/gallery/${dataImg}/${dataImg}.mp4" alt="Preview video project ${dataImg}" />`;
        };
    });
    imgName.addEventListener("click", () =>{
        containerGallery.classList.add("display");
        closeBtn.style.pointerEvents = "auto";
        bodyAll.classList.add('no-scroll');

        var dataImg = parseInt(imgName.getAttribute("data-img"), 10);
        var dataCount = parseInt(imgName.getAttribute("data-count"), 10);
        
        if(dataImg >= 7 && dataImg < 13){
            imgViewContainer.innerHTML = `<video muted controls data-zoom="${dataImg}" autoplay src="../asset/gallery/${dataImg}/${dataImg}.mp4" alt="Preview video project ${dataImg}" />`;
            } else {imgViewContainer.innerHTML = `<img data-zoom="${dataImg}" loading="lazy" src="../asset/gallery/${dataImg}/${dataImg}.png" alt="Preview image project ${dataImg}" draggable="false"/>`;
        };

        var name = imgName.querySelector(".name").textContent;
        modalName.textContent = name;

        var description = imgName.getAttribute("data-description");
        modalReveal.innerHTML = description;

        modalImgReveal.innerHTML = '';
        for (let i = dataImg + 1; i <= dataImg + dataCount; i++) {
            modalImgReveal.innerHTML += `<img data-zoom="${i}" loading="lazy" src="../asset/gallery/${dataImg}/${i}.png" alt="Project ${name} ${i}" />`;
        }
        tlGallery.reversed(!tlGallery.reversed());
    });
    
});

closeBtn.onclick = function(){
    tlGallery.reversed(!tlGallery.reversed());
    containerGallery.classList.remove("display");
    body.classList.remove('no-scroll');
    modalImgReveal.innerHTML = '';
    modalName.innerHTML = '';

};

function revealImg(){

    tlGallery.to("#items", 0.5, {
            opacity: 0.1,
        })

    tlGallery.to(".img-name .name", 1, {
        ease: "power4.inOut",
        opacity: 0.6,

    });

    tlGallery.to(".img-preview-container", 1, {
        clipPath: "polygon(0 100%, 100% 100%, 100% 100%, 0 100%)",
        y: 25,
        ease: "power4.inOut",
    }, "<");

    tlGallery.to(".img-modal", 0.4,{
        opacity: 1,
        ease: "none",
        delay: -0.125,
    });

    tlGallery.to(".img-view", 1,{
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
        ease: "power4.inOut",
    }, "<");

    tlGallery.to(".close-btn .btnGallery", 1,{
        top: "0",
        ease: "power4.inOut",
        opacity: 1,
    }, "<");

    tlGallery.to(".modal-name", 1,{
        clipPath: "polygon(100% 0, 0 0, 0 100%, 100% 100%)",
        ease: "power4.inOut",
    }, "<");

    tlGallery.to(".modal-image-container", 1,{
        clipPath: "polygon(100% 100%, 0 100%, 0 0, 100% 0)",
        ease: "power4.inOut",
    }, "<");

    tlGallery.to(".modal-name-revealer", 1,{
        clipPath: "polygon(100% 100%, 0 100%, 0 0, 100% 0)",
        ease: "power4.inOut",
    }, "<").reverse();
}

revealImg();
