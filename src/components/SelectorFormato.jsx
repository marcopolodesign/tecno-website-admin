import { FORMATOS, PRESETS, BLOQUE_SEG, esPorTiempo, duracionSeg, mmss } from '../lib/formatos'

// How the work at this station is measured.
//
// The formats are presets, not a blank form: a coach saying "Tabata" means 8 × (20s, 10s), and
// asking them to type it is how one station ends up as 6 × 25/10 by accident. The numbers stay
// editable underneath, because a coach who wants 6 rounds should get 6 rounds.
//
// What is on screen is not this row's duration but the station's: the member does the whole
// circuit before advancing, so what has to fit in the six minutes is the sum. Reading one row at
// a time is how three two-minute rows each passed the check and the box ran six minutes long.

export default function SelectorFormato({ valor, onChange, turnoSeg, usadoSeg = 0 }) {
  const { formato = 'Series', rondas, trabajoSeg, descansoSeg } = valor || {}
  const porTiempo = esPorTiempo(formato)
  const propio = porTiempo ? duracionSeg({ rondas, trabajoSeg, descansoSeg }) : 0
  const estacion = usadoSeg + propio
  const excede = estacion > BLOQUE_SEG
  const restante = Math.max(0, BLOQUE_SEG - usadoSeg)
  // El turno real que viene corriendo la cola. Sólo se menciona si discrepa del bloque: si
  // coinciden no aporta nada, y si el box viene avanzando antes de los seis minutos es un
  // problema de configuración de la línea que el coach no puede arreglar desde acá.
  const turnoDiscrepa = turnoSeg > 0 && Math.abs(turnoSeg - BLOQUE_SEG) > 30

  const elegir = (f) => {
    if (!esPorTiempo(f)) {
      onChange({ formato: f, rondas: null, trabajoSeg: null, descansoSeg: null })
      return
    }
    const p = PRESETS[f]
    onChange({ formato: f, rondas: p.rondas, trabajoSeg: p.trabajoSeg, descansoSeg: p.descansoSeg })
  }

  const set = (campo) => (ev) => {
    const n = ev.target.value === '' ? '' : Math.max(0, Number(ev.target.value))
    onChange({ formato, rondas, trabajoSeg, descansoSeg, [campo]: n })
  }

  const pct = Math.min(100, Math.round((estacion / BLOQUE_SEG) * 100))
  const pctUsado = Math.min(100, Math.round((usadoSeg / BLOQUE_SEG) * 100))

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
            <label style={s.campo}>
              <span style={s.etiqueta}>Descanso (seg)</span>
              <input
                type="number"
                min="0"
                max="600"
                value={descansoSeg ?? 0}
                onChange={set('descansoSeg')}
                style={s.input}
                disabled={formato === 'EMOM'}
              />
            </label>
          </div>

          <span style={s.ayuda}>
            {formato === 'EMOM'
              ? 'En EMOM el descanso es lo que sobra del minuto después de las reps — por eso no se carga.'
              : formato === 'AMRAP'
                ? 'Las vueltas que entren en ese tiempo. Las reps por vuelta van en Series x Reps.'
                : formato === 'A completar'
                  ? 'Sin estructura fija ni tope de ejercicios. Si es una submodalidad con nombre (ej. escalera 1-1-2-2-3-3), describila en Notas.'
                  : 'Cada ronda: trabajo y después descanso.'}
          </span>

          <div style={{ ...s.medidor, ...(excede ? s.medidorRoto : {}) }}>
            <div style={s.barra}>
              <div style={{ ...s.barraUsado, width: `${pctUsado}%` }} />
              <div
                style={{
                  ...s.barraPropio,
                  left: `${pctUsado}%`,
                  width: `${Math.max(0, pct - pctUsado)}%`,
                  background: excede ? '#DC2626' : '#F45F37',
                }}
              />
            </div>
            <div style={s.medidorTexto}>
              <strong>{mmss(estacion)}</strong> de los {mmss(BLOQUE_SEG)} de la estación
              {usadoSeg > 0 && ` · este ejercicio suma ${mmss(propio)} a ${mmss(usadoSeg)} ya cargados`}
              {!excede && usadoSeg > 0 && ` · quedan ${mmss(restante - propio)}`}
            </div>
            {excede && (
              <div style={s.error}>
                Se pasa {mmss(estacion - BLOQUE_SEG)} del bloque. El box avanza a los{' '}
                {mmss(BLOQUE_SEG)} igual: el socio se va a mover antes de terminar.
              </div>
            )}
            {turnoDiscrepa && (
              <div style={s.aviso}>
                Ojo: el turno que viene corriendo la cola es de {mmss(turnoSeg)}, no {mmss(BLOQUE_SEG)}.
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
  barraUsado: { position: 'absolute', top: 0, bottom: 0, left: 0, background: '#C4BFB8' },
  barraPropio: { position: 'absolute', top: 0, bottom: 0 },
  medidorTexto: { lineHeight: 1.4 },
  error: { fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 },
  aviso: { fontSize: 12, color: '#92400E', lineHeight: 1.4 },
}
