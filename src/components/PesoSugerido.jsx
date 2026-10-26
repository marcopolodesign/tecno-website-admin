import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// What this member last lifted here.
//
// The weight field used to open empty every time, so the number was asked out loud at the box
// or guessed — which is how someone sits at the same weight for a month and nobody notices.
//
// Suggested, never filled in silently. A number that appears on its own gets accepted without
// being read, and the coach is the one who knows whether last week was a bad week. Clicking is
// cheap; a wrong weight that nobody chose is not.
//
// It says where the number came from, because a weight carried over from a sibling exercise is
// a worse guess than the member's own history on this one and should not be able to pass for it.

export default function PesoSugerido({ clientId, exerciseId, valorActual, onUsar }) {
  const [sug, setSug] = useState(null)

  useEffect(() => {
    if (!clientId || !exerciseId) {
      setSug(null)
      return
    }
    let vigente = true
    ;(async () => {
      const { data } = await supabase.rpc('peso_sugerido', {
        p_user_id: clientId,
        p_exercise_id: Number(exerciseId),
      })
      if (vigente) setSug(data?.[0] || null)
    })()
    return () => {
      vigente = false
    }
  }, [clientId, exerciseId])

  if (!sug?.kg) return null

  const yaPuesto = String(valorActual ?? '') === String(Number(sug.kg))
  const estancado = sug.veces_igual >= 3
  const dias = sug.ultima_fecha
    ? Math.max(0, Math.round((Date.now() - new Date(sug.ultima_fecha)) / 86400000))
    : null
  // es_real: exercise_logs.weight_used_kg, lo que el socio efectivamente levantó (cargado en
  // "Resultados reales"). Sin eso, sug.kg es session_exercises.weight_kg — el plan del coach,
  // nunca confirmado — y decir "levantó" ahí sería inventarlo.
  const esReal = Boolean(sug.es_real)

  const colorLinea = estancado ? s.lineaAtencion : esReal ? s.lineaReal : s.lineaPlan

  return (
    <div style={{ ...s.caja, ...(esReal ? s.cajaReal : s.cajaPlan), ...(estancado ? s.cajaAtencion : {}) }}>
      <div style={s.texto}>
        <span style={colorLinea}>
          {esReal ? 'Levantó' : 'Prescripto'} <strong>{Number(sug.kg)} kg</strong>
          {dias === 0 ? ' hoy' : dias === 1 ? ' ayer' : dias != null ? ` hace ${dias} días` : ''}
        </span>
        <span style={s.detalle}>
          {sug.origen === 'misma familia'
            ? `Tomado de "${sug.desde_ejercicio}", que es el mismo movimiento con otro implemento.`
            : estancado
              ? `Viene con el mismo peso hace ${sug.veces_igual} sesiones seguidas — puede estar para subir.`
              : esReal
                ? 'Cargado como resultado real en este mismo ejercicio.'
                : 'Prescripto en este mismo ejercicio — todavía sin resultado real cargado.'}
        </span>
      </div>
      {!yaPuesto && (
        <button type="button" onClick={() => onUsar(String(Number(sug.kg)))} style={s.boton}>
          Usar
        </button>
      )}
    </div>
  )
}

const s = {
  caja: {
    display: 'flex', alignItems: 'center', gap: 10, marginTop: 6,
    padding: '8px 10px', borderRadius: 10, border: '1px solid transparent',
  },
  // Verde = dato real, cargado en "Resultados reales". Gris = todavía es sólo el plan del
  // coach — la misma distinción que hace la frase de arriba, para que no haga falta leer el
  // texto para saber cuál es cuál de un vistazo.
  cajaReal: { background: '#F0FDF4', borderColor: '#BBF7D0' },
  cajaPlan: { background: '#F9FAFB', borderColor: '#E5E7EB' },
  cajaAtencion: { background: '#FFFBEB', borderColor: '#FDE68A' },
  texto: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  lineaReal: { fontSize: 13, color: '#166534' },
  lineaPlan: { fontSize: 13, color: '#4b5563' },
  lineaAtencion: { fontSize: 13, color: '#92400E' },
  detalle: { fontSize: 11, color: '#6b7280', lineHeight: 1.4 },
  boton: {
    border: '1px solid #e5e7eb', background: 'white', borderRadius: 8, padding: '6px 12px',
    fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
  },
}
