/**
 * splineViewer.js
 * Loads the Spline .splinecode scene into #spline-canvas via @splinetool/runtime.
 *
 * Key behaviours:
 *  1. Delays app.load() until .upgrade becomes visible (GSAP reveals it ~4s after
 *     page load). This ensures the "Start > Transition" animations fire while the
 *     canvas is already on screen, so the user sees the full 1s ease-in transition.
 *
 *  2. Mouse parallax: smoothly rotates the top-level scene group toward the cursor.
 *       X axis (vertical mouse)   — less
 *       Y axis (horizontal mouse) — even less
 *       Z axis (horizontal mouse) — little roll
 */

import { Application } from 'https://unpkg.com/@splinetool/runtime/build/runtime.js';

const SCENE_URL   = 'https://prod.spline.design/mnOBvvPrEjXFqYmh/scene.splinecode';
const OBJ_NAMES   = ['h1', 'h2', 'e', 'l', 'l2', 'o'];

const canvas = document.getElementById('spline-canvas');
const app    = new Application(canvas);

// ── Parallax state ────────────────────────────────────────────────────────────
let rotTarget = null;
let tRX = 0, tRY = 0, tRZ = 0;
let cRX = 0, cRY = 0, cRZ = 0;

// Max rotation in radians — keep all values subtle
const MAX_RX = 0.10;   // vertical mouse   → X tilt  (less)
const MAX_RY = 0.06;   // horizontal mouse → Y pan   (even less)
const MAX_RZ = 0.025;  // horizontal mouse → Z roll  (little)
const SMOOTH = 0.05;   // lerp factor — lower = smoother / slower

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Polls every animation frame until `el` has computed opacity > 0
 * and is not visibility:hidden, then calls `cb` once.
 */
function waitForVisible(el, cb) {
  let fired = false;
  const tick = () => {
    if (fired) return;
    const cs  = getComputedStyle(el);
    const opa = parseFloat(cs.opacity);
    if (opa > 0.01 && cs.visibility !== 'hidden') {
      fired = true;
      cb();
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/**
 * Walk up from an object until its parent is the THREE.Scene
 * (i.e. parent.parent === null), returning the top-level group.
 */
function topLevelOf(obj) {
  let cur = obj;
  while (cur.parent && cur.parent.parent) cur = cur.parent;
  return cur;
}

// ── Scene initialisation ──────────────────────────────────────────────────────

function initScene() {
  app.load(SCENE_URL).then(() => {
    const objects = OBJ_NAMES.map(n => app.findObjectByName(n)).filter(Boolean);

    if (objects.length > 0) {
      // If all objects share a single top-level group, rotate that group;
      // otherwise fall back to the first object's direct scene-level parent.
      const tops = new Set(objects.map(topLevelOf));
      rotTarget = tops.size === 1 ? [...tops][0] : topLevelOf(objects[0]);
    }

    requestAnimationFrame(animateParallax);
    console.log('[Spline] Scene ready — objects found:', objects.length);
  }).catch(err => console.error('[Spline] Load failed:', err));
}

// Wait for the loading-page GSAP animation to reveal .upgrade, THEN load.
// This guarantees "Start > Transition" events fire while the canvas is visible.
const upgradeEl = document.querySelector('.upgrade');
if (upgradeEl) {
  waitForVisible(upgradeEl, initScene);
} else {
  initScene();
}

// ── Mouse parallax ────────────────────────────────────────────────────────────

document.addEventListener('mousemove', (e) => {
  // Normalise to -1…+1 relative to viewport centre
  const nx =  (e.clientX / window.innerWidth  - 0.5) * 2;
  const ny =  (e.clientY / window.innerHeight - 0.5) * 2;

  tRX = -ny * MAX_RX;  // tilt up/down   (less)
  tRY =  nx * MAX_RY;  // pan left/right (even less)
  tRZ = -nx * MAX_RZ;  // slight roll    (little)
});

function animateParallax() {
  requestAnimationFrame(animateParallax);
  if (!rotTarget) return;

  // Exponential lerp toward target — produces smooth, "heavy" feel
  cRX += (tRX - cRX) * SMOOTH;
  cRY += (tRY - cRY) * SMOOTH;
  cRZ += (tRZ - cRZ) * SMOOTH;

  rotTarget.rotation.x = cRX;
  rotTarget.rotation.y = cRY;
  rotTarget.rotation.z = cRZ;
}
