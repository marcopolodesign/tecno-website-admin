#!/usr/bin/env node
// "Lo arreglado no vuelve" — control de números cortados en las TVs de la sala (2026-10-20).
//
// Mateo, usando la sala en staging: "se están cortando mucho los números en las TVs". Este script
// abre cada pantalla de TV (sede + estación en todos sus estados y formatos) a 1920×1080 con datos
// fijos — intercepta tv_linea / tv_sede / tv_resolver / ahora, así no toca staging ni depende de que
// haya gente en la sala — y mide, carácter por carácter, la TINTA de cada dígito (canvas
// measureText con la misma fuente) contra todo lo que la recorta: ancestros con overflow, el borde
// del lienzo y la pantalla. Falla si algún dígito queda visible a medias.
//
// Además pide la fuente: falla si Geist / Geist Mono no cargaron (sin ellas la TV cae a la fuente
// del sistema, que en la Samsung tiene otras medidas).
//
// Correr (sirve dist/ solo; antes `npx vite build`):
//   npm i --no-save playwright-core
//   node scripts/check-tv-numeros.mjs                 # usa ./dist
//   DIST=/tmp/tv-dist OUT=/tmp/tv-numeros node scripts/check-tv-numeros.mjs   # + capturas
//   SIN_FUENTE=1 node scripts/check-tv-numeros.mjs    # bloquea las woff2: prueba el respaldo
//   CHROME=/ruta/al/chrome node scripts/check-tv-numeros.mjs
//   BASE=https://tecno-admin-staging-git-…vercel.app node scripts/check-tv-numeros.mjs   # contra un deploy
import http from 'node:http'
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = process.env.DIST || new URL('../dist/', import.meta.url).pathname
const OUT = process.env.OUT || ''
const SIN_FUENTE = Boolean(process.env.SIN_FUENTE)
const TOL = 0.75 // px de tolerancia (antialias)

function chromeLocal() {
  if (process.env.CHROME) return process.env.CHROME
  const base = join(process.env.HOME || '', 'Library/Caches/ms-playwright')
  if (!existsSync(base)) return undefined
  const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
  for (const d of dirs) {
    const p = join(base, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
    if (existsSync(p)) return p
  }
  return undefined
}

// ── Servidor estático de dist/ (fallback SPA a index.html) ────────────────────────────────
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0])
  let f = join(DIST, p)
  if (!existsSync(f) || p.endsWith('/') || !extname(p)) f = join(DIST, 'index.html')
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' })
  res.end(readFileSync(f))
})
// BASE=https://<preview>.vercel.app corre lo mismo contra un deploy (los datos siguen siendo fijos).
if (!process.env.BASE) await new Promise((r) => server.listen(0, r))
const BASE = process.env.BASE || `http://localhost:${server.address().port}`

