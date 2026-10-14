// Las TVs de la sala son Samsung Tizen 5.0 (Chrome 63), que no conoce `gap` en flexbox (llegó en
// Chrome 84): las piezas de la TV quedan pegadas. Si el navegador no lo soporta, lo emulamos con
// márgenes en los hijos. En cualquier navegador actual esto no hace nada.
//
// De dónde sale el valor, porque el navegador viejo lo descarta antes de que llegue al DOM:
// - estilos inline de React (`style={{ gap: 32 }}`): un setter en CSSStyleDeclaration lo copia a
//   `--shim-gap` en el mismo style (no como propiedad JS: Chrome recicla ese objeto y se pierde);
// - clases de Tailwind: el build copia `gap` a `--shim-gap` (ver vite.config.js).

function soportaFlexGap() {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden'
  el.appendChild(document.createElement('div'))
  el.appendChild(document.createElement('div'))
  document.body.appendChild(el)
  const ok = el.scrollHeight === 1
  document.body.removeChild(el)
  return ok
}

const MARCA = 'data-gap-shim'
const INLINE = { gap: '--shim-gap', rowGap: '--shim-row-gap', columnGap: '--shim-col-gap' }

function capturarInline() {
  const proto = CSSStyleDeclaration.prototype
  Object.keys(INLINE).forEach((prop) => {
    if (prop in proto) return
    Object.defineProperty(proto, prop, {
      configurable: true,
      get() { return this.getPropertyValue(INLINE[prop]).trim() },
      set(v) {
        if (v == null || v === '') this.removeProperty(INLINE[prop])
        else this.setProperty(INLINE[prop], typeof v === 'number' ? v + 'px' : String(v))
      },
    })
  })
}

function leerGaps(cs) {
  const css = (n) => cs.getPropertyValue(n).trim()
  const partes = css('--shim-gap').split(/\s+(?![^(]*\))/).filter(Boolean)
  return {
    fila: css('--shim-row-gap') || partes[0] || '',
    col: css('--shim-col-gap') || partes[1] || partes[0] || '',
  }
}

function aplicar(root) {
  const nodos = root.querySelectorAll('*')
  for (let i = 0; i < nodos.length; i++) {
    const el = nodos[i]
    const cs = getComputedStyle(el)
    if (cs.display === 'grid' || cs.display === 'inline-grid') {
      // Grid sí tiene gap en Chrome 63, pero con el nombre viejo.
      const g = leerGaps(cs)
      if (g.fila && el.style.gridRowGap !== g.fila) el.style.gridRowGap = g.fila
      if (g.col && el.style.gridColumnGap !== g.col) el.style.gridColumnGap = g.col
      continue
    }
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue
    const columna = cs.flexDirection.indexOf('column') === 0
    const g = leerGaps(cs)
    const valor = columna ? g.fila : g.col
    if (!valor || valor === 'normal' || valor === '0' || valor === '0px') continue
    const lado = columna ? 'marginTop' : 'marginLeft'
    const hijos = el.children
    let primero = true
    for (let j = 0; j < hijos.length; j++) {
      const h = hijos[j]
      const hcs = getComputedStyle(h)
      if (hcs.position === 'absolute' || hcs.position === 'fixed' || hcs.display === 'none') continue
      const nuestro = h.getAttribute(MARCA) === lado
      if (primero) {
        if (nuestro) { h.style[lado] = ''; h.removeAttribute(MARCA) }
        primero = false
        continue
      }
      // No pisar un margen que puso el propio componente.
      if (!nuestro && h.style[lado]) continue
      if (h.style[lado] !== valor) h.style[lado] = valor
      if (!nuestro) h.setAttribute(MARCA, lado)
    }
  }
}

let instalado = false

// Se llama antes de montar React, para que el setter exista cuando React escribe los estilos.
export function instalarFlexGapShim() {
  if (instalado || typeof window === 'undefined' || soportaFlexGap()) return
  instalado = true
  capturarInline()
  let pendiente = false
  const programar = () => {
    if (pendiente) return
    pendiente = true
    requestAnimationFrame(() => { pendiente = false; aplicar(document.body) })
  }
  new MutationObserver(programar).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })
  programar()
}
