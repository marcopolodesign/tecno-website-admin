import { FORMATOS, PRESETS, esPorTiempo, duracionSeg, mmss } from '../lib/formatos'

// How the work at this station is measured.
//
// The formats are presets, not a blank form: a coach saying "Tabata" means 8 × (20s, 10s), and
// asking them to type it is how one station ends up as 6 × 25/10 by accident. The numbers stay
// editable underneath, because a coach who wants 6 rounds should get 6 rounds.
//
// The total is always on screen. What decides whether a format belongs at a station is whether
// it fits the turn, and that is the one number a coach cannot read off rounds and seconds
// without stopping to multiply.

export default function SelectorFormato({ valor, onChange, turnoSeg }) {
  const { formato = 'Series', rondas, trabajoSeg, descansoSeg } = valor || {}
  const porTiempo = esPorTiempo(formato)
  const total = porTiempo ? duracionSeg({ rondas, trabajoSeg, descansoSeg }) : 0
  const noEntra = porTiempo && turnoSeg > 0 && total > turnoSeg

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
              <span style={s.etiqueta}>{formato === 'AMRAP' ? 'Tiempo total (seg)' : 'Trabajo (seg)'}</span>
              <input type="number" min="5" max="3600" value={trabajoSeg ?? ''} onChange={set('trabajoSeg')} style={s.input} />
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
                : 'Cada ronda: trabajo y después descanso.'}
          </span>

          <div style={{ ...s.total, ...(noEntra ? s.totalRoto : {}) }}>
            Dura <strong>{mmss(total)}</strong>
            {turnoSeg > 0 && ` · el turno en el box es de ${mmss(turnoSeg)}`}
            {noEntra && ' — no entra, el socio se va a mover de box antes de terminar.'}
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
  total: {
    padding: '8px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0',
    color: '#166534', fontSize: 13,
  },
  totalRoto: { background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' },
}
