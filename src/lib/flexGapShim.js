// Las TVs de la sala son Samsung Tizen 5.0 (Chrome 63), que no conoce `gap` en flexbox (llegó en
// Chrome 84): las piezas de la TV quedan pegadas. Si el navegador no lo soporta, lo emulamos con
// márgenes en los hijos. En cualquier navegador actual esto no hace nada.
//
// De dónde sale el valor, porque el navegador viejo lo descarta antes de que llegue al DOM:
// - estilos inline de React (`style={{ gap: 32 }}`): un setter en CSSStyleDeclaration lo copia a
//   `--shim-gap` en el mismo style (no como propiedad JS: Chrome recicla ese objeto y se pierde);
// - clases de Tailwind: el build copia `gap` a `--shim-gap` (ver vite.config.js).
//
// Las Tizen 3.0 (Chrome 47) tampoco tienen variables CSS (llegaron en Chrome 49): ahí el inline se
// en `border-spacing` ("columna fila"), que ese Chrome sí conserva y que sólo dibuja en tablas
// (la TV no tiene ninguna); el shim lo lee del style del elemento.
// (Las pantallas de TV son todas inline; las clases de Tailwind quedan sin gap en esas teles.)
// `?sin-gap=1` en la URL fuerza el shim y `?sin-vars=1` el modo sin variables, para probarlo.

const forzar = (k) => typeof window !== 'undefined' && new RegExp('[?&]' + k + '=1').test(window.location.search)
const conVars = !forzar('sin-vars') && typeof window !== 'undefined' && !!(window.CSS && CSS.supports && CSS.supports('--a', '0'))
const HOST = 'border-spacing'

function leerHost(style) {
  const [col = '', fila = col] = style.getPropertyValue(HOST).trim().split(/\s+/).filter(Boolean)
  return { fila, col }
}
function escribirHost(style, { fila, col }) {
  const f = fila && fila !== '0px' ? fila : '0px'
  const c = col && col !== '0px' ? col : '0px'
  if (f === '0px' && c === '0px') style.removeProperty(HOST)
  else style.setProperty(HOST, c + ' ' + f)
}

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
    if (prop in proto && !forzar('sin-gap')) return
    Object.defineProperty(proto, prop, {
      configurable: true,
      get() {
        if (conVars) return this.getPropertyValue(INLINE[prop]).trim()
        const h = leerHost(this)
        return prop === 'rowGap' ? h.fila : prop === 'columnGap' ? h.col : h.fila === h.col ? h.fila : h.fila + ' ' + h.col
      },
      set(v) {
        const vacio = v == null || v === ''
        const valor = vacio ? '' : typeof v === 'number' ? v + 'px' : String(v)
        if (conVars) {
          if (vacio) this.removeProperty(INLINE[prop])
          else this.setProperty(INLINE[prop], valor)
          return
        }
        const partes = valor.split(/\s+(?![^(]*\))/).filter(Boolean)
        const h = leerHost(this)
        if (prop === 'gap') { h.fila = partes[0] || ''; h.col = partes[1] || partes[0] || '' }
        else if (prop === 'rowGap') h.fila = partes[0] || ''
        else h.col = partes[0] || ''
        escribirHost(this, h)
      },
    })
  })
}

function leerGaps(cs, el) {
  const css = (n) => cs.getPropertyValue(n).trim()
  if (!conVars) {
    const h = leerHost(el.style)
    return { fila: h.fila === '0px' ? '' : h.fila, col: h.col === '0px' ? '' : h.col }
  }
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
      const g = leerGaps(cs, el)
      if (g.fila && el.style.gridRowGap !== g.fila) el.style.gridRowGap = g.fila
      if (g.col && el.style.gridColumnGap !== g.col) el.style.gridColumnGap = g.col
      continue
    }
    if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue
    const columna = cs.flexDirection.indexOf('column') === 0
    const g = leerGaps(cs, el)
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
  if (instalado || typeof window === 'undefined' || (soportaFlexGap() && !forzar('sin-gap'))) return
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
