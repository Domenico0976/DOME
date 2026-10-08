const images = document.querySelectorAll('img');

    images.forEach((img, index) => {
    img.style.animationDelay = `${index * 1}s`;
});

let cursorPosition = { x: 0, y: 0 };
let scrollPosition = 0; // Per tenere traccia dello scroll verticale
let isCursorMoving = false;
let cursorMoveTimeout;
let circles = [];
let circleRemovalInterval;

const intro = document.querySelector(".intro");
const cursor = document.getElementById("main");

const introBounds = intro.getBoundingClientRect();

window.addEventListener("scroll", () => {
    scrollPosition = window.scrollY;
});

intro.addEventListener("mousemove", (e) => {
    const cursorX = Math.max(introBounds.left, Math.min(e.clientX, introBounds.right));
    const cursorY = Math.max(introBounds.top, Math.min(e.clientY + scrollPosition, introBounds.bottom));

    cursorPosition.x = cursorX;
    cursorPosition.y = cursorY;

    gsap.to(cursor, {
        x: cursorX - cursor.offsetWidth / 2 + "px",
        y: cursorY - cursor.offsetHeight / 2 + "px",

    });

    isCursorMoving = true;

    clearTimeout(cursorMoveTimeout);
    cursorMoveTimeout = setTimeout(() => {
        isCursorMoving = false;
        setTimeout(() => {
            clearInterval(circleRemovalInterval);
            circleRemovalInterval = setInterval(() => {
                if (circles.length > 0) {
                    let circleW = circles.shift();
                    circleW.style.transform = "scale(0.3)";
                    circleW.remove();
                } else {
                    clearInterval(circleRemovalInterval);
                }
            }, 10);
            }, 600);
        }, 100);
    });

    setInterval(() => {
        if (isCursorMoving) {
            const circle = document.createElement("div");
            circle.classList.add("circle");
            intro.appendChild(circle);

            circle.style.left = cursorPosition.x - introBounds.left - circle.offsetWidth / 2 + "px";
            circle.style.top = cursorPosition.y - introBounds.top - circle.offsetHeight / 2 + "px";

            circles.push(circle);
        }
    }, 10);

    
const containerSlide = document.querySelector("#slide");
let imageIndex = 1;
let animationTimeout = null;
let currentlyPlaying = false;

function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function addNewItem(x, y) {
    const existingItems = containerSlide.querySelectorAll(".item");
    const minDistance = 80; // Distanza minima tra le immagini

    for (const item of existingItems) {
        const itemX = parseFloat(item.style.left) + 75; // Centro dell'immagine esistente
        const itemY = parseFloat(item.style.top) + 100; // Centro dell'immagine esistente
        if (getDistance(x, y, itemX, itemY) < minDistance) {
            return;
        }
    }

    const newItem = document.createElement("div");
    newItem.className = "item";
    newItem.style.left = `${x - 75}px`;
    newItem.style.top = `${y - 100}px`;

    const img = document.createElement("img");
    img.src = `./cursorPage/img${imageIndex}.png`;
    newItem.appendChild(img);
    imageIndex = (imageIndex % 7) + 1;

    containerSlide.appendChild(newItem);
    manageItemLimit();
}

function manageItemLimit() {
    const items = Array.from(containerSlide.querySelectorAll(".item")); // Convert to array
    for (let i = items.length - 1; i >= 0; i--) {
        if (items.length > 100) {
            containerSlide.removeChild(items[i]);
        }
    }
}
function startAnimation() {
    if (currentlyPlaying || containerSlide.children.length === 0) return;
    currentlyPlaying = true;

    gsap.to(".item", {
        y: 250,
        scale: 0.5,
        opacity: 0,
        duration: 0.5,
        stagger: 0.045,
        onComplete: function () {
            this.targets().forEach((item) => {
                if (item.parentNode) {
                    item.parentNode.removeChild(item);
                }
            });
            currentlyPlaying = false;
        },
    });
}

containerSlide.addEventListener("mousemove", function (event) {
    clearTimeout(animationTimeout);
    addNewItem(event.pageX, event.pageY);
    animationTimeout = setTimeout(startAnimation, 30);
});

let ratina = document.querySelectorAll('.ratina');
let container3 = document.querySelector('.intro-3');
let closeEye = document.querySelectorAll('.close');
const cursor3 = document.querySelector('#main3');

container3.addEventListener('mousemove', (e) => {
    const { left: containerLeft, top: containerTop, width: containerWidth, height: containerHeight } = container3.getBoundingClientRect();

    const mouseX = e.clientX - containerLeft; 
    const mouseY = e.clientY - containerTop; 

    let left = (mouseX / containerWidth) * 100;
    let top = (mouseY / containerHeight) * 100;

    gsap.to(cursor3, {
        x: mouseX,
        y: mouseY,
        rotation: mouseX / 2,
        duration: .5,
        scale: 1,
        ease: "power2.out",

    })


    left = left < 0 ? 0 : (left > 70 ? 70 : left);
    top = top < 0 ? 0 : (top > 90 ? 90 : top);

    ratina.forEach((el) => {
        el.style.left = `${left}%`;
        el.style.top = `${top}%`;
    });
});

