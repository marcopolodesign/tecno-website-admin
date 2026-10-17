// Prueba del aviso de errores de la TV (script inline de index.html + TvErrorBoundary) en el Chromium
// rebajado a Chrome 47. Fuerza cada tipo de error con ?tv-error-prueba=..., espera el cartel en
// pantalla y el envío a Sentry, y saca captura. Sin error, confirma que no aparece ningún cartel.
//   node scripts/tv-chrome47/aviso.mjs http://localhost:4747 /tmp/tv-aviso [/tv/palermo/A/1]
//   node scripts/tv-chrome47/aviso.mjs https://tv.somostecnofit.com /tmp/tv-aviso-live /palermo/A/1
// SIN_ENVIO=1 corta el pedido a Sentry (lo registra igual) para no ensuciar el proyecto.
import { chromium } from 'playwright-core'
const [base, out, ruta = '/tv/palermo/A/1'] = process.argv.slice(2)
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const UA = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 3.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.0 Chrome/47.0.2526.69 TV safari/537.36'
const EMU = `(() => {
  const borrar = (o, ks) => ks.forEach(k => { try { delete o[k] } catch (e) {} ; try { if (k in o) Object.defineProperty(o, k, { value: undefined, configurable: true, writable: true }) } catch (e) {} })
  borrar(window, ['Proxy','Reflect','queueMicrotask','structuredClone','ResizeObserver','IntersectionObserver','PerformanceObserver','customElements','WeakRef','FinalizationRegistry','BigInt'])
  borrar(Object, ['entries','values','fromEntries','getOwnPropertyDescriptors','hasOwn'])
  borrar(Array.prototype, ['flat','flatMap','at','findLast'])
  borrar(String.prototype, ['padStart','padEnd','replaceAll','trimStart','trimEnd','matchAll','at'])
  borrar(Promise.prototype, ['finally']); borrar(Promise, ['allSettled','any'])
  borrar(NodeList.prototype, ['forEach']); borrar(Element.prototype, ['append','prepend','replaceChildren','toggleAttribute'])
})()`

const casos = (process.env.CASOS || 'ninguno,onerror,promesa,render').split(',')
const browser = await chromium.launch({ executablePath: exe })
let fallas = 0
for (const caso of casos) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: UA })
  await ctx.addInitScript(EMU)
  // Como Chrome 47: sin ES modules, sólo corre el bundle nomodule.
  await ctx.route(/^https?:\/\/[^/]+\/[^.]*$/, async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue()
    const r = await route.fetch(); let b = await r.text()
    b = b.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, '').replace(/ nomodule/g, '')
    await route.fulfill({ response: r, body: b })
  })
  const envios = []
  await ctx.route(/ingest\.us\.sentry\.io/, async (route) => {
    const lineas = (route.request().postData() || '').split('\n')
    let ev = {}; try { ev = JSON.parse(lineas[2]) } catch (e) {}
    envios.push(ev)
    if (process.env.SIN_ENVIO) return route.fulfill({ status: 200, body: '{}' })
    const r = await route.fetch(); envios[envios.length - 1].__status = r.status(); await route.fulfill({ response: r })
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]))
  const url = base + ruta + (caso === 'ninguno' ? '' : '?tv-error-prueba=' + caso)
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(9000)
  const cartel = await page.evaluate(() => {
    const c = document.getElementById('tv-reporte-cartel')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { texto: c.innerText.replace(/\s+/g, ' ').slice(0, 300), alto: Math.round(r.height) }
  })
  const legacy = await page.evaluate(() => !document.querySelector('script[type="module"]'))
  await page.screenshot({ path: `${out}-${caso}.png` })
  const ev = envios[0]
  const ok = caso === 'ninguno' ? !cartel && envios.length === 0 : !!cartel && !!ev && ev.tags && ev.tags.superficie === 'tv'
  if (!ok) fallas++
  console.log(`\n[${ok ? 'OK' : 'FALLA'}] ${caso} legacy=${legacy}`)
  console.log('  cartel:', cartel ? `${cartel.alto}px — ${cartel.texto}` : '(ninguno)')
  if (ev) console.log('  sentry:', ev.__status || 'cortado', JSON.stringify({ id: ev.event_id, tags: ev.tags, user: ev.user, value: ev.exception && ev.exception.values[0].value, frames: ev.exception && ev.exception.values[0].stacktrace && ev.exception.values[0].stacktrace.frames.length }))
  if (errs.length) console.log('  pageerror:', [...new Set(errs)].slice(0, 4).join(' | '))
  await ctx.close()
}
await browser.close()
process.exit(fallas ? 1 : 0)
