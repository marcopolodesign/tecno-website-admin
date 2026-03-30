import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '../lib/supabase'

const RESET_DELAY = 4000 // ms before returning to idle

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
  const scannerRef = useRef(null)
  const scannerDivId = 'checkin-qr-reader'
  const resetTimerRef = useRef(null)

  // state: 'idle' | 'granted' | 'denied'
  const [state, setState] = useState('idle')
  const [memberData, setMemberData] = useState(null)
  const [deniedReason, setDeniedReason] = useState('')
  const [progress, setProgress] = useState(100)

  const startScanner = () => {
    if (scannerRef.current) return
    const scanner = new Html5QrcodeScanner(
      scannerDivId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    )
    scanner.render(onScanSuccess, onScanError)
    scannerRef.current = scanner
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {})
      scannerRef.current = null
    }
  }

  const resetToIdle = () => {
    setState('idle')
    setMemberData(null)
    setDeniedReason('')
    setProgress(100)
    // give DOM a tick to re-render the div before reinitialising
    setTimeout(() => startScanner(), 50)
  }

  const startCountdown = () => {
    setProgress(100)
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / RESET_DELAY) * 100)
      setProgress(remaining)
      if (remaining > 0) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }

  const onScanSuccess = async (uuid) => {
    stopScanner()

    const today = new Date().toISOString().slice(0, 10)

    const { data: user, error } = await supabase
      .from('users')
      .select('first_name, last_name, membership_status, membership_end_date, membership_type')
      .eq('id', uuid)
      .single()

    if (error || !user) {
      setMemberData(null)
      setDeniedReason('Código no reconocido')
      setState('denied')
      playDenied()
    } else if (user.membership_status === 'active' && user.membership_end_date >= today) {
      setMemberData(user)
      setState('granted')
      playGranted()
    } else if (user.membership_status === 'cancelled') {
      setMemberData(user)
      setDeniedReason('Membresía cancelada')
      setState('denied')
      playDenied()
    } else {
      setMemberData(user)
      setDeniedReason('Membresía vencida')
      setState('denied')
      playDenied()
    }

    startCountdown()
    resetTimerRef.current = setTimeout(resetToIdle, RESET_DELAY)
  }

  const onScanError = () => {
    // suppress per-frame errors
  }

  useEffect(() => {
    startScanner()
    return () => {
      stopScanner()
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Granted ───────────────────────────────────────────

  if (state === 'granted') {
    return (
      <div style={overlay('#16a34a')}>
        <div style={styles.resultCard}>
          <div style={{ ...styles.iconCircle, background: 'rgba(255,255,255,0.25)' }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M16 40L32 56L64 24" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
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

  // ─── Denied ────────────────────────────────────────────

  if (state === 'denied') {
    return (
      <div style={overlay('#dc2626')}>
        <div style={styles.resultCard}>
          <div style={{ ...styles.iconCircle, background: 'rgba(255,255,255,0.25)' }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M24 24L56 56M56 24L24 56" stroke="white" strokeWidth="8" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={styles.resultTitle}>ACCESO DENEGADO</h1>
          {memberData ? (
            <p style={styles.memberName}>
              {memberData.first_name} {memberData.last_name}
            </p>
          ) : (
            <p style={styles.memberName}>Socio no encontrado</p>
          )}
          <p style={{ ...styles.detail, fontSize: 20, marginTop: 8 }}>{deniedReason}</p>
        </div>
        <ProgressBar progress={progress} color="rgba(255,255,255,0.5)" />
      </div>
    )
  }

  // ─── Idle / Scanning ───────────────────────────────────

  return (
    <div style={overlay('#111827')}>
      <div style={styles.idleContent}>
        <div style={styles.header}>
          <div style={styles.logo}>T</div>
          <h1 style={styles.headerTitle}>TecnoFit — Control de Acceso</h1>
        </div>
        <div style={styles.scannerContainer}>
          <div id={scannerDivId} style={styles.scannerDiv} />
        </div>
        <p style={styles.scanHint}>Apuntá la cámara al código QR del socio</p>
      </div>
    </div>
  )
}

function ProgressBar({ progress, color }) {
  return (
    <div style={styles.progressTrack}>
      <div
        style={{
          ...styles.progressBar,
          width: `${progress}%`,
          background: color,
        }}
      />
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
  // Idle
  idleContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    width: '100%',
    maxWidth: 480,
    padding: '0 24px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: '#F45F37',
    color: 'white',
    fontSize: 28,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    textAlign: 'center',
  },
  scannerContainer: {
    width: '100%',
    border: '3px solid #F45F37',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#1f2937',
  },
  scannerDiv: {
    width: '100%',
  },
  scanHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    textAlign: 'center',
    margin: 0,
  },
}
