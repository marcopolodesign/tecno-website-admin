// The timed work formats, in one place, because three screens read them: the coach writing the
// session, the box screen running the clock, and the app in the member's hand. "Tabata" has to
// mean 8 × (20s, 10s) in all three or the wall and the phone disagree in front of the member.
//
// Mirrors preset_formato() and fase_del_formato() in the database. Duplicated on purpose rather
// than fetched: the box screen has to keep counting through a dropped connection, and a
// countdown that stops because a request failed is worse than one derived locally. Both sides
// are pure functions of elapsed seconds, so they cannot drift apart.

export const FORMATOS = ['Series', 'AMRAP', 'EMOM', 'Tabata']

export const PRESETS = {
  // AMRAP is one round with a cap: as many rounds as possible inside the time.
  AMRAP: { rondas: 1, trabajoSeg: 480, descansoSeg: 0 },
  // EMOM has no stored rest — the rest is whatever is left of the minute after the reps.
  EMOM: { rondas: 10, trabajoSeg: 60, descansoSeg: 0 },
  Tabata: { rondas: 8, trabajoSeg: 20, descansoSeg: 10 },
}

export const esPorTiempo = (formato) => Boolean(formato) && formato !== 'Series'

export function duracionSeg({ rondas, trabajoSeg, descansoSeg }) {
  if (!rondas || !trabajoSeg) return 0
  return rondas * (trabajoSeg + (descansoSeg || 0))
}

export function comoTexto(formato, { rondas, trabajoSeg, descansoSeg } = {}) {
  if (!esPorTiempo(formato)) return null
  if (formato === 'AMRAP') return `AMRAP ${Math.round(trabajoSeg / 60)}′`
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
