import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { queueService, boxLabel } from '../services/queueService'
import { useCountdown, useBoxPhase, explicacionSegDeLinea, formatMMSS } from '../lib/tvClock'
import { ExercisePanel, ExplicacionPanel } from './tv/BoxPanels'

function BoxSlot({ box, line }) {
  const countdown = formatMMSS(useCountdown(box.status === 'occupied' ? box.advances_at : null))
  const isOccupied = box.status === 'occupied'
  // El exercise arrives with the box in a single payload — no per-box fetch, so five
  // boxes changing at once is one request, not six.
  const exercise = box.ejercicio
  const exercises = box.ejercicios?.length ? box.ejercicios : exercise ? [exercise] : []

  // Explicación (los primeros explicacion_seg del box) vs. estación (el resto, hasta
  // advances_at). `line?.explicacion_seg` todavía puede no venir en el payload de tv_linea —
  // useBoxPhase cae al default de la migración (60s) mientras tanto, ver tvClock.js.
  const phase = useBoxPhase(isOccupied ? box.entered_at : null, explicacionSegDeLinea(line))
  const enExplicacion = isOccupied && phase.fase === 'explicacion'

  return (
    <div
      style={{
        flex: 1,
        borderRadius: 20,
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isOccupied ? 'flex-start' : 'center',
        gap: 10,
        background: isOccupied ? 'rgba(244,95,55,0.15)' : 'rgba(255,255,255,0.04)',
        border: isOccupied ? '2px solid #F45F37' : '2px solid rgba(255,255,255,0.08)',
        minHeight: 340,
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>
        BOX {boxLabel(line?.line_number, box.line_position)}
      </span>
      {isOccupied ? (
        <>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
            {box.socio ?? 'Ocupado'}
          </span>
          <span style={{ color: '#F45F37', fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>
            {countdown}
          </span>
          {enExplicacion ? (
            <ExplicacionPanel exercises={exercises} restanteSeg={phase.restanteExplicacionSeg} />
          ) : (
            <ExercisePanel exercise={exercise} exercises={exercises} estacionInicioIso={phase.estacionInicioIso} />
          )}
        </>
      ) : (
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>Libre</span>
      )}
    </div>
  )
}

export default function QueueTv() {
  const { lineaId } = useParams()
  const [line, setLine] = useState(null)
  const [boxes, setBoxes] = useState([])
  const [confirming, setConfirming] = useState(null)
  const [connected, setConnected] = useState(true)
  const unsubRef = useRef(null)

  // One call for the whole screen. It is also the only way this page can read anything:
  // the TV route is public and every underlying table is behind "authenticated", so the
  // payload comes from a function that anon may call and the tables stay closed.
  //
  // tv_linea() ya manda explicacion_seg/estacion_seg/demo_estacion_seg/modo_demo dentro de
  // `linea` (actualizado 2026-09-23 en tecnofit-supabase). tvClock.js igual guarda los
  // defaults de la migración (60s/420s) como respaldo por si algún día se llama a esta
  // pantalla contra un ambiente con un tv_linea() más viejo.
  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('tv_linea', { p_line_id: Number(lineaId) })
      if (error) throw error
      setLine(data?.linea ?? null)
      setBoxes(data?.boxes ?? [])
      setConfirming(data?.confirmando ?? null)
      setConnected(true)
    } catch (err) {
      console.error('Error refreshing TV screen:', err)
      setConnected(false)
    }
  }, [lineaId])

  useEffect(() => {
    refresh()
    unsubRef.current = queueService.subscribeToLine(lineaId, refresh)

    // Reconnect overlay: if we haven't heard from Realtime/refresh in a while,
    // show a reconnecting state rather than silently going stale — mirrors
    // Lucas's box-display reconnect handling concept.
    const staleCheck = setInterval(() => {
      refresh()
    }, 15000)

    return () => {
      unsubRef.current?.()
      clearInterval(staleCheck)
    }
  }, [lineaId, refresh])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0b0d12',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        padding: 32,
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#F45F37',
            color: 'white',
            fontSize: 24,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          T
        </div>
        <h1 style={{ color: 'white', fontSize: 28, fontWeight: 700, margin: 0 }}>
          {line?.name ?? 'Línea'}
        </h1>
        {!connected && (
          <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 14 }}>Reconectando…</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        {boxes.map((box) => (
          <BoxSlot key={box.line_position} box={box} line={line} />
        ))}
        {boxes.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 'auto' }}>Sin boxes configurados</p>
        )}
      </div>

      {confirming && (
        <div
          style={{
            background: 'rgba(245,158,11,0.15)',
            border: '2px solid #f59e0b',
            borderRadius: 16,
            padding: '20px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>
            {confirming.socio ?? 'Socio'} — confirmá tu turno en la app
          </span>
        </div>
      )}
    </div>
  )
}
