import { supabase } from '../lib/supabase'
import { BLOQUE_SEG } from '../lib/formatos'

/**
 * Genera el resto del mes a partir de las sesiones que el coach escribió a mano
 * (botón "Generar Sesiones"/"Regenerar" en Rutinas).
 *
 * Nota para la próxima sesión que mire este archivo: `exercises_catalogo` NO es una tabla
 * separada de `exercises` — es una VIEW sobre la misma tabla (`SELECT ... FROM exercises e`,
 * con `elementos` calculado desde exercise_elementos). Mismo id, mismas columnas de
 * clasificación (patron, musculo, family_code, complejidad_tecnica, intensidad_relativa). Así
 * que leer `exercises` acá abajo (perfilesDeEsfuerzo) y pedir candidatos por
 * `sustitutos_para_ejercicio` (que expone exercises_catalogo) usan exactamente la misma data —
 * no hace falta "migrar" nada entre las dos, y por eso este archivo perdió sin uso cerca de 600
 * líneas heredadas de un diseño de motor anterior (grupos de ejercicio, box_groups, overrides
 * de coach, log de generación...) que nada en la plataforma llama: verificado con grep sobre
 * todo el admin antes de borrarlas, no a ojo.
 *
 * Rendimiento (2026-09-24): generar una rutina hacía ~55 ida-y-vuelta a la base POR SESIÓN
 * (1-2 sustitutos_para_ejercicio por ejercicio, 1 peso_sugerido por ejercicio, 1 insert por
 * ejercicio) — con la conexión de un socio real (Lucas, ~1s de latencia) un mes de 30 sesiones
 * quedaba "colgado" ~30 minutos, aunque el trabajo de la base son milisegundos: era la latencia
 * de red multiplicada por ~1.550 viajes. Se reordenó en tres frentes, sin tocar qué ejercicio
 * elige el motor (mismos seeds, mismo orden de concesiones — ver seededIndex y los comentarios
 * de generarSesion):
 *
 *   1. El universo de sustitutos de cada (ejercicio, box) se pide UNA vez por rutina, no una
 *      vez por slot por sesión — ver poolDeSustitutos. sustitutos_para_ejercicio ordena por
 *      patrón/familia/rol/hash, nunca por qué se excluye, así que pedirlo completo y filtrar en
 *      JS da exactamente el mismo resultado que pedirlo de a un excluir distinto por llamada.
 *   2. El peso de todos los ejercicios de una sesión se pide en un solo viaje (RPC
 *      `pesos_sugeridos`, plural) en vez de uno por ejercicio — ver pesosSugeridos.
 *   3. Todas las filas de session_exercises de una sesión se insertan en un solo INSERT, no uno
 *      por ejercicio — ver el final de generarSesion.
 *
 * Lo que sí sigue siendo secuencial, a propósito: qué ejercicio evitar por estación (`usados`,
 * que se acumula estación tras estación dentro de la sesión) y qué evitó la sesión anterior
 * (`evitar`/`anterior`, sesión tras sesión). Paralelizar esas dos cosas cambiaría qué ejercicio
 * termina eligiéndose — es la dependencia real, no una ida-y-vuelta de más — así que se dejaron
 * como estaban y sólo se sacó del medio lo que no cambiaba el resultado.
 */

// Deterministic string hash (FNV-1a) — same inputs always produce the same pick, so
// regenerating a routine is reproducible instead of silently landing on a different exercise
// every run. Concept ported (not code — his was PHP crc32) from Lucas Barral's
// RutinaMaterializerService.
function seededIndex(seed, length) {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return length > 0 ? hash % length : 0
}

/**
 * El peso sugerido de varios ejercicios de un mismo socio, en un solo viaje.
 *
 * Antes esto era `getProposedWeight` llamada una vez por ejercicio (una RPC `peso_sugerido` por
 * fila de session_exercises) — 25-30 ida-y-vuelta por sesión sólo para el peso. peso_sugerido
 * es una función STABLE de (socio, ejercicio): no depende de la sesión ni del orden en que se
 * pida, así que juntar todos los ejercicios de la sesión y pedirlos de una (RPC
 * `pesos_sugeridos`, ver migración 20260924130000) da el mismo número por ejercicio que pedirlo
 * uno por uno.
 */
async function pesosSugeridos(userId, exerciseIds) {
  if (!userId || !exerciseIds.length) return new Map()
  const { data, error } = await supabase.rpc('pesos_sugeridos', {
    p_user_id: userId,
    p_exercise_ids: exerciseIds,
  })
  if (error) throw error
  return new Map((data || []).map((row) => [row.exercise_id, row.kg ?? null]))
}

/**
 * Los techos que le pone el arquetipo del socio.
 *
 * Un arquetipo no dice qué entrenar, dice hasta dónde: alguien que arranca no debería recibir lo
 * más técnico del catálogo por más que el patrón de movimiento coincida. Sin arquetipo cargado no
 * hay techo y el motor se comporta como siempre.
 */
