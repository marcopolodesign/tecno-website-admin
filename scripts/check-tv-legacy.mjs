// Control de que el build sigue abriendo en las TVs de la sala: Samsung Tizen 3.0, Chrome 47
// (la foto de Lucas del 2026-10-15; antes se creía Tizen 5.0 / Chrome 63).
// 2026-10-14: tv.somostecnofit.com quedaba en blanco por un SyntaxError del bundle.
// 2026-10-15: en blanco otra vez por "Proxy is not defined" (Sentry) y, sin grid, todo apilado.
// Prueba completa en un Chromium rebajado a Chrome 47: scripts/tv-chrome47/README.md.
// Corre después de `vite build`; si falla, el deploy no sale.
import { readFileSync, readdirSync } from 'node:fs'
import { parse } from 'acorn'
import { simple } from 'acorn-walk'

// 2026-10-26: los estilos INLINE de React con `inset` no pasan por la reescritura de CSS y Chrome <87
// los ignora: en la Samsung el <video> quedaba sin tamaño (se veía sólo el póster). Ningún componente
// de TV puede usar `inset:` en un style={{}}.
import { readFileSync as __rf, readdirSync as __rd } from 'node:fs'
{
  const dirs = ['src/components/tv', 'src/components']
  const tvFiles = []
  for (const d of dirs) for (const f of __rd(d)) if (/\.(jsx|js)$/.test(f) && (d.endsWith('/tv') || /^(QueueTv|Tv|Anotarme)/.test(f))) tvFiles.push(`${d}/${f}`)
  const malos = tvFiles.filter((f) => /\binset\s*:/.test(__rf(f, 'utf8')))
  if (malos.length) { console.error('✗ `inset:` en estilos inline de TV (Chrome 47 lo ignora):', malos.join(', ')); process.exit(1) }
  // 2026-10-27: el lienzo de la TV no puede ser position: fixed (la Samsung no dibuja el <video>).
  const lienzo = __rf('src/components/tv/TvChrome.jsx', 'utf8')
  // 2026-10-28: en modo un video el póster va DEBAJO del <video> (zIndex 0). Ponerlo encima, aunque sea
  // con fundido/transparente, hace que la Samsung no dibuje el video (probado dos veces en la TV de Mateo).
  const cruzado = __rf('src/components/tv/VideoCruzado.jsx', 'utf8')
  const tarjeta = cruzado.slice(cruzado.indexOf('function TarjetaUnVideo'), cruzado.indexOf('function TarjetaUnVideo') + 2500)
  if (/zIndex: [2-9]/.test(tarjeta.split('<VideoEjercicio')[0])) { console.error('✗ TarjetaUnVideo: el póster quedó encima del video'); process.exit(1) }
  if (/export function LienzoTv[\s\S]{0,1500}position: 'fixed'/.test(lienzo)) { console.error('✗ LienzoTv volvió a position: fixed: la Samsung no dibuja el video'); process.exit(1) }
}


const dir = new URL('../dist/assets/', import.meta.url)
const archivos = readdirSync(dir)
const errores = []

// JS. El bundle legacy (nomodule, Chromium 47+) tiene que ser ES2015. El moderno puede traer import()/import.meta
// (la guarda de Vite que manda a Chrome 63 al legacy), pero nada de ?., ?? ni ??=.
for (const f of archivos.filter((a) => a.endsWith('.js'))) {
  const src = readFileSync(new URL(f, dir), 'utf8')
  const legacy = f.includes('-legacy-')
  try {
    const ast = parse(src, legacy ? { ecmaVersion: 2015, sourceType: 'script' } : { ecmaVersion: 2020, sourceType: 'module' })
    if (!legacy) {
      simple(ast, {
        ChainExpression(n) { errores.push(`${f}: optional chaining (?.) en ${n.start}`) },
        LogicalExpression(n) { if (n.operator === '??') errores.push(`${f}: ?? en ${n.start}`) },
      })
    }
  } catch (e) {
    errores.push(`${f}: ${e.message} → ${src.slice(Math.max(0, e.pos - 40), e.pos + 40).replace(/\n/g, ' ')}`)
  }
}

