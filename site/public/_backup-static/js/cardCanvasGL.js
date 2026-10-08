(function initCanvasOpgl() {
  var stageContainers = document.querySelectorAll('.opgl-stage');

  function sanitizeName(fileName) {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  function removeSelectedCard(stage) {
    var selectedCard = stage.querySelector('.wrapper .image-squ.is-selected-to-canvas');
    if (selectedCard) {
      selectedCard.classList.remove('is-selected-to-canvas');
      selectedCard.classList.remove('is-returning-to-stack');
      void selectedCard.offsetWidth;
      selectedCard.classList.add('is-returning-to-stack');

      if (selectedCard.__returnAnimTimeout) {
        clearTimeout(selectedCard.__returnAnimTimeout);
      }

      selectedCard.__returnAnimTimeout = setTimeout(function() {
        selectedCard.classList.remove('is-returning-to-stack');
        selectedCard.__returnAnimTimeout = null;
      }, 500);
    }
  }

  function removeCanvas(stage) {
    if (stage.__fluidHover) {
      stage.__fluidHover.destroy();
      stage.__fluidHover = null;
    }

    var existing = stage.querySelector('.canvas-opgl');
    if (existing) {
      existing.remove();
    }

    removeSelectedCard(stage);
    stage.classList.remove('is-canvas-open');
  }

  function openCanvas(stage, imageSrc, selectedCard) {
    removeCanvas(stage);

    var fileName = imageSrc.split('/').pop() || 'image';
    var imageKey = sanitizeName(fileName);

    var canvas = document.createElement('div');
    canvas.className = 'canvas-opgl canvas-opgl--' + imageKey;
    canvas.setAttribute('data-image-name', imageKey);

    var canvasView = document.createElement('div');
    canvasView.className = 'canvas-opgl-view';

    var img = document.createElement('img');
    img.src = imageSrc;
    img.alt = '';
    img.draggable = false;
    canvasView.appendChild(img);

    // ── Fluid hover effect (WebGL liquid distortion, hover-only, off in zoom) ──
    var fluidHandle = typeof FluidHover !== 'undefined'
      ? FluidHover.mount(canvasView, img)
      : null;
    if (fluidHandle) {
      canvasView.classList.add('has-fluid');
      stage.__fluidHover = fluidHandle;
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── Zoom button (desktop only via CSS) ──────────────────────────
    var isZoomActive = false;
    var ZOOM_SCALE = 2.8;

    var zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.className = 'canvas-opgl-zoom-btn';
    zoomBtn.setAttribute('aria-label', 'Toggle zoom mode');

    var zoomIconSVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="20" y1="20" x2="15.65" y2="15.65"></line></svg>';

    function setZoomState(active) {
      isZoomActive = active;
      if (active) {
        canvasView.classList.add('zoom-active');
        zoomBtn.classList.add('is-active');
        zoomBtn.innerHTML = zoomIconSVG + 'No Zoom';
        img.style.transform = '';
        img.style.transformOrigin = 'center center';
      } else {
        canvasView.classList.remove('zoom-active');
        zoomBtn.classList.remove('is-active');
        zoomBtn.innerHTML = 'Zoom mode' + zoomIconSVG;
        img.style.transform = '';
        img.style.transformOrigin = 'center center';
      }
    }

    setZoomState(false);

    zoomBtn.addEventListener('click', function(event) {
      event.stopPropagation();
      setZoomState(!isZoomActive);
    });

    canvasView.addEventListener('mousemove', function(event) {
      if (!isZoomActive) return;
      var rect = img.getBoundingClientRect();
      var x = Math.min(Math.max((event.clientX - rect.left) / rect.width * 100, 0), 100);
      var y = Math.min(Math.max((event.clientY - rect.top) / rect.height * 100, 0), 100);
      img.style.transformOrigin = x + '% ' + y + '%';
      img.style.transform = 'scale(' + ZOOM_SCALE + ')';
    });

    canvasView.addEventListener('mouseleave', function() {
      if (!isZoomActive) return;
      img.style.transform = 'scale(1)';
    });
    // ────────────────────────────────────────────────────────────────

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'canvas-opgl-close';
    closeButton.setAttribute('aria-label', 'Close image preview');
    closeButton.textContent = '×';

    closeButton.addEventListener('click', function(event) {
      event.stopPropagation();
      removeCanvas(stage);
    });

    canvasView.appendChild(zoomBtn);
    canvasView.appendChild(closeButton);
    canvas.appendChild(canvasView);

    canvas.addEventListener('click', function(event) {
      if (!canvasView.contains(event.target)) {
        removeCanvas(stage);
      }
    });

    if (selectedCard) {
      selectedCard.classList.add('is-selected-to-canvas');
    }

    stage.appendChild(canvas);
    stage.classList.add('is-canvas-open');
  }

  stageContainers.forEach(function(stage) {
    var wrapper = stage.querySelector('.card-base-clear .wrapper');
    if (!wrapper) {
      return;
    }

    wrapper.querySelectorAll('.image-squ img').forEach(function(img) {
      img.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        var selectedCard = img.closest('.image-squ');
        openCanvas(stage, img.getAttribute('src') || '', selectedCard);
      });
    });
  });
})();
