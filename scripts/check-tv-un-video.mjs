#!/usr/bin/env node
// "Lo arreglado no vuelve" — control del modo "un video a la vez" (2026-10-23).
//
// Las Samsung Tizen 3.0 de la sala decodifican UN SOLO <video> de HTML5 por vez: la estación de
// 4 ejercicios mostraba 4 <video> autoplay a la vez (una por tarjeta, vía VideoCruzado) y ninguna
// dibujaba — las 4 quedaban en negro. En Chrome de escritorio la misma URL andaba bien.
//
// Este control abre la pantalla de estación (AMRAP de 4 ejercicios, con póster + video hosted en
// cada uno) con el user-agent real de esas Samsung y verifica:
//   1. Nunca más de 1 <video> en el DOM de toda la pantalla, en cualquier momento.
//   2. Cada tarjeta tiene su póster (<img>) puesto, aunque no le toque el turno del video.
//   3. El turno rota: la tarjeta con el video cambia después de REPRODUCIR el intervalo de turno.
//   4. (2026-10-26) La TV ignora `autoplay` (se neutraliza el atributo): el video igual arranca,
//      porque VideoEjercicio llama a play() — antes quedaba el póster quieto.
//   5. (2026-10-26) Un video que no carga NO pierde el turno a los 6 s (antes cada 6 s se desarmaba
//      y se volvía a pedir el archivo) y el aviso inline lo manda a Sentry como VideoNoArranca con
//      readyState, error y src.
// Y, con un user-agent de escritorio normal, que la estación siga mostrando un <video> POR
// tarjeta (4) — el modo viejo no te lo tiene que sacar.
//
// Uso (antes: `npx vite build`):
//   npm i --no-save playwright-core
//   node scripts/check-tv-un-video.mjs                 # usa ./dist
//   DIST=/tmp/tv-dist OUT=/tmp/tv-un-video node scripts/check-tv-un-video.mjs   # + capturas
//   CHROME=/ruta/al/chrome node scripts/check-tv-un-video.mjs
//   BASE=https://tecno-admin-staging-git-…vercel.app node scripts/check-tv-un-video.mjs
import http from 'node:http'
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = process.env.DIST || new URL('../dist/', import.meta.url).pathname
const OUT = process.env.OUT || ''
const SAMSUNG_UA = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 3.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.0 Chrome/47.0.2526.69 TV safari/537.36'
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const TURNO_MS = 10000 // tiene que matchear src/components/tv/turnoVideo.js
const CLIP = readFileSync(new URL('./fixtures/tv-clip.mp4', import.meta.url)) // H.264 Main, 3 s
// La Samsung no hace caso del atributo autoplay (peor caso): sin play() explícito no arranca nunca.
const SIN_AUTOPLAY = `(() => {
  const set = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (n, v) { if (this.tagName === 'VIDEO' && String(n).toLowerCase() === 'autoplay') return; return set.call(this, n, v) }
  Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', { get() { return false }, set() {}, configurable: true })
})()`

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
if (!process.env.BASE) await new Promise((r) => server.listen(0, r))
const BASE = process.env.BASE || `http://localhost:${server.address().port}`

// ── Datos fijos: una estación AMRAP de 4 ejercicios, los 4 con video + póster "ready" ──────
const LOCATION = 'db9a686a-cc72-413e-9c0c-c3058812de60'
const E = 60, T = 30, S = 600
const iso = (ms) => new Date(ms).toISOString()
const NOMBRES = ['Sentadilla búlgara con mancuernas', 'Remo con banda elástica', 'Plancha con toque de hombros', 'Burpees al cajón']
const ej = (i) => ({
  code: `EJ${i}`, name: NOMBRES[i], rondas: 1, formato: 'AMRAP', sets_reps: '12 por vuelta', rest_time: '60s',
  trabajo_seg: S, descanso_seg: 0, exercise_order: i + 1, ejercicios_por_minuto: null, segundos_por_ejercicio: null,
  // "ready": exerciseMedia() devuelve kind:'hosted' con poster + src — el caso real de un
  // ejercicio ya migrado al catálogo nuevo (ver catchup.md 2026-10-22).
  processing_status: 'ready', tv_path: `exercises/ej${i}-tv.mp4`, poster_path: `exercises/ej${i}-poster.jpg`,
  crop_tv: null, recorte_inicio: null, recorte_fin: null,
  video_url: null, video_thumbnail_url: null, video_platform: null, video_embed_id: null,
})
const EXERCISES = [0, 1, 2, 3].map(ej)
function linea() {
  return { id: 4, name: 'LINEA A', modo_demo: false, line_number: 1, location_id: LOCATION, estacion_seg: S, transicion_seg: T, explicacion_seg: E, demo_estacion_seg: S, demo_transicion_seg: T }
}
function boxLibre(pos) {
  return { kg: null, socio: null, nombre: null, riesgo: null, status: 'free', ejercicio: null, elementos: [], iniciales: null, avatar_url: null, ejercicios: [], entered_at: null, ingreso_at: null, advances_at: null, line_position: pos }
}
function boxOcupado(pos, enteredMs) {
  return {
    kg: 1240, socio: 'Maximiliano R.', nombre: 'Maximiliano', riesgo: { dias: 4, bucket: 'very_good' }, status: 'occupied',
    ejercicio: EXERCISES[0], elementos: [], iniciales: 'MR', avatar_url: null, ejercicios: EXERCISES,
    entered_at: iso(enteredMs), ingreso_at: iso(enteredMs - 47 * 60000), advances_at: iso(enteredMs + (E + S + T) * 1000), line_position: pos,
  }
}
// En plena estación (recién arrancada: seg = E + 3) para no depender de esperar la explicación.
function payloadEstacion(now, pos = 2, total = 5) {
  const seg = E + 3
  const boxes = Array.from({ length: total }, (_, i) => (i + 1 === pos ? boxOcupado(pos, now - seg * 1000) : boxLibre(i + 1)))
  return { linea: linea(), boxes, confirmando: null }
}

