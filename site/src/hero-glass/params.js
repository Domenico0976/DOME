// src/hero-glass/params.js
// Pure constants and math. No Three.js, React, CSS or preloader.

import { MOBILE_BREAKPOINT, TABLET_BREAKPOINT } from '../constants/breakpoints.js'

// --- Pen values (verbatim) ---

export const TORUS_KNOT = {
  radius: 0.88,
  tube: 0.53,
  tubularSegments: 33,
  radialSegments: 7,
  p: 2,
  q: 3,
}

export const MATERIAL = {
  color: 0xffffff,
  metalness: 0.12,
  roughness: 0.051,
  transmission: 1,
  thickness: 0.7,
  ior: 1.55,
  dispersion: 2.9,
  // 0.35, not 1. scene.environment is a PMREM of RoomEnvironment — a white
  // studio with visible light panels. At envMapIntensity 1 on a near-mirror
  // surface it reflects that studio across the whole object and buries the
  // refracted text, which reads as "a background reflection" rather than as
  // glass. This only scales the specular IBL; the transmission is untouched.
  envMapIntensity: 0.35,
  toneMapped: false,
}

export const CAMERA_Z = 5
export const TORUS_Z = 2.2
export const BACKDROP_Z = 1.0
export const TORUS_VIEWPORT_SCALE = 0.09

// --- Text rows ---

// A `behind` row has to sit inside the transmission frustum, just in front of
// the backdrop. A `front` row has to sit between the torus and the camera.
export const TEXT_BEHIND_Z = BACKDROP_Z + 0.05
export const TEXT_FRONT_Z = TORUS_Z + 0.8

export const TEXT_LAYOUT = {
  pad: 3,
  opacity: 1,
  behindWobble: 1,
  frontWobble: 0,
  behindAlphaTest: 0.5,
  frontAlphaTest: 0,
  behindRenderOrder: 0,
  frontRenderOrder: 10,
}

export const ROTATION = { xSpeed: 0.05, ySpeed: 0.25, pointerX: 0.12, pointerY: 0.15 }
export const REDUCED_ROTATION = { x: 0.06, y: 0.04, z: 0.1 }

export const SITE_BG_FALLBACK = 'transparent'

// --- Framing ---

export const BOUNDING_RADIUS = 0.25

// --- Responsive ---

export const LAYOUTS = {
  mobile: {
    maxWidth: MOBILE_BREAKPOINT,
    scaleMultiplier: 1.39,
    anchorX: 0.07,
    anchorY: 0.55,
    padding: 0.1,
    halfCut: true,
    parallax: 0.45,
  },
  tablet: {
    maxWidth: TABLET_BREAKPOINT,
    scaleMultiplier: 1.02,
    anchorX: 0.3,
    anchorY: 0.7,
    padding: 0.12,
    halfCut: true,
    parallax: 0.55,
  },
  desktop: {
    maxWidth: Infinity,
    scaleMultiplier: 1.3,
    anchorX: 0.3,
    anchorY: 0.65,
    padding: 0.03,
    halfCut: true,
    parallax: 0.9,
  },
}

export function layoutFor(width) {
  if (width < MOBILE_BREAKPOINT) return LAYOUTS.mobile
  if (width < TABLET_BREAKPOINT) return LAYOUTS.tablet
  return LAYOUTS.desktop
}

// --- Site background ---

export function readSiteBackground(el) {
  const target = el || (typeof document !== 'undefined' ? document.documentElement : null)
  if (!target) return SITE_BG_FALLBACK
  const value = getComputedStyle(target).getPropertyValue('--c-field').trim()
  return value || SITE_BG_FALLBACK
}

// --- Placement ---

// Pen scale rule, measured at the camera.
export function torusScaleFor(camera) {
  const halfFov = (camera.fov * Math.PI / 180) / 2
  const visibleHeight = 2 * CAMERA_Z * Math.tan(halfFov)
  const visibleWidth = visibleHeight * camera.aspect
  return Math.min(visibleWidth, visibleHeight) * TORUS_VIEWPORT_SCALE
}

// Measured at the object depth, not at the camera. halfCut puts the centre on
// the anchored edge, so half the object falls off-screen.
export function torusPlacementFor(camera, scale, layout = LAYOUTS.desktop) {
  const halfFov = (camera.fov * Math.PI / 180) / 2
  const visibleHeight = 2 * (CAMERA_Z - TORUS_Z) * Math.tan(halfFov)
  const visibleWidth = visibleHeight * camera.aspect
  const halfExtent = scale * BOUNDING_RADIUS
  const insetX = layout.anchorX * visibleWidth + layout.padding * visibleWidth
  const insetY = layout.anchorY * visibleHeight - layout.padding * visibleHeight
  return {
    x: insetX + (layout.halfCut ? 0 : halfExtent),
    y: insetY - halfExtent,
  }
}

// --- Scroll parallax ---

// Walks the object down until its top edge hits the section's middle (world y = 0).
// Lenis supplies the smoothing.
export function parallaxYFor(restY, halfExtent, progress, factor = 1) {
  const clamped = Math.min(Math.max(progress, 0), 1)
  return (-halfExtent - restY) * clamped * factor
}

// The mark is bottom-anchored, so its top edge already sits near the section
// middle: parallaxYFor nearly cancels out on it (~1% of the screen height,
// invisible). The mark gets its own rule instead — it rises on scroll,
// against the sinking torus, so the two glass bodies separate as the hero
// leaves. LOGO_RISE is the full-travel rise as a fraction of the half
// visible height at LOGO_Z (0.5 keeps every layout fully on-screen).
export const LOGO_RISE = 0.25

