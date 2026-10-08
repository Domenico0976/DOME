import React, { useRef, useEffect, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import ArchiveHoverCanvas from './ArchiveHoverCanvas'
import { PendulumCanvas } from './ArchiveHoverCanvas'
import ArchiveCursor from './ArchiveCursor'
import { useArchiveCursor } from '../hooks/useArchiveCursor'
import { useInView } from '../hooks/useInView.js'
import { useCursorGate } from '../hooks/useCursorGate'

gsap.registerPlugin(ScrollTrigger)

const archives = [
     { num: '01', name: 'AlFly',                
     type: 'Urban Transportation',           
     roles: 'UX/UI Design & Service Design',             
     year: '2022', image: '/assets/images/archive-video/alfly-test.gif',    
     gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
     videoPath: '/assets/images/archive-video/alfly-test.mp4',
      gifPath: '/assets/images/archive-video/alfly-test.gif',
      link: null },

  { num: '02', name: 'Policlinico di Milano',              
    type: 'Healthcare Experience',       
    roles: 'UX/UI Design & Service Design',             
     year: '2022', image: '/assets/images/archive-video/Animaz-policliMi.gif', 
     gradient: 'linear-gradient(135deg, #e43838 0%, #fed6e3 100%)',
     videoPath: '/assets/images/archive-video/Animaz-policliMi.mp4',
      gifPath: '/assets/images/archive-video/Animaz-policliMi.gif',
      link: null },

  { num: '03', name: 'uBank',            
    type: 'Home Banking',       
    roles: 'UX/UI Design & Service Design',             
     year: '2024', image: '/assets/images/archive-video/Animaz-ubank.gif',    
     gradient: 'linear-gradient(135deg, #13547a 0%, #80d0c7 100%)',
     videoPath: '/assets/images/archive-video/Animaz-ubank.mp4',
      gifPath: '/assets/images/archive-video/Animaz-ubank.gif',
      link: null },

  { num: '04', name: 'SISALFUNCLUB',       
    type: 'Game App Experience',
    roles: 'UX/UI Design & Service Design',             
     year: '2022', 
     image: '/assets/images/archive-video/Animaz-sisalfunclub.gif', 
     gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
     videoPath: '/assets/images/archive-video/Animaz-sisalfunclub.mp4',
      gifPath: '/assets/images/archive-video/Animaz-sisalfunclub.gif',
      link: null },

  { num: '05', 
    name: 'iTour',             
    type: 'Travel Manager',    
    roles: 'UX/UI Design & Service Design',             
     year: '2022', image: '/assets/images/archive-video/Animaz-itour.jpg',   
     gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
      gifPath: '/assets/images/archive-video/Animaz-itour.jpg',
      link: null },

  { num: '06', name: "CYP Wheels",            
    type: 'Custom E-commerce',    
    roles: 'UX/UI & Full Stack Web Developer',             
     year: '2026', image: null,  
     gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      gifPath: null,
      link: 'https://cypwheels.com/' },

  { num: '07', name: 'Dulcis in Fundo',              
    type: 'Custom E-commerce',    
    roles: 'UX/UI & Full Stack Web Developer',             
     year: '2025', image: null ,      
     gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
      gifPath: null,
      link: 'https://dulcisinfundo.store' },

  { num: '08', name: 'Collezione Cagnola',              
    type: 'Custom E-commerce',    
    roles: 'UX/UI & Full Stack Web Developer',             
     year: '2025', image: null,   
     gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      gifPath: null,
      link: 'https://collezionecagnola.it' },

  { num: '09', name: 'Sielco',              
    type: 'IT Website',    roles: 'UX/UI & Full Stack Web Developer',             
     year: '2025', image: null,     
     gradient: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
      gifPath: null,
      link: 'https://sielco.it/' },

  { num: '10', name: 'Marabini Recuperi',              
    type: 'Business Website',    
    roles: 'UX/UI & Full Stack Web Developer',             
     year: '2026', image: null,  
     gradient: 'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)',
      gifPath: null,
      link: 'https://marabinirecuperi.it/' }    
]

// Stable poster list for the continuous hover strip (identity must not change
// across renders, or the canvas would re-preload its textures every hover).
const STRIP_IMAGES = archives.map((a) => a.image)
// Same stability for the per-row animated media: rows with video hold a live
// muted texture, gif-only rows a live decoder texture, the rest stay static.
const STRIP_VIDEOS = archives.map((a) => a.videoPath ?? null)
const STRIP_GIFS = archives.map((a) => a.gifPath ?? null)


export default function Archives() {
  const sectionRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const [hoveredRow, setHoveredRow] = useState(null)
  const pendulumRef = useRef({ theta: 0, omega: 0 })
  const lastHoveredIdxRef = useRef(-1)
  const rowVisibleRef = useRef(new Set())
  const rowBoxRef = useRef(null)
  const cursorInRowRef = useRef(false)
  const cursorEntryRef = useRef({ x: 0, y: 0 })
  const canvasOpacityRef = useRef({ value: 0 })
  const {
    isMobile, openCanvas, cursorRef, setCursor,
    latchedClosed, setLatchedClosed, clearLatchedClosed, isFreshInteraction,
  } = useArchiveCursor()
  const { isTouch: gateIsTouch, isAwake } = useCursorGate()
  // Tablet (<=1024) usa la versione mobile a lista: la tabella desktop nasce
  // per hover+mouse e su touch non mostra canvas. Solo layout, non input.
  const [isTabletLayout, setIsTabletLayout] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 1024px)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 1024px)')
    const on = (e) => setIsTabletLayout(e.matches)
    setIsTabletLayout(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const isNarrow = isMobile || isTabletLayout

  // `target` is the getter form on purpose: useInView's own comment says a plain ref
  // object is observed as null for elements resolved after mount. Passing the EXISTING
  // sectionRef is the point — destructuring a new ref from the hook would shadow it,
  // and that ref is also what the canvas receives as boundsRef for its bounds maths.
  const [, sectionInView] = useInView({ target: () => sectionRef.current })
  const sectionInViewRef = useRef(sectionInView)
  useEffect(() => { sectionInViewRef.current = sectionInView }, [sectionInView])

  const indexOfRow = (row) => archives.findIndex((a) => a.num === row?.num)

  // Latch the close when the section leaves the viewport while open, remembering which
  // row was showing. The latch is NOT cleared here: `sectionInView` flipping back to
  // true must not reopen the canvas.
  useEffect(() => {
    if (!sectionInView && hoveredRow) setLatchedClosed(indexOfRow(hoveredRow))
  }, [sectionInView, hoveredRow, setLatchedClosed])

  // Desktop row choreography. Driven off the hovered index in React state, not CSS
  // sibling selectors: `tr:hover ~ tr` matches only FOLLOWING siblings, so rows above
  // the hovered one would never shift. One timeline per state change puts weight,
  // transform and opacity on a single clock; three independent CSS transitions would
  // land on slightly different frames. Position 0 on every tween starts them together.
  //
  // The x-shift animates the cells rather than the <tr>: `transform` on a table row is
  // unreliable, and the brief asks for the row's contents to move regardless. Opacity
  // stays on the <tr> because it is not a transform.
  //
  // font-weight is NOT compositor-friendly: GSAP tweens the numeric value exactly as CSS
  // would and every step re-runs layout. Requested explicitly, bounded to a handful of
  // cells over 0.35s. If it measures badly on low-end hardware, let it step — do not
  // silently drop the interpolation.
  const ROW_SHIFT = -28
  const ROW_DUR = 0.6
  const ROW_WEIGHT_DUR = 0.25
  const ROW_EASE = 'expo.out'
  const rowTlRef = useRef(null)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rows = sectionRef.current?.querySelectorAll('tbody tr')
    if (!rows || rows.length === 0) return
    rowTlRef.current?.kill()
    const tl = gsap.timeline()
    const anyHovered = hoveredRow != null
    rows.forEach((row) => {
      const isHovered = row.getAttribute('data-hovered') === 'true'
      // Only the hovered row moves. Non-hovered rows stay put and are dimmed instead —
      // shifting them right fought the hovered row's own travel and read as noise.
      const shift = isHovered ? ROW_SHIFT : 0
      const dim = !anyHovered ? 1 : isHovered ? 1 : 0.8
      row.querySelectorAll('th, td').forEach((cell) => {
        tl.to(cell, { x: shift, duration: ROW_DUR, ease: ROW_EASE }, 0)
      })
      tl.to(row, { opacity: dim, duration: ROW_DUR, ease: ROW_EASE }, 0)
      const title = row.querySelector('td.col-name')
      if (title) {
        // Deliberately shorter than the travel. font-weight re-runs layout on every
        // interpolated step, so stretching it over the full duration is what made the
        // motion read as unsmooth; the cheap composited transform carries the long glide
        // while the expensive part finishes early.
        tl.to(title, { fontWeight: isHovered ? 600 : 500, duration: ROW_WEIGHT_DUR, ease: ROW_EASE }, 0)
      }
    })
    rowTlRef.current = tl
  }, [hoveredRow])

  // Live row tracking for the continuous strip: every row change updates the
  // hovered index immediately. The strip chases it with smoothing, so images
  // flow one after another instead of discrete wipes — no gate, no settle.
  const handleRowEnter = (e, row, index) => {
    if (isFreshInteraction(index)) clearLatchedClosed()
    if (gateIsTouch && !isAwake.current) return
    setCursor(e.clientX, e.clientY)
    cursorEntryRef.current = { x: e.clientX, y: e.clientY }
    rowBoxRef.current = e.currentTarget
    cursorInRowRef.current = true
    lastHoveredIdxRef.current = index
    setHoveredRow(row)
  }

  const handleRowMove = (e) => {
    if (gateIsTouch && !isAwake.current) return
    setCursor(e.clientX, e.clientY)
  }

  // Row click: su touch il tap apre sempre il canvas (il link si apre dal
  // bottone nero "click to open"); su desktop resta la regola precedente.
  // Only http(s) passes, so a bad value can never turn
  // the click into script execution.
  const openRowLink = (row) => {
    const url = typeof row?.link === 'string' ? row.link.trim() : ''
    if (!/^https?:\/\//i.test(url)) return false
    window.open(url, '_blank', 'noopener,noreferrer')
    return true
  }

  const handleRowClick = (e, row, index) => {
    if (gateIsTouch) {
      if (isAwake.current) return
      openCanvas(row.image, 'archive-wind', { videoPath: row.videoPath, gifPath: row.gifPath, link: row.link, name: row.name })
      lastHoveredIdxRef.current = index
      return
    }
    if (openRowLink(row)) return
  }

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const handleSectionLeave = () => {
      setHoveredRow(null)
      cursorInRowRef.current = false
      rowBoxRef.current = null
    }
    section.addEventListener('mouseleave', handleSectionLeave, { passive: true })
    return () => {
      section.removeEventListener('mouseleave', handleSectionLeave)
    }
  }, [])

  useEffect(() => {
    if (!gateIsTouch) return

    let rafId = 0
    let activeIndex = -1
    const tick = () => {
      if (isAwake.current) {
        const { x, y } = cursorRef.current
        const target = document.elementFromPoint(x, y)?.closest('.archives-list .archive-row')
        const rows = sectionRef.current?.querySelectorAll('.archives-list .archive-row')
        const index = target && rows ? Array.from(rows).indexOf(target) : -1
        if (index >= 0 && index !== activeIndex) {
          activeIndex = index
          handleRowEnter({ clientX: x, clientY: y, currentTarget: target }, archives[index], index)
        } else if (index < 0 && activeIndex >= 0) {
          activeIndex = -1
          setHoveredRow(null)
          cursorInRowRef.current = false
          canvasOpacityRef.current.value = 0
        }
        if (index >= 0) canvasOpacityRef.current.value = 1
      } else if (activeIndex >= 0) {
        activeIndex = -1
        setHoveredRow(null)
        cursorInRowRef.current = false
        canvasOpacityRef.current.value = 0
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [gateIsTouch, cursorRef, isAwake])

  useEffect(() => {
    if (isNarrow) return
    // Pass the element, not the ref object. GSAP reads scope.current at call
    // time, and a ref is nulled on unmount — with a ref scope that read fails
    // and the context falls back to a detached div, logging "Invalid scope".
    const section = sectionRef.current
    if (!section) return
    const ctx = gsap.context(() => {
      const heading = sectionRef.current?.querySelector('.section-head')
      const rows = sectionRef.current?.querySelectorAll('tbody tr')
      const table = sectionRef.current?.querySelector('.archives-table')

      if (heading) {
        gsap.fromTo(heading,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: heading, start: 'top 85%', once: true } }
        )
      }

      if (table && rows?.length) {
        gsap.fromTo(table,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.9, delay: 0.2, ease: 'power3.out',
            scrollTrigger: { trigger: table, start: 'top 85%', once: true } }
        )
        gsap.to(table, {
          y: -25,
          ease: 'none',
          scrollTrigger: { trigger: table, start: 'top bottom', end: 'bottom top', scrub: 1 }
        })
      }

      rows?.forEach((row, i) => {
        gsap.fromTo(row,
          { opacity: 0, x: -20 },
          { opacity: 1, x: 0, duration: 0.5, delay: 0.3 + i * 0.04, ease: 'power2.out',
            // onEnter, NOT onComplete: `once: true` kills the ScrollTrigger as soon as the
            // first onEnter fires, so the trigger's own onComplete never ran and
            // rowVisibleRef stayed permanently empty. That left handleRowEnter always taking
            // the else branch, so prevImage stayed null and slideDir stayed 0 — and the
            // transition effect early-returns on slideDir === 0, meaning the slide could
            // never run for anyone no matter what the slide guard allowed.
            scrollTrigger: { trigger: row, start: 'top 90%', once: true, onEnter: () => rowVisibleRef.current.add(i) } }
        )
      })
    }, section)

    return () => ctx.revert()
    // isMobile/isNarrow must be deps: with [] this effect runs once, so mounting on a
    // phone hit the early return above and the desktop reveals were never
    // registered — they could not be recovered by the global refresh either.
  }, [isNarrow])

  return (
    <section className="archives-region" id="archives" aria-labelledby="archives-title" ref={sectionRef}>
      <div className="container">
        <div className="section-head">
          <h2 id="archives-title">Archives</h2>
          <span className="count">23 works · 2022 – 2026</span>
        </div>

        {isNarrow ? (
          <div className="archives-list" role="list" aria-label="Project archive">
            {archives.map((a, i) => (
              <article
                key={a.num}
                role="listitem"
                className="project-row archive-row"
                data-image={a.image ?? 'https://picsum.photos/400/300'}
                data-gradient={a.gradient ?? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}
                onMouseEnter={(e) => handleRowEnter(e, a, i)}
                onMouseMove={handleRowMove}
                onMouseLeave={() => {
                  cursorInRowRef.current = false
                  setHoveredRow(null)
                }}
                onClick={(e) => handleRowClick(e, a, i)}
              >
                <span className="pr-year">{a.num}</span>
                <div className="pr-body">
                  <h3 className="pr-name">{a.name}</h3>
                  <p className="pr-meta">
                    <span>{a.type}</span>
                    <span className="dot" aria-hidden="true">/</span>
                    <span>{a.roles}</span>
                    <span className="dot" aria-hidden="true">/</span>
                    <span>{a.year}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
        <table className="archives-table" aria-describedby="archives-title">
          <caption className="visually-hidden" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
            Project archive, listed by year
          </caption>
          <thead>
            <tr>
              <th scope="col" className="col-num">N°</th>
              <th scope="col" className="col-name">Project</th>
              <th scope="col" className="col-type">Type</th>
              <th scope="col" className="col-roles">Roles</th>
              <th scope="col" className="col-year">Year</th>
            </tr>
          </thead>
          <tbody>
            {archives.map((a, i) => (
              <tr
                key={a.num}
                data-image={a.image ?? 'https://picsum.photos/400/300'}
                data-gradient={a.gradient ?? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}
                data-hovered={hoveredRow?.num === a.num ? 'true' : 'false'}
                onMouseEnter={(e) => handleRowEnter(e, a, i)}
                onMouseMove={handleRowMove}
                onMouseLeave={() => {
                  cursorInRowRef.current = false
                  setHoveredRow(null)
                }}
                onClick={(e) => handleRowClick(e, a, i)}
              >
                <th scope="row" className="col-num">{a.num}</th>
                <td className="col-name">{a.name}</td>
                <td className="col-type">{a.type}</td>
                <td className="col-roles">{a.roles}</td>
                <td className="col-year">{a.year}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}

        <div style={{ position: 'relative' }} ref={canvasContainerRef}>
          <PendulumCanvas
              visible={!!hoveredRow && sectionInView && !latchedClosed.current}
            cursorRef={cursorRef}
            pendulumRef={pendulumRef}
            boundsRef={sectionRef}
            anchorRef={rowBoxRef}
            showLinkChip={!!hoveredRow?.link}
            linkUrl={hoveredRow?.link ?? null}
            image={hoveredRow?.image}
            videoPath={hoveredRow?.videoPath}
            gifPath={hoveredRow?.gifPath}
            canvasOpacityRef={canvasOpacityRef}
          >
            <ArchiveHoverCanvas
              pendulumRef={pendulumRef}
              cursorRef={cursorRef}
              image={hoveredRow?.image}
              videoPath={hoveredRow?.videoPath}
              gifPath={hoveredRow?.gifPath}
              stripImages={STRIP_IMAGES}
              stripTarget={hoveredRow ? indexOfRow(hoveredRow) : 0}
              stripVideos={STRIP_VIDEOS}
              stripGifs={STRIP_GIFS}
              visible={!!hoveredRow && sectionInView && !latchedClosed.current}
              gateIsTouch={gateIsTouch}
              gateIsAwake={isAwake}
            />
          </PendulumCanvas>
          <ArchiveCursor cursorRef={cursorRef} rowBoxRef={rowBoxRef} cursorInRowRef={cursorInRowRef} cursorEntryRef={cursorEntryRef} canvasOpacityRef={canvasOpacityRef} pendulumRef={pendulumRef} />
        </div>
      </div>
    </section>
  )
}
