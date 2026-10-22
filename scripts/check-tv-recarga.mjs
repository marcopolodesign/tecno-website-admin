// Control (2026-10-22): una TV en el cartel de error a pantalla completa se recarga sola
// (1 min, y si vuelve a caer 2, 4… hasta 10 min). Falla si no avisa, si no recarga o si la espera no crece.
// Tarda ~80 s (tiempo real: el reloj simulado de Playwright también dispara el error forzado).
// Uso: npx vite build && npm i --no-save playwright-core && node scripts/check-tv-recarga.mjs [base]
//   base por defecto: sirve ./dist en un puerto local con scripts/tv-chrome47/server.mjs.
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const exe = process.env.CHROME || process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
let base = process.argv[2]
let server = null
if (!base) {
  const port = process.env.PORT || '4793'
  server = spawn('node', ['scripts/tv-chrome47/server.mjs', 'dist', '/tmp/tv-recarga.log'], { env: { ...process.env, PORT: port }, stdio: 'ignore' })
  base = `http://localhost:${port}`
  await new Promise((r) => setTimeout(r, 1500))
}

const fallas = []
const browser = await chromium.launch({ executablePath: exe })
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await ctx.newPage()
  let cargas = 0
  page.on('load', () => { cargas++ })
  const url = `${base}/tv/palermo/a/1?tv-error-prueba=render`
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(8000)
  const txt = await page.evaluate(() => (document.getElementById('tv-reporte-cartel') || {}).innerText || '')
  if (!/Se vuelve a cargar sola en 1 min/.test(txt)) fallas.push('el cartel no avisa "Se vuelve a cargar sola en 1 min": ' + JSON.stringify(txt.slice(0, 200)))
  const antes = cargas
  await page.waitForTimeout(62000)
  if (cargas <= antes) fallas.push('no se recargó sola al minuto')
  await page.waitForTimeout(8000)
  const segunda = await page.evaluate(() => (window.__tvRecargaEn ? window.__tvRecargaEn() : 0))
  if (segunda !== 120) fallas.push(`después de una recarga la espera tendría que ser 120 s y es ${segunda}`)
} finally {
  await browser.close()
  if (server) server.kill()
}

if (fallas.length) {
  console.error('check-tv-recarga: FALLA')
  for (const f of fallas) console.error('  - ' + f)
  process.exit(1)
}
console.log('check-tv-recarga: OK (avisa, recarga al minuto y la espera crece)')