// ── Datos fijos ──────────────────────────────────────────────────────────────────────────
const LOCATION = 'db9a686a-cc72-413e-9c0c-c3058812de60'
const E = 60, T = 30
const iso = (ms) => new Date(ms).toISOString()
const ej = (i, extra) => ({
  code: `EJ${i}`, name: ['Sentadilla búlgara con mancuernas', 'Remo con banda elástica', 'Plancha con toque de hombros', 'Burpees al cajón', 'Peso muerto rumano'][i % 5],
  rondas: 1, formato: 'AMRAP', sets_reps: '10 por vuelta', rest_time: '60s', trabajo_seg: 600, descanso_seg: 0, exercise_order: i + 1,
  video_url: null, tv_path: null, poster_path: null, crop_tv: null, recorte_inicio: null, recorte_fin: null, video_embed_id: null, video_platform: null,
  processing_status: 'pending', video_thumbnail_url: null, ejercicios_por_minuto: null, segundos_por_ejercicio: null, ...extra,
})
const FORMATOS = {
  amrap: [0, 1, 2, 3].map((i) => ej(i, { formato: 'AMRAP', trabajo_seg: 600, sets_reps: '12 por vuelta' })),
  amrap20: [0, 1].map((i) => ej(i, { formato: 'AMRAP', trabajo_seg: 1200, sets_reps: '8 por vuelta' })),
  tabata: [ej(0, { formato: 'Tabata', rondas: 8, trabajo_seg: 20, descanso_seg: 10, sets_reps: 'Máximas reps' })],
  tabata3: [0, 1, 2].map((i) => ej(i, { formato: 'Tabata', rondas: 8, trabajo_seg: 20, descanso_seg: 10, sets_reps: 'Máximas reps' })),
  emom: [ej(0, { formato: 'EMOM', rondas: 10, trabajo_seg: 60, sets_reps: '15', ejercicios_por_minuto: 1 })],
  emom2: [0, 1].map((i) => ej(i, { formato: 'EMOM', rondas: 12, trabajo_seg: 60, sets_reps: '12', ejercicios_por_minuto: 2 })),
  series: [ej(0, { formato: 'Series', sets_reps: '4x12' })],
  series3: [0, 1, 2].map((i) => ej(i, { formato: 'Series', sets_reps: '4x10' })),
}

function linea(S) {
  return { id: 4, name: 'LINEA A', modo_demo: false, line_number: 1, location_id: LOCATION, estacion_seg: S, transicion_seg: T, explicacion_seg: E, demo_estacion_seg: S, demo_transicion_seg: T }
}
function boxLibre(pos) {
  return { kg: null, socio: null, nombre: null, riesgo: null, status: 'free', ejercicio: null, elementos: [], iniciales: null, avatar_url: null, ejercicios: [], entered_at: null, ingreso_at: null, advances_at: null, line_position: pos }
}
function boxOcupado(pos, enteredMs, S, formato, extra) {
  const ejercicios = FORMATOS[formato]
  return {
    kg: 1240, socio: 'Maximiliano R.', nombre: 'Maximiliano', riesgo: { dias: 4, bucket: 'very_good' }, status: 'occupied',
    ejercicio: ejercicios[0], elementos: ['Mancuernas', 'Banda', 'Colchoneta'], iniciales: 'MR', avatar_url: null, ejercicios,
    entered_at: iso(enteredMs), ingreso_at: iso(enteredMs - 47 * 60000), advances_at: iso(enteredMs + (E + S + T) * 1000), line_position: pos, ...extra,
  }
}
// estado → { pos, payload(now) }. `seg` = cuántos segundos lleva el socio en el box.
function escenaEstacion({ pos = 2, seg, S = 1200, formato = 'amrap', total = 5 }) {
  return (now) => {
    const boxes = Array.from({ length: total }, (_, i) => (i + 1 === pos ? boxOcupado(pos, now - seg * 1000, S, formato) : boxLibre(i + 1)))
    return { linea: linea(S), boxes, confirmando: null }
  }
}
const ESCENAS = [
  { nombre: 'sede-fila', url: '/tv/palermo', fila: 4 },
  { nombre: 'sede-fila-larga', url: '/tv/palermo', fila: 7 },
  { nombre: 'llegando', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: 1 }) },
  { nombre: 'explicacion', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: 8 }) },
  { nombre: 'explicacion-tabata3', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: 8, formato: 'tabata3' }) },
  { nombre: 'preparate', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E - 3 }) },
  { nombre: 'estacion-amrap', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 3 }) },
  // AMRAP de 20′ recién arrancado: el reloj muestra 5 caracteres ("20:00" → "19:5x")
  { nombre: 'estacion-amrap-20', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E, formato: 'amrap20' }), espera: 1200 },
  { nombre: 'estacion-tabata', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 5, formato: 'tabata', S: 240 }) },
  { nombre: 'estacion-tabata3', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 5, formato: 'tabata3', S: 240 }) },
  { nombre: 'estacion-emom', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 5, formato: 'emom', S: 600 }) },
  { nombre: 'estacion-emom2', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 5, formato: 'emom2', S: 720 }) },
  { nombre: 'estacion-series', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 3, formato: 'series' }) },
  { nombre: 'estacion-series3', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 3, formato: 'series3' }) },
  { nombre: 'chau', url: '/tv/palermo/a/2', datos: escenaEstacion({ seg: E + 420 + 3, S: 420 }), espera: 3500 },
  { nombre: 'chau-4', url: '/tv/palermo/a/4', datos: escenaEstacion({ pos: 4, seg: E + 420 + 3, S: 420 }), espera: 3500 },
  { nombre: 'resumen', url: '/tv/palermo/a/5', datos: escenaEstacion({ pos: 5, seg: E + 420 + T - 6, S: 420 }) },
]

