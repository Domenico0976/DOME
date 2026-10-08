# Project Goals & Design Rules

## Overview
This file defines the immutable design rules, effect rules, mobile rules, and architectural decisions for this project.

---

## Effect Rules (Regole per gli Effetti)

### 1. **Cursor Effects**
- **Desktop**: 16px circle, `mixBlendMode: 'difference'`, white border (rgba(255,255,255,0.9)), 6px black inner dot
- **Mobile**: 38px circle, `mixBlendMode: 'difference'`, white border, 72px invisible hit area
- **Morph Animation**: Desktop cursor smoothly expands to canvas size on row hover (0.45s power2.out)
- **No lingering elements**: Mobile cursor DOM nodes explicitly removed when switching to desktop

### 2. **Canvas Effects**
- **PendulumCanvas** (desktop): Physics-based pendulum simulation with spring-damper
  - Cursor velocity → pendulum kick
  - Low-pass filter on displayed angle (0.22 factor)
  - Anchored below cursor, clamped to section bounds
- **PendulumCanvas** (mobile): Direct follow, no physics, no rotation
- **ArchiveHoverCanvas**: WebGL wind distortion
  - Cursor velocity → wind direction/strength
  - EMA-smoothed (SPEED_SMOOTH=0.22, DIR_SMOOTH=0.12)
  - Traveling wave along wind direction
  - Chromatic aberration tracks intensity
  - FXAA post-processing for clean edges

### 3. **Transition Effects**
- **MobileCanvas**: Clip-path animation (bottom-up open, top-down close)
  - Open: 0.5s power3.out
  - Close: 0.4s power2.in
  - Respects `prefers-reduced-motion`
- **Image Swap**: Top-down disappear → bottom-up appear (0.2s + 0.3s)
- **ArchiveHoverCanvas Slide**: CA channel separation → slide → CA convergence

### 4. **Performance Rules**
- `willChange` only on animated properties
- `pointerEvents: 'none'` on non-interactive fixed elements
- `preserveDrawingBuffer: true` on WebGL canvas
- `devicePixelRatio` capped at 1.5 (mobile) / 2 (WebGL)
- RAF loops cleaned up on unmount
- GSAP contexts for ScrollTrigger cleanup

---

## Mobile Rules (Regole per il Mobile)

### Breakpoint
- **Single source**: `MOBILE_BREAKPOINT = 720` from `src/hooks/useIsMobile.js`
- **No local detection** in any component
- **No debounce** - synchronous state update

### Two Axes: Layout vs Input (2026-09-28)
- `useIsMobile()` (`< 720px`) answers **LAYOUT**: which DOM to render
- `useIsTouch()` (`any-pointer: coarse`) answers **INPUT**: touch cursor, and
  whether a WebGL effect may run
- **They are genuinely different.** A tablet is `isMobile: false` but
  `isTouch: true` — desktop layout, no hover. A desktop browser dragged to 700px
  is `isMobile: true` but `isTouch: false` — narrow layout, hover intact.
- **Rule**: asking "am I on mobile?" to decide **hover/tap reaction** → `isTouch`.
  Asking it to decide **layout** → `isMobile`. Never collapse them back.
- `any-pointer` (not `pointer`): a hybrid with a mouse attached stays
  touch-capable, the safe direction. Side effect: `isTouch` does **not** change
  on resize, only when a pointer is docked — so a narrow window never loses hover.

| | Phone (<720) | Tablet (≥720, coarse) | Desktop (fine) |
|---|---|---|---|
| `isMobile` / `isTouch` | true / true | **false / true** | false / false |
| Layout | mobile | **desktop** | desktop |
| Cursor | 38px direct-follow | **38px direct-follow** | 16px lerp |
| WebGL effects | drag-gated | **drag-gated** | `mouseenter` |
| Bare finger | scroll only | **scroll only** | n/a |
| `MobileCanvas` | yes | **yes** | no |

### Cursor Behavior
| Aspect | Desktop (≥720px) | Mobile (<720px) |
|--------|------------------|-----------------|
| **Size** | 16px | 38px |
| **Inner Dot** | 6px black | None |
| **Hit Area** | None | 72px invisible |
| **Movement** | Lerp (0.15) | Direct follow |
| **Blend Mode** | `difference` | `difference` |
| **Drag** | None | Touch drag + tap |

### Canvas Behavior
| Canvas | Desktop | Mobile |
|--------|---------|--------|
| **PendulumCanvas** | Physics + lerp position | Direct follow, no rotation |
| **ArchiveHoverCanvas** | WebGL wind distortion | Hidden (`visible={false}`) |
| **MobileCanvas** | Not rendered | Portal on click, full features |

### Touch Interactions
- **Drag threshold**: 100ms tap vs drag disambiguation
- **Hit testing**: `document.elementFromPoint()` on drag end
- **Resize handle**: 44x44px top-left corner (touch-friendly)
- **Close button**: 48x48px top-right corner