// video: 'clip' sirve el clip real · 'colgado' deja el pedido sin respuesta (TV que nunca carga)
async function contextoConRuta(browser, userAgent, { video = 'clip', sentry = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent })
  await ctx.route(/\/realtime\/v1\//, (r) => r.abort())
  await ctx.route(/sentry\.io\//, (r) => { sentry.push(r.request().postData() || ''); r.fulfill({ status: 200, body: '{}' }) })
  await ctx.route(/exercise-media\/.*\.mp4/, (r) => {
    if (video === 'colgado') return // nunca responde
    r.fulfill({ status: 200, contentType: 'video/mp4', headers: { 'accept-ranges': 'bytes' }, body: CLIP })
  })
  await ctx.route(/\/rest\/v1\/rpc\/(ahora|tv_linea|tv_sede|tv_resolver)/, async (route) => {
    const fn = route.request().url().match(/rpc\/(\w+)/)[1]
    const now = Date.now()
    let body
    if (fn === 'ahora') body = JSON.stringify(iso(now))
    else if (fn === 'tv_resolver') body = JSON.stringify({ sede: 'Palermo', line_id: 4, location_id: LOCATION })
    else if (fn === 'tv_sede') body = JSON.stringify({ fila: [], sede: { id: LOCATION, name: 'Palermo' }, lineas: [] })
    else body = JSON.stringify(payloadEstacion(now))
    route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  return ctx
}

// Cuenta <video> en toda la pantalla y <img> de póster de ejercicio (exercise-media/…poster…).
// "visibles" excluye el pozo oculto de PrecargaVideos (aria-hidden): ésos no son tarjetas, son
// sólo caché de navegador — en modo un video ni existen (PrecargaVideos no renderiza nada).
const MEDIR = () => {
  const todos = Array.from(document.querySelectorAll('video'))
  const ocultoPrecarga = (v) => {
    for (let e = v; e; e = e.parentElement) {
      if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return true
    }
    return false
  }
  const visibles = todos.filter((v) => !ocultoPrecarga(v))
  const posters = Array.from(document.querySelectorAll('img')).filter((img) => /poster/.test(img.src)).length
  return {
    videosTotal: todos.length,
    videos: visibles.length,
    videoSrcs: visibles.map((v) => v.currentSrc || v.src),
    posters,
  }
}

if (OUT) mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: chromeLocal() })
const fallas = []

try {
  // ── 1) TV vieja (Samsung Tizen 3.0 / Chrome 47) que ignora autoplay, con videos que cargan ──
  {
    const ctx = await contextoConRuta(browser, SAMSUNG_UA)
    await ctx.addInitScript(SIN_AUTOPLAY)
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]))
    await page.goto(`${BASE}/tv/palermo/a/2`, { waitUntil: 'load' })
    await page.waitForTimeout(3000)
    const m1 = await page.evaluate(MEDIR)
    const r1 = await page.evaluate(() => { const v = document.querySelector('video'); return v ? { paused: v.paused, t: v.currentTime, autoplay: v.hasAttribute('autoplay') } : null })
    if (OUT) await page.screenshot({ path: join(OUT, 'samsung-t0.png') })
    console.log(`Samsung t0: ${m1.videosTotal} video(s) — ${m1.posters} póster(es) — ${JSON.stringify(m1.videoSrcs)} — ${JSON.stringify(r1)}`)
    if (m1.videosTotal > 1) fallas.push(`Samsung t0: ${m1.videosTotal} <video> a la vez (tiene que ser ≤ 1)`)
    if (m1.posters < 3) fallas.push(`Samsung t0: sólo ${m1.posters} póster(es) en pantalla — tendría que haber uno por tarjeta sin turno`)
    if (!r1 || r1.paused || r1.t <= 0) fallas.push(`Samsung sin autoplay: el video no arrancó (${JSON.stringify(r1)}) — falta el play() explícito de VideoEjercicio`)

    await page.waitForTimeout(TURNO_MS + 3000)
    const m2 = await page.evaluate(MEDIR)
    if (OUT) await page.screenshot({ path: join(OUT, 'samsung-t1.png') })
    console.log(`Samsung t1 (+${Math.round((TURNO_MS + 3000) / 1000)}s): ${m2.videosTotal} video(s) en el DOM — ${JSON.stringify(m2.videoSrcs)}`)
    if (m2.videosTotal > 1) fallas.push(`Samsung t1: ${m2.videosTotal} <video> a la vez (tiene que ser ≤ 1)`)
    if (m1.videos === 1 && m2.videos === 1 && m1.videoSrcs[0] === m2.videoSrcs[0]) {
      fallas.push('Samsung: el turno no rotó — el video reprodujo el intervalo y sigue siendo el dueño')
    }
    if (errs.length) fallas.push(`Samsung: error(es) de página: ${errs.join(' | ')}`)
    await ctx.close()
  }

  // ── 1b) TV vieja con un video que nunca carga: no rota y avisa a Sentry ─────────────────────
  {
    const sentry = []
    const ctx = await contextoConRuta(browser, SAMSUNG_UA, { video: 'colgado', sentry })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/tv/palermo/a/2`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    const m1 = await page.evaluate(MEDIR)
    await page.waitForTimeout(2 * TURNO_MS + 2000)
    const m2 = await page.evaluate(MEDIR)
    console.log(`Samsung colgado: ${JSON.stringify(m1.videoSrcs)} → ${JSON.stringify(m2.videoSrcs)} — ${sentry.length} envío(s) a Sentry`)
    if (m1.videoSrcs[0] !== m2.videoSrcs[0]) fallas.push('Samsung colgado: el turno pasó con un video que nunca arrancó (vuelve a reiniciar la carga cada 6 s)')
    if (process.env.VERBOSE) for (const b of sentry) console.log('  sentry:', (/"value":"([^"]{0,200})/.exec(b) || [])[1])
    const aviso = sentry.find((b) => b.includes('VideoNoArranca'))
    if (!aviso) fallas.push('Samsung colgado: el aviso inline no mandó VideoNoArranca a Sentry')
    else {
      for (const campo of ['readyState', 'networkState', 'errorCode', 'src', 'video_ready_state']) {
        if (!aviso.includes(campo)) fallas.push(`Samsung colgado: el aviso a Sentry no trae ${campo}`)
      }
      if (!aviso.includes('exercise-media')) fallas.push('Samsung colgado: el aviso a Sentry no trae el src del video')
      if (!aviso.includes('"level":"warning"')) fallas.push('Samsung colgado: el aviso de video tiene que ser warning, no fatal')
    }
    const cartel = await page.evaluate(() => !!document.getElementById('tv-reporte-cartel'))
    if (cartel) fallas.push('Samsung colgado: el video que no arranca pintó el cartel rojo (tiene que ir sólo a Sentry)')
    await ctx.close()
  }

  // ── 2) UA normal: la estación de 4 ejercicios sigue con un video por tarjeta ────────────────
  {
    const ctx = await contextoConRuta(browser, DESKTOP_UA)
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]))
    await page.goto(`${BASE}/tv/palermo/a/2`, { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    const m = await page.evaluate(MEDIR)
    if (OUT) await page.screenshot({ path: join(OUT, 'desktop.png') })
    console.log(`Desktop: ${m.videos} video(s) visibles (+${m.videosTotal - m.videos} de precarga oculta) — ${JSON.stringify(m.videoSrcs)}`)
    if (m.videos !== 4) fallas.push(`Desktop: ${m.videos} <video> visibles (tendrían que ser 4, uno por tarjeta — el modo viejo no debe tocar navegadores modernos)`)
    if (errs.length) fallas.push(`Desktop: error(es) de página: ${errs.join(' | ')}`)
    await ctx.close()
  }
} finally {
  await browser.close()
  server.close()
}

if (fallas.length) {
  console.error('\n✗ check-tv-un-video: FALLA')
  for (const f of fallas) console.error('  - ' + f)
  process.exit(1)
}
console.log('\n✓ check-tv-un-video: OK (Samsung: ≤1 video + póster + arranca sin autoplay + rota tras reproducir · colgado: no rota + Sentry · Desktop: 1 video por tarjeta)')
