// The timed work formats, in one place, because three screens read them: the coach writing the
// session, the box screen running the clock, and the app in the member's hand. "Tabata" has to
// mean 8 × (20s, 10s) in all three or the wall and the phone disagree in front of the member.
//
// Mirrors preset_formato() and fase_del_formato() in the database. Duplicated on purpose rather
// than fetched: the box screen has to keep counting through a dropped connection, and a
// countdown that stops because a request failed is worse than one derived locally. Both sides
// are pure functions of elapsed seconds, so they cannot drift apart.

export const FORMATOS = ['Series', 'AMRAP', 'EMOM', 'Tabata', 'A completar']

// Una estación dura seis minutos. No es una preferencia de diseño: es el reloj con el que la
// cola hace avanzar a la gente de box en box, así que una estación más larga no se alarga —
// se corta, con el socio a mitad de la última vuelta y la línea entera corrida.
//
// Vive acá y no en el generador porque son dos caminos hacia la misma tabla: el generador
// arma el mes solo y el coach escribe las primeras sesiones a mano. El tope lo tenía escrito
// únicamente el generador, y a mano se podía guardar cualquier cosa.
export const BLOQUE_SEG = 360

export const PRESETS = {
  // AMRAP is one round with a cap: as many rounds as possible inside the time.
  AMRAP: { rondas: 1, trabajoSeg: BLOQUE_SEG, descansoSeg: 0 },
  // EMOM has no stored rest — the rest is whatever is left of the minute after the reps.
  EMOM: { rondas: 6, trabajoSeg: 60, descansoSeg: 0 },
  Tabata: { rondas: 8, trabajoSeg: 20, descansoSeg: 10 },
  // Sin estructura fija: el coach carga los ejercicios que quiera (sin el tope de 3 de AMRAP)
  // y describe la submodalidad a mano en las notas (ej. "escalera 1-1-2-2-3-3"). El bloque de
  // seis minutos es el mismo que el resto de los formatos por tiempo.
  'A completar': { rondas: 1, trabajoSeg: BLOQUE_SEG, descansoSeg: 0 },
}

export const esPorTiempo = (formato) => Boolean(formato) && formato !== 'Series'

export function duracionSeg({ rondas, trabajoSeg, descansoSeg }) {
  if (!rondas || !trabajoSeg) return 0
  return rondas * (trabajoSeg + (descansoSeg || 0))
}

/**
 * Lo que dura la estación entera: la suma de sus filas con reloj.
 *
 * Se mide por estación y no por ejercicio porque el socio no cambia de box entre un ejercicio
 * y el siguiente — hace el circuito completo y recién ahí avanza. Tres filas de dos minutos
 * son seis minutos de box, y mirando fila por fila las tres pasan el control.
 *
 * Series no suma: no tiene reloj, la carga y las repeticiones las administra el socio dentro
 * del turno.
 */
export function duracionEstacionSeg(filas) {
  return (filas || []).reduce(
    (total, f) => total + (esPorTiempo(f?.formato) ? duracionSeg(f) : 0),
    0
  )
}

export function comoTexto(formato, { rondas, trabajoSeg, descansoSeg } = {}) {
  if (!esPorTiempo(formato)) return null
  if (formato === 'AMRAP') return `AMRAP ${Math.round(trabajoSeg / 60)}′`
  if (formato === 'A completar') return `A completar ${Math.round(trabajoSeg / 60)}′`
  if (formato === 'EMOM') return `EMOM ${rondas}′`
  return `${formato} ${rondas}×${trabajoSeg}/${descansoSeg}`
}

export function mmss(segundos) {
  const s = Math.max(0, Math.round(segundos))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Which round, working or resting, and how much of the current phase is left — from elapsed
// seconds, never from a counter. A wall screen is a background tab as far as the browser is
// concerned, so anything that counts by incrementing has drifted by the eighth round.
export function faseDelFormato(transcurridoSeg, { rondas, trabajoSeg, descansoSeg }) {
  const ciclo = trabajoSeg + (descansoSeg || 0)
  if (!ciclo || !rondas) return null
  const total = rondas * ciclo
  if (transcurridoSeg >= total) {
    return { ronda: rondas, fase: 'fin', restanteSeg: 0, terminado: true }
  }
  const dentro = transcurridoSeg % ciclo
  const trabajando = dentro < trabajoSeg
  return {
    ronda: Math.floor(transcurridoSeg / ciclo) + 1,
    fase: trabajando ? 'trabajo' : 'descanso',
    restanteSeg: trabajando ? trabajoSeg - dentro : ciclo - dentro,
    terminado: false,
  }
}
