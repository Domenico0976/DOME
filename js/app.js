const lenis = new Lenis()

lenis.on('scroll', ScrollTrigger.update)

gsap.ticker.add((time)=>{
  lenis.raf(time * 1000);
})

gsap.ticker.lagSmoothing(0);

document.addEventListener("DOMContentLoaded", () => {

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfefdfd);

const camera = new THREE.PerspectiveCamera(
    65, window.innerWidth/ window.innerHeight, 0.1, 1000
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
});

renderer.setClearColor(0xfffff, 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.tonMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;
document.querySelector(".model").appendChild(renderer.domElement);

const ambientLigth = new THREE.AmbientLight(0xffffff, 4);
scene.add(ambientLigth);

const mainLigth = new THREE.DirectionalLight(0xffffff, 2);
mainLigth.position.set(0, 5, 2.5);
scene.add(mainLigth);

const fillLigth= new THREE.DirectionalLight(0xffffff, 4);
fillLigth.position.set(-5, 0, -5);
scene.add(fillLigth);

const hemiLigth = new THREE.HemisphereLight(0xffffff, 0xffffff, 4);
hemiLigth.position.set(0, 15, 0);
scene.add(hemiLigth);

function basicAnimate(){
    renderer.render(scene, camera);
    requestAnimationFrame(basicAnimate);
}
basicAnimate();

let model;
const can1 = new THREE.GLTFLoader();
can1.load(
    "./asset/three.js/josta.glb",
    function (gltf){
        model = gltf.scene;
        model.traverse((node) =>{
            if(node.isMesh){
                if(node.material){
                    node.material.metalness = 0.45;
                    node.material.roughness = 1;
                    node.material.envMapIntesity = 0.5;
                }
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        scene.add(model);

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.z = maxDim * 1.5;
 
        model.scale.set(0, 0, 0);
        playInitialAnimation();

        cancelAnimationFrame(basicAnimate);
        animate();
    });

    const floatAmplitude = 0.2;
    const floadSpeed = 1.5;
    const rotationSpeed = 0.3;
    let isFloating = true;
    let currentScroll = 0;

    const stickyHeight = window.innerHeight;
    const scannerSection = document.querySelector(".scanner");
    const scannerPosition = scannerSection.offsetTop;
    const scanContainer = document.querySelector(".scan-container");
    const scanSound = new Audio("./asset/three.js/scanner.mp3");
    const bodySound = new Audio("./asset/three.js/can.wav");
    gsap.set(scanContainer, {scale: 0});

    function playInitialAnimation(){
        if (model){
            gsap.to(model.scale, {
                x:1,
                y:1,
                z:1,
                duration: 1,
                ease: "power2.out"
            });
        }
        gsap.to(scanContainer,{
            scale: 1,
            duration: 1,
            ease: "power2.out"
        })
    }

    ScrollTrigger.create({
        trigger: "body",
        start: "top top",
        // markers: true,
        // end: "top 60",
        onEnterBack: () => {
            if(model){
                gsap.to(model.scale, {
                    x: 1,
                    y: 1,
                    z: 1,
                    duration: 1,
                    ease:"power2.out",
                });
                isFloating = true;
            }
        gsap.to(scanContainer, {
            scale: 1,
            duration: 1,
            ease: "power2.out",
            });
        },
    });    

    ScrollTrigger.create({
        trigger: ".scanner",
        start: "top top",
        toggleActions: "play none none reverse",
        end: stickyHeight + "px",
        // markers: true,
        pin: true,
        onEnter: () => {
            if(model){
                isFloating = true;
                model.position.y = -10;
                setTimeout(() =>{
                    scanSound.currentTime = 0;
                    scanSound.volume = 0.55;
                    scanSound.play();
                }, 800);
                
                gsap.to(model.scale, {
                    x: 0.5,
                    y: 0.5,
                    z: 0.5,
                    duration: 0.5,
                    ease: "power2.in",
                    onComplete: () => {
                        gsap.to(model.rotation, {
                            y: model.rotation.y + Math.PI * 1.2,
                            duration: 2,
                            ease:"power2.inOut",
                            onComplete: () =>{
                                gsap.to(model.scale, {
                                    x: 1,
                                    y: 1,
                                    z: 1,
                                    duration: 0.5,
                                    ease: "power2.in",
                                })
                                }   
                        });
                    },
                });
            }
        },
        onLeaveBack: () => {
            gsap.to(model.scale, {
                x: 1,
                y: 1,
                z: 1,
                duration: 0.5,
                ease: "power2.in",
            })
            gsap.to(model.rotation, {
                z: model.rotation.z + Math.PI * 2,
                
                duration: 2,
                ease:"power2.inOut",
            });
        }
    });

    lenis.on("scroll", (e) => {
        currentScroll = e.scroll;
    });
    

    let mouseX = 0;
    let mouseY = 0;

    window.addEventListener("mousemove", (event) => {
    const { clientX, clientY } = event;

    // Converti le coordinate del mouse in un range normalizzato (-1 a 1)
    mouseX = (clientX / window.innerWidth) * 2 - 1;
    mouseY = -(clientY / window.innerHeight) * 2 + 1; // Invertito per allinearsi al canvas
});

    function animate(){
        
        if(model){
            if(isFloating){
                const floatOffset =
                    Math.sin(Date.now() * 0.001 * floadSpeed) * floatAmplitude;
                    model.position.y = floatOffset;
            }

            const scrollProgress = Math.min(currentScroll / scannerPosition);


            if(scrollProgress < 1){
                model.rotation.x = scrollProgress * Math.PI * 2;
            }

            if(scrollProgress < 1){
                model.rotation.y += 0.01 * rotationSpeed;
            }

        // Interpolazione della rotazione per seguire il puntatore del mouse
        const targetRotationX = mouseX * Math.PI * 0.05; // Amplifica il movimento del mouse
        const targetRotationY = mouseYgi * Math.PI * 0.05; // Amplifica il movimento del mouse

        // Lerp per una transizione fluida
        model.rotation.x += (targetRotationX - model.rotation.x) * 0.05; // Damping 0.1
        model.rotation.z += (targetRotationY - model.rotation.z) * 0.05; // Damping 0.1

        }
        
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
        
    }

    let resizeTimeout;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }, 100);
    });

})