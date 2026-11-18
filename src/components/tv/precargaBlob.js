// Videos de la estación bajados enteros a memoria antes de usarlos (2026-11-18), como hace el sistema viejo
// en las mismas Samsung (boxes.js: XHR responseType 'blob' + URL.createObjectURL al llegar el socio al box).
// Así, mientras la persona entrena, la TV no pide nada por la red: no hay pedidos por rangos que se queden
// colgados. Sólo para las TVs de la sala (UN_VIDEO). XHR y no fetch: Chrome 47.
//
// Una página https no puede pedir por XHR un http (contenido mixto activo): los videos del server local del
// gimnasio (prueba 4) se reproducen directo, sin blob. Control: scripts/check-tv-un-video.mjs.
const cache = new Map() // src → { url, estado: 'bajando' | 'listo' | 'error', usado }
const MAX = 24

function podar() {
  if (cache.size <= MAX) return
  const viejos = [...cache.entries()].filter(([, v]) => v.estado !== 'bajando').sort((a, b) => a[1].usado - b[1].usado)
  for (const [src, v] of viejos.slice(0, cache.size - MAX)) {
    try { if (v.url) URL.revokeObjectURL(v.url) } catch (e) { /* nada */ }
    cache.delete(src)
  }
}

export function precargable(src) {
  if (!src || typeof window === 'undefined') return false
  return !(window.location.protocol === 'https:' && /^http:/i.test(src))
}

export function precargarVideos(srcs = []) {
  const lista = srcs.filter((s) => precargable(s) && !cache.has(s))
  let activos = 0
  const siguiente = () => {
    while (activos < 2 && lista.length) {
      const src = lista.shift()
      const entrada = { url: null, estado: 'bajando', usado: Date.now() }
      cache.set(src, entrada)
      activos++
      try {
        const x = new XMLHttpRequest()
        x.open('GET', src, true)
        x.responseType = 'blob'
        x.onload = () => {
          if (x.status === 200 || x.status === 206) { entrada.url = URL.createObjectURL(x.response); entrada.estado = 'listo' } else entrada.estado = 'error'
          activos--; siguiente(); podar()
        }
        x.onerror = () => { entrada.estado = 'error'; activos--; siguiente() }
        x.send()
      } catch (e) { entrada.estado = 'error'; activos-- }
    }
  }
  siguiente()
}

// La URL en memoria si ya terminó de bajar; si no, null (se usa la de red, como antes).
export function blobDe(src) {
  const e = src && cache.get(src)
  if (!e || e.estado !== 'listo') return null
  e.usado = Date.now()
  return e.url
}

export function __precargaDebug() {
  return [...cache.entries()].map(([src, v]) => ({ src: src.split('/').slice(-3).join('/'), estado: v.estado }))
}
if (typeof window !== 'undefined') window.__tvPrecarga = __precargaDebug
