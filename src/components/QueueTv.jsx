import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { queueService, boxLabel } from '../services/queueService'

function useCountdown(advancesAt) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!advancesAt) {
      setLabel('')
      return
    }
    const tick = () => {
      const ms = Math.max(0, new Date(advancesAt).getTime() - Date.now())
      const s = Math.floor(ms / 1000)
      setLabel(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [advancesAt])
  return label
}

function BoxSlot({ box, lineNumber }) {
  const countdown = useCountdown(box.status === 'occupied' ? box.advances_at : null)
  const isOccupied = box.status === 'occupied'

  return (
    <div
      style={{
        flex: 1,
        borderRadius: 20,
        padding: '28px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: isOccupied ? 'rgba(244,95,55,0.15)' : 'rgba(255,255,255,0.04)',
        border: isOccupied ? '2px solid #F45F37' : '2px solid rgba(255,255,255,0.08)',
        minHeight: 180,
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>
        BOX {boxLabel(lineNumber, box.boxes?.line_position)}
      </span>
      {isOccupied ? (
        <>
          <span style={{ color: 'white', fontSize: 22, fontWeight: 700, textAlign: 'center' }}>
            {box.users ? `${box.users.first_name} ${box.users.last_name?.[0] ?? ''}.` : 'Ocupado'}
          </span>
          <span style={{ color: '#F45F37', fontSize: 28, fontWeight: 800, fontFamily: 'monospace' }}>
            {countdown}
          </span>
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

  const refresh = useCallback(async () => {
    try {
      const [{ data: boxData }, { data: queueData }] = await Promise.all([
        queueService.getLineBoxStatus(lineaId),
        queueService.getQueueForLine(lineaId),
      ])
      setBoxes(boxData || [])
      setConfirming((queueData || []).find((q) => q.status === 'confirming') || null)
      setConnected(true)
    } catch (err) {
      console.error('Error refreshing TV screen:', err)
      setConnected(false)
    }
  }, [lineaId])

  useEffect(() => {
    supabase
      .from('production_lines')
      .select('id, name, line_number')
      .eq('id', lineaId)
      .single()
      .then(({ data }) => setLine(data))

    refresh()
    unsubRef.current = queueService.subscribeToLine(lineaId, refresh)

    // Reconnect overlay: if we haven't heard from Realtime/refresh in a while,
    // show a reconnecting state rather than silently going stale — mirrors
    // Luki's box-display reconnect handling concept.
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
          <BoxSlot key={box.id} box={box} lineNumber={line?.line_number} />
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
            {confirming.users ? `${confirming.users.first_name} ${confirming.users.last_name?.[0] ?? ''}.` : 'Socio'}{' '}
            — confirmá tu turno en la app
          </span>
        </div>
      )}
    </div>
  )
}
