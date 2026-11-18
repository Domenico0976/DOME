import { containScale, freeHeight, scaleFor, runwayProgress } from './geometry.js'

// Lo stato della scala a scena contenuta, in funzione di quanto si è
// scorso nella corsa dedicata. Il banner della giunta svanisce nel primo
// 30%: quando l'immagine si stacca dalla banda, la cucitura non esiste più.
const SCALE_INSET = 0.88
const BANNER_FADE = 0.3

export function scaleState({ vh, headerH, creditsH, openW, fileW, fileH, scrolled, runway }) {
  const freeH = freeHeight({ vh, headerH, creditsH })
  const { w } = containScale({
    fileW,
    fileH,
    freeW: openW,
    freeH,
    inset: SCALE_INSET,
  })
  const target = scaleFor({ openW, targetW: w })
  const p = runwayProgress({ scrolled, runway })

  const scale = Math.round((1 + (target - 1) * p) * 1000) / 1000
  const bannerOpacity = Math.round(Math.max(0, 1 - p / BANNER_FADE) * 1000) / 1000
  return { scale, bannerOpacity }
}
