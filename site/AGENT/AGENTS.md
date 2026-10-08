# Agents Configuration - Work Steps & Testing Protocol

## Cross-Link Index
- **[EFFECTS.md](./EFFECTS.md)** — Effect reference (desktop vs mobile rules, per-section explainers)
- **[NOTES.md](./NOTES.md)** — Non-WebGL logic changelog
- **[NOTES_WEBGL.md](./NOTES_WEBGL.md)** — WebGL logic changelog

> **MANDATORY — READ ME AT EVERY MODIFICATION REQUEST.** Questo file (`AGENT/AGENTS.md`) deve essere letto per intero ogni volta che un agente riceve una richiesta di modifica al sito O agli effetti WebGL, PRIMA di toccare qualsiasi altro file o codice. Vale per feature, bug-fix, refactor e tuning effetti. Le regole qui sotto non sono opzionali.

---

## 🚫 REGOLA CRITICA — MAI GIT SENZA CONSENSO ESPLICITO

**L'agente NON DEVE MAI eseguire operazioni git distruttive** (`git checkout`, `git revert`, `git reset`, `git restore`, `git stash`, `git clean`, `git rm`) **senza richiesta esplicita dell'utente**. Queste operazioni cancellano lavoro — proprio e di altre sessioni opencode aperte in parallelo sullo stesso progetto.

- Per QUALSIASI operazione git (anche `git checkout -- <file>`), chiedere SEMPRE prima all'utente.
- L'utente gestisce personalmente checkout / revert / reset / stash / clean.
- Sono consentite SOLO operazioni git di sola lettura: `git status`, `git diff`, `git log`.
- Se una modifica va annullata, NON usare git: ripristinare manualmente il contenuto del file con `edit`/`write`, oppure chiedere all'utente.

---

## Work Steps (Cosa Fare)

### 1. **Development Workflow**
- **Always use the shared `useIsMobile()` hook** from `src/hooks/useIsMobile.js` for **layout** detection
- **Always use the shared `useIsTouch()` hook** from `src/hooks/useIsTouch.js` for **input/hover/tap** detection (`any-pointer: coarse`)
- **Never create duplicate mobile detection logic** in components
- **Never collapse `isMobile` and `isTouch` back into one flag** — they answer different questions. A tablet is `isMobile:false, isTouch:true`; a 700px desktop window is `isMobile:true, isTouch:false`
- **Use `createPortal` for fixed-position elements** (cursors, canvases, modals)
- **Separate refs for desktop vs mobile cursors** - never share `elRef` between modes
- **Clean up DOM nodes explicitly** when switching mobile/desktop modes

### 2. **Cursor System Rules**
- Desktop cursor: 16px circle with lerp animation (LERP = 0.15)
- Mobile cursor: 38px circle with direct follow + 72px hit area
- Both rendered via `createPortal` to `document.body`
- Mobile cursor has `mixBlendMode: 'difference'` + white border
- Desktop cursor has inner 6px black dot

### 3. **Canvas System Rules**
- **PendulumCanvas**: Physics-based on desktop, direct-follow on mobile
- **MobileCanvas**: Only renders portal when `canvasState.open === true`
- **ArchiveHoverCanvas**: WebGL wind distortion, only on desktop hover
- All canvases use `createPortal` to `document.body`

### 4. **Animation Rules**
- Use GSAP for all animations
- Respect `prefers-reduced-motion` media query
- Kill previous tweens before starting new ones
- Use `gsap.context()` for ScrollTrigger animations

---

## What NOT To Do (Cosa NON Fare)