function payloadSede(now, cuantos = 4) {
  const todos = [
    { id: 'q1', status: 'confirming', socio: 'Maximiliano R.', iniciales: 'MR', avatar_url: null, line_number: 1, confirm_deadline: iso(now + 88000) },
    { id: 'q2', status: 'waiting', socio: 'Florencia G.', iniciales: 'FG', avatar_url: null, line_number: null },
    { id: 'q3', status: 'waiting', socio: 'Bartolomé I.', iniciales: 'BI', avatar_url: null, line_number: null },
    { id: 'q4', status: 'waiting', socio: 'Ana P.', iniciales: 'AP', avatar_url: null, line_number: null },
    { id: 'q5', status: 'waiting', socio: 'Joaquín M.', iniciales: 'JM', avatar_url: null, line_number: null },
    { id: 'q6', status: 'waiting', socio: 'Lucía F.', iniciales: 'LF', avatar_url: null, line_number: null },
    { id: 'q7', status: 'waiting', socio: 'Tomás B.', iniciales: 'TB', avatar_url: null, line_number: null },
  ]
  const fila = todos.slice(0, cuantos)
  const ln = (id, n, nombre) => ({
    id, name: nombre, line_number: n, ocupados: 5, modo_demo: false, estacion_seg: 420, transicion_seg: 30, explicacion_seg: 60, demo_estacion_seg: 60, demo_transicion_seg: 30,
    box1: { status: 'occupied', entered_at: iso(now - 30000), advances_at: iso(now + 488000) },
    box1_socio: null,
    boxes: [1, 2, 3, 4, 5].map((p) => ({ status: 'occupied', iniciales: 'XY', avatar_url: null, line_position: p })),
  })
  return { fila, sede: { id: LOCATION, name: 'Palermo' }, lineas: [ln(4, 1, 'LINEA A'), ln(5, 2, 'LINEA B')] }
}