// CSS: lo que ese Chromium descarta entero.
const css = archivos.filter((a) => a.endsWith('.css'))
for (const f of css) {
  const src = readFileSync(new URL(f, dir), 'utf8')
  if (/@layer\b/.test(src)) errores.push(`${f}: quedó un @layer (Chrome 99+)`)
  if (/[;{]inset:/.test(src)) errores.push(`${f}: quedó un inset: (Chrome 87+)`)
  if (!src.includes('--shim-gap')) errores.push(`${f}: falta la copia de gap para flexGapShim`)
}

// Fuente: lo que en Chrome 47 rompe la TV y no se puede arreglar con un polyfill.
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8')
const main = src('main.jsx')
if (!/typeof Proxy === 'function'/.test(main) || !/if \(sentryPuedeCorrer\) \{\s*import\('@sentry\/react'\)/.test(main) || /^import .*@sentry/m.test(main)) {
  errores.push('src/main.jsx: Sentry tiene que ir con import() dinámico detrás de la guarda de Proxy (Chrome 47 no tiene Proxy, y el SDK no debe entrar al bundle de la TV)')
}
const tvDir = new URL('../src/components/tv/', import.meta.url)
const fuentesTv = [
  ...readdirSync(tvDir).filter((a) => a.endsWith('.jsx') && a !== 'Grilla.jsx').map((a) => 'components/tv/' + a),
  ...readdirSync(new URL('../src/components/', import.meta.url)).filter((a) => /^(QueueTv|Tv)\w*\.jsx$/.test(a)).map((a) => 'components/' + a),
]
for (const f of fuentesTv) {
  if (/display:\s*'(inline-)?grid'/.test(src(f))) errores.push(`src/${f}: display grid en una pantalla de TV — usar <Grilla> (Chrome 47 no tiene grid)`)
}

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
if (!html.includes('nomodule')) errores.push('index.html: falta el bundle legacy (nomodule)')

// 2026-10-16: la A1 de Palermo quedaba en blanco sin avisar. El aviso de errores inline tiene que
// existir, ir antes de cualquier bundle y ser ES5 puro (Chrome 47, sin fetch/Promise/arrow).
const aviso = /<script id="tv-reporte">([\s\S]*?)<\/script>/.exec(html)
if (!aviso) {
  errores.push('index.html: falta el aviso de errores de TV (<script id="tv-reporte">)')
} else {
  // Los type="module" corren diferidos (después del aviso); los clásicos y nomodule, en orden.
  const primerClasico = html.search(/<script(?![^>]*type="module")[^>]*\s(data-)?src=/)
  if (primerClasico !== -1 && html.indexOf('<script id="tv-reporte">') > primerClasico) errores.push('index.html: el aviso de errores de TV tiene que ir antes de los bundles')
  try { parse(aviso[1], { ecmaVersion: 5, sourceType: 'script' }) } catch (e) { errores.push(`index.html: el aviso de errores de TV no es ES5 — ${e.message}`) }
  if (/\bfetch\s*\(|\bnew Promise\b/.test(aviso[1])) errores.push('index.html: el aviso de errores de TV usa fetch/Promise (Chrome 47)')
  if (aviso[1].includes('__TV_BUILD__')) errores.push('index.html: el aviso de errores de TV quedó sin la versión del build')
  if (!aviso[1].includes("superficie: 'tv'")) errores.push('index.html: el aviso de errores de TV perdió el tag superficie=tv (la alerta de Sentry filtra por él)')
}
// 2026-10-19: el Chrome 47 real (Tizen 3.0) se colgaba compilando el bundle legacy de 3,4 MB (todo el
// CRM en un solo chunk) y la A1 quedaba en blanco y "cargando". El chunk de entrada legacy, que es lo
// que baja y compila la TV, tiene que quedar chico: el CRM va en MainApp (lazy) y Sentry con import().
const entradaLegacy = /data-src="\/assets\/(index-legacy-[^"]+\.js)"/.exec(html)
const TOPE_ENTRADA = 1200 * 1024
if (!entradaLegacy) errores.push('index.html: no encuentro la entrada legacy (data-src)')
else {
  const tam = readFileSync(new URL(entradaLegacy[1], dir)).length
  if (tam > TOPE_ENTRADA) errores.push(`${entradaLegacy[1]}: ${Math.round(tam / 1024)} KB — la entrada legacy de la TV no puede pasar de ${TOPE_ENTRADA / 1024} KB (Chrome 47 se cuelga compilando)`)
}
if (!/lazy\(\(\) => import\('\.\/MainApp'\)\)/.test(src('App.jsx'))) errores.push('src/App.jsx: el CRM (MainApp) tiene que cargarse con lazy() para no entrar al bundle de la TV')
if (/<link[^>]+fonts\.googleapis\.com\/css[^>]*rel="stylesheet"|<link[^>]+rel="stylesheet"[^>]+fonts\.googleapis/.test(html)) errores.push('index.html: Google Fonts como <link> bloquea el render en la TV — se cargan desde el aviso inline sólo fuera de la TV')
if (!/<TvErrorBoundary>/.test(src('App.jsx'))) errores.push('src/App.jsx: TvHostApp sin TvErrorBoundary (la TV queda en blanco sin avisar)')

if (errores.length) {
  console.error('✗ El build no abre en las TVs de la sala (Tizen 3.0, Chrome 47):\n' + errores.join('\n'))
  process.exit(1)
}
console.log(`✓ Build compatible con las TVs (Tizen 3.0, Chrome 47): ${archivos.filter((a) => a.endsWith('.js')).length} JS, ${css.length} CSS`)