async function techosDelSocio(userId) {
  if (!userId) return null
  const { data } = await supabase.rpc('techos_del_socio', { p_user_id: userId })
  return data?.[0] ?? null
}

// Elementos que implican una carga real que se trackea en kg — no cable ni banda. La rutina
// real de un socio en CENTRAL nunca puso carga_kg en polea o banda elástica, sólo en barra y
// mancuerna; el motor sigue esa misma convención al decidir qué ejercicio "necesita" un peso.
const ELEMENTOS_CON_PESO = [
  'Barra', 'Barra en rack', 'Mancuernas', 'Keteball', 'Sand bag', 'Medicin ball',
  'Pelota de carga', 'Landmine',
]

async function perfilesDeEsfuerzo() {
  // El catálogo entero en una sola query en vez de una consulta por estación generada: un mes
  // de cinco estaciones es 125 de ellas, y esto son 312 filas de tres columnas chicas.
  const { data } = await supabase
    .from('exercises')
    .select('id, complejidad_tecnica, intensidad_relativa, family_code, movimiento_madre')
    .eq('is_active', true)

  // Qué ejercicios necesitan un peso real, para poder avisar cuando no hay ninguno de dónde
  // sacarlo — sin esto, un ejercicio con barra sin peso es indistinguible de uno de peso
  // corporal que correctamente no lleva ninguno.
  const { data: elementosConPeso } = await supabase
    .from('elementos')
    .select('id')
    .in('nombre', ELEMENTOS_CON_PESO)
  const idsElementosConPeso = (elementosConPeso || []).map((e) => e.id)
  const idsNecesitanCarga = new Set()
  if (idsElementosConPeso.length) {
    const { data: relaciones } = await supabase
      .from('exercise_elementos')
      .select('exercise_id')
      .in('elemento_id', idsElementosConPeso)
    for (const r of relaciones || []) idsNecesitanCarga.add(r.exercise_id)
  }

  return new Map((data || []).map((e) => [e.id, { ...e, necesitaCarga: idsNecesitanCarga.has(e.id) }]))
}

/**
 * El universo completo de sustitutos de cada (ejercicio, box) que la rutina va a necesitar,
 * pedido UNA vez por toda la rutina y en paralelo — no una vez por slot por sesión.
 *
 * sustitutos_para_ejercicio ordena por patrón/familia/rol/hash(socio+box+candidato) — nada de
 * eso depende de p_excluir, sólo que las filas excluidas no aparezcan en el resultado. Pedirlo
 * sin exclusión y con un límite que cubre el catálogo activo entero (~312 ejercicios, ver
 * perfilesDeEsfuerzo) da EL MISMO ORDEN que cualquier llamada puntual con un excluir más chico:
 * sacar ids de esta lista en JS y cortar a 12 reproduce exactamente lo que hoy hace cada llamada
 * a la RPC con su propio excluir (`usados`+`evitar`+`candidatos`, distinto en cada slot). Eso es
 * lo que permite generar las 30 sesiones del mes sin volver a tocar esta RPC.
 *
 * Un (ejercicio, box) es el mismo para todas las sesiones que rotan sobre la misma plantilla
 * escrita a mano, así que el número de llamadas acá es del orden de "cuántas líneas escribió el
 * coach" (5-25), no de "cuántas sesiones genera el mes" (hasta 30).
 */
async function poolDeSustitutos(clientId, pares) {
  const entradas = await Promise.all(
    pares.map(async ([exerciseId, boxId]) => {
      const { data, error } = await supabase.rpc('sustitutos_para_ejercicio', {
        p_exercise_id: exerciseId,
        p_box_id: boxId,
        p_user_id: clientId,
        p_excluir: [],
        p_limite: 500,
      })
      if (error) throw error
      return [`${exerciseId}::${boxId}`, data || []]
    })
  )
  return new Map(entradas)
}

/**
 * Which timed formats a given exercise can be run as.
 *
 * The three formats are not interchangeable, and the difference is the exercise, not the taste
 * of whoever wrote the session:
 *
 *   EMOM   — reps inside a 60s window; the rest is whatever is left over, so the member paces
 *            themselves and the pause is forced. Tolerates anything. Always allowed.
 *   Tabata — 20s all-out, eight times. Only works on something you can do fast without thinking.
 *   AMRAP  — eight continuous minutes. Nothing forces a pause, so it needs a movement you can
 *            still hold together while tired.
 *
 * The two catalog fields answer two different questions, and mixing them up is what makes a
 * generated session look wrong to a coach:
 *
 *   complejidad_tecnica  — can this be done fast at all? A coordination-ladder drill cannot,
 *                          at any intensity. Complejidad 3 gets EMOM and nothing else.
 *   intensidad_relativa  — can this be sustained for eight minutes? Burpees are the textbook
 *                          Tabata and a terrible AMRAP; that is intensidad 3, not complexity.
 *
 * Both are 1-3 and filled in for most of the catalog. Missing means EMOM only — the
 * conservative one — rather than a guess made from an empty field.
 */
