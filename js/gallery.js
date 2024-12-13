var imgNames = document.querySelectorAll(".img-name");
var imgPreviewContainer = document.querySelector(".img-preview-container");
var imgViewContainer = document.querySelector(".img-modal .img-view");
var modalReveal = document.querySelector(".modal-name-revealer");
var modalImgReveal = document.querySelector(".modal-image-container");
var containerGallery = document.querySelector(".img-names");
var bodyAll = document.documentElement;
let nav = document.querySelector("nav")
var modalPanel = document.querySelector(".img-modal");
modalPanel.style.pointerEvents = "none";

var closeBtn = document.querySelector(".close-btn");
var modalName = document.querySelector(".modal-name");
let tlGallery = gsap.timeline({paused:true});

imgNames.forEach((imgName) => {
    imgName.addEventListener("mouseover", () => {
        var dataImg = parseInt(imgName.getAttribute("data-img"), 10);
        if(dataImg < 7 || dataImg > 12 ){
            imgPreviewContainer.innerHTML = `<img loading ="lazy" src="../asset/gallery/${dataImg}/${dataImg}.png" alt="Preview image project ${dataImg}" draggable="false" />`;
        } else {imgPreviewContainer.innerHTML = `<video src="../asset/gallery/${dataImg}/${dataImg}.mp4" alt="Preview video project ${dataImg}" />`;
        };
    });
    imgName.addEventListener("click", () =>{
        modalPanel.style.display = "flex";
        imgViewContainer.innerHTML = '';
        modalImgReveal.innerHTML = '';
        modalName.innerHTML = '';
        containerGallery.classList.add("display");
        closeBtn.style.pointerEvents = "auto";
        bodyAll.classList.add('no-scroll');
        modalPanel.style.pointerEvents = "auto";


        var dataImg = parseInt(imgName.getAttribute("data-img"), 10);
        var dataCount = parseInt(imgName.getAttribute("data-count"), 10);
        
        if(dataImg >= 7 && dataImg < 13){
            imgViewContainer.innerHTML = `<video data-zoom="${dataImg}" autoplay src="../asset/gallery/${dataImg}/${dataImg}.mp4" alt="Preview video project ${dataImg}" />`;
            const video = imgViewContainer.querySelector('video');
            video.volume = 0.05;

            } else {imgViewContainer.innerHTML = `<img loading ="lazy" data-zoom="${dataImg}" src="../asset/gallery/${dataImg}/${dataImg}.png" alt="Preview image project ${dataImg}" draggable="false"/>`;
        };

        var name = imgName.querySelector(".name").textContent;
        modalName.textContent = name;

        var description = imgName.getAttribute("data-description");
        modalReveal.innerHTML = description;


        
        for (let i = dataImg + 1; i <= dataImg + dataCount; i++) {
            modalImgReveal.innerHTML += `<img loading ="lazy" data-zoom="${i}" src="../asset/gallery/${dataImg}/${i}.png" alt="Project ${name} ${i}" />`;
        }
        tlGallery.reversed(!tlGallery.reversed());
    });
    
});

closeBtn.onclick = function(){
    tlGallery.reversed(!tlGallery.reversed());
    containerGallery.classList.remove("display");
    body.classList.remove('no-scroll');
    closeBtn.style.pointerEvents = "auto";
    setTimeout(modalHide, 2000);
};

function modalHide(){
    modalPanel.style.display = "none";
    imgViewContainer.innerHTML = '';
    modalImgReveal.innerHTML = '';
    modalName.innerHTML = '';
}

function revealImg(){

    tlGallery.to(nav, 1,{
        y: -100
    })

    tlGallery.to("#items", {
            opacity: 0.1,
            y: 130,
            duration: 2,
        }, "<")

    tlGallery.to(".img-name .name", 1, {
        ease: "power4.inOut",
        opacity: 0.6,

    },"<");

    tlGallery.to(".img-preview-container", 1, {
        clipPath: "polygon(0 100%, 100% 100%, 100% 100%, 0 100%)",
        y: 25,
        ease: "power4.inOut",
    }, "<");

    tlGallery.to(".img-modal", 0.4,{
        opacity: 1,
        ease: "none",
        delay: -0.125,
    },">");

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