// ── Medición dentro de la página ─────────────────────────────────────────────────────────
// Por cada dígito visible: su tinta (measureText con la fuente calculada) y el rectángulo que lo
// recorta (intersección de ancestros con overflow ≠ visible + la ventana). "Cortado" = la tinta
// toca el recorte pero no entra entera. Uno que queda afuera del todo (el número que rueda en el
// cambio de estación) está escondido a propósito y no cuenta.
const MEDIR = (TOL) => {
  const ctx = document.createElement('canvas').getContext('2d')
  const vw = window.innerWidth, vh = window.innerHeight
  const visible = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false
    }
    return true
  }
  const recorte = (el) => {
    let r = { l: 0, t: 0, r: vw, b: vh }
    for (let e = el.parentElement ? el : null; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e)
      const ox = cs.overflowX !== 'visible', oy = cs.overflowY !== 'visible'
      if (!ox && !oy) continue
      const b = e.getBoundingClientRect()
      const k = e.offsetWidth ? b.width / e.offsetWidth : 1
      const bl = parseFloat(cs.borderLeftWidth) * k, bt = parseFloat(cs.borderTopWidth) * k
      const br = parseFloat(cs.borderRightWidth) * k, bb = parseFloat(cs.borderBottomWidth) * k
      if (ox) { r.l = Math.max(r.l, b.left + bl); r.r = Math.min(r.r, b.right - br) }
      if (oy) { r.t = Math.max(r.t, b.top + bt); r.b = Math.min(r.b, b.bottom - bb) }
    }
    return r
  }
  const out = []
  const tintas = [] // { nodo, ink, digito, texto }
  const caja = (r) => [r.l, r.t, r.r, r.b].map(Math.round)
  const walker = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = n.nodeValue
    if (!txt.trim()) continue
    const el = n.parentElement
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const font = `${cs.fontSize} ${cs.fontFamily.split(',')[0]}`
    const clip = recorte(el)
    const texto = txt.trim().slice(0, 30)
    let adentro = 0, afuera = 0, parcial = 0, peor = null
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i]
      if (/\s/.test(ch)) continue
      const range = document.createRange()
      range.setStart(n, i); range.setEnd(n, i + 1)
      const rr = range.getBoundingClientRect()
      if (!rr.width && !rr.height) continue
      const m = ctx.measureText(ch)
      const alto = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
      const s = alto ? rr.height / alto : 1
      const base = rr.top + m.fontBoundingBoxAscent * s
      const ink = { l: rr.left - m.actualBoundingBoxLeft * s, r: rr.left + m.actualBoundingBoxRight * s, t: base - m.actualBoundingBoxAscent * s, b: base + m.actualBoundingBoxDescent * s }
      const digito = /\d/.test(ch)
      // Los números cuentan desde la tolerancia; el resto del texto desde 2 px (acentos y
      // antialias que rozan el borde de una tarjeta).
      const tol = digito ? TOL : 2
      const toca = ink.r > clip.l && ink.l < clip.r && ink.b > clip.t && ink.t < clip.b
      const entra = ink.l >= clip.l - tol && ink.r <= clip.r + tol && ink.t >= clip.t - tol && ink.b <= clip.b + tol
      if (entra) adentro++
      else if (toca) parcial++
      else afuera++
      if (!entra) {
        const falta = Math.max(clip.l - ink.l, ink.r - clip.r, clip.t - ink.t, ink.b - clip.b)
        if (!peor || (toca && !peor.toca) || (toca === peor.toca && falta > peor.falta)) peor = { ch, falta, ink, toca }
      }
      if (toca) tintas.push({ nodo: n, ink, digito, ch, texto, font })
    }
    // Cortado: algún carácter visible a medias, o parte del texto adentro y parte afuera (una línea
    // que se cae de la tarjeta o de la pantalla). Todo afuera = escondido a propósito (el número que
    // rueda en el cambio de estación).
    if (parcial > 0 || (adentro > 0 && afuera > 0)) {
      out.push({ tipo: 'cortado', texto, ch: peor.ch, falta: Math.round(peor.falta * 10) / 10, font, ink: caja(peor.ink), clip: caja(clip) })
    }
  }
  // Un número que se monta sobre otro texto (interlineado demasiado justo, o que se pasa a la
  // columna de al lado): tintas de nodos distintos que se pisan más de 2 px en los dos ejes.
  const PISA = 2
  const vistos = new Set()
  for (const a of tintas) {
    if (!a.digito) continue
    for (const b of tintas) {
      if (b.nodo === a.nodo) continue
      const dx = Math.min(a.ink.r, b.ink.r) - Math.max(a.ink.l, b.ink.l)
      const dy = Math.min(a.ink.b, b.ink.b) - Math.max(a.ink.t, b.ink.t)
      if (dx > PISA && dy > PISA) {
        const k = `${a.texto}|${b.texto}`
        if (vistos.has(k)) continue
        vistos.add(k)
        out.push({ tipo: 'pisado', texto: a.texto, ch: a.ch, otro: b.texto, falta: Math.round(Math.min(dx, dy)), font: a.font, ink: [a.ink.l, a.ink.t, a.ink.r, a.ink.b].map(Math.round), clip: [b.ink.l, b.ink.t, b.ink.r, b.ink.b].map(Math.round) })
      }
    }
  }
  return out.map(({ nodo, ...o }) => o)
}