function formatosPosibles(ejercicio) {
  const posibles = ['EMOM']
  const complejidad = ejercicio?.complejidad_tecnica
  const intensidad = ejercicio?.intensidad_relativa
  if (complejidad == null || intensidad == null) return posibles

  if (complejidad <= 2) posibles.push('Tabata')
  if (complejidad <= 2 && intensidad <= 2) posibles.push('AMRAP')
  return posibles
}

// A station is a circuit, not an exercise. The gym runs five stations of about six minutes each,
// and inside a station the member cycles through several movements — the routines CENTRAL has for
// August are all three exercises of 25s work / 15s rest, repeated three times: 3 × 3 × 40s = 6:00.
//
// Six minutes is the target, not a rule. What is fixed is that the station takes the same slot in
// the line whichever format it runs, so the queue never has to care.

/**
 * Si un ejercicio entra bajo el techo del arquetipo del socio.
 *
 * El techo se aplica sólo cuando queda alguien debajo: es preferible ofrecerle algo por encima
 * del techo que dejarle un hueco en el circuito, porque el hueco lo ve en el piso y el techo es
 * una preferencia, no una contraindicación. Para lo que no se negocia están las
 * contraindicaciones, que filtran antes y sin excepción.
 */
function dentroDelTecho(ejercicio, techos) {
  if (!techos) return true
  const { complejidad_max: cMax, intensidad_max: iMax } = techos
  const c = ejercicio?.complejidad_tecnica
  const i = ejercicio?.intensidad_relativa
  if (cMax != null && c != null && c > cMax) return false
  if (iMax != null && i != null && i > iMax) return false
  return true
}

/**
 * How a station of BLOQUE_SEG runs under each format: cuántos ejercicios prefiere el circuito y
 * cuánto dura cada intervalo — la cantidad TOTAL de intervalos en 6:00 es del formato, no de
 * cuántos ejercicios entraron (ver trabajoDelBloque): un Tabata siempre son 12 turnos de 20/10,
 * los reparta entre 3 ejercicios o entre 4 — igual que el preset que ve el coach armando a mano
 * (SelectorFormato/PRESETS en formatos.js) y que la cola/TV, que cuentan el total como
 * rondas × (trabajo + descanso) sin mirar cuántos ejercicios hay.
 *
 *   Tabata  12 turnos de 20s + 10s = 6:00   — el clásico, repartido entre los ejercicios que haya
 *   EMOM    6 turnos de 60s        = 6:00   — un movimiento por minuto
 *   AMRAP   6:00 corridos                   — las vueltas las pone el socio, no hay turnos fijos
 *   Series  lo que escribió el coach, sin reloj — carga y repeticiones
 */
// El texto de EMOM es literalmente lo que prescripcionTexto({reps:10}) de formatos.js
// produciría — no se importa esa función acá para no atar el motor a un cambio en formatos.js
// (el mirror de este archivo en motor-mcp no tiene ese import, y agregarlo ahí sin sincronizar
// formatos.js también rompía el service entero, no sólo EMOM). Si prescripcionTexto cambia de
// forma, este literal se actualiza a mano.
const CIRCUITO = {
  Tabata: { ejercicios: 4, celda: 30, trabajo: 20, descanso: 10, reps: 'máx por ronda' },
  EMOM: { ejercicios: 3, celda: 60, trabajo: 60, descanso: 0, reps: '10 reps' },
  AMRAP: { ejercicios: 4, celda: null, trabajo: null, descanso: 0, reps: '10 por vuelta' },
}

/**
 * El trabajo de una estación: cuántas vueltas y cuánto dura cada turno, para que el bloque cierre
 * en seis minutos con los ejercicios que efectivamente entraron.
 *
 * `rondas`/`trabajo_seg` son del FORMATO, no de la cantidad de ejercicios — mismo criterio que
 * PRESETS en formatos.js (EMOM siempre 6 rondas de 60s, Tabata siempre 12 de 20/10) y que
 * duracionSeg/faseDelFormato (admin y TV), que calculan el total como rondas × (trabajo +
 * descanso) SIN multiplicar por la cantidad de ejercicios — eso ya se sacó a propósito una vez
 * (ver duracionEstacionSeg: "sumar como antes multiplicaba el tiempo por la cantidad de
 * ejercicios... daban 18:00, que no existe"). Este generador dividía por `cantidad` para
 * compensar esa vieja multiplicación — pero como ya no existe del otro lado, el resultado real
 * era una estación que decía (y corría) menos de 6:00 apenas había más de un ejercicio: un EMOM
 * de 3 ejercicios cerraba en 2:00, un AMRAP de 4 en 1:30. Encontrado generando una rutina real
 * completa y comparando contra lo que muestra el armador manual para el mismo formato.
 *
 * En AMRAP el reloj es uno solo para todo el bloque — el socio da las vueltas que pueda, no hay
 * un turno fijo por ejercicio que repartir.
 */
