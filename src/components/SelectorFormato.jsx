import {
  FORMATOS,
  PRESETS,
  BLOQUE_SEG,
  EMOM_MIN_POR_MINUTO,
  EMOM_MAX_POR_MINUTO,
  esPorTiempo,
  duracionSeg,
  mmss,
} from '../lib/formatos'

// How the work at THIS STATION is measured — once, not per exercise.
//
// The formats are presets, not a blank form: a coach saying "Tabata" means 8 × (20s, 10s), and
// asking them to type it is how one station ends up as 6 × 25/10 by accident. The numbers stay
// editable underneath, because a coach who wants 6 rounds should get 6 rounds.
//
// One control per station, not one per row: the member does the whole circuit — every exercise
// loaded here runs inside the SAME clock — so asking the format again for the second exercise
// answered a question that was already settled by the first. Every session_exercises row for
// this station is written with these same four fields (see Routines.jsx saveExerciseToSession),
// so what is on screen is the station's own duration, not a sum across its exercises.
//
// Defaults to a full block (AMRAP, 360s) — never more than the six minutes a station gets before
// the queue moves the member along, and never less by accident either.

export default function SelectorFormato({ valor, onChange, turnoSeg }) {
  const { formato = 'Series', rondas, trabajoSeg, descansoSeg, ejerciciosPorMinuto } = valor || {}
  const porTiempo = esPorTiempo(formato)
  const estacion = porTiempo ? duracionSeg({ rondas, trabajoSeg, descansoSeg }) : 0
  const excede = estacion > BLOQUE_SEG
  const restante = Math.max(0, BLOQUE_SEG - estacion)
  // El turno real que viene corriendo la cola. El box se queda ocupado más que los seis
  // minutos del ejercicio a propósito (demo + margen antes de avanzar al siguiente) — eso no
  // es un problema, es el diseño (advance-queue-tick corre a los 8:00 = 6:00 de ejercicio +
  // 1:00 de demo + 1:00 de margen). Sólo importa cuando el turno real es MÁS CORTO que el
  // bloque: ahí el socio se va a mover antes de terminar el ejercicio, y es un problema de
  // configuración de la línea que el coach no puede arreglar desde acá.
  const turnoDiscrepa = turnoSeg > 0 && turnoSeg < BLOQUE_SEG - 30

  const elegir = (f) => {
    if (!esPorTiempo(f)) {
      onChange({ formato: f, rondas: null, trabajoSeg: null, descansoSeg: null, ejerciciosPorMinuto: null })
      return
    }
    const p = PRESETS[f]
    onChange({
      formato: f,
      rondas: p.rondas,
      trabajoSeg: p.trabajoSeg,
      descansoSeg: p.descansoSeg,
      // Sólo EMOM trae ejerciciosPorMinuto en su preset — el resto lo deja en null, igual que
      // rondas/trabajoSeg quedan en null para Series: un campo que ese formato no usa.
      ejerciciosPorMinuto: p.ejerciciosPorMinuto ?? null,
    })
  }

  const set = (campo) => (ev) => {
    const n = ev.target.value === '' ? '' : Math.max(0, Number(ev.target.value))
    onChange({ formato, rondas, trabajoSeg, descansoSeg, ejerciciosPorMinuto, [campo]: n })
  }

  // Acotado a 1-6 (el mismo rango que el CHECK de la base) apenas se suelta el input, no en
  // cada tecla — si no, escribir "1" antes de completar "16" lo clampeaba a mitad de camino.
  const setPorMinuto = (ev) => {
    const n = ev.target.value === '' ? EMOM_MIN_POR_MINUTO : Number(ev.target.value)
    const acotado = Math.min(EMOM_MAX_POR_MINUTO, Math.max(EMOM_MIN_POR_MINUTO, n))
    onChange({ formato, rondas, trabajoSeg, descansoSeg, ejerciciosPorMinuto: acotado })
  }

  const pct = Math.min(100, Math.round((estacion / BLOQUE_SEG) * 100))

  return (
    <div style={s.contenedor}>
      <div style={s.chips}>
        {FORMATOS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => elegir(f)}
            style={{ ...s.chip, ...(formato === f ? s.chipActivo : {}) }}
          >
            {f === 'Series' ? 'Series × reps' : f}
          </button>
        ))}
      </div>

      {porTiempo && (
        <>
          <div style={s.numeros}>
            <label style={s.campo}>
              <span style={s.etiqueta}>Rondas</span>
              <input type="number" min="1" max="60" value={rondas ?? ''} onChange={set('rondas')} style={s.input} />
            </label>
            <label style={s.campo}>
              <span style={s.etiqueta}>{formato === 'AMRAP' || formato === 'A completar' ? 'Tiempo total (seg)' : 'Trabajo (seg)'}</span>
              <input type="number" min="5" max={BLOQUE_SEG} value={trabajoSeg ?? ''} onChange={set('trabajoSeg')} style={s.input} />
            </label>
            {formato === 'EMOM' ? (
              // El descanso de EMOM no se carga (es lo que sobra del minuto — ver la ayuda de
              // abajo), así que este es el lugar natural para la otra decisión propia de EMOM:
              // cuántos ejercicios entran juntos en cada minuto.
              <label style={s.campo}>
                <span style={s.etiqueta}>Ejercicios por minuto</span>
                <input
                  type="number"
                  min={EMOM_MIN_POR_MINUTO}
                  max={EMOM_MAX_POR_MINUTO}
                  value={ejerciciosPorMinuto ?? EMOM_MIN_POR_MINUTO}
                  onChange={setPorMinuto}
                  style={s.input}
                />
              </label>
            ) : (
              <label style={s.campo}>
                <span style={s.etiqueta}>Descanso (seg)</span>
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={descansoSeg ?? 0}
                  onChange={set('descansoSeg')}
                  style={s.input}
                />
              </label>
            )}
          </div>

          <span style={s.ayuda}>
            {formato === 'EMOM'
              ? 'Cuántos ejercicios comparten cada minuto. El descanso es lo que sobre del minuto después de hacerlos, por eso no se carga aparte.'
              : formato === 'AMRAP'
                ? 'Las vueltas que entren en ese tiempo. Las reps por vuelta van en Series x Reps.'
                : formato === 'A completar'
                  ? 'Sin estructura fija ni tope de ejercicios. Si es una submodalidad con nombre (ej. escalera 1-1-2-2-3-3), describila en Notas.'
                  : 'Cada ronda: trabajo y después descanso.'}
          </span>

          <div style={{ ...s.medidor, ...(excede ? s.medidorRoto : {}) }}>
            <div style={s.barra}>
              <div
                style={{
                  ...s.barraPropio,
                  left: 0,
                  width: `${pct}%`,
                  background: excede ? '#991B1B' : '#F45F37',
                }}
              />
            </div>
            <div style={s.medidorTexto}>
              <strong>{mmss(estacion)}</strong> de los {mmss(BLOQUE_SEG)} de la estación
              {!excede && ` · quedan ${mmss(restante)}`}
            </div>
            {excede && (
              <div style={s.error}>
                Se pasa {mmss(estacion - BLOQUE_SEG)} del bloque. El box avanza a los{' '}
                {mmss(BLOQUE_SEG)} igual: el socio se va a mover antes de terminar.
              </div>
            )}
            {turnoDiscrepa && (
              <div style={s.aviso}>
                Ojo: la cola avanza el box a los {mmss(turnoSeg)}, antes de los {mmss(BLOQUE_SEG)} que necesita el ejercicio — el socio se va a mover sin terminar.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const s = {
  contenedor: { display: 'flex', flexDirection: 'column', gap: 8 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '6px 12px', borderRadius: 999, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 500,
  },
  chipActivo: { background: '#FFF1ED', borderColor: '#F45F37', color: '#B33204', fontWeight: 700 },
  numeros: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  campo: { display: 'flex', flexDirection: 'column', gap: 4 },
  etiqueta: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#9ca3af' },
  input: {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb',
    fontSize: 14, boxSizing: 'border-box', color: '#111827',
  },
  ayuda: { fontSize: 12, color: '#9ca3af', lineHeight: 1.4 },
  medidor: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '10px 12px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0',
    color: '#166534', fontSize: 13,
  },
  medidorRoto: { background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' },
  barra: { position: 'relative', height: 8, borderRadius: 4, background: '#E7E3DD', overflow: 'hidden' },
  barraPropio: { position: 'absolute', top: 0, bottom: 0 },
  medidorTexto: { lineHeight: 1.4 },
  error: { fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 },
  aviso: { fontSize: 12, color: '#92400E', lineHeight: 1.4 },
}