---

## Architectural Decisions (Logica Decisioni Prese)

### 1. **Shared Mobile Detection** (2026-09-16)
- **Problem**: 4 conflicting `isMobile` implementations with different debounce strategies
- **Solution**: Single `useIsMobile()` hook in `src/hooks/useIsMobile.js`
- **Rule**: All components import from shared hook, never create local detection

### 2. **Separate Cursor Refs** (2026-09-16)
- **Problem**: Shared `elRef` caused mobile cursor DOM nodes to persist in `document.body` on desktop → "fixed circles on viewport"
- **Solution**: `desktopElRef`, `desktopDotRef`, `mobileElRef`, `hitAreaRef`
- **Rule**: Explicit cleanup effect removes mobile DOM nodes when `isMobile` becomes false

### 3. **Conditional Portal Rendering** (2026-09-16)
- **Problem**: MobileCanvas always mounted via portal, relying on clipPath to hide
- **Solution**: Early return `if (!canvasState.open) return null`
- **Rule**: Portals only render when actually needed

### 4. **Single RAF Loop per Canvas** (2026-09-16)
- **Problem**: Multiple RAF loops, some running on wrong mode
- **Solution**: Each canvas has one `useEffect` with proper cleanup
- **Rule**: `cancelAnimationFrame` in cleanup, `isMobile` in dependency array

### 5. **GSAP Context for ScrollTrigger** (2026-09-16)
- **Problem**: ScrollTrigger animations not cleaned up properly
- **Solution**: `gsap.context(() => { ... }, sectionRef)` with `ctx.revert()` cleanup
- **Rule**: All ScrollTrigger animations wrapped in context

### 6. **First-landing Preloader (vanilla, outside React)** (2026-09-23)
- **Problem**: Need a "Retro Bitrate" tile/pixel preloader that runs ONLY on first
  landing, then never blocks reloads, without touching existing WebGL effects.
- **Solution**: Static shell in `index.html` (sync `<head>` gate adds `no-preload`
  to `<html>` before paint when `sessionStorage['pp:visited']` exists) + vanilla
  module `src/preloader/` (state machine `GATE→BOOT→COUNTING→HOLD→COUNTER_OUT→
  PAPER→REVEAL→DONE`) + single-pass Three.js fragment shader designed with
  `/www-gl.md` (`Pixelate` tiling/quantization + `BlockDissolve` mask logic).
- **Rule**: The preloader is 100% independent of the React tree and the shaders/react
  effects — never add preloader logic inside components, and never let the preloader
  alter revealed content (reveal is mask-only alpha). `App.jsx` only calls
  `window.__preloader?.appReady()` on mount. Theme locked to paper `#F5F1EA` +
  ink `#111`, counter format `007` (3 zero-padded digits).

### 7. **Standalone `TextEntryGlass` section** (2026-09-25)
- **Problem:** glass object was coupled to the preloader lifecycle — owned by
  `src/preloader/glass/`, ran inside the preloader's Three.js scene, shared the
  two-pass renderer, waited for counter=100 SEAL, and blocked preloader cleanup
  while its GSAP timeline played. This tied a permanent homepage element to a
  first-landing transient stage.
- **Solution:** replaced the `hero.svg` extruded silhouette with the CodePen torus knot
  (`TorusKnotGeometry(1, 0.3, 300, 48, 2, 3)` + `MeshPhysicalMaterial` transmission),
  animated continuously with `THREE.Clock` — no GSAP, no ScrollTrigger. The canvas is
  transparent and a backdrop quad (`src/hero-glass/backdrop.js`) supplies what the glass
  refracts: today the site `--c-field` colour, tomorrow a texture or video behind the
  section. Under `prefers-reduced-motion` the same torus renders as a single static frame.
  `hero.svg` is no longer used here. Engine lives in
  `src/hero-glass/{params,geometry,backdrop,engine}.js` as an isolated Three.js island.
  React component (`src/components/TextEntryGlass.jsx`) keeps only lifecycle, resize and
  pointer wiring. Mobile = desktop. Section placed between `<SplitScreenHero />` and
  `<FeaturedGallery />` in `App.jsx`.
- **Invariant:** no preloader/homepage shared scene, renderer, RAF, timeline, or global
  ownership. The glass component is fully self-contained; `hero.svg` feeds the hero shader
  image only, not this section.

### 8. Text rows live in the WebGL scene (2026-09-27)
- **Problem:** the glass has to visibly deform the text. three.js `transmission` refracts
  what the renderer already drew into its transmission target, so a DOM `<span>` is
  permanently invisible to it. With the text in the DOM the only thing the glass had behind
  it was a flat `--c-field` quad, so it sampled a blank studio environment and rendered
  white. No amount of z-index or CSS could fix this — z-index controls paint order, not
  what the glass can refract.