function trabajoDelBloque(formato) {
  const c = CIRCUITO[formato]
  if (formato === 'AMRAP') {
    return { formato, rondas: 1, trabajo_seg: BLOQUE_SEG, descanso_seg: 0, sets_reps: c.reps }
  }
  // floor y no round: redondear para arriba pasa el bloque, no lo ajusta.
  const rondas = Math.max(1, Math.floor(BLOQUE_SEG / c.celda))
  return {
    formato, rondas, trabajo_seg: c.trabajo, descanso_seg: c.descanso, sets_reps: c.reps,
    // El armador manual escribe 1 por default cuando el coach arma un EMOM ejercicio por
    // ejercicio (ver PRESETS.EMOM en formatos.js) — acá pasa lo mismo: CIRCUITO.EMOM ya inserta
    // una fila por ejercicio con rondas=6 rotando de a una, que es exactamente lo que describe
    // ejercicios_por_minuto=1. Sin esto, una estación EMOM generada y una armada a mano decían
    // lo mismo en pantalla pero una tenía el campo cargado y la otra no.
    ...(formato === 'EMOM' ? { ejercicios_por_minuto: 1 } : {}),
  }
}

/**
 * Which format the station is going to run — decided before the exercises, not after.
 *
 * The whole circuit runs under one format, so every movement in it has to tolerate that format:
 * one technical lift at 20s all-out is enough to make a Tabata a bad idea for the whole station.
 * Choosing the format first and then filling the circuit with movements that tolerate it is what
 * keeps the variety; deciding afterwards means one awkward candidate drags every station back to
 * EMOM, which is what happened the first time.
 *
 * Series is left alone. The coach prescribing sets and reps decided the station is strength work;
 * turning it into a Tabata changes what the station is for, not how it is measured.
 */
function formatoDelBloque(plantillas, semilla, techos, perfiles) {
  const cabeza = plantillas[0]
  if (!cabeza.formato || cabeza.formato === 'Series') return null
  // Las que prefiere el arquetipo, si declaró alguna. Sigue eligiendo entre varias: una sola
  // modalidad para todo el mes es el problema que vinimos a resolver.
  const preferidas = (techos?.formatos_preferidos || []).filter((f) => CIRCUITO[f])
  let opciones = preferidas.length ? preferidas : Object.keys(CIRCUITO)

  // Los ejercicios que el coach fijó ("pin") no rotan nunca — ver más abajo, en el loop de
  // candidatos. El formato de la estación tiene que ser uno que TODOS los fijados toleren, o la
  // sustitución no le cambia el formato al ejercicio fijado, se lo cambia a él: exactamente lo
  // que el pin existe para evitar. Con más de uno fijado se acota a lo que todos toleran juntos.
  const fijados = plantillas.filter((p) => p.is_pinned)
  if (fijados.length) {
    const toleradosPorTodos = fijados.reduce((acc, p) => {
      const tolerados = formatosPosibles(perfiles?.get(p.exercise_id))
      return acc.filter((f) => tolerados.includes(f))
    }, opciones)
    if (toleradosPorTodos.length) opciones = toleradosPorTodos
  } else {
    // Sin nada fijado todavía en la estación, se mantiene la heurística anterior como red de
    // seguridad: una estación cuyo primer ejercicio necesita carga real (barra, mancuerna,
    // sandbag...) no debería poder sortear un formato que ESE ejercicio no tolera.
    const perfilAncla = perfiles?.get(cabeza.exercise_id)
    if (perfilAncla?.necesitaCarga) {
      const tolerados = formatosPosibles(perfilAncla)
      const restringidas = opciones.filter((f) => tolerados.includes(f))
      if (restringidas.length) opciones = restringidas
    }
  }

  return opciones[seededIndex(semilla, opciones.length)]
}

/**
 * Generate the rest of the month from the sessions the coach wrote by hand.
 *
 * The gym's flow: the first few sessions are written by a person, the rest are the engine's job.
 * Each generated session takes one of the hand-made ones as its shape — same stations, same sets
 * and reps, same rest — and swaps every exercise for one that shares its movement pattern, that
 * the station can actually run, and that the member is not contraindicated for.
 *
 * Deterministic on purpose. Regenerating a routine has to land on the same month, or nobody can
 * tell whether a change they made did anything.
 */