| ❌ Don't Do | ✅ Do Instead |
|------------|---------------|
| Create local `isMobile` state in components | Import `useIsMobile()` (layout) or `useIsTouch()` (input) from the shared hooks |
| Use `isMobile` to decide whether a WebGL effect may run | Use `isTouch` — a tablet has no hover but is not `isMobile` |
| Share `elRef` between desktop/mobile cursors | Use separate `desktopElRef`, `mobileElRef` |
| Leave mobile DOM nodes in `document.body` on desktop | Explicit cleanup in `useEffect` when `isMobile` becomes false |
| Always render MobileCanvas portal | Early return `if (!canvasState.open) return null` |
| Add resize listeners in every component | Single listener in `useIsMobile` hook |
| Use debounce for mobile detection | Synchronous state update in shared hook |
| Hardcode 720px breakpoint | Import `MOBILE_BREAKPOINT` from `useIsMobile` |
| Gate a hover/click effect on `onMouseEnter` | On touch a tap fires `mouseenter`. Read the cursor through `useCursorGate()` and gate on `isAwake` (a parked cursor keeps steering; `isCursorActive` is cleared on pointerup). Keep `mouseenter` for fine pointers only. **Machine-enforced** since 2026-09-30 by `tests/structure/effectGate.structure.test.js`, which fails the build on any file reading `isCursorActiveRef` / `isDraggingRef` / `isDragging` outside the three roles that own the drag — two were missed (`ProjectRow.handleEnter`, `FeaturedGallery`'s tick) |
| Let a canvas resize on both axes independently | Lock the natural image ratio (`fitAspectBox`) so a drag scales W and derives H, never stretches |
| `ScrollTrigger.config({ ignoreMobileResize: true })` | The mobile↔desktop flip changes document height drastically. Trigger positions from one mode are stale in the other — always `ScrollTrigger.refresh()` on the flip |

---

## Testing Procedures (Come Testare)

### Desktop Testing
1. **Cursor Behavior**
   - Move mouse → 16px circle follows with smooth lerp
   - Hover archive row → cursor morphs to canvas size
   - Leave row → cursor shrinks back to 16px
   - No fixed circles during scroll

2. **Archive Hover**
   - Hover row → PendulumCanvas appears below cursor
   - WebGL wind distortion activates on cursor movement
   - Canvas follows cursor smoothly with pendulum physics

3. **Mobile Canvas**
   - Click archive row → MobileCanvas opens with image
   - Resize handle works (top-left)
   - Close button works
   - No portal when closed

### Mobile Testing (< 720px viewport)
1. **Cursor Behavior**
   - 38px circle centered on screen initially
   - Touch drag → cursor follows finger directly
   - Tap image → opens MobileCanvas
   - No lerp, no morph animation

2. **Canvas Behavior**
   - PendulumCanvas: direct follow, no physics
   - ArchiveHoverCanvas: hidden (`visible={false}`)
   - MobileCanvas: full functionality
   - MobileCanvas resize drag keeps the image aspect ratio — no stretching
   - Hover/click effects appear only while the mobile cursor is **dragging**,
     never on a bare tap

### Resize Testing
**Test BOTH directions — they fail differently.**
- **desktop → mobile**: verify clean mode switch (no stale DOM nodes) and
  correct cursor type for each mode
- **mobile → desktop**: verify ScrollTrigger positions are recalculated —
  reveals fire, parallax is aligned, no text is mispositioned. A stale-trigger
  bug hides in this direction only, because the mobile document is *taller* so
  stale positions still land roughly in range.
- After each flip, scroll the full page and confirm every reveal triggers.

### Automated Verification
```bash
# Build verification
npm run build

# Type check (if TS configured)
npx tsc --noEmit

# Lint
npm run lint
```

---

## Verification & Testing File Locations

### Where to Save Test Results
| Test Type | Location | Format |
|-----------|----------|--------|
| **Visual Regression** | `AGENT/test-results/visual/` | PNG screenshots + diff |
| **Unit Tests** | `AGENT/test-results/unit/` | Jest/Vitest JSON output |
| **E2E Tests** | `AGENT/test-results/e2e/` | Playwright JSON + screenshots |
| **Performance** | `AGENT/test-results/perf/` | Lighthouse JSON + metrics |
| **Console Logs** | `AGENT/test-results/console/` | Text logs with timestamps |

### Required Test Artifacts
- **Before/After screenshots** for every visual change
- **Console error capture** during test runs
- **Viewport-specific tests** (375px, 768px, 1024px, 1440px)
- **Reduced motion tests** (both enabled/disabled)

### Test Naming Convention
```
{feature}-{viewport}-{state}-{timestamp}.{ext}
Examples:
- cursor-desktop-hover-20260916-143022.png
- mobile-canvas-open-mobile-20260916-143022.png
- pendulum-physics-desktop-drag-20260916-143022.json
```

---

## Agent Communication Protocol

### For New Tasks
1. Read this `AGENT/AGENTS.md` first — **obbligatorio ad OGNI richiesta di modifica** (sito E WebGL), prima di qualsiasi altro file o codice
2. Read `AGENT/GOAL.md` for design rules
3. Read `AGENT/EFFECTS.md` §GENERAL RULE before touching any effect
4. Check `AGENT/NOTES.md` for recent non-GL changes
5. Check `AGENT/NOTES_WEBGL.md` for recent GL changes

### For Bug Fixes
1. Reproduce in dev server
2. Document in `AGENT/issues/`
3. Fix following rules above
4. Add test case to prevent regression
5. Update relevant documentation in `AGENT/NOTES.md` or `AGENT/NOTES_WEBGL.md`

### For New Features
1. Brainstorm in `AGENT/plans/`
2. Get approval before implementation
3. Follow all rules in this document
4. Update `AGENT/GOAL.md` if new patterns established

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/hooks/useIsMobile.js` | Single mobile detection source |
| `src/components/ArchiveCursor.jsx` | Desktop + mobile cursor rendering |
| `src/components/MobileCanvas.jsx` | Mobile image canvas |
| `src/components/ArchiveHoverCanvas/PendulumCanvas.jsx` | Pendulum canvas |
| `src/components/ArchiveHoverCanvas/ArchiveHoverCanvas.jsx` | WebGL hover canvas |
| `src/components/Archives.jsx` | Main archives section |
| `init/goal.md` | Design rules & decisions |

---

## Last Updated
- **Date**: 2026-09-16
- **Version**: 1.0
- **Author**: Atlas Orchestrator
- **Related Work**: Mobile cursor fix, shared isMobile hook, portal cleanup