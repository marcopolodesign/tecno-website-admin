// Control de que el build sigue abriendo en las TVs de la sala: Samsung Tizen 5.0, Chrome 63
// (2026-10-14: tv.somostecnofit.com quedaba en blanco por un SyntaxError del bundle).
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

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
if (!html.includes('nomodule')) errores.push('index.html: falta el bundle legacy (nomodule)')

if (errores.length) {
  console.error('✗ El build no abre en las TVs de la sala (Chrome 63):\n' + errores.join('\n'))
  process.exit(1)
}
console.log(`✓ Build compatible con las TVs (Chrome 63): ${archivos.filter((a) => a.endsWith('.js')).length} JS, ${css.length} CSS`)