export const generateRoutineSessions = async (routineId) => {
  const { data: routine, error: rError } = await supabase
    .from('training_routines')
    .select('*, users (id)')
    .eq('id', routineId)
    .single()
  if (rError) throw rError

  const totalSessions = routine.total_sessions || 30

  const { data: plantillas, error: pError } = await supabase
    .from('routine_sessions')
    .select('id, session_number, session_exercises (*)')
    .eq('routine_id', routineId)
    .order('session_number')
  if (pError) throw pError

  // What the coach wrote is whatever is not the engine's own work — not the first five sessions.
  // Five is what the gym happens to write on a good week, and hardcoding it meant a coach who
  // wrote one day had nothing to generate from, and a coach who wrote six had the sixth ignored
  // and then overwritten. The base is the hand-written sessions, however many there are.
  const conEjercicios = (plantillas || []).filter((s) =>
    (s.session_exercises || []).some((se) => !se.is_auto_generated)
  )
  const aMano = conEjercicios.length
    ? Math.max(...conEjercicios.map((s) => s.session_number))
    : 0
  if (conEjercicios.length === 0) {
    throw new Error(
      'No hay ninguna sesión cargada a mano para usar de base. Con una alcanza: armá la Sesión 1 y volvé a generar.'
    )
  }

  // Candado: sólo se toma la generación si nadie más la tiene, o si la tiene hace más de 10
  // minutos sin avanzar — eso es "quedó colgada", no "está en curso". La condición vive en el
  // propio UPDATE (no en el SELECT de `routine`, más arriba) porque es la única forma atómica:
  // si dos coaches aprietan "Generar" a la vez, Postgres serializa las dos UPDATE contra la
  // misma fila y sólo la primera encuentra la fila todavía elegible — la segunda vuelve con
  // `tomado` vacío y no sigue. Sin este candado, las dos corridas generaban session_number
  // repetidos y chocaban con routine_sessions_routine_id_session_number_key.
  const DIEZ_MIN_MS = 10 * 60 * 1000
  const staleDesde = new Date(Date.now() - DIEZ_MIN_MS).toISOString()
  const { data: tomado, error: lockError } = await supabase
    .from('training_routines')
    .update({ generation_status: 'generating', generation_progress: 0 })
    .eq('id', routineId)
    .or(`generation_status.neq.generating,updated_at.lt.${staleDesde}`)
    .select('id')
  if (lockError) throw lockError
  if (!tomado?.length) {
    if (routine.generation_status === 'generating') {
      const minutos = routine.updated_at
        ? Math.max(1, Math.round((Date.now() - new Date(routine.updated_at).getTime()) / 60000))
        : null
      throw new Error(
        minutos != null
          ? `Se está generando desde hace ${minutos} min. Esperá a que termine.`
          : 'Se está generando ahora mismo. Esperá a que termine.'
      )
    }
    throw new Error('Otra persona la generó justo ahora. Volvé a intentar en un momento.')
  }

  try {
    // Anything previously generated is replaced. Regenerating after fixing a station should not
    // leave the old month interleaved with the new one.
    const { data: viejas } = await supabase
      .from('routine_sessions')
      .select('id')
      .eq('routine_id', routineId)
      .gt('session_number', aMano)
    if (viejas?.length) {
      await supabase.from('routine_sessions').delete().in('id', viejas.map((s) => s.id))
    }

    // Independientes entre sí: uno lee exercises/elementos, el otro el arquetipo del socio.
    const [perfiles, techos] = await Promise.all([perfilesDeEsfuerzo(), techosDelSocio(routine.client_id)])

    // Todos los pares (ejercicio, box) que alguna sesión generada va a necesitar sustitutos —
    // salen de las sesiones a mano, que son las que rotan de base para todo el mes. Pedirlos
    // todos de una, en paralelo, es lo que saca sustitutos_para_ejercicio del loop por sesión
    // (ver poolDeSustitutos).
    const pares = new Map()
    for (const s of conEjercicios) {
      for (const te of s.session_exercises || []) {
        if (!te.is_cooldown && te.box_number && te.box_id) {
          pares.set(`${te.exercise_id}::${te.box_id}`, [te.exercise_id, te.box_id])
        }
      }
    }
    const pool = await poolDeSustitutos(routine.client_id, [...pares.values()])

    // What the last hand-written session used. Without this the first generated session is the
    // only one in the month that does not know what came the day before, and it can repeat it —
    // which is exactly what it did: session 5 finished with squats and session 6 opened with them.
    const ultima = conEjercicios[conEjercicios.length - 1]
    let anterior = (ultima.session_exercises || []).map((se) => se.exercise_id)
    for (let n = aMano + 1; n <= totalSessions; n++) {
      // Rotate through the hand-made sessions so the month keeps their variety instead of
      // orbiting one of them.
      const base = conEjercicios[(n - aMano - 1) % conEjercicios.length]
      anterior = await generarSesion(routineId, routine.client_id, base, n, anterior, perfiles, techos, pool)
      // Progreso visible para cualquier pestaña/coach que esté mirando esta rutina (Routines.jsx
      // la sondea mientras generation_status = 'generating'). De paso, cada UPDATE re-toca
      // updated_at (trigger ya existente en training_routines) — es el latido que el candado de
      // arriba usa para distinguir una generación en curso de una que quedó colgada.
      await supabase.from('training_routines').update({ generation_progress: n }).eq('id', routineId)
    }

    await supabase
      .from('training_routines')
      .update({ generation_status: 'completed' })
      .eq('id', routineId)

    return { generadas: totalSessions - aMano, desde: conEjercicios.length }
  } catch (error) {
    await supabase
      .from('training_routines')
      .update({ generation_status: 'failed' })
      .eq('id', routineId)
    throw error
  }
}

