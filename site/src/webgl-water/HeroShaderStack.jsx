// The hero's shader stack, isolated so it can arrive after the section itself.
//
// Split from shader-hero.jsx on purpose. The section carries the page's first
// impression and its `background-image: url(/hero-day-opt.webp)`, so it must be in the
// DOM from the first paint; only the ~2.4 MB of shader library behind it can be
// deferred. Making the whole section lazy left a hole in the page where the hero
// should be, and the page jumped when the chunk landed.
import {
  ChromaFlow,
  CursorRipples,
  DotGrid,
  FilmGrain,
  ImageTexture,
  Shader,
} from 'shaders/react'
import HeroTextRing from './HeroTextRing.jsx'

const trailDotSize = {
  type: 'map',
  source: 'trailFlow',
  channel: 'alpha',
  inputMax: 1,
  inputMin: 0,
  outputMax: 1,
  outputMin: 0,
}

const mergeDotSize = {
  type: 'map',
  source: 'trailFlow',
  channel: 'alpha',
  inputMax: 1,
  inputMin: 0,
  outputMax: 1.85,
  outputMin: 0,
}

// px boundingBox units resolve against the canvas; a square box preserves the SVG's
// natural aspect.
const heroSvgBox = {
  x: { value: 0, unit: 'px' },
  y: { value: 92, unit: 'px' },
  width: { value: 280, unit: 'px' },
  height: { value: 280, unit: 'px' },
  origin: 'top-center',
}

// Brand text ring lives in HeroTextRing.jsx (three.js overlay, same section).
export default function HeroShaderStack({ onUnavailable }) {
  return (
    <div className="hero-shader-wrapper" aria-hidden="true">
      <Shader
        className="hero-gl-canvas"
        disableTelemetry
        onUnavailable={onUnavailable}
      >
        <ImageTexture url="/hero-day-opt.webp" objectFit="cover" />
        <DotGrid
          id="trailDots"
          density={35}
          dotSize={trailDotSize}
          twinkle={0.5}
          visible={false}
        />
        <DotGrid
          id="trailMerge"
          density={35}
          dotSize={mergeDotSize}
          twinkle={0.2}
          visible={false}
        />
        <ChromaFlow
          id="trailFlow"
          intensity={2.5}
          radius={1.25}
          visible={true}
        />
        <ImageTexture url="/hero-night.jpeg" objectFit="cover" maskSource="trailDots" />
        <ImageTexture url="/hero-night.jpeg" objectFit="cover" maskSource="trailMerge" />
        <ImageTexture
          url="/assets/svg/hero-hover.svg"
          objectFit="fill"
          boundingBox={heroSvgBox}
          maskSource="trailDots"
        />
        <ImageTexture
          url="/assets/svg/hero-hover.svg"
          objectFit="fill"
          boundingBox={heroSvgBox}
          maskSource="trailMerge"
        />
        <ImageTexture
          url="/assets/svg/hero.svg"
          objectFit="fill"
          boundingBox={heroSvgBox}
          maskSource="trailMerge"
          maskType="alphaInverted"
        />
        <CursorRipples />
        <FilmGrain strength={0.15} />
      </Shader>
      <HeroTextRing />
    </div>
  )
}
