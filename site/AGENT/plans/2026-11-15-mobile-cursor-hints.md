# Mobile-cursor contextual hints (tooltips) — plan

Status: **awaiting approval** (new feature — project rule: plan before implementation).

## Goal
On touch devices, show a small, friendly, non-blocking hint ("pill/chip") that teaches
what the mobile cursor can do **in the section the user is currently looking at**. It
narrates the cursor so the site feels alive, without ever blocking navigation.

## Behaviour
- **Only on touch** (`isTouch` from `useCursorGate`) — the mobile cursor only exists there.
- **One pill at a time**, tied to the section that dominates the viewport.
- **Non-blocking**: `pointer-events: none`, never captures taps/scroll.
- **Anchored to the mobile cursor** (speech-bubble style, above it) so "muovimi / spostami"
  reads as an instruction *to the cursor*. Falls back to bottom-centre if the cursor
  position is 0,0 (pre-init).
- **Hide** the moment the user interacts meaningfully:
  - the mobile cursor is grabbed/awake (`isAwake` → true), or
  - a click/tap anywhere on the page.
- **Reappear after 3 s of inactivity**, with a **new random phrase** for the current
  section (never the same one twice in a row).
- **Reduced motion**: appear/disappear instantly (no fade), still functional.
- On section change (scroll), swap to that section's phrase (fade out/in).

## Architecture (islands, no coupling to the cursor internals)
1. `src/content/mobileCursorHints.js` — pure data: `HINTS = { hero: [...], gallery: [...],
   selected: [...], callout: [...], archives: [...] }` (English, playful TOV). Export
   `pickHint(sectionId, avoid)` (pure, unit-testable, no immediate repeat).
2. `src/hooks/useActiveSection.js` — one IntersectionObserver over `[data-hint-section]`
   markers (add the attribute to the section wrappers), returns the id of the section
   with the greatest visible ratio (dominant section).
3. `src/components/MobileCursorHint.jsx` — portal to `document.body`; reads
   `useCursorGate()` (`isTouch`, `isAwake`, `parked`) + a global "last interaction"
   signal; renders the pill when `visible`. Owns the 3 s idle timer + random pick.
4. CSS in `global.css` — `.cursor-hint` pill: black bg, white text, radius 999,
   `font: var(--f-data)`, `clamp(12px,3.4vw,14px)`, padding ~10×16, `pointer-events:none`,
   `z-index: 100002` (above the cursor), `max-width: min(78vw, 320px)`, `aria` via
   `role="status"` + `aria-live="polite"` (announce once, not noisy).
5. `App.jsx` — mount `<MobileCursorHint />` inside `ArchiveCursorProvider` next to
   `<MobileCanvas />` (only when `isTouch`).

## Section markers
Add `data-hint-section="hero|gallery|selected|callout|archives"` to:
- `SplitScreenHero` section (hero), `FeaturedGallery` section (gallery),
  `SelectedProjects` wrapper (selected), the FocusCallout host (callout),
  `Archives` section (archives).

## Phrases (dataset — EN, friendly/playful)
- **hero**: "Move me to feel the effect", "Psst — drag me and the lights dance",
  "I'm shy: move me around", "Try dragging me across the headline".
- **gallery**: "Put me on an image!", "Hover me over a card", "Drag me onto a project — go on",
  "Point me at a cover, I'll bloom".
- **selected**: "Open a project and watch what I do", "Tap a project — I've got a surprise",
  "Pick one and drag me inside", "Open one, then move me around".
- **callout**: "Move me over the text, I'm curious", "Drag me across the words",
  "I love this bit — slide me on the text", "Put me on the letters, see the colours".
- **archives**: "Open a project and slide me onto the image", "Tap a row, then move me over the pic",
  "Open one and drag me across it", "I'll follow you over the photo".

## Acceptance criteria
- Bare-finger scroll never shows an effect *and* the pill stays (or hides on tap) but the
  pill itself never blocks scroll/tap.
- Grabbing the cursor hides the pill; 3 s idle brings it back with a different phrase.
- Switching sections swaps phrases.
- `prefers-reduced-motion`: no fade animation.
- New pure tests: `pickHint` (no immediate repeat, valid section, empty→null);
  `useActiveSection` (jsdom stub IO) picks highest ratio.
- `effectGate`/structure suites stay green; build clean.

## Risks / decisions to confirm
- Anchor to the cursor (speech-bubble) vs a fixed bottom-centre pill. Plan assumes **cursor-anchored**.
- `aria-live` can be chatty if phrases rotate while idle; plan announces only on appear (not each rotation) — confirm.
