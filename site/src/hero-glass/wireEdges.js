import * as THREE from 'three'

// Costruzione delle linee del wireframe.
//
// `material.wireframe` di three disegna gli spigoli dei TRIANGOLI, quindi su una
// mesh a quad mostra anche la diagonale di ogni quad: il reticolo sembra una
// ragnatela invece che una griglia. Qui le linee si costruiscono a mano, in due
// modi che coprono i due oggetti dell'hero-glass:
//
//  1. `quadEdgePositions` — per una mesh PARAMETRICA a griglia (il torus knot):
//     conosce il numero di colonne e righe, quindi disegna solo i lati dei quad.
//  2. `featureEdgePositions` — per una mesh triangolata qualsiasi (l'estrusione
//     del logo, che quad non ne ha): tiene gli spigoli veri, cioè i bordi e le
//     pieghe, e scarta le diagonali perché stanno sullo stesso piano.
//
// Entrambe sono pure: geometry in ingresso, Float32Array di posizioni in uscita
// (null se la mesh non si presta, così il chiamante sa di dover ripiegare).

// Accumulatore con deduplica per POSIZIONE: le mesh chiuse hanno vertici
// duplicati (la cucitura del tubo, le facce del cubo), quindi lo stesso lato
// arriverebbe due volte. Un `Set` di chiavi testuali costa una volta al mount e
// dimezza il buffer.
function edgeCollector(geometry) {
  const pos = geometry.getAttribute('position')
  const seen = new Set()
  const out = []
  const key = (i) =>
    `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`
  const push = (a, b) => {
    const ka = key(a)
    const kb = key(b)
    const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
    if (seen.has(id)) return
    seen.add(id)
    out.push(pos.getX(a), pos.getY(a), pos.getZ(a), pos.getX(b), pos.getY(b), pos.getZ(b))
  }
  return { push, result: () => (out.length ? new Float32Array(out) : null) }
}

// Vertice (i, j) della griglia del torus knot: three impila i vertici con
// `for i in 0..tubular` esterno e `for j in 0..radial` interno.
export function quadEdgePositions(geometry, { cols, rows }) {
  const pos = geometry?.getAttribute ? geometry.getAttribute('position') : null
  if (!pos || !(cols > 0) || !(rows > 0)) return null
  if (pos.count !== (cols + 1) * (rows + 1)) return null

  const at = (i, j) => i * (rows + 1) + j
  const collector = edgeCollector(geometry)

  // Lati lungo il tubo e lati attorno al tubo: sono i quad, mai le diagonali.
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j <= rows; j += 1) collector.push(at(i, j), at(i + 1, j))
  }
  for (let i = 0; i <= cols; i += 1) {
    for (let j = 0; j < rows; j += 1) collector.push(at(i, j), at(i, j + 1))
  }
  return collector.result()
}

// Spigoli "veri" di una mesh triangolata: un lato si tiene se ha una sola
// faccia (bordo) o se le due facce che lo condividono non sono complanari.
// `thresholdDeg` è la tolerance dell'angolo: 1.5° scarta le diagonali (0°) e
// tiene le pieghe vere (bevel, pareti, silhouette).
export function featureEdgePositions(geometry, { thresholdDeg = 1.5 } = {}) {
  const pos = geometry?.getAttribute ? geometry.getAttribute('position') : null
  if (!pos || pos.count < 3) return null
  const index = geometry.getIndex ? geometry.getIndex() : null
  const triCount = Math.floor((index ? index.count : pos.count) / 3)
  if (triCount < 1) return null

  const cosLimit = Math.cos((thresholdDeg * Math.PI) / 180)

  // Saldatura per posizione. Le mesh NON indicizzate (ExtrudeGeometry, quindi
  // il logo) hanno un vertice per triangolo: due facce non condividono MAI un
  // indice, quindi ogni spigolo risulterebbe di una sola faccia, il test di
  // complanarità non scatterebbe mai e il reticolo mostrerebbe la triangolazione
  // intera. Con la mappa posizione → id condiviso tutto torna a funzionare.
  const weld = new Map()
  const id = new Int32Array(pos.count)
  for (let i = 0; i < pos.count; i += 1) {
    const k = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`
    let w = weld.get(k)
    if (w === undefined) {
      w = i
      weld.set(k, w)
    }
    id[i] = w
  }

  const vertex = (i) => (index ? id[index.getX(i)] : id[i])
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()

  // key = min * count + max: intero, niente stringhe nel ciclo caldo.
  const edges = new Map()

  for (let t = 0; t < triCount; t += 1) {
    const i0 = vertex(t * 3)
    const i1 = vertex(t * 3 + 1)
    const i2 = vertex(t * 3 + 2)
    if (i0 === i1 || i1 === i2 || i2 === i0) continue // triangolo degenere dopo la saldatura
    a.fromBufferAttribute(pos, i0)
    b.fromBufferAttribute(pos, i1)
    c.fromBufferAttribute(pos, i2)
    e1.subVectors(b, a)
    e2.subVectors(c, a)
    n.crossVectors(e1, e2)
    if (n.lengthSq() === 0) continue // triangolo degenere: non ha normale
    n.normalize()

    const faces = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ]
    for (const [p, q] of faces) {
      const lo = p < q ? p : q
      const hi = p < q ? q : p
      const key = lo * pos.count + hi
      const found = edges.get(key)
      if (!found) {
        edges.set(key, { lo, hi, nx: n.x, ny: n.y, nz: n.z, faces: 1, bent: false })
      } else {
        found.faces += 1
        // Basta una piega perché lo spigolo si veda.
        const dot = found.nx * n.x + found.ny * n.y + found.nz * n.z
        if (dot < cosLimit) found.bent = true
      }
    }
  }

  const keep = []
  for (const e of edges.values()) {
    // Una piega vale per tutto lo spigolo; una sola faccia significa bordo, e
    // un bordo si vede sempre.
    if (e.faces === 1 || e.bent) keep.push(e)
  }
  if (!keep.length) return null

  // Deduplica per posizione: su una mesh non indicizzata (il cubo di three) lo
  // stesso spigolo appartiene a due facce con vertici distinti, quindi
  // arriverebbe due volte — coincidente, quindi invisibile ma inutile.
  const collector = edgeCollector(geometry)
  for (const e of keep) collector.push(e.lo, e.hi)
  return collector.result()
}
