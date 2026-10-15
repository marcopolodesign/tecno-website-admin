import { Children } from 'react'

// Grilla de las pantallas de TV. Las TVs de la sala son Samsung Tizen 3.0 (Chrome 47), que no
// conocen CSS Grid (llegó en Chrome 57) ni `gap` en flex: ahí `display: grid` se descarta, todo
// queda apilado y la pantalla no entra. Donde hay grid se dibuja igual que siempre; donde no,
// se arma lo mismo con filas de flex y márgenes.
//
// `cols`: un número (n columnas iguales) o una lista de pistas — 'fr' (se reparte) o un ancho en px.
// `llenar`: las filas se reparten el alto disponible (el `gridAutoRows: minmax(0, 1fr)` de antes).
// `?sin-grid=1` en la URL fuerza el respaldo, para probarlo en un navegador actual.

const sinGrid = (() => {
  if (typeof window === 'undefined') return false
  if (/[?&]sin-grid=1/.test(window.location.search)) return true
  return !(window.CSS && CSS.supports && CSS.supports('display', 'grid'))
})()

export const tieneGrid = !sinGrid

// El hijo de cada celda ocupa la celda entera, como un item de grid estirado.
if (sinGrid && typeof document !== 'undefined') {
  const st = document.createElement('style')
  st.textContent = '.tv-celda>*{-webkit-box-flex:1;-webkit-flex:1 1 0px;flex:1 1 0px;min-width:0;min-height:0}'
  document.head.appendChild(st)
}

const pista = (p) => (p === 'fr' ? 'minmax(0, 1fr)' : `${p}px`)

export default function Grilla({ cols, gap = 0, llenar = false, style, children, ...rest }) {
  const pistas = typeof cols === 'number' ? Array.from({ length: Math.max(1, cols) }, () => 'fr') : cols
  const items = Children.toArray(children)

  if (!sinGrid) {
    return (
      <div
        {...rest}
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: typeof cols === 'number' ? `repeat(${Math.max(1, cols)}, minmax(0, 1fr))` : pistas.map(pista).join(' '),
          ...(llenar ? { gridAutoRows: 'minmax(0, 1fr)' } : null),
          gap,
        }}
      >
        {children}
      </div>
    )
  }

  const filas = []
  for (let i = 0; i < items.length; i += pistas.length) filas.push(items.slice(i, i + pistas.length))

  return (
    <div {...rest} style={{ ...style, display: 'flex', flexDirection: 'column' }}>
      {filas.map((fila, f) => (
        <div
          key={f}
          style={{
            display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 0,
            ...(llenar ? { flex: '1 1 0px' } : null),
            ...(f > 0 ? { marginTop: gap } : null),
          }}
        >
          {pistas.map((p, c) => (
            <div
              key={c}
              className="tv-celda"
              style={{
                display: 'flex', flexDirection: 'row', alignItems: 'stretch', minWidth: 0, minHeight: 0, position: 'relative',
                flex: p === 'fr' ? '1 1 0px' : `0 0 ${p}px`,
                ...(c > 0 ? { marginLeft: gap } : null),
              }}
            >
              {fila[c] !== undefined ? fila[c] : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