/** One generated session. Returns the exercise ids it used, for the next one to avoid. */
async function generarSesion(routineId, clientId, base, sessionNumber, evitar, perfiles, techos, pool) {
  // Yesterday's movements, as families rather than ids.
  const familiasAyer = new Set(
    evitar.map((id) => perfiles?.get(id)?.family_code).filter(Boolean)
  )

  const { data: session, error: sError } = await supabase
    .from('routine_sessions')
    .insert([{
      routine_id: routineId,
      title: `Sesión ${sessionNumber}`,
      session_number: sessionNumber,
      status: 'locked',
    }])
    .select()
    .single()
  if (sError) throw sError

  const usados = []
  // exercise_order is UNIQUE per session, so it is numbered across the session and not per
  // station — the same constraint that used to make the admin's own form collide.
  let orden = 0

  // Filas a insertar, armadas en memoria estación por estación. El peso y el INSERT van al
  // final, todos juntos (ver debajo) — no fila por fila, que es lo que hacía 25-30 ida-y-vuelta
  // de más por sesión.
  const pendientes = []

  // Group the template by station. The station is what gets generated: its format, how long the
  // circuit is and which movements are in it are one decision, not one per row.
  const estaciones = new Map()
  for (const te of [...(base.session_exercises || [])].sort(
    (a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0)
  )) {
    const clave = te.is_cooldown ? `cool-${te.exercise_order}` : `box-${te.box_number}`
    if (!estaciones.has(clave)) estaciones.set(clave, [])
    estaciones.get(clave).push(te)
  }

  for (const [, plantillas] of estaciones) {
    const cabeza = plantillas[0]

    // A cooldown has no station, so there is nothing to rotate it against — it carries over.
    if (cabeza.is_cooldown || !cabeza.box_number) {
      orden += 1
      usados.push(cabeza.exercise_id)
      pendientes.push({
        te: cabeza,
        exerciseId: cabeza.exercise_id,
        orden,
        fuente: 'template',
        trabajo: {
          formato: cabeza.formato || 'Series',
          rondas: cabeza.rondas,
          trabajo_seg: cabeza.trabajo_seg,
          descanso_seg: cabeza.descanso_seg,
          sets_reps: cabeza.sets_reps,
        },
        necesitaCarga: perfiles?.get(cabeza.exercise_id)?.necesitaCarga || false,
        isPinned: cabeza.is_pinned || false,
      })
      continue
    }

    const semillaEstacion = `${routineId}-${sessionNumber}-f${cabeza.box_number}`
    const formato = formatoDelBloque(plantillas, semillaEstacion, techos, perfiles)
    // Series keeps the circuit the coach wrote; a timed format sizes it to fill the six minutes.
    const cupo = formato ? CIRCUITO[formato].ejercicios : plantillas.length

    // One candidate per slot. When the format asks for more exercises than the coach wrote, the
    // extra slots reuse the template's movements in order — the fourth exercise of a Tabata
    // rotates the first one's pattern again, into a different movement.
    const candidatos = []
    // Qué movimientos ya entraron a ESTA estación, hoy — no por id de ejercicio (eso ya lo
    // cubre p_excluir más abajo) sino por movimiento_madre: "Biceps polea baja con barra" y
    // "Biceps con mancuernas sentado" son ejercicios distintos pero el mismo movimiento con
    // otro material, y un socio no debería ver bíceps dos veces en el mismo circuito.
    const movimientosEnEstacion = new Set()
    for (let i = 0; i < cupo; i++) {
      const te = plantillas[i % plantillas.length]
      // Sólo la ocurrencia LITERAL que el coach escribió mantiene el pin — no sus clones de
      // wrap-around. Si la estación tiene un solo ejercicio escrito (fijado) y el formato pide
      // 3 o 4 slots, sin este chequeo el mismo ejercicio se clonaba idéntico en cada slot extra
      // (three "Peso Muerto con barra" en una sola estación) en vez de rotar variedad alrededor
      // de esa ancla, que es lo que ya hacía un wrap-around no pineado.
      const esOcurrenciaEscrita = i < plantillas.length

      if (te.is_pinned && esOcurrenciaEscrita) {
        // Fijado por el coach: nunca pasa por sustitutos_para_ejercicio, se mantiene el mismo
        // ejercicio siempre. El peso y el formato de la estación se siguen calculando como
        // siempre — sólo la identidad del ejercicio queda afuera de la rotación.
        candidatos.push(te.exercise_id)
        const movPin = perfiles?.get(te.exercise_id)?.movimiento_madre
        if (movPin) movimientosEnEstacion.add(movPin)
        continue
      }

      // El universo completo para este (ejercicio, box) ya está pedido — ver poolDeSustitutos.
      // `pedir` ahora sólo filtra en memoria: nada de esto es una ida-y-vuelta a la base.
      const universo = pool?.get(`${te.exercise_id}::${te.box_id}`) || []
      const pedir = (excluir) => {
        const fuera = new Set(excluir)
        return universo.filter((o) => !fuera.has(o.id)).slice(0, 12)
      }

      // Las concesiones tienen orden, y el orden es por lo que le cuesta al socio.
      //
      //   1. Contraindicaciones — no se ceden nunca; filtran del lado de la base.
      //   2. No repetir dentro del circuito de hoy — lo peor de ver en el piso. Por movimiento,
      //      no por id: dos ejercicios de bíceps con materiales distintos siguen siendo bíceps
      //      dos veces en el mismo circuito.
      //   3. El techo del arquetipo — al que arranca no se le ofrece lo más técnico, aunque el
      //      patrón coincida. Cede antes que 2 y después que 4.
      //   4. No repetir el movimiento de ayer — molesto, pero es lo más barato de resolver.
      //
      // La versión anterior cedía el techo primero, y al que arranca le aparecían sentadillas
      // sobre bosu con sandbag porque el pool de esa estación no tenía nada más simple sin
      // repetir. Repetir una sentadilla sin carga es mejor que eso.
      const bajoTecho = (lista) => lista.filter((o) => dentroDelTecho(perfiles?.get(o.id), techos))

      // Un id distinto no es un movimiento distinto. El catálogo lo dice con family_code:
      // sentadilla con sandbag y sentadilla con kettlebell son una sentadilla agarrando otra cosa.
      const otraFamiliaQueAyer = (lista) => {
        const fuera = lista.filter((o) => {
          const fam = perfiles?.get(o.id)?.family_code
          return !fam || !familiasAyer.has(fam)
        })
        return fuera.length ? fuera : lista
      }

      // A diferencia de otraFamiliaQueAyer, ésta NO tiene fallback propio — es la concesión que
      // más cuesta ceder, así que la cascada de abajo la sostiene incluso cuando ya cedió techo
      // y ayer, y sólo la deja caer como último recurso.
      const sinRepetirMovimientoHoy = (lista) =>
        lista.filter((o) => {
          const mov = perfiles?.get(o.id)?.movimiento_madre
          return !mov || !movimientosEnEstacion.has(mov)
        })

      const conAyerFuera = pedir([...usados, ...evitar, ...candidatos])
      let opciones = sinRepetirMovimientoHoy(bajoTecho(otraFamiliaQueAyer(conAyerFuera)))

      if (!opciones.length) {
        // Se afloja lo de ayer, manteniendo el techo y no repetir movimiento hoy.
        const conAyerAdentro = pedir([...usados, ...candidatos])
        opciones = sinRepetirMovimientoHoy(bajoTecho(conAyerAdentro))
        if (!opciones.length) {
          // Se afloja también el techo, pero seguimos sin repetir movimiento hoy.
          opciones = sinRepetirMovimientoHoy(conAyerAdentro)
          // Y sólo si de verdad no queda ninguna otra opción se repite un movimiento dentro de
          // la estación — preferible a un hueco en el circuito, pero es la última concesión.
          if (!opciones.length) opciones = conAyerAdentro
        }
      }

      // Only movements that tolerate the station's format get into the station's circuit.
      const admiten = opciones.filter(
        (o) => !formato || formatosPosibles(perfiles?.get(o.id)).includes(formato)
      )
      const elegibles = admiten.length ? admiten : opciones

      let elegidoId = null
      if (elegibles.length) {
        // The engine's own order is the same every time for a given member and station, so the
        // session number is what makes session 7 differ from session 12. seededIndex keeps it
        // reproducible: same routine, same month, every time.
        const semilla = `${semillaEstacion}-s${i}`
        elegidoId = elegibles[seededIndex(semilla, elegibles.length)].id
        candidatos.push(elegidoId)
      } else if (i < plantillas.length && !candidatos.includes(te.exercise_id)) {
        // No substitute available: the coach's own choice is better than a hole in the circuit.
        elegidoId = te.exercise_id
        candidatos.push(elegidoId)
      }
      if (elegidoId != null) {
        const movElegido = perfiles?.get(elegidoId)?.movimiento_madre
        if (movElegido) movimientosEnEstacion.add(movElegido)
      }
    }
    if (!candidatos.length) continue

    // A format nobody in the circuit tolerates would be a station the member cannot do. EMOM is
    // the one everything tolerates, so it is where an impossible station lands.
    const formatoFinal =
      formato && candidatos.every((id) => formatosPosibles(perfiles?.get(id)).includes(formato))
        ? formato
        : formato && 'EMOM'
    // Falling back re-sizes the circuit too: four exercises at a minute each is eight minutes, not
    // six, and the station has to give the line back its slot on time.
    const delBloque = formatoFinal
      ? candidatos.slice(0, CIRCUITO[formatoFinal].ejercicios)
      : candidatos
    // Rounds come from how many exercises actually made it in, so the block still closes at 6:00.
    const trabajo = formatoFinal ? trabajoDelBloque(formatoFinal) : null

    for (const [i, exerciseId] of delBloque.entries()) {
      orden += 1
      usados.push(exerciseId)
      const te = plantillas[i % plantillas.length]
      const fuente = exerciseId === te.exercise_id ? 'template' : 'similar'
      pendientes.push({
        te,
        exerciseId,
        orden,
        fuente,
        trabajo: trabajo ?? {
          formato: 'Series',
          rondas: null,
          trabajo_seg: null,
          descanso_seg: null,
          sets_reps: te.sets_reps,
        },
        necesitaCarga: perfiles?.get(exerciseId)?.necesitaCarga || false,
        // Mismo criterio que arriba: sólo la ocurrencia literal que escribió el coach queda
        // marcada como fija — un clon de wrap-around que se sustituyó normalmente no es "el
        // ejercicio fijado", aunque comparta plantilla con el que sí lo es.
        isPinned: (i < plantillas.length && te.is_pinned) || false,
      })
    }
  }

  // Un solo viaje para el peso de TODOS los ejercicios de la sesión — antes eran uno por
  // ejercicio (getProposedWeight). El peso depende sólo de (socio, ejercicio), nunca de en qué
  // fila de la sesión termina, así que pedir los ids únicos de una da el mismo número que
  // pedirlos uno por uno.
  const idsUnicos = [...new Set(pendientes.map((p) => p.exerciseId))]
  const pesos = await pesosSugeridos(clientId, idsUnicos)

  // Y un solo INSERT para todas las filas — antes era uno por ejercicio (insertarEjercicio).
  const filas = pendientes.map((p) =>
    filaDeSessionExercise(
      session.id, p.te, p.exerciseId, p.orden, p.fuente, p.trabajo,
      pesos.get(p.exerciseId) ?? null, p.necesitaCarga, p.isPinned
    )
  )
  const { error: seError } = await supabase.from('session_exercises').insert(filas)
  if (seError) {
    throw new Error(`No se pudieron insertar los ejercicios de la sesión ${sessionNumber}: ${seError.message}`)
  }

  return usados
}

