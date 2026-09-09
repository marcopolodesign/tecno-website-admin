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
  // 12 × (20+10) = 6:00 exacto. Antes eran 8 rondas (4:00) — el default dejaba 2:00 de la
  // estación sin usar hasta que el coach subiera "Rondas" a mano; ningún otro preset tiene
  // este problema (EMOM/AMRAP/A completar ya cierran justo en 6:00 desde el default).
  Tabata: { rondas: 12, trabajoSeg: 20, descansoSeg: 10 },
  // Sin estructura fija: el coach carga los ejercicios que quiera (sin el tope de 3 de AMRAP)
  // y describe la submodalidad a mano en las notas (ej. "escalera 1-1-2-2-3-3"). El bloque de
  // seis minutos es el mismo que el resto de los formatos por tiempo.
  'A completar': { rondas: 1, trabajoSeg: BLOQUE_SEG, descansoSeg: 0 },
}

// Cuántos ejercicios distintos arma un circuito por tiempo, y qué dice cada vuelta en vez de
// "3x12" — un circuito corre con UN reloj compartido por todas sus filas (ver SelectorFormato),
// así que "series x reps" por ejercicio no significa nada ahí: confundía al coach armando el
// circuito a mano ("¿por qué me pide reps si esto es por tiempo?"). Serie/A completar no tienen
// cupo fijo — el coach carga los que quiera. Debe coincidir con CIRCUITO en
// routineGenerationService.js (ejercicios/reps) — están duplicados a propósito, igual que los
// PRESETS de arriba, no por descuido.
export const CUPO_POR_FORMATO = { Tabata: 4, EMOM: 3, AMRAP: 4 }
export const REPS_POR_FORMATO = { Tabata: 'máx por ronda', EMOM: '10 por minuto', AMRAP: '10 por vuelta' }

export const esPorTiempo = (formato) => Boolean(formato) && formato !== 'Series'

export function duracionSeg({ rondas, trabajoSeg, descansoSeg }) {
  if (!rondas || !trabajoSeg) return 0
  return rondas * (trabajoSeg + (descansoSeg || 0))
}

/**
 * Lo que dura la estación entera.
 *
 * La modalidad es de la ESTACIÓN, no de cada ejercicio: todas las filas de una misma estación
 * comparten formato/rondas/trabajoSeg/descansoSeg (se sincronizan al guardar cualquiera de
 * ellas), así que el tiempo de la estación es el de UNA fila cualquiera — sumar como antes
 * multiplicaba el tiempo por la cantidad de ejercicios cargados (tres ejercicios en AMRAP 6:00
 * daban 18:00 de estación, que no existe).
 *
 * Series no cuenta: no tiene reloj, la carga y las repeticiones las administra el socio dentro
 * del turno.
 */
export function duracionEstacionSeg(filas) {
  const primera = (filas || [])[0]
  if (!primera || !esPorTiempo(primera.formato)) return 0
  return duracionSeg(primera)
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

// ─────────────────────────────────────────────────────────────────────────────
// EMOM: qué entra en un minuto
//
// "Cada minuto, en el minuto" no dice cuántos ejercicios entran en ese minuto. Puede ser uno
// solo repetido seis veces, o "10 push ups + 30s de plancha" juntos adentro del mismo minuto.
// Las dos son EMOM y se arman igual de seguido, así que es el coach el que tiene que poder
// decirlo — antes la estación guardaba tres ejercicios y seis rondas y las dos lecturas eran
// igual de válidas mirando la fila.
//
// La estación guarda `ejerciciosPorMinuto`; cada fila guarda `segundosPorEjercicio` (null = va
// por repeticiones). De esos dos sale todo lo demás, incluido el texto que ya leen la TV, la
// app y las listas del admin.
// ─────────────────────────────────────────────────────────────────────────────

export const EMOM_MIN_POR_MINUTO = 1
export const EMOM_MAX_POR_MINUTO = 6
export const MINUTO_SEG = 60

/**
 * El texto de una fila del circuito: "10 reps", "30s".
 *
 * Es lo que se guarda en `sets_reps`, que es donde ya miran la TV, la app y el admin. Derivarlo
 * en vez de guardar una etiqueta suelta es lo que hace que una pantalla que no sabe nada de
 * EMOM por minuto igual muestre algo correcto.
 */
export function prescripcionTexto({ segundos, reps } = {}) {
  if (segundos) return `${segundos}s`
  if (reps) return `${reps} reps`
  return ''
}

/**
 * Cómo se reparten los ejercicios de la estación entre los minutos.
 *
 * Con 4 ejercicios y 2 por minuto, el minuto 1 es A+B y el 2 es C+D — y como el EMOM dura seis
 * minutos, en el 3 vuelve a empezar por A+B. Devuelve los grupos en orden; el que corre el
 * reloj sólo tiene que ir tomando `grupos[minuto % grupos.length]`.
 */
export function gruposDelMinuto(filas, ejerciciosPorMinuto) {
  const lista = filas || []
  const porMinuto = Math.max(EMOM_MIN_POR_MINUTO, ejerciciosPorMinuto || 1)
  const grupos = []
  for (let i = 0; i < lista.length; i += porMinuto) {
    grupos.push(lista.slice(i, i + porMinuto))
  }
  return grupos
}

/** Los ejercicios que le tocan a un minuto concreto (1 = el primero). */
export function filasDelMinuto(filas, ejerciciosPorMinuto, minuto) {
  const grupos = gruposDelMinuto(filas, ejerciciosPorMinuto)
  if (!grupos.length) return []
  return grupos[(Math.max(1, minuto) - 1) % grupos.length]
}

/**
 * Los segundos que el coach dejó escritos dentro de un minuto.
 *
 * Sólo suma lo prescripto POR TIEMPO: las repeticiones no tienen duración fija — diez push ups
 * son veinte segundos o cuarenta según quién los haga — así que el sistema nunca sabe de verdad
 * cuánto dura el minuto. Por eso esto alcanza para avisar que se pasó, y no para prohibirlo.
 */
export function segundosCargados(filas) {
  return (filas || []).reduce((acc, f) => acc + (Number(f.segundosPorEjercicio ?? f.segundos_por_ejercicio) || 0), 0)
}

/** Lo que queda del minuto después del trabajo cargado. Negativo = se pasó. */
export function sobranteDelMinuto(filas) {
  return MINUTO_SEG - segundosCargados(filas)
}

/**
 * El minuto contado como lo diría un coach: "10 reps Push ups + 30s Plancha".
 *
 * `nombreDe` lo pasa quien llama porque el nombre del ejercicio vive en distintos lugares según
 * la pantalla (el admin lo tiene embebido, la TV lo recibe en el payload de la línea).
 */
export function resumenDelMinuto(filas, nombreDe = (f) => f.nombre) {
  return (filas || [])
    .map((f) => {
      const texto = prescripcionTexto({
        segundos: f.segundosPorEjercicio ?? f.segundos_por_ejercicio,
        reps: f.reps,
      })
      const nombre = nombreDe(f)
      return [texto, nombre].filter(Boolean).join(' ')
    })
    .filter(Boolean)
    .join(' + ')
}