let textIntro = document.querySelectorAll(".textIntro");

gsap.from(textIntro, {
    scrollTrigger: {
        trigger: ".intro",
        start: "center 30%",
        end: "bottom bottom",
        toggleActions: "play none none reverse",
    },
    y: -130,
    scale: 0.6
})

let textFocus = document.querySelectorAll(".textFocus");

gsap.from(textFocus, {
    scrollTrigger: {
        trigger: container3,
        start: "top 10%",
        end: "bottom bottom",
        toggleActions: "play none none reverse",
    },
    y: 300,
    stagger: 0.1,
    duration: 0.5,
    ease: "power2.out"
});


gsap.fromTo(
    ".eye",
    { scale: 0.4 },
    {
        scale: 1,
        duration: 0.3,
        ease: "bouncy.inOut",
        scrollTrigger: {
            trigger: container3,
            start: "top 10%",
            end: "bottom bottom",
            toggleActions: "play none none reverse",
        },
    }
);

gsap.fromTo(
    "#heroP",
    { y: 200, opacity: 0 },
    {
        y: 0, opacity: 1,
        duration: .4,
        ease: "power2.inOut",
        scrollTrigger: {
            trigger: container3,
            start: "center 70%",
            end: "bottom bottom",
            pin: true,
            scrub: 1,
            toggleActions: "play none none reverse",
        },
    }
);

gsap.from(closeEye, 
{
    y: 380,
    repeat: -1,
    duration: 1.3,
    repeatDelay: 6,
    ease: "power2.out"
})

let textFocus2 = document.querySelectorAll(".textFocus2")

gsap.from(textFocus2, {
    scrollTrigger: {
        trigger: ".wallText",
        start: "top top",
      end: "+=250%",
      scrub: true,
      pin: true,
    },
    y: 300,
    stagger: 0.1,
    duration: 0.5,
    ease: "power2.inOut"
});

document.addEventListener("DOMContentLoaded", () => {
      const container = document.querySelector("#rainbow");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.style.display = "block";
      container.appendChild(canvas);


      const colors = [
  [51, 23, 51],   // #331733
  [173, 117, 173], // #AD75AD
  [245, 77, 66],   // #F54D42
  [38, 17, 38],   // Tonalità più scura di #331733
  [204, 163, 204], // Tonalità più chiara di #AD75AD
  [255, 120, 110], // Tonalità più chiara di #F54D42
  [76, 34, 76],   // Tonalità media di #331733
  [139, 93, 139],  // Tonalità più scura di #AD75AD
  [230, 60, 50]    // Tonalità più scura di #F54D42
];

let cells = [];
let cellSize = 5;
let rows, cols;

function resizeCanvas() {
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
  rows = Math.ceil(canvas.height / cellSize);
  cols = Math.ceil(canvas.width / cellSize);
  initializeCells();
}

function initializeCells() {
  cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        x: col * cellSize,
        y: row * cellSize,
        color: null,
        isWhite: false,
        whiteDuration: 0,
        colorDuration: 2
      });
    }
  }
}

function drawCells() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cells.forEach(cell => {
    if (cell.isWhite) {
      ctx.strokeStyle = `rgba(61, 50, 79, ${Math.max(0.01, cell.whiteDuration / 30)})`;

      ctx.lineWidth = Math.max(0.001, cell.whiteDuration / 30);

      ctx.strokeRect(cell.x, cell.y, cellSize, cellSize);    } else if (cell.color) {
      ctx.fillStyle = `rgba(${cell.color.join(",")}, ${Math.max(0.1, cell.colorDuration / 50)})`;
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
    }
    ctx.fillRect(cell.x, cell.y, cellSize, cellSize);
  });
}

function animateRandomCells() {
  cells.forEach(cell => {
    if (Math.random() < 0.003) {
      cell.isWhite = true;
      cell.whiteDuration = 50;
    }
    if (cell.isWhite) {
      cell.whiteDuration--;
      if (cell.whiteDuration <= 1) {
        cell.isWhite = false;
      }
    }
  });
}

function animateCellColors() {
  cells.forEach(cell => {
    if (cell.colorDuration >= 0) {
      cell.colorDuration--;
      if (cell.colorDuration <= 0) {
        cell.color = null;
      }
    }
  });
}

// Gestione movimento del mouse
canvas.addEventListener("mousemove", e => {
  const mouseX = e.offsetX;
  const mouseY = e.offsetY;

  cells.forEach(cell => {
    const distance = Math.hypot(cell.x + cellSize / 2 - mouseX, cell.y + cellSize / 2 - mouseY);
    if (distance < cellSize * 1.6) {
      if (!cell.isWhite) {
        cell.color = colors[Math.floor(Math.random() * colors.length)];
        cell.colorDuration = 400; // Durata del colore in frame
      }
    }
  });
});

// Animazione principale
function animate() {
  animateRandomCells();
  animateCellColors();
  drawCells();
  requestAnimationFrame(animate);
}

// Avvia il tutto
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
animate();
});

document.querySelector('.closeBtn').addEventListener('click', () => {
            // Chiude la finestra se è stata aperta con "window.open" o un link con target="_blank".
            window.close();
});