/** Una fila de session_exercises, lista para el insert en lote. La forma sale de la plantilla; el trabajo, del bloque. */
function filaDeSessionExercise(sessionId, te, exerciseId, orden, fuente, trabajo, peso, necesitaCarga, isPinned) {
  // te.weight_kg es el peso de la plantilla — pero es el peso del ejercicio QUE HABÍA en esa
  // posición del circuito, no necesariamente el que termina eligiéndose acá. Un sustituto de
  // peso corporal (una "Gluteos elevación cadera colchoneta", por ejemplo) heredaba el peso del
  // Peso Muerto con barra que ocupaba esa misma posición en la plantilla — un número sin
  // sentido en un ejercicio que no usa ninguna carga. Sólo se hereda cuando el que realmente se
  // eligió necesita carga.
  const pesoFinal = peso ?? (necesitaCarga ? te.weight_kg : null)

  // Silencio no es lo mismo que "no lleva peso": un ejercicio con barra sin ningún peso de
  // referencia (ni historial real vía peso_sugerido, ni la plantilla) es un hueco que el coach
  // tiene que llenar antes de que el socio llegue a la estación, no un peso corporal legítimo.
  // exercise_logs está vacío en todo el sistema hoy, así que esto va a aparecer seguido hasta
  // que se resuelva quién carga el peso real levantado (pendiente ya anotado en el catchup).
  const notas = []
  if (fuente === 'template' && te.notes) notas.push(te.notes)
  if (necesitaCarga && pesoFinal == null) notas.push('Sin peso de referencia — revisar antes de la sesión')

  return {
    session_id: sessionId,
    exercise_id: exerciseId,
    box_id: te.box_id,
    box_number: te.box_number,
    exercise_order: orden,
    sets_reps: trabajo.sets_reps,
    rest_time: te.rest_time,
    repetition_time: te.repetition_time,
    micro_pause: te.micro_pause,
    weight_kg: pesoFinal,
    // Same minutes at the station, a different way of spending them.
    formato: trabajo.formato,
    rondas: trabajo.rondas,
    trabajo_seg: trabajo.trabajo_seg,
    descanso_seg: trabajo.descanso_seg,
    // Sólo EMOM lo trae (ver trabajoDelBloque) — el resto de los formatos generados no usa
    // el campo, igual que el armador manual lo deja en null fuera de EMOM.
    ejercicios_por_minuto: trabajo.ejercicios_por_minuto ?? null,
    notes: notas.length ? notas.join(' · ') : null,
    is_auto_generated: true,
    is_cooldown: te.is_cooldown || false,
    generation_source: fuente,
    is_pinned: isPinned || false,
  }
}
