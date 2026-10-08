import React, { useRef, useEffect } from 'react'

export default function CursorGlow() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      canvas.style.display = 'none'
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = canvas.clientWidth || window.innerWidth
    let H = canvas.clientHeight || window.innerHeight
    canvas.width = W
    canvas.height = H

    let px = -999
    let py = -999
    let raf = 0

    // Cursor glow — no time term, so redraw on pointer move, never idle-loop
    function draw() {
      raf = 0
      ctx.clearRect(0, 0, W, H)
      const radius = Math.max(W, H) * 0.22
      const g = ctx.createRadialGradient(px, py, 0, px, py, radius)
      g.addColorStop(0, 'rgba(238,214,200,0.16)')
      g.addColorStop(1, 'rgba(238,214,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }

    const scheduleDraw = () => { if (!raf) raf = requestAnimationFrame(draw) }

    const onMove = (e) => { px = e.clientX; py = e.clientY; scheduleDraw() }
    const onLeave = () => { ctx.clearRect(0, 0, W, H) }
    const onResize = () => {
      W = canvas.clientWidth || window.innerWidth
      H = canvas.clientHeight || window.innerHeight
      canvas.width = W
      canvas.height = H
      if (px > -999) scheduleDraw()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="canvas-top-app"
      className="gl-canvas gl-canvas--top"
      aria-hidden="true"
    />
  )
}
