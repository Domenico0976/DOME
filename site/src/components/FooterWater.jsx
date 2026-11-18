// Footer water: STESSO stack dell'hero (HeroShaderStack.jsx), con una sola
// differenza voluta: le celle che scoprono l'immagine notturna restano visibili
// più a lungo. Si ottiene dalla mappa `dotSize`, che porta il diametro della
// cella a saturazione con metà del trail (`outputMax` 2 invece di 1): a parità
// di alone la cella resta piena mentre il trail svanisce, quindi si vede per più
// tempo. Tutto il resto è identico all'hero: densità 35, twinkle 0.5 / 0.2,
// ChromaFlow 2.5 / 1.25 con momentum di default (30), CursorRipples di default,
// FilmGrain 0.15.
//
// La base DAY è un layer DOM sotto (parallax); il canvas rivela il NIGHT dove
// passa il cursore, mascherato dalle due griglie di punti.
import {
  ChromaFlow,
  CursorRipples,
  DotGrid,
  FilmGrain,
  ImageTexture,
  Shader,
} from 'shaders/react'

// Unica differenza dall'hero: `outputMax` 2 (hero: 1). Più grande è il
// diametro che la cella raggiunge con lo stesso alone, più a lungo resta sopra
// la soglia visibile mentre il trail decade.
const trailDotSize = {
  type: 'map',
  source: 'footerTrailFlow',
  channel: 'alpha',
  inputMax: 1,
  inputMin: 0,
  outputMax: 2,
  outputMin: 0,
}

const mergeDotSize = {
  type: 'map',
  source: 'footerTrailFlow',
  channel: 'alpha',
  inputMax: 1,
  inputMin: 0,
  outputMax: 1.85,
  outputMin: 0,
}

export default function FooterWater({ nightSrc, onUnavailable }) {
  return (
    <div className="footer-shader-wrapper" aria-hidden="true">
      <Shader
        className="footer-gl-canvas"
        disableTelemetry
        onUnavailable={onUnavailable}
      >
        <DotGrid
          id="footerTrailDots"
          density={35}
          dotSize={trailDotSize}
          twinkle={0.5}
          visible={false}
        />
        <DotGrid
          id="footerTrailMerge"
          density={35}
          dotSize={mergeDotSize}
          twinkle={0.2}
          visible={false}
        />
        <ChromaFlow
          id="footerTrailFlow"
          intensity={2.5}
          radius={1.25}
          visible={true}
        />
        <ImageTexture url={nightSrc} objectFit="cover" maskSource="footerTrailDots" />
        <ImageTexture url={nightSrc} objectFit="cover" maskSource="footerTrailMerge" />
        <CursorRipples />
        <FilmGrain strength={0.15} />
      </Shader>
    </div>
  )
}
