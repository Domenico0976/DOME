import * as THREE from 'three'
import { featureEdgePositions, quadEdgePositions } from './wireEdges.js'

// Wireframe rivelato dal cursore, sopra al materiale.
//
// Le linee NON sono `material.wireframe` di three: quello disegna gli spigoli
// dei triangoli, quindi su una mesh a quad mostra anche la diagonale di ogni
// quad e il reticolo sembra una ragnatela. Qui si costruisce il reticolo vero
// (vedi wireEdges.js): quad per la mesh a griglia del torus knot, spigoli reali
// per l'estrusione del logo.
//
// La copia è figlia della mesh, quindi eredita posizione, rotazione e scala
// senza codice. La geometria delle linee è un buffer piccolo e separato: i
// vertici sono una selezione di quelli della mesh, le diagonali non ci sono.
//
// La maschera è un cerchio morbido attorno al puntatore, in spazio schermo:
// si vede solo la porzione di reticolo che stai guardando, con il bordo
// sfumato (smoothstep fra il 28% e il 100% del raggio, vedi SOFT).
//
// Perché non litiga col depth buffer: le linee stanno esattamente sulla
// superficie, quindi la copia è scalata di un soffio (OFFSET) e sfiora la
// mesh. `depthWrite: false` + `depthTest: true`: le linee dentro il volume
// restano nascoste dal materiale, si vede solo il guscio verso la camera.

// Quanto è sfumato il bordo: frazione del raggio che fa da rampa.
const SOFT = 0.72
// Raggio della maschera in frazioni dell'altezza del canvas.
const RADIUS = 0.26
// Quanto la copia sfiora la superficie (frazione). Va tenuto piccolo: è solo
// per non far litigare le linee col depth buffer, e oltre ~1,01 il reticolo
// stacca visibilmente dal bordo del vetro.
const OFFSET = 1.004

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec2 uPointer;     // NDC, -1..1, y in su
  uniform vec2 uResolution;   // px CSS del canvas
  uniform float uRadius;      // in altezze di canvas
  uniform float uSoft;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
    vec2 p = uPointer * 0.5 + 0.5;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    // Cerchio vero: la distanza si raddrizza sull'aspetto.
    float d = length((uv - p) * vec2(aspect, 1.0));
    float edge = max(uRadius * uSoft, 0.0005);
    float mask = 1.0 - smoothstep(uRadius - edge, uRadius, d);
    if (mask < 0.002) discard;
    gl_FragColor = vec4(uColor, uOpacity * mask);
  }
`

export function createWireOverlay(
  mesh,
  { color = '#f166eb', radius = RADIUS, soft = SOFT, opacity = 0.8, cols = 0, rows = 0 } = {},
) {
  // Reticolo: quad se la mesh ha una griglia (cols/rows), altrimenti spigoli
  // veri. Se nessuno dei due produce linee non c'è niente da rivelare.
  const positions =
    (cols && rows ? quadEdgePositions(mesh.geometry, { cols, rows }) : null) ??
    featureEdgePositions(mesh.geometry)
  if (!positions || !positions.length) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPointer: { value: new THREE.Vector2(0, 0) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: radius },
      uSoft: { value: soft },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  })

  // LineSegments, non Mesh: le linee sono già segmenti (niente indici di
  // wireframe da far generare a three), quindi nessuna diagonale.
  const wire = new THREE.LineSegments(geometry, material)
  wire.scale.setScalar(OFFSET)
  wire.renderOrder = 2
  // Il bounding sphere del reticolo è più stretto di quello della mesh, e con
  // la scala di sfioramento non vale la pena ricalcolarlo: il padre fa già da
  // frustum culling.
  wire.frustumCulled = false
  mesh.add(wire)

  return {
    object: wire,
    setPointer(x, y) {
      material.uniforms.uPointer.value.set(x, y)
    },
    setView(width, height) {
      material.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height))
    },
    dispose() {
      mesh.remove(wire)
      geometry.dispose()
      material.dispose()
    },
  }
}
