# Cross-Attack: r1-architect.md vs designer-findings.md

**Date**: 2026-08-22
**Author**: architect
**Team**: opgl-fluid-hover-plan

---

## CRITICAL Issues Identified

### C1. Destroy Contract Ordering
**Designer claim**: "dispose WebGL context, delete textures/FBOs, cancel rAF"

**Problem**: Wrong order. Canceling rAF last allows race condition where render loop fires after context destruction → browser crash.

**Required order**:
```
1. Cancel rAF ← FIRST
2. Lose context
3. Delete FBO textures + framebuffers
4. Delete programs
5. Remove listeners
6. Disconnect ResizeObserver
7. Remove <canvas> from DOM ← LAST
```

### C2. Zoom Mode Canvas Hiding
**Designer claim**: "When zoom active: hide canvas, show img"

**Problem**: `display: none` destroys WebGL context in Safari. When user exits zoom, GL context must be recreated → visible flash. Also breaks click-outside-to-close handler.

**Required behavior**: Keep img in DOM. Toggle canvas visibility via `opacity` or skip render loop. Never use `display: none` on canvas.

### C3. Touch Behavior Documentation
**Designer claim**: "Fluid effect: never triggers (strictly mouse-driven)"

**Problem**: States touch support as "gap" without resolution. Should explicitly document: touch devices get static image only (mouse-only per requirements).

---

## HIGH Issues

### H1. Overscan/Fade Mismatch
**Designer claim**: Reduce scale_factor to 1.15×

**Risk**: At 1.15× overscan, fade zone shrinks to ~1.1px. If image content has detail within this zone, it appears semi-transparent.

**Recommendation**: Increase `img_frame_width` from `.004` to `.006` to match reduced overscan.

### H2. Shimmer Viability
**Designer claim**: Single-shimmer first-hover hint

**Assessment**: Feature creep without success metric. Adds complexity. Risk of confusing users.

**Recommendation**: Drop shimmer. Let effect speak for itself.

---

## LOW Issues

### L1. Visibilitychange Not Mentioned
**Gap**: Designer doesn't mention pausing rAF when tab hidden.

**Fix**: Add visibilitychange handler to pause rAF for battery conservation.

---

## Summary

| ID | Severity | Issue | Action |
|----|----------|-------|--------|
| C1 | CRITICAL | Destroy order wrong | Reorder: rAF first, DOM last |
| C2 | CRITICAL | Hidden img breaks zoom | Keep img visible; toggle canvas |
| C3 | CRITICAL | Touch undefined | Document: touch = static only |
| H1 | HIGH | Overscan/fade mismatch | Increase img_frame_width to .006 |
| H2 | HIGH | Shimmer risk | Drop shimmer |
| L1 | LOW | Missing visibilitypause | Add visibilitychange handler |

---

## Recommendations for Lead

1. **Mandatory**: Engineer must follow destroy order from r1-architect.md
2. **Mandatory**: Zoom mode must keep img visible
3. **Mandatory**: Document touch behavior as "static only"
4. **Advisory**: Test overscan with real portfolio images
5. **Optional**: Add visibilitypause

---

## Files Referenced

- `r1-architect.md` — Full architectural analysis
- `designer-findings.md` — Target of cross-attack
- `r2-architect.md` — R2 concessions and defended positions
- `r3-architect-final.md` — R3 synthesis
- `r4-architect-final.md` — R4 final concessions (100% consensus)