const browser = await chromium.launch({ executablePath: chromeLocal() })
let fallos = 0
if (OUT) mkdirSync(OUT, { recursive: true })
// 1920×1080, una TV con la barra del navegador a la vista (~990) y el lienzo más bajo que admite LienzoTv (900).
const VIEWPORTS = (process.env.VIEWPORTS || '1920x1080,1920x990,1920x900').split(',').map((v) => v.split('x').map(Number))
for (const [vw, vh] of VIEWPORTS) for (const esc of ESCENAS) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, reducedMotion: 'no-preference' })
  await ctx.route(/\/realtime\/v1\//, (r) => r.abort())
  await ctx.route(/\/rest\/v1\/rpc\/(ahora|tv_linea|tv_sede|tv_resolver)/, async (route) => {
    const fn = route.request().url().match(/rpc\/(\w+)/)[1]
    const now = Date.now()
    let body
    if (fn === 'ahora') body = JSON.stringify(iso(now))
    else if (fn === 'tv_resolver') body = JSON.stringify({ sede: 'Palermo', line_id: 4, location_id: LOCATION })
    else if (fn === 'tv_sede') body = JSON.stringify(payloadSede(now, esc.fila))
    else body = JSON.stringify(esc.datos ? esc.datos(now) : { linea: linea(420), boxes: [], confirmando: null })
    route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  if (SIN_FUENTE) await ctx.route(/\.woff2?(\?|$)/, (r) => r.abort())
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]))
  await page.goto(BASE + esc.url, { waitUntil: 'load' })
  await page.waitForTimeout(esc.espera || 2500)
  const fuentes = await page.evaluate(async () => {
    await document.fonts.ready
    return { geist: document.fonts.check("700 40px 'Geist'"), mono: document.fonts.check("600 40px 'Geist Mono'"), cargadas: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`) }
  })
  const cortes = await page.evaluate(MEDIR, TOL)
  const texto = await page.evaluate(() => (document.getElementById('root')?.innerText || '').replace(/\s+/g, ' ').slice(0, 90))
  if (OUT) await page.screenshot({ path: join(OUT, `${esc.nombre}-${vw}x${vh}.png`) })
  const sinFuente = !SIN_FUENTE && !(fuentes.cargadas.some((f) => /^"?Geist"?\s/.test(f)) && fuentes.cargadas.some((f) => /Geist Mono/.test(f)))
  const vacio = !/\d/.test(texto)
  const mal = cortes.length > 0 || errs.length > 0 || sinFuente || vacio
  if (mal) fallos++
  console.log(`${mal ? '✗' : '✓'} ${vw}×${vh} ${esc.nombre.padEnd(20)} ${texto.slice(0, 60)}`)
  if (sinFuente) console.log(`    sin Geist/Geist Mono cargadas (cargadas: ${fuentes.cargadas.join(', ') || 'ninguna'})`)
  if (vacio) console.log('    la pantalla no muestra ningún número (¿no levantó la escena?)')
  for (const c of cortes) {
    if (c.tipo === 'cortado') console.log(`    cortado "${c.ch}" de "${c.texto}" (${c.font}) — ${c.falta}px afuera · tinta ${c.ink} · recorte ${c.clip}`)
    else console.log(`    pisado "${c.ch}" de "${c.texto}" (${c.font}) sobre "${c.otro}" — ${c.falta}px · tinta ${c.ink} · otro ${c.clip}`)
  }
  for (const e of errs) console.log(`    error: ${e}`)
  await ctx.close()
}
await browser.close()
if (server.listening) server.close()
console.log(fallos ? `\n✗ ${fallos} pantalla(s) con números cortados o sin fuente` : '\n✓ ningún número cortado en las TVs')
process.exit(fallos ? 1 : 0)
