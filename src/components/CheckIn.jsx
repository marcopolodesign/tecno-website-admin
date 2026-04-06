import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabase'

const RESET_DELAY = 5000

function playGranted() {
  try {
    const ctx = new AudioContext()
    ;[880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.45)
      osc.start(ctx.currentTime + i * 0.18)
      osc.stop(ctx.currentTime + i * 0.18 + 0.45)
    })
  } catch {}
}

function playDenied() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.value = 220
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {}
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CheckIn() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [state, setState] = useState('idle') // 'idle' | 'granted' | 'denied'
  const [memberData, setMemberData] = useState(null)
  const [deniedReason, setDeniedReason] = useState('')
  const [progress, setProgress] = useState(100)

  const startCountdown = useCallback(() => {
    setProgress(100)
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / RESET_DELAY) * 100)
      setProgress(remaining)
      if (remaining > 0) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  const resetToIdle = useCallback(() => {
    setState('idle')
    setMemberData(null)
    setDeniedReason('')
    setProgress(100)
    setSessionId(crypto.randomUUID()) // new QR on each reset
  }, [])

  // Subscribe to realtime broadcast for this session
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const channel = supabase.channel(`checkin:${sessionId}`)

    channel.on('broadcast', { event: 'checkin' }, ({ payload }) => {
      const { membership_status, membership_end_date } = payload
      const today = new Date().toISOString().slice(0, 10)

      if (membership_status === 'active') {
        setMemberData(payload)
        setState('granted')
        playGranted()
      } else if (membership_status === 'cancelled') {
        setMemberData(payload)
        setDeniedReason('Membresía cancelada')
        setState('denied')
        playDenied()
      } else {
        setMemberData(payload)
        setDeniedReason('Membresía vencida')
        setState('denied')
        playDenied()
      }

      startCountdown()
      setTimeout(resetToIdle, RESET_DELAY)
    })

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [sessionId, startCountdown, resetToIdle])

  const qrUrl = `${window.location.origin}/acceso?session=${sessionId}`

  // ─── Granted ──────────────────────────────────────────────────────────────

  if (state === 'granted') {
    return (
      <div style={overlay('#16a34a')}>
        <div style={styles.resultCard}>
          <div style={{ ...styles.iconCircle, background: 'rgba(255,255,255,0.25)' }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M16 40L32 56L64 24" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={styles.resultTitle}>ACCESO PERMITIDO</h1>
          <p style={styles.memberName}>
            {memberData?.first_name} {memberData?.last_name}
          </p>
          {memberData?.membership_type && (
            <p style={styles.detail}>Plan: {memberData.membership_type}</p>
          )}
          {memberData?.membership_end_date && (
            <p style={styles.detail}>Vence: {formatDate(memberData.membership_end_date)}</p>
          )}
        </div>
        <ProgressBar progress={progress} color="rgba(255,255,255,0.5)" />
      </div>
    )
  }

  // ─── Denied ───────────────────────────────────────────────────────────────

  if (state === 'denied') {
    return (
      <div style={overlay('#dc2626')}>
        <div style={styles.resultCard}>
          <div style={{ ...styles.iconCircle, background: 'rgba(255,255,255,0.25)' }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M24 24L56 56M56 24L24 56" stroke="white" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 style={styles.resultTitle}>ACCESO DENEGADO</h1>
          {memberData ? (
            <p style={styles.memberName}>{memberData.first_name} {memberData.last_name}</p>
          ) : (
            <p style={styles.memberName}>Socio no encontrado</p>
          )}
          <p style={{ ...styles.detail, fontSize: 20, marginTop: 8 }}>{deniedReason}</p>
        </div>
        <ProgressBar progress={progress} color="rgba(255,255,255,0.5)" />
      </div>
    )
  }

  // ─── Idle: show QR ────────────────────────────────────────────────────────

  return (
    <div style={overlay('#111827')}>
      <div style={styles.idleContent}>
        <div style={styles.header}>
          <div style={styles.logo}>T</div>
          <h1 style={styles.headerTitle}>Escaneá para ingresar</h1>
        </div>
        <div style={styles.qrContainer}>
          <QRCodeSVG value={qrUrl} size={260} bgColor="#ffffff" fgColor="#111827" />
        </div>
        <p style={styles.scanHint}>Apuntá la cámara de tu celular al código</p>
      </div>
    </div>
  )
}

function ProgressBar({ progress, color }) {
  return (
    <div style={styles.progressTrack}>
      <div style={{ ...styles.progressBar, width: `${progress}%`, background: color }} />
    </div>
  )
}

const overlay = (bg) => ({
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: bg,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, sans-serif',
})

const styles = {
  resultCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '40px 32px',
    textAlign: 'center',
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    color: 'white',
    fontSize: 42,
    fontWeight: 800,
    letterSpacing: 2,
    margin: 0,
  },
  memberName: {
    color: 'white',
    fontSize: 28,
    fontWeight: 600,
    margin: 0,
  },
  detail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    margin: 0,
  },
  progressTrack: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    background: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.05s linear',
    borderRadius: 3,
  },
  idleContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 40,
    padding: '0 24px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: '#F45F37',
    color: 'white',
    fontSize: 32,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    textAlign: 'center',
  },
  qrContainer: {
    background: 'white',
    padding: 24,
    borderRadius: 20,
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
  },
  scanHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    textAlign: 'center',
    margin: 0,
  },
}
