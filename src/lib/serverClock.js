// Reloj del servidor para las pantallas (2026-09-30).
//
// Cada dispositivo contaba contra su propio Date.now() y los timestamps del servidor
// (entered_at, advances_at, confirm_deadline): el teléfono corría ~10 s adelantado respecto
// de la TV. Ahora se pide `ahora()` (RPC pública, now() del servidor) 3 veces al cargar y cada
// 60 s, y se calcula el corrimiento con la muestra de menor RTT (la que menos error de red
// arrastra): offset = serverMs - (t0 + t1) / 2. serverNow() = Date.now() + offset.
//
// Contrato compartido con la app (mismos nombres: `ahora()` en la base, `serverNow()` acá).
// Todo lo de cola/fase/cuenta regresiva de la TV usa serverNow(), nunca Date.now() crudo.
//
// supabase se importa adentro de muestrear() (no arriba) para que este módulo —y tvClock.js,
// que lo importa— se pueda cargar desde Node en scripts/check-tvclock-phases.mjs sin
// import.meta.env.

const MUESTRAS = 3
const CADA_MS = 60_000

let offsetMs = 0
let ultimoRttMs = null
let sincronizado = false
const oyentes = new Set()

export function serverNow() {
  return Date.now() + offsetMs
}

export function estadoReloj() {
  return { offsetMs, rttMs: ultimoRttMs, sincronizado }
}

export function suscribirReloj(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

// Pura (testeada): de una lista de { t0, t1, serverMs } elige la de menor RTT y devuelve
// { offsetMs, rttMs }, o null si no hay muestras.
export function calcularOffset(muestras) {
  let mejor = null
  for (const m of muestras) {
    const rtt = m.t1 - m.t0
    if (!mejor || rtt < mejor.rtt) mejor = { rtt, offset: m.serverMs - (m.t0 + m.t1) / 2 }
  }
  return mejor ? { offsetMs: mejor.offset, rttMs: mejor.rtt } : null
}

export async function sincronizarReloj() {
  let supabase
  try {
    ;({ supabase } = await import('./supabase'))
  } catch {
    return null
  }
  const muestras = []
  for (let i = 0; i < MUESTRAS; i++) {
    const t0 = Date.now()
    try {
      const { data, error } = await supabase.rpc('ahora')
      const t1 = Date.now()
      if (error || !data) continue
      const serverMs = new Date(data).getTime()
      if (Number.isFinite(serverMs)) muestras.push({ t0, t1, serverMs })
    } catch {
      /* sin red: se conserva el offset anterior */
    }
  }
  const r = calcularOffset(muestras)
  if (r) {
    offsetMs = r.offsetMs
    ultimoRttMs = r.rttMs
    sincronizado = true
    oyentes.forEach((fn) => fn(estadoReloj()))
  }
  return r
}

let iniciado = false
export function iniciarRelojServidor() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  sincronizarReloj()
  window.setInterval(sincronizarReloj, CADA_MS)
}

// Arranca solo apenas se importa en el navegador (las TVs lo importan vía tvClock.js).
iniciarRelojServidor()
