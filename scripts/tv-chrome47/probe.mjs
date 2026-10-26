// Abre las pantallas de TV en un Chromium "rebajado" a Chrome 47 y reporta errores y contenido.
import { chromium } from 'playwright-core'
const [base, out, sinGrid] = [process.argv[2], process.argv[3], process.argv[4] === 'singrid']
const exe = process.env.HOME + '/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
const EMU = `(() => {
  const borrar = (o, ks) => ks.forEach(k => { try { delete o[k] } catch (e) {} ; try { if (k in o) Object.defineProperty(o, k, { value: undefined, configurable: true, writable: true }) } catch (e) {} })
  borrar(window, ['Proxy','Reflect','queueMicrotask','structuredClone','ResizeObserver','IntersectionObserver','PerformanceObserver','customElements','WeakRef','FinalizationRegistry','BigInt'])
  borrar(Object, ['entries','values','fromEntries','getOwnPropertyDescriptors','hasOwn'])
  borrar(Array.prototype, ['flat','flatMap','at','findLast'])
  borrar(String.prototype, ['padStart','padEnd','replaceAll','trimStart','trimEnd','matchAll','at'])
  borrar(Promise.prototype, ['finally']); borrar(Promise, ['allSettled','any'])
  borrar(NodeList.prototype, ['forEach']); borrar(Element.prototype, ['append','prepend','replaceChildren','toggleAttribute'])
  const sup = CSS.supports.bind(CSS)
  CSS.supports = function (a, b) { const t = String(a) + ' ' + String(b); if (/grid|--|gap|aspect-ratio|inset|clamp/.test(t)) return false; return sup(a, b) }
})()`
const browser = await chromium.launch({ executablePath: exe })
const urls = (process.env.URLS || '/tv/palermo,/tv/palermo/a,/tv/palermo/a/1,/tv/palermo/b/2').split(',')
for (const u of urls) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 3.0) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/2.0 Chrome/47.0.2526.69 TV safari/537.36' })
  await ctx.addInitScript(EMU)
  if (process.env.LIVE) await ctx.route(/^https?:\/\/[^/]+\/[^.]*$/, async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue()
    const r = await route.fetch(); let b = await r.text()
    b = b.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, '').replace(/ nomodule/g, '')
    await route.fulfill({ response: r, body: b })
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + e.message.split('\n')[0]))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.goto(base + u + (sinGrid ? '?sin-grid=1&sin-gap=1&sin-vars=1' : ''), { waitUntil: 'load' }).catch(e => errs.push('goto ' + e.message))
  await page.waitForTimeout(9000)
  const txt = await page.evaluate(() => (document.getElementById('root')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160))
  const legacy = await page.evaluate(() => !!document.querySelector('script[data-src*="legacy"]') || [...document.scripts].some(s => /legacy/.test(s.src)))
  await page.screenshot({ path: `${out}-${u.replace(/\//g, '_')}.png` })
  console.log(`\n${u} legacy=${legacy}\n  texto: ${txt || '(VACÍO)'}\n  ${[...new Set(errs)].slice(0, 6).join('\n  ') || 'sin errores'}`)
  await ctx.close()
}
await browser.close()
