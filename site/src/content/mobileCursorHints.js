// Mobile-cursor tutorial hints — EN, informal and playful, but plain and direct.
//
// Copy rules (mrktg-copywriting / mrktg-copy-editing): clarity over cleverness,
// short and active, the cursor speaks in first person, no exclamation points, no
// buzzwords, no AI-cliché ("watch the lights dance", "go on", "psst"). Each line
// says what to DO and what it buys you.
//
// One phrase per appearance, chosen at random (never the same twice in a row).
// Data only: no React, no DOM, so it stays trivially unit-testable.

export const HINTS = {
  hero: [
    'Drag me across the headline',
    'Move me around, the light follows',
    'I light up wherever you drag',
    'Grab me and sweep the title',
  ],
  gallery: [
    'Drop me on a project',
    'Drag me onto a cover to peel it back',
    'Park me on an image',
    'Move me over a card the colour comes through',
  ],
  selected: [
    'Open a project, then drag me inside',
    'Tap a project and move me around',
    'Open one and slide me over the shots',
    'Pick a project and drag me in',
  ],
  callout: [
    'Drag me over the big text',
    'Slide me across the letters',
    'Run me along the words',
    'Move me through the type, watch it warp',
  ],
  // No `archives` entry on purpose: that section has no WebGL surface of its own,
  // so the cursor has nothing to reveal there and the hint must not appear. The
  // `data-hint-section="archives"` marker stays so the section still "claims" the
  // viewport and a neighbouring section's hint can't leak into it.
}

/**
 * Return a random hint for `sectionId`, avoiding `avoid` so the same phrase
 * never appears twice in a row. `null` when the section has no hints.
 */
export function pickHint(sectionId, avoid = null) {
  const list = HINTS[sectionId]
  if (!Array.isArray(list) || list.length === 0) return null
  if (list.length === 1) return list[0]
  let i = Math.floor(Math.random() * list.length)
  if (list[i] === avoid) i = (i + 1) % list.length
  return list[i]
}
