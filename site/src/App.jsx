import React, { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Header from './components/Header.jsx'
import TextEntryGlass from './components/TextEntryGlass.jsx'
import SplitScreenHero from './components/SplitScreenHero.jsx'
import FeaturedGallery from './components/FeaturedGallery.jsx'
import SelectedProjects from './components/SelectedProjects.jsx'
import Archives from './components/Archives.jsx'
import Footer from './components/Footer.jsx'
import CursorGlow from './components/CursorGlow.jsx'
import MobileCanvas from './components/MobileCanvas.jsx'
import MobileCursorHint from './components/MobileCursorHint.jsx'
import GalleryTouchEffect from './components/GalleryTouchEffect.jsx'
import SoundUnlockChip from './components/SoundUnlockChip.jsx'
import Scrollbar from './components/Scrollbar.jsx'
import { ArchiveCursorProvider } from './hooks/useArchiveCursor'
import { useIsMobile } from './hooks/useIsMobile'
import { useIsTouch } from './hooks/useIsTouch'

// SplitScreenHero is a plain import again: it now renders its section
// synchronously and defers only the shader stack inside itself, so there is no
// hole in the page and nothing to suspend here. The heavy `shaders` chunk is
// still started from main.jsx, which is the only place that knows about it.

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  const isMobile = useIsMobile()
  const isTouch = useIsTouch()

  // Lenis non si crea qui: vive in `src/smooth/lenisBoot.js`, chiamato una
  // volta da main.jsx prima del mount. In un effetto React StrictMode lo
  // distruggeva e ricreava, e `window.__lenis` restava null proprio quando
  // footer, scrollbar e preloader lo leggono.

  // Mobile <-> desktop flip changes document height drastically (archives
  // table<->list, type scale), so trigger positions computed for one mode are
  // stale in the other. Never ignore these resizes: refresh after layout settles.
  const firstMode = useRef(true)
  useEffect(() => {
    if (firstMode.current) { firstMode.current = false; return }
    let raf = 0
    let frames = 0
    let lastHeight = -1
    let stable = 0
    // Wait for the document height to stop changing rather than guessing a delay.
    // A refresh that runs while React is still swapping the layout measures the
    // old height and leaves every trigger stale. MAX_FRAMES is a backstop so a
    // continuously animating element cannot keep this loop alive forever.
    const MAX_FRAMES = 90
    const settle = () => {
      frames += 1
      const height = document.documentElement.scrollHeight
      if (height === lastHeight) stable += 1
      else { stable = 0; lastHeight = height }
      if (stable >= 2 || frames >= MAX_FRAMES) { ScrollTrigger.refresh(); return }
      raf = requestAnimationFrame(settle)
    }
    raf = requestAnimationFrame(settle)
    return () => cancelAnimationFrame(raf)
  }, [isMobile, isTouch])

  // Signal the first-landing preloader that the real app is mounted, so it can
  // safely uncover the site (see src/preloader/index.js). No-op if skipped.
  //
  // A DOM attribute rather than a call into window.__preloader: these are two
  // independent entry points racing to start, and the app can finish mounting
  // before the preloader has installed its global. `window.__preloader?.appReady()`
  // silently did nothing in that order, and the preloader then sat on screen for
  // twenty seconds waiting for a flag that was never going to arrive. A marker on
  // <html> is readable no matter who gets there first.
  useEffect(() => {
    document.documentElement.dataset.appReady = '1'
  }, [])

  return (
    <ArchiveCursorProvider>
      <>
        <CursorGlow />
        <Header />
        <main id="top">
          <SplitScreenHero />
          <TextEntryGlass />
          <FeaturedGallery />
          <SelectedProjects />
          <Archives />
        </main>
        <Footer />
        {isTouch && <MobileCanvas />}
        {isTouch && <MobileCursorHint />}
        {isTouch && <GalleryTouchEffect />}
        <SoundUnlockChip />
        <Scrollbar />
      </>
    </ArchiveCursorProvider>
  )
}