export function logoParallaxYFor(camera, progress, factor = 1) {
  const halfFov = (camera.fov * Math.PI / 180) / 2
  const halfVisible = (CAMERA_Z - LOGO_Z) * Math.tan(halfFov)
  const clamped = Math.min(Math.max(progress, 0), 1)
  return halfVisible * LOGO_RISE * clamped * factor
}

// --- Logo mark (second glass object) ---

// Same depth as the torus: same refraction field, no extra depth-sort story.
export const LOGO_Z = TORUS_Z

// Extrude settings in SVG units (the mark lives in a 400x400 box). A deep
// body + present bevel reads as cut glass; the mesh is normalized by
// logoScaleFor afterwards, so these numbers only set proportions, not size.
// Keep depth generous: a paper-thin extrude refracts like a window (almost
// invisible head-on), which is why the mark looked "without refraction".
export const LOGO_EXTRUDE = {
  depth: 12,
  steps: 3,
  bevelEnabled: true,
  bevelThickness: 4,
  bevelSize: 1,
  bevelSegments: 2,
  curveSegments: 4,
}

// Static presentation tilt (radians). Flat faces parallel to the camera bend
// almost nothing, so the mark leans into the light: bevels and flanks catch
// distortion + env reflections like the torus curves do. Tune freely, the
// placement math already absorbs it (a tilted thin plate only shrinks its
// screen box, never overflows it).
export const LOGO_TILT = { x: 0.12, y: -0.5, z: 0 }

// Slow spin on top of LOGO_TILT, same language as the torus ROTATION but
// gentler: the mark stays readable while the glass keeps moving.
export const LOGO_SPIN = { xSpeed: 0, ySpeed: 0.08, pointerX: 0.06, pointerY: 0.075 }

// Hard envelope for the logo X rotation (radians): the mark must stay
// frontal, never flip. Envelope budget: |TILT.x| 0.12 + pointer 0.06 +
// OSC.amplitude 0.36 = 0.54 < LIMIT 0.5411, so the sine reversal (not the
// clamp) does the turning; the clamp only bites on out-of-range pointer.
export const LOGO_X_LIMIT = (31 * Math.PI) / 180
// Ping-pong around the tilt: sin() slows to 0 at the extremes and comes
// back, in loop, instead of spinning round. speed 0.4 rad/s ≈ 16 s/ciclo.
export const LOGO_OSC = { amplitude: 0.36, speed: 0.4 }

// Micro-surface tuning for the logo glass (see buildLogoNormalMap in
// logoMesh.js). normalScale bends transmission/reflection sampling, uvScale
// sets the noise grain over the mark (extrude UVs are in SVG units, so this
// is ~1 tile per 85 units), driftX/driftY slowly slide the map so the glass
// stays alive. All stock properties — the shader program is untouched.
export const LOGO_GLASS = { normalScale: 0.55, uvScale: 0.012, driftX: 0.008, driftY: 0.005 }

// Spectral dispersion (real chromatic aberration inside transmission) for the
// mark only — the torus keeps MATERIAL.dispersion. three spreads the
// transmitted RGB by (ior - 1) * 0.025 * dispersion, so with ior 1.25 it
// takes ~10 to read clearly; fringes live on bevels/edges and over refracted
// content, flat centers stay clean. Raise ior instead if you want it wilder
// everywhere (it multiplies this too).
export const LOGO_DISPERSION = 2

// sizeFraction is the logo's world height as a fraction of the visible height
// at LOGO_Z. Desktop: bottom-right corner. Mobile: right edge, vertically
// centered ("meta a destra"). The mark always stays fully on-screen.
export const LOGO_LAYOUTS = {
  mobile: {
    sizeFraction: 0.32,
    anchorX: -0.77,
    anchorY: 0.25,
    padding: 0.1,
    parallax: 0.84,
  },
  tablet: {
    sizeFraction: 0.46,
    anchorX: -0.7,
    anchorY: -0.56,
    padding: 0.1,
    parallax: 0.5,
  },
  desktop: {
    sizeFraction: 0.65,
    anchorX: -0.65,
    anchorY: 0.5,
    padding: 0.06,
    parallax: 0.7,
  },
}

export function logoLayoutFor(width) {
  if (width < MOBILE_BREAKPOINT) return LOGO_LAYOUTS.mobile
  if (width < TABLET_BREAKPOINT) return LOGO_LAYOUTS.tablet
  return LOGO_LAYOUTS.desktop
}

export function logoScaleFor(camera, naturalHeight, layout = LOGO_LAYOUTS.desktop) {
  const halfFov = (camera.fov * Math.PI / 180) / 2
  const visibleHeight = 2 * (CAMERA_Z - LOGO_Z) * Math.tan(halfFov)
  return (visibleHeight * layout.sizeFraction) / Math.max(naturalHeight, 1e-6)
}

// Corner/edge anchoring with per-axis half extents (the mark is not square).
// anchor -0.5 hugs the left/bottom edge, +0.5 the right/top edge, 0 centers;
// padding always pushes inward and the mark stays fully inside.
export function logoPlacementFor(camera, halfExtent, layout = LOGO_LAYOUTS.desktop) {
  const halfFov = (camera.fov * Math.PI / 180) / 2
  const visibleHeight = 2 * (CAMERA_Z - LOGO_Z) * Math.tan(halfFov)
  const visibleWidth = visibleHeight * camera.aspect
  const sx = Math.sign(layout.anchorX)
  const sy = Math.sign(layout.anchorY)
  return {
    x: layout.anchorX * visibleWidth - sx * layout.padding * visibleWidth - sx * halfExtent.x,
    y: layout.anchorY * visibleHeight - sy * layout.padding * visibleHeight - sy * halfExtent.y,
  }
}
