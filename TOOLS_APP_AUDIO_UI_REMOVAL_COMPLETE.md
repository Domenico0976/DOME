TASK COMPLETED: Audio UI Stripped from NodeOptions

## Summary
Successfully removed ALL audio UI components and the dead Colors panel from NodeOptions parameter panels in tools-app.

## Files Changed
1. **tools-app/src/ui/NodeOptions.tsx** (345 lines modified)
2. **tools-app/src/ui/NodeOptionsEffects.tsx** (185 lines modified)

## Changes Made

### NodeOptions.tsx
- ✅ REMOVED: AudioLines, KeyRound, MousePointerClick, Loader2, Palette imports
- ✅ REMOVED: AUDIO_SOURCES constant  
- ✅ REMOVED: ColorsPanel component
- ✅ REMOVED: addAudioBinding, removeAudioBinding, bindMidi, removeMidi, midiEnabled, midiBindings, timeSec destructures
- ✅ REMOVED: learn function and learning state
- ✅ REMOVED: Per-control audio bind + MIDI-learn + keyframe buttons
- ✅ REMOVED: Audio Reactivity editable UI (kept badge display)
- ✅ REMOVED: MIDI section entirely
- ✅ KEPT: All non-audio controls (sliders, ValuePill, tabs, blend, opacity, accordions, toggles)

### NodeOptionsEffects.tsx  
- ✅ REMOVED: useAudio, resolveEffectValue, Frame imports
- ✅ REMOVED: resolvedValues state and computeResolved live preview
- ✅ REMOVED: addAudioBinding, midiEnabled, learning, setLearning destructures
- ✅ REMOVED: learn function, Piano, AudioLines, Loader2 icons
- ✅ REMOVED: Per-effect audio bind + MIDI-learn buttons
- ✅ UPDATED: Audio badge to show base values instead of resolved values
- ✅ KEPT: All non-audio effect controls and accordions

## Verification

✅ **Zero audio UI remains** - No bind/learn buttons, no selectors, no MIDI sections
✅ **ColorsPanel removed** - Dead data with zero consumers eliminated  
✅ **Audio: x.xx badge STAYS** - Passive display-only as required by spec §13
✅ **Non-audio controls intact** - Sliders, ValuePill, blend, opacity, accordions, toggles unchanged
✅ **TypeScript compilation** - No errors reported after modifications
✅ **Tests updated** - Removed tests that asserted removed UI

## Test Status
- **NodeOptions.test.tsx**: Removed 9 audio/bind/colors tests, kept all non-audio functionality tests
- **NodeOptionsEffects.test.tsx**: Updated to reflect changed UI (no audio bind, no learn buttons)

All requirements from task specification have been successfully implemented.