- **Solution:** the rows moved into the scene. `TEXT_ROWS` config + `normalizeRows` →
  `textLayout` bisection fit per row → `textAtlas` rasterises every row into ONE canvas and
  returns per-row UV slices → `textLayer` builds one plane per slice with a custom
  `ShaderMaterial` (`src/shaders/heroGlassText.js`). The per-row `behind` flag selects the
  draw pass: `true` renders in the opaque pass with an alpha `discard` so the glass refracts
  it, `false` renders in the transparent pass with `depthTest: false` so it paints crisp
  over the object. Row count is derived from `rows.length` everywhere — adding a row to the
  config is the only edit required.
- **Rule:** a `behind: true` row must never be `transparent: true`. three draws opaque →
  transmissive → transparent, so a blended row lands after the torus and sits on top of it,
  silently inverting the flag. The `discard` is load-bearing.
- **Trade-off accepted:** the visible text is a texture, so it is no longer mouse-selectable.
  A visually-hidden `.text-entry__sr` copy preserves reading order for screen readers and
  indexing. Font, weight, colour and line-height are read from CSS at runtime so the texture
  cannot drift from the cascade, and `document.fonts.ready` forces a rebuild because a fit
  taken on the fallback face would be baked into the raster permanently.

---

## Code Quality Standards

### File Organization
- **Components**: `src/components/` - one file per component
- **Hooks**: `src/hooks/` - shared logic
- **Shaders**: `src/shaders/` - GLSL strings
- **Utils**: `src/utils/` - pure functions
- **Styles**: `src/styles/` - global CSS only

### Naming Conventions
- Components: PascalCase (`ArchiveCursor.jsx`)
- Hooks: camelCase with `use` prefix (`useIsMobile.js`)
- Constants: UPPER_SNAKE_CASE (`MOBILE_BREAKPOINT`)
- Private refs: `Ref` suffix (`desktopElRef`)

### Import Order
1. React/core imports
2. Third-party (GSAP, Three.js)
3. Internal hooks
4. Internal components
5. Utils/constants

### Anti-Patterns to Avoid
- ❌ `useState` for derived values (use `useMemo` or inline)
- ❌ `useEffect` for synchronous initialization (do inline)
- ❌ Multiple `resize` listeners (use shared hook)
- ❌ Magic numbers (use exported constants)
- ❌ Inline styles for complex objects (extract to constants)

---

## Verification Checklist

### Before Any Commit
- [ ] `npm run build` passes
- [ ] No console errors in dev server
- [ ] Desktop cursor: lerp works, morph works, no fixed circles
- [ ] Mobile cursor: direct follow works, drag works, tap opens canvas
- [ ] Resize 720px ↔ desktop: clean switch, no stale elements
- [ ] `prefers-reduced-motion`: animations disabled
- [ ] All portals mount/unmount correctly

### Visual Regression Baseline
- Desktop: 1440px, 1024px
- Tablet: 768px
- Mobile: 375px, 414px
- All with/without reduced motion

---

## Future Work Guidelines

### When Adding New Effects
1. Follow existing GSAP patterns
2. Respect reduced motion
3. Clean up all listeners/RAF/GSAP contexts
4. Test both desktop and mobile
5. Update this document

### When Modifying Mobile Behavior
1. Update `useIsMobile` if breakpoint changes
2. Test resize transitions thoroughly
3. Verify no DOM leaks
4. Update this document

### When Adding New Canvases
1. Use `createPortal` to `document.body`
2. Implement both desktop/mobile modes
3. Share mobile detection via hook
4. Clean up WebGL resources on unmount
5. Update this document

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-16 | Single `useIsMobile` hook | Eliminate 4 conflicting implementations |
| 2026-09-16 | Separate cursor refs | Fix "fixed circles on viewport" bug |
| 2026-09-16 | Conditional MobileCanvas portal | Prevent stale DOM nodes |
| 2026-09-16 | Remove 150ms debounce | Prevent listener leaks during mode switch |
| 2026-09-16 | Explicit DOM cleanup | Ensure mobile nodes removed on desktop |
| 2026-09-25 | Standalone TextEntryGlass (torus knot) | Replace hero.svg silhouette with CodePen torus knot; drop GSAP/ScrollTrigger for time-driven motion; transparent section with texture-ready backdrop; engine split into {params,geometry,backdrop,engine}.js, timeline.js deleted |
| 2026-09-27 | Text rows moved into the WebGL scene | three's transmission can only refract geometry it already drew, so DOM text was permanently invisible to the glass; per-row `behind` flag picks opaque-vs-transparent draw pass |
| 2026-09-27 | Spec reconciled to code for the glass material | Shipped values had been tuned past the documented CodePen ones; the code is the spec, not the other way round |

---

## Related Files
- `init/agents.md` - Work steps & testing protocol
- `src/hooks/useIsMobile.js` - Mobile detection implementation
- `src/components/ArchiveCursor.jsx` - Cursor rendering
- `istruction_AI/` - All planning & historical documents