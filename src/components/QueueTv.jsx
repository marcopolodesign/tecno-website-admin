import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { queueService, boxLabel } from '../services/queueService'
import { exerciseMedia } from '../lib/exerciseMedia'

// Drift-free countdown: derives remaining time from an absolute target
// timestamp every animation frame instead of a setInterval tick, and only
// setState's when the displayed integer second actually changes — immune to
// background-tab throttling drift on an always-on TV. Pattern ported from
// Lucas Barral's apps/box-display/src/lib/timer.ts + TimerCountdown.tsx.
function useCountdown(targetIso) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    targetIso ? Math.max(0, Math.ceil((new Date(targetIso).getTime() - Date.now()) / 1000)) : null
  )

  useEffect(() => {
    if (!targetIso) {
      setSecondsLeft(null)
      return
    }
    const targetMs = new Date(targetIso).getTime()
    let rafId
    const loop = () => {
      const remaining = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
      setSecondsLeft((prev) => (prev !== remaining ? remaining : prev))
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [targetIso])

  if (secondsLeft == null) return ''
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ExercisePanel({ exercise }) {
  if (!exercise) {
    return (
      <div style={panelStyles.empty}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Entrenando</span>
      </div>
    )
  }

  const ex = exercise
  // The TV gets the TV rendition and the TV framing. Anything the gym has not filmed yet
  // still falls back to whatever link the exercise was carrying.
  const media = exerciseMedia(ex, 'tv')

  return (
    <div style={panelStyles.wrapper}>
      <div style={panelStyles.media}>
        {media.kind === 'hosted' ? (
          // The poster covers the moment before the first frame decodes, so a box that
          // just changed exercise never shows black.
          <video
            src={media.src}
            poster={media.poster || undefined}
            autoPlay
            muted
            loop
            playsInline
            style={{ ...panelStyles.mediaEl, ...media.style }}
          />
        ) : media.kind === 'youtube' ? (
          <iframe
            src={`https://www.youtube.com/embed/${media.embedId}?autoplay=1&mute=1&loop=1&controls=0&playlist=${media.embedId}`}
            style={panelStyles.mediaEl}
            allow="autoplay; encrypted-media"
            title={ex?.name}
          />
        ) : media.kind === 'image' ? (
          <img src={media.src} alt={ex?.name} style={panelStyles.mediaEl} />
        ) : (
          <div style={{ ...panelStyles.mediaEl, background: 'rgba(255,255,255,0.06)' }} />
        )}
      </div>
      <span style={panelStyles.exerciseName}>{ex?.name ?? 'Ejercicio'}</span>
      <span style={panelStyles.exerciseMeta}>
        {[ex.sets_reps, ex.rest_time ? `descanso ${ex.rest_time}s` : null]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
  )
}

const panelStyles = {
  wrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 90 },
  media: {
    width: '100%',
    aspectRatio: '16 / 10',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
  },
  mediaEl: { width: '100%', height: '100%', objectFit: 'cover', border: 0 },
  exerciseName: { color: 'white', fontSize: 15, fontWeight: 700, textAlign: 'center' },
  exerciseMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
}

function BoxSlot({ box, lineNumber }) {
  const countdown = useCountdown(box.status === 'occupied' ? box.advances_at : null)
  const isOccupied = box.status === 'occupied'
  // The exercise arrives with the box in a single payload — no per-box fetch, so five
  // boxes changing at once is one request, not six.
  const exercise = box.ejercicio

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
        BOX {boxLabel(lineNumber, box.line_position)}
      </span>
      {isOccupied ? (
        <>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
            {box.socio ?? 'Ocupado'}
          </span>
          <span style={{ color: '#F45F37', fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>
            {countdown}
          </span>
          <ExercisePanel exercise={exercise} />
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
          <BoxSlot key={box.line_position} box={box} lineNumber={line?.line_number} />
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
