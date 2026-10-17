// Control de que el build sigue abriendo en las TVs de la sala: Samsung Tizen 3.0, Chrome 47
// (la foto de Lucas del 2026-10-15; antes se creía Tizen 5.0 / Chrome 63).
// 2026-10-14: tv.somostecnofit.com quedaba en blanco por un SyntaxError del bundle.
// 2026-10-15: en blanco otra vez por "Proxy is not defined" (Sentry) y, sin grid, todo apilado.
// Prueba completa en un Chromium rebajado a Chrome 47: scripts/tv-chrome47/README.md.
// Corre después de `vite build`; si falla, el deploy no sale.
import { readFileSync, readdirSync } from 'node:fs'
import { parse } from 'acorn'
import { simple } from 'acorn-walk'

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
if (!/typeof Proxy === 'function'/.test(main) || !/if \(sentryPuedeCorrer\) Sentry\.init/.test(main)) {
  errores.push('src/main.jsx: Sentry.init sin la guarda de Proxy (Chrome 47 no tiene Proxy y la TV queda en blanco)')
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
if (!/<TvErrorBoundary>/.test(src('App.jsx'))) errores.push('src/App.jsx: TvHostApp sin TvErrorBoundary (la TV queda en blanco sin avisar)')

if (errores.length) {
  console.error('✗ El build no abre en las TVs de la sala (Tizen 3.0, Chrome 47):\n' + errores.join('\n'))
  process.exit(1)
}
console.log(`✓ Build compatible con las TVs (Tizen 3.0, Chrome 47): ${archivos.filter((a) => a.endsWith('.js')).length} JS, ${css.length} CSS`)
