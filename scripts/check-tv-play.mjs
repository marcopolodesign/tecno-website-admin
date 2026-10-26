// Control (2026-10-21): en el Chrome viejo de las TVs Samsung `video.play()` devuelve undefined,
// así que encadenar `.catch` / `.then` directo sobre `play()` rompe la TV entera.
// Falla si algún archivo de src/ encadena algo directo sobre `.play()`.
// Uso: node scripts/check-tv-play.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = new URL('../src', import.meta.url).pathname
const archivos = []
const recorrer = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) recorrer(p)
    else if (/\.(jsx?|tsx?)$/.test(n)) archivos.push(p)
  }
}
recorrer(raiz)

const malo = /\.play\??\.?\(\)\s*\??\.(catch|then|finally)\b/
const fallas = []
for (const f of archivos) {
  readFileSync(f, 'utf8').split('\n').forEach((linea, i) => {
    if (!/^\s*(\/\/|\*)/.test(linea) && malo.test(linea)) fallas.push(`${f.replace(raiz, 'src')}:${i + 1}: ${linea.trim()}`)
  })
}

if (fallas.length) {
  console.error('check-tv-play: FALLA — `play()` puede devolver undefined en las TVs viejas:')
  for (const l of fallas) console.error('  ' + l)
  process.exit(1)
}
console.log(`check-tv-play: OK (${archivos.length} archivos)`)